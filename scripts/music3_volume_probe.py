#!/usr/bin/env python3
"""Ship the Music3 worker's boot logs off the RunPod network volume via R2."""

import json, os, pathlib, sys, time, urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import music3_bench as bench

ROOT = pathlib.Path(__file__).resolve().parents[1]
API = "https://rest.runpod.io/v1"


def call(path, method="GET", payload=None):
    key = os.environ["RUNPOD_API_KEY"]
    data = json.dumps(payload).encode() if payload is not None else None
    request = urllib.request.Request(
        f"{API}{path}", data=data, method=method,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        body = response.read()
    return json.loads(body) if body else {}


def main():
    bench.load_env(ROOT / ".env")
    bench.load_env(pathlib.Path("/vfast/data/code/omniserve-native/.runpod-music3.env"))
    stamp = int(time.time())
    upload_url, public_url, fetch_url = bench.presign(f"createdmusic/probe-{stamp}.txt")
    script = (
        "set -x; "
        "{ df -h /workspace; ls -la /workspace /workspace/models "
        "/workspace/models/minimax-music3 /workspace/omniserve/music3; "
        "du -sh /workspace/models/minimax-music3 2>/dev/null; "
        "echo '=== bootstrap.log ==='; tail -c 200000 /workspace/omniserve/music3/bootstrap.log; "
        "echo '=== server.log ==='; tail -c 200000 /workspace/omniserve/music3/server.log; } "
        f"> /tmp/probe.txt 2>&1; curl -sS -X PUT -H 'Content-Type: audio/wav' --data-binary @/tmp/probe.txt '{upload_url}'; sleep 30"
    )
    pod = call("/pods", "POST", {
        "name": f"music3-probe-{stamp}",
        "imageName": "runpod/base:0.6.2-cuda12.4.1",
        "gpuTypeIds": ["NVIDIA RTX PRO 6000 Blackwell Server Edition", "NVIDIA H200", "NVIDIA H100 80GB HBM3", "NVIDIA A40"],
        "gpuCount": 1,
        "cloudType": "SECURE",
        "networkVolumeId": os.environ["MUSIC3_RUNPOD_NETWORK_VOLUME_ID"],
        "dataCenterIds": [os.environ["MUSIC3_RUNPOD_DATACENTER_ID"]],
        "containerDiskInGb": 10,
        "dockerEntrypoint": ["bash", "-lc", script],
        "dockerStartCmd": [],
        "ports": [],
    })
    pod_id = pod.get("id")
    print("pod", pod_id, flush=True)
    try:
        for attempt in range(60):
            time.sleep(10)
            try:
                with urllib.request.urlopen(fetch_url, timeout=60) as response:
                    text = response.read().decode("utf-8", "replace")
                out = ROOT / "createdmusic" / f"probe-{stamp}.txt"
                out.write_text(text)
                print("saved", out, len(text))
                return
            except Exception as error:
                print(f"waiting {attempt}: {error}", flush=True)
        print("probe output never appeared")
    finally:
        if pod_id:
            call(f"/pods/{pod_id}", "DELETE")
            print("terminated", pod_id)


if __name__ == "__main__":
    main()
