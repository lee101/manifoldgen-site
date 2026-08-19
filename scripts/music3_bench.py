#!/usr/bin/env python3
"""Submit MiniMax-Music3 jobs to the production RunPod endpoint and save results."""

import argparse, base64, json, os, pathlib, subprocess, sys, time, urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "createdmusic"


def load_env(path):
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"'))


def presign(key):
    import boto3
    from botocore.config import Config

    account = os.environ["R2_ACCOUNT_ID"]
    client = boto3.client(
        "s3",
        endpoint_url=f"https://{account}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["CLOUDFLARE_R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["CLOUDFLARE_R2_SECRET_ACCESS_KEY"],
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )
    bucket = os.environ["R2_BUCKET"]
    url = client.generate_presigned_url(
        "put_object",
        Params={"Bucket": bucket, "Key": key, "ContentType": "audio/wav"},
        ExpiresIn=7200,
    )
    # The public host only serves the site's own prefixes, so results come back
    # through a presigned GET rather than the public URL.
    fetch = client.generate_presigned_url(
        "get_object", Params={"Bucket": bucket, "Key": key}, ExpiresIn=7200
    )
    return url, f"https://{os.environ['R2_PUBLIC_HOST']}/{key}", fetch


def api(endpoint, path, method="POST", payload=None):
    key = os.environ.get("RUNPOD_API_KEY") or os.environ["H3_RUNPOD_API_KEY"]
    data = json.dumps(payload).encode() if payload is not None else None
    request = urllib.request.Request(
        f"https://api.runpod.ai/v2/{endpoint}{path}",
        data=data,
        method=method,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        return json.loads(response.read())


def run(name, endpoint, body, poll=10, deadline=3600):
    submitted = time.time()
    queued = api(endpoint, "/run", payload={"input": body})
    job_id = queued["id"]
    print(f"[{name}] queued {job_id}", flush=True)
    while time.time() - submitted < deadline:
        time.sleep(poll)
        state = api(endpoint, f"/status/{job_id}", method="GET")
        status = state.get("status")
        if status in ("COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"):
            state["_wall_seconds"] = round(time.time() - submitted, 2)
            print(f"[{name}] {status} in {state['_wall_seconds']}s", flush=True)
            return state
        print(f"[{name}] {status} {round(time.time() - submitted)}s", flush=True)
    raise TimeoutError(f"{name} timed out")


def save(name, state, fetch_url):
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{name}.json").write_text(json.dumps(state, indent=2))
    wav = OUT / f"{name}.wav"
    output = state.get("output") or {}
    if output.get("outputs"):
        wav.write_bytes(base64.b64decode(output["outputs"][0]["data"]))
    elif fetch_url:
        url = fetch_url
        for attempt in range(10):
            try:
                with urllib.request.urlopen(url, timeout=300) as response:
                    wav.write_bytes(response.read())
                break
            except Exception as error:  # R2 propagation
                if attempt == 9:
                    raise
                print(f"[{name}] download retry {attempt}: {error}", flush=True)
                time.sleep(5)
    else:
        raise RuntimeError("no audio in output")
    opus = OUT / f"{name}.opus"
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-c:a", "libopus", "-b:a", "128k", str(opus)],
        check=True,
    )
    print(f"[{name}] wav={wav.stat().st_size} opus={opus.stat().st_size}", flush=True)
    return opus


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--name", required=True)
    parser.add_argument("--lyrics-file", required=True)
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--duration", type=int, default=180)
    parser.add_argument("--seed", type=int, default=20260818)
    parser.add_argument("--endpoint", default=None)
    parser.add_argument("--extra", default="{}")
    args = parser.parse_args()

    load_env(ROOT / ".env")
    load_env(pathlib.Path("/vfast/data/code/omniserve-native/.runpod-music3.env"))
    endpoint = args.endpoint or os.environ["MUSIC3_RUNPOD_ENDPOINT_ID"]

    upload_url, public_url, fetch_url = presign(f"createdmusic/{args.name}-{int(time.time())}.wav")
    body = {
        "workload": "minimax-music3",
        "prompt": args.prompt,
        "lyrics": pathlib.Path(args.lyrics_file).read_text().strip(),
        "duration_seconds": args.duration,
        "seed": args.seed,
        "output_upload_url": upload_url,
        "output_public_url": public_url,
    }
    body.update(json.loads(args.extra))
    state = run(args.name, endpoint, body)
    if state.get("status") != "COMPLETED":
        print(json.dumps(state, indent=2)[:4000])
        sys.exit(1)
    save(args.name, state, fetch_url)
    metrics = (state.get("output") or {}).get("metrics") or {}
    print(json.dumps({k: metrics[k] for k in sorted(metrics) if k != "sha256"}, indent=2))


if __name__ == "__main__":
    main()
