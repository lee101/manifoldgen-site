#!/usr/bin/env -S uv run --script
# /// script
# dependencies = ["boto3", "requests"]
# ///
"""Drive a swap endpoint the way the server does: cut <=5 s clips, upload, submit batch jobs, follow the stream, download results.

  run_batch_endpoint.py ENDPOINT_ID --video source.mp4 --image swapped.png --clips 1 --mp 0.4 [--mode batch|single|legacy] [--workers 2] [--out DIR]

Reads RUNPOD_API_KEY and the R2 credentials (CLOUDFLARE_R2_*, R2_*) from the environment or from --env-file.
"""
import argparse, json, os, pathlib, subprocess, sys, tempfile, time, uuid

import boto3, requests

p = argparse.ArgumentParser()
p.add_argument("endpoint")
p.add_argument("--video", required=True)
p.add_argument("--image", required=True)
p.add_argument("--clips", type=int, default=1)
p.add_argument("--clip-seconds", type=float, default=5.0)
p.add_argument("--mp", type=float, default=0.4)
p.add_argument("--steps", type=int, default=20)
p.add_argument("--turbo", action="store_true")
p.add_argument("--mode", choices=["batch", "single", "legacy"], default="batch")
p.add_argument("--workers", type=int, default=1, help="number of batch jobs to split the clips over")
p.add_argument("--out", default="/tmp/swap-batch-out")
p.add_argument("--env-file", default="")
p.add_argument("--prompt", default="Replace every person in <Video 1> with the corresponding character in <Picture 1>, matching left to right. Keep each replacement character's identity, outfit, and look from <Picture 1>. Preserve the source video's camera, background, lighting, and objects. Match each person's position, scale, pose, and movement. Do not show the reference image or its background.")
a = p.parse_args()
if a.env_file:
    for line in pathlib.Path(a.env_file).read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k, v.strip().strip('"'))
KEY = os.environ.get("RUNPOD_API_KEY") or os.environ["H3_RUNPOD_API_KEY"]
H = {"Authorization": "Bearer " + KEY, "User-Agent": "curl/8.10"}
BASE = f"https://api.runpod.ai/v2/{a.endpoint}"
s3 = boto3.client("s3", endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com", aws_access_key_id=os.environ["CLOUDFLARE_R2_ACCESS_KEY_ID"],
                  aws_secret_access_key=os.environ["CLOUDFLARE_R2_SECRET_ACCESS_KEY"], region_name="auto")
BUCKET, PUBLIC = os.environ.get("R2_BUCKET", "manifoldgenstatic"), os.environ.get("R2_PUBLIC_HOST", "manifoldgenstatic.manifoldgen.com")
PREFIX = f"tmp/h3swap-test/{uuid.uuid4().hex[:8]}"
t0 = time.time()
log = lambda m: print(f"[{time.time() - t0:7.1f}s] {m}", flush=True)
keys = []


def put(path, name, ctype):
    key = f"{PREFIX}/{name}"
    s3.upload_file(str(path), BUCKET, key, ExtraArgs={"ContentType": ctype})
    keys.append(key)
    return f"https://{PUBLIC}/{key}"


def target(name):
    key = f"{PREFIX}/{name}"
    keys.append(key)
    return s3.generate_presigned_url("put_object", Params={"Bucket": BUCKET, "Key": key}, ExpiresIn=6 * 3600), f"https://{PUBLIC}/{key}"


work = pathlib.Path(tempfile.mkdtemp(prefix="swap-batch-"))
image_url = put(a.image, "ref" + pathlib.Path(a.image).suffix, "image/png")
clips = []
for i in range(a.clips):
    start = i * (a.clip_seconds - 0.25) if i else 0.0
    path = work / f"src-{i}.mp4"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", f"{start:.3f}", "-i", a.video, "-t", f"{a.clip_seconds + (0.25 if i else 0):.3f}", "-an",
                    "-vf", "fps=24,scale='min(1280,iw)':-2,format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", str(path)], check=True)
    up, pub = target(f"out-{i}.mp4")
    clips.append({"id": i, "video_url": put(path, f"src-{i}.mp4", "video/mp4"), "seed": 7 + i, "_output_upload_url": up, "_output_public_url": pub})
log(f"uploaded {len(clips)} clips")
shared = {"image_urls": [image_url], "prompt": a.prompt, "steps": 4 if a.turbo else a.steps, "megapixels": a.mp, "turbo": a.turbo}
if not a.turbo:
    shared["easycache"] = [0.12, 0.15, 0.9]
inputs = []
if a.mode == "batch":
    per = [clips[i::a.workers] for i in range(min(a.workers, len(clips)))]
    inputs = [{**shared, "task": "character_swap", "clips": group} for group in per]
else:
    for clip in clips:
        item = {**shared, "task": "character_swap", "video_url": clip["video_url"], "seed": clip["seed"], "_output_upload_url": clip["_output_upload_url"], "_output_public_url": clip["_output_public_url"]}
        inputs.append(item)
jobs = []
for item in inputs:
    r = requests.post(BASE + "/run", json={"input": item, "policy": {"executionTimeout": 3 * 3600 * 1000}}, headers=H, timeout=60)
    r.raise_for_status()
    jobs.append(r.json()["id"])
log(f"submitted {len(jobs)} job(s): {jobs}")
done, seen, last = {}, set(), None
while len(done) < len(jobs):
    for jid in jobs:
        if jid in done:
            continue
        st = requests.get(f"{BASE}/status/{jid}", headers=H, timeout=60).json()
        sr = requests.get(f"{BASE}/stream/{jid}", headers=H, timeout=60)
        for item in (sr.json().get("stream", []) if sr.ok else []):
            out = item.get("output", item)
            key = (jid, out.get("clip"))
            if key not in seen:
                seen.add(key)
                log(f"stream {jid[:8]} clip={out.get('clip')} error={out.get('error')} gen={out.get('metrics', {}).get('generation_seconds')} stages={out.get('metrics', {}).get('stage_seconds')}")
        if st["status"] in ("COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"):
            done[jid] = st
            log(f"{jid[:8]} {st['status']} delay={st.get('delayTime')}ms exec={st.get('executionTime')}ms err={st.get('error')}")
    h = requests.get(BASE + "/health", headers=H, timeout=30).json()
    brief = (h["workers"].get("idle", 0), h["workers"].get("initializing", 0), h["workers"].get("running", 0), h["workers"].get("throttled", 0), h["jobs"].get("inQueue"), h["jobs"].get("inProgress"))
    if brief != last:
        log(f"health idle/init/running/throttled={brief[:4]} queue={brief[4]} inprogress={brief[5]}")
        last = brief
    time.sleep(6)
out_dir = pathlib.Path(a.out)
out_dir.mkdir(parents=True, exist_ok=True)
results = []
for st in done.values():
    output = st.get("output")
    items = output if isinstance(output, list) else [output]
    for item in items:
        item = (item or {}).get("output", item) if isinstance(item, dict) else item
        if not item:
            continue
        results.append(item)
for item in results:
    metrics = item.get("metrics") or {}
    url = ((item.get("outputs") or [{}])[0]).get("url")
    log(f"result clip={item.get('clip')} gpu={metrics.get('gpu')} profile={metrics.get('profile')} path={metrics.get('profile_path')} gen={metrics.get('generation_seconds')} stages={metrics.get('stage_seconds')} boot={metrics.get('worker_boot_seconds')} err={item.get('error')}")
    if url:
        data = requests.get(url, timeout=120).content
        (out_dir / f"clip-{item.get('clip', 0)}.mp4").write_bytes(data)
log(f"saved {len(results)} result(s) to {out_dir}; cleanup: {len(keys)} objects under {PREFIX}")
if os.environ.get("KEEP_OBJECTS") != "1":
    for key in keys:
        s3.delete_object(Bucket=BUCKET, Key=key)
(out_dir / "summary.json").write_text(json.dumps([{**(r.get("metrics") or {}), "clip": r.get("clip")} for r in results], indent=1))
