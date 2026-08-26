#!/usr/bin/env python3
"""Run base / latent-2x / twopass H3 upscale variants on a scratch RunPod pod.

Mirrors scripts/music3_volume_probe.py: launch one SECURE pod per GPU type with
the production H3 image, run the real runtime path (balanced profile, ck
attention, face gate + face-refine second pass), upload the log and middle
frames to presigned R2 PUTs, then delete the pod.

Usage:
    python3 scripts/h3_upscale_gpu_probe.py --gpu "NVIDIA A40" --gpu "NVIDIA L40S"
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import pathlib
import sys
import time
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import music3_bench as bench

ROOT = pathlib.Path(__file__).resolve().parents[1]
API = "https://rest.runpod.io/v1"
H3_CONFIG = json.loads((ROOT / "config/runpod-h3.json").read_text())
DEFAULT_IMAGE = H3_CONFIG["image"]
POLL_SECONDS = 20
MAX_WAIT_SECONDS = 105 * 60


def call(path: str, method: str = "GET", payload: dict | None = None) -> dict:
    key = os.environ.get("RUNPOD_API_KEY") or os.environ["H3_RUNPOD_API_KEY"]
    data = json.dumps(payload).encode() if payload is not None else None
    request = urllib.request.Request(
        f"{API}{path}",
        data=data,
        method=method,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        body = response.read()
    return json.loads(body) if body else {}


def registry_auth_id(config: dict) -> str:
    """Reuse the production template's private-registry credential.

    RunPod scratch Pods do not inherit registry auth from a Serverless
    template. Looking up the credential by ID avoids copying registry secrets
    into this script or the Pod environment.
    """
    override = os.environ.get("H3_RUNPOD_REGISTRY_AUTH_ID", "").strip()
    if override:
        return override
    endpoints = config.get("endpoints") or []
    if not endpoints or not endpoints[0].get("templateId"):
        raise RuntimeError("H3 config has no production template to source registry auth")
    template = call(f"/templates/{endpoints[0]['templateId']}")
    auth_id = str(template.get("containerRegistryAuthId") or "").strip()
    if not auth_id:
        raise RuntimeError(
            "production H3 template has no containerRegistryAuthId; refusing to launch a private image"
        )
    return auth_id


def presign_put(client, bucket: str, key: str) -> str:
    # No ContentType param: signature must not constrain the curl upload header.
    return client.generate_presigned_url("put_object", Params={"Bucket": bucket, "Key": key}, ExpiresIn=10800)


def presign_get(client, bucket: str, key: str) -> str:
    return client.generate_presigned_url("get_object", Params={"Bucket": bucket, "Key": key}, ExpiresIn=10800)


def presign_pair(key: str) -> tuple[str, str]:
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
    return presign_put(client, os.environ["R2_BUCKET"], key), presign_get(client, os.environ["R2_BUCKET"], key)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--gpu",
        dest="gpus", action="append",
        required=True,
        help="RunPod GPU type id, e.g. 'NVIDIA A40' (repeatable)",
    )
    parser.add_argument("--image", default=DEFAULT_IMAGE)
    parser.add_argument("--seed", type=int, default=1234)
    parser.add_argument(
        "--prompt",
        default=(
            "Close-up portrait of a weathered old fisherman with deep wrinkles "
            "and a grey beard, looking directly at the camera, gentle ocean "
            "breeze, golden hour light, he speaks warmly about the sea"
        ),
    )
    parser.add_argument(
        "--out-dir",
        default=str(ROOT / "docs/upscale-results"),
        help="where fetched logs land",
    )
    args = parser.parse_args()

    bench.load_env(ROOT / ".env")
    registry_auth = registry_auth_id(H3_CONFIG)

    here = pathlib.Path(__file__).resolve().parent
    inner_source = (here / "h3_upscale_probe_inner.py").read_text()
    inner_b64 = base64.b64encode(inner_source.encode()).decode()

    out_dir = pathlib.Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    failures = []
    for gpu_index, gpu in enumerate(args.gpus):
        stamp = int(time.time())
        slug = gpu.lower().replace(" ", "-")
        log_key = f"h3-upscale-probe/{stamp}/{slug}/log.txt.gz"
        log_put, log_fetch = presign_pair(log_key)
        frame_urls = {}
        for variant in ("base", "latent", "twopass"):
            key = f"h3-upscale-probe/{stamp}/{slug}/{variant}.png"
            frame_urls[variant] = presign_pair(key)

        uploader = "\n".join(
            [
                "import os, sys, urllib.request",
                "targets = [('log', sys.argv[1], os.environ['PROBE_LOG_URL'])]",
                "for variant in ('base', 'latent', 'twopass'):",
                "    path = f'/tmp/out/{variant}.png'",
                "    url = os.environ.get(f'PROBE_FRAME_URL_{variant.upper()}')",
                "    if url:",
                "        targets.append((variant, path, url))",
                "for name, path, url in targets:",
                "    try:",
                "        with open(path, 'rb') as handle:",
                "            data = handle.read()",
                "        status = urllib.request.urlopen(",
                "            urllib.request.Request(url, data=data, method='PUT'), timeout=180",
                "        ).status",
                "        print('uploaded', name, status, flush=True)",
                "    except Exception as error:",
                "        print('upload failed', name, error, flush=True)",
            ]
        )
        uploader_b64 = base64.b64encode(uploader.encode()).decode()
        bootstrap = (
            "set -x; "
            "mkdir -p /weights /tmp/out; "
            f"echo {inner_b64} | base64 -d > /tmp/probe_inner.py; "
            f"echo {uploader_b64} | base64 -d > /tmp/upload_results.py; "
            "{ id; nvidia-smi; which python python3; free -m; df -h / /weights; } > /tmp/probe.log 2>&1; "
            "python -u /tmp/probe_inner.py >> /tmp/probe.log 2>&1 "
            "|| python3 -u /tmp/probe_inner.py >> /tmp/probe.log 2>&1; "
            "echo EXIT:$? >> /tmp/probe.log; "
            "gzip -kf /tmp/probe.log; "
            "python /tmp/upload_results.py /tmp/probe.log.gz "
            "|| python3 /tmp/upload_results.py /tmp/probe.log.gz"
        )

        print(f"[{gpu}] launching pod image={args.image}", flush=True)
        pod = call(
            "/pods",
            "POST",
            {
                "name": f"h3upscale-probe-{slug}-{stamp}",
                "imageName": args.image,
                "containerRegistryAuthId": registry_auth,
                "gpuTypeIds": [gpu],
                "gpuCount": 1,
                "cloudType": "SECURE",
                "containerDiskInGb": 220,
                "dockerEntrypoint": ["bash", "-lc", bootstrap],
                "dockerStartCmd": [],
                "ports": [],
                "env": {
                    "PROBE_PROMPT": args.prompt,
                    "PROBE_SEED": str(args.seed),
                    "PROBE_LOG_URL": log_put,
                    **{
                        f"PROBE_FRAME_URL_{variant.upper()}": put
                        for variant, (put, _fetch) in frame_urls.items()
                    },
                },
            },
        )
        pod_id = pod.get("id")
        print(f"[{gpu}] pod {pod_id}", flush=True)
        destination = out_dir / f"probe-{slug}-{stamp}.log.gz"
        ok = False
        try:
            deadline = time.time() + MAX_WAIT_SECONDS
            while time.time() < deadline:
                time.sleep(POLL_SECONDS)
                try:
                    with urllib.request.urlopen(log_fetch, timeout=60) as response:
                        blob = response.read()
                    if blob:
                        destination.write_bytes(blob)
                        print(f"[{gpu}] saved {destination} ({len(blob)} bytes)", flush=True)
                        ok = True
                        break
                except Exception as error:
                    print(f"[{gpu}] waiting: {error}", flush=True)
            if not ok:
                print(f"[{gpu}] timed out after {MAX_WAIT_SECONDS}s", flush=True)
                failures.append(gpu)
        finally:
            if pod_id:
                call(f"/pods/{pod_id}", "DELETE")
                print(f"[{gpu}] terminated {pod_id}", flush=True)

    for slug_file in sorted(out_dir.glob("probe-*.log.gz")):
        print(f"log: {slug_file}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
