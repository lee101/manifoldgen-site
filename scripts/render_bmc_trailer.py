#!/usr/bin/env python3
"""Render the Big Multiplayer Chess storyboard through the site's H3 RunPod endpoint."""
from __future__ import annotations
import concurrent.futures, importlib.util, json, os, pathlib, subprocess, sys, time, urllib.parse, urllib.request, uuid

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "testreview/bigmultiplayerchess"

def load_env(path: pathlib.Path):
    if not path.exists(): return
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line: continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key, value.strip().strip('"').strip("'"))

load_env(ROOT / ".env")
spec = importlib.util.spec_from_file_location("h3canary", ROOT / "scripts/runpod-h3-direct-canary.py")
h3 = importlib.util.module_from_spec(spec); spec.loader.exec_module(h3)

def submit(item: dict, index: int) -> dict:
    endpoint = os.environ.get("H3_NORMAL_RUNPOD_ENDPOINT") or json.loads((ROOT / "config/runpod-h3.json").read_text())["endpoints"][0]["id"]
    api_key = os.environ.get("H3_RUNPOD_API_KEY") or os.environ["RUNPOD_API_KEY"]
    prefix = os.environ.get("R2_PATH_PREFIX", "gallery").strip("/")
    object_key = f"{prefix}/testreview/bigmultiplayerchess/{item['name']}-{uuid.uuid4()}.mp4"
    public_url = f"https://{os.environ['R2_PUBLIC_HOST']}/{object_key}"
    payload = {"input": {
        "prompt": item["prompt"], "aspect_ratio": "16:9", "size": "native", "duration": 5,
        "steps": 20, "seed": 2026082300 + index, "structured_prompt": True, "include_audio": True,
        "output_codec": "mp4-h264", "encode_quality": 20,
        "_output_upload_url": h3.presign_put(object_key, 7200), "_output_public_url": public_url,
    }}
    base = f"https://api.runpod.ai/v2/{endpoint}"
    control = f"https://rest.runpod.io/v1/endpoints/{endpoint}"
    try: h3.request_json(control, api_key, {"workersMax": 3, "workersMin": 0, "scalerType": "REQUEST_COUNT", "scalerValue": 1}, method="PATCH")
    except Exception: pass
    queued = h3.request_json(base + "/run", api_key, payload)
    job_id = queued["id"]; print(f"queued {item['name']} {job_id}", flush=True)
    deadline = time.monotonic() + 3600
    while True:
        state = h3.request_json(base + "/status/" + urllib.parse.quote(job_id, safe=""), api_key)
        if state.get("status") in {"COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"}: break
        if time.monotonic() > deadline: raise TimeoutError(item["name"])
        time.sleep(8)
    if state.get("status") != "COMPLETED": raise RuntimeError(f"{item['name']}: {state.get('error') or state.get('status')}")
    artifact = ((state.get("output") or {}).get("outputs") or [{}])[0]
    url = artifact.get("url") or public_url
    target = OUT / f"{item['name']}.mp4"
    # Cloudflare occasionally rejects Python's default urllib user-agent even
    # though the freshly published R2 object is healthy. curl is also what the
    # production deploy checks use, and gives us bounded retries.
    subprocess.run(["curl", "-fsSL", "--retry", "5", "--retry-all-errors", url, "-o", str(target)], check=True)
    print(f"ready {target.name} {target.stat().st_size} bytes", flush=True)
    return {"name": item["name"], "job_id": job_id, "url": url, "file": str(target.relative_to(ROOT)), "metrics": (state.get("output") or {}).get("metrics", {})}

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    shots = json.loads((OUT / "storyboard.json").read_text())
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        futures = [pool.submit(submit, item, i + 1) for i, item in enumerate(shots)]
        for future in concurrent.futures.as_completed(futures): results.append(future.result())
    results.sort(key=lambda row: row["name"])
    (OUT / "render-manifest.json").write_text(json.dumps(results, indent=2))
    print("all H3 shots ready", flush=True)

if __name__ == "__main__": main()
