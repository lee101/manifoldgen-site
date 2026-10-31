"""Batch Conjurer's Soul 2 clips through our Pika H3 Flex RunPod endpoint (cheapest lane, ~$4/h serverless GPU).

  uv run tools/flex.py [--only 1,5,18] [--size native|hd] [--seed N] [--workers 3] [--go]

Dry run by default. Wakes the endpoint (workersMax N), submits every job at once so workers batch them, downloads
clips/NN.mp4 straight from R2, ALWAYS drops workersMax back to 0 afterwards, and prints metered cost.
"""
import argparse, importlib.util, urllib.error, json, math, os, sys, time, urllib.parse, urllib.request, uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT.parent
EP = "r2w5aaxyz1bx08"  # cog-manifold-h3-flex
RATE_PER_H = 4.00      # serverless RTX PRO 6000 flex price used in the bench
spec = importlib.util.spec_from_file_location("canary", SITE / "scripts/runpod-h3-direct-canary.py")
canary = importlib.util.module_from_spec(spec); spec.loader.exec_module(canary)

for line in (SITE / ".env").read_text().splitlines():
    if "=" in line and not line.lstrip().startswith("#"):
        k, v = line.split("=", 1); os.environ.setdefault(k.strip(), v.strip().strip('"'))

ap = argparse.ArgumentParser()
ap.add_argument("--only", default=""); ap.add_argument("--size", default="native"); ap.add_argument("--seed", type=int, default=20261031)
ap.add_argument("--workers", type=int, default=3); ap.add_argument("--go", action="store_true"); ap.add_argument("--outdir", default="clips")
a = ap.parse_args()
only = {int(x) for x in a.only.split(",") if x}
prompts = [p for p in json.loads((ROOT / "out/prompts.json").read_text()) if not only or p["id"] in only]
# measured warm: 55 s per 5 s clip at native, 150 s at hd; time grows ~ (d/5)^1.35
base = 55 if a.size == "native" else 150
est = sum(base * (p["duration"] / 5) ** 1.35 for p in prompts)
print(f"{len(prompts)} clips, {a.size}, est {est/60:.0f} GPU-min = ${est/3600*RATE_PER_H:.2f}")
if not a.go:
    sys.exit("dry run; add --go")

key = canary.required("RUNPOD_API_KEY"); rj = canary.request_json
ctl, base_url = f"https://rest.runpod.io/v1/endpoints/{EP}", f"https://api.runpod.ai/v2/{EP}"
REST = 0  # the endpoint rests at 0; never restore a previous value (a crashed run once left it at 3)
out = ROOT / "out" / a.outdir; out.mkdir(parents=True, exist_ok=True)
jobs, spent = {}, 0.0
try:
    rj(ctl, key, {"workersMax": a.workers, "workersMin": 0, "scalerType": "REQUEST_COUNT", "scalerValue": 1}, method="PATCH")
    for p in prompts:
        objkey = f"{os.environ.get('R2_PATH_PREFIX', 'gallery').strip('/')}/tests/conjurer2/{uuid.uuid4()}.mp4"
        pub = f"https://{canary.required('R2_PUBLIC_HOST')}/{objkey}"
        inp = {"prompt": p["prompt"], "aspect_ratio": "16:9", "size": a.size, "duration": float(p["duration"]), "steps": 6,
               "seed": a.seed + p["id"], "structured_prompt": True, "include_audio": True, "output_codec": "mp4-h264", "encode_quality": 20,
               "_output_upload_url": canary.presign_put(objkey), "_output_public_url": pub}
        still = ROOT / "out/stills" / f"{p['id']:02d}.png"
        if still.exists():
            inp["first_frame"] = "data:image/png;base64," + __import__("base64").b64encode(still.read_bytes()).decode()
        for attempt in range(7):
            try:
                budget_ms = int((240 + 3 * base * (p["duration"] / 5) ** 1.35) * 1000)  # cold boot + 3x predicted, same rule as server/runpod_policy.go
                body = {"input": inp, "policy": {"executionTimeout": budget_ms, "ttl": budget_ms + 1800000}}
                jobs[p["id"]] = (rj(f"{base_url}/run", key, body)["id"], pub); break
            except urllib.error.HTTPError as e:
                if e.code != 409 or attempt == 6: raise
                rj(ctl, key, {"workersMax": a.workers}, method="PATCH"); time.sleep(5)
        print(f"submitted {p['id']:02d} ({p['duration']}s)", flush=True)
        (out / "jobs.json").write_text(json.dumps({str(k): v for k, v in jobs.items()}))
    while jobs:
        time.sleep(15)
        for i, (jid, pub) in list(jobs.items()):
            st = rj(f"{base_url}/status/{urllib.parse.quote(jid, safe='')}", key)
            if st.get("status") in ("COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"):
                ms = st.get("executionTime") or 0; spent += ms / 3.6e6 * RATE_PER_H
                if st["status"] == "COMPLETED":
                    art = ((st.get("output") or {}).get("outputs") or [{}])[0]
                    url = art.get("url") or pub
                    try:
                        req = urllib.request.Request(url, headers={"User-Agent": "curl/8.10"})
                        (out / f"{i:02d}.mp4").write_bytes(urllib.request.urlopen(req, timeout=300).read())
                    except Exception as e:
                        print(f"DOWNLOAD FAILED {i:02d} {url} {e}; output={json.dumps(st.get('output'))[:300]}", flush=True)
                print(f"{st['status']} {i:02d} exec {ms/1000:.0f}s delay {(st.get('delayTime') or 0)/1000:.0f}s  total ${spent:.2f}", flush=True)
                del jobs[i]
except BaseException:
    for i, (jid, _) in jobs.items():  # never orphan paid jobs
        try: rj(f"{base_url}/cancel/{urllib.parse.quote(jid, safe='')}", key, {}, method="POST"); print(f"cancelled {i:02d}")
        except Exception as e: print("cancel failed", i, e)
    raise
finally:
    h = rj(f"{base_url}/health", key).get("jobs") or {}
    if int(h.get("inProgress") or 0) + int(h.get("inQueue") or 0) == 0:
        rj(ctl, key, {"workersMin": 0, "workersMax": REST}, method="PATCH"); print(f"endpoint workersMax back to {REST}")
    else:
        print("WARNING: jobs still active; endpoint left up, reset workersMax manually")
print(f"metered execution cost ${spent:.2f} (cold-start delay is extra but small)")
