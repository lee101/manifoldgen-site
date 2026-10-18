#!/usr/bin/env python3
"""Create or update the voice enhancer RunPod template + serverless endpoint.

  RUNPOD_API_KEY=... TG_API_KEY=... OPENPATHS_API_KEY=... \
    scripts/runpod_deploy.py --image ghcr.io/lee101/voice-enhancer:<tag> [--endpoint-id ID] [--workers-max 1]

Secrets are read from the environment (or the site .env) and never printed.
Workers default to zero: pass --workers-max explicitly to open the lane.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import urllib.error
import urllib.request

API = "https://rest.runpod.io/v1"
SITE_ENV = Path(__file__).resolve().parents[3] / ".env"
SECRET_KEYS = ("TG_API_KEY", "OPENPATHS_API_KEY")


def env() -> dict:
    values = dict(os.environ)
    if SITE_ENV.exists():
        for line in SITE_ENV.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                values.setdefault(k.strip(), v.strip())
    values.setdefault("RUNPOD_API_KEY", values.get("H3_RUNPOD_API_KEY", ""))
    return values


def call(method: str, path: str, key: str, body: dict | None = None) -> dict:
    req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": "Bearer " + key, "Content-Type": "application/json",
                                          "User-Agent": "manifoldgen-ops/1.0"})  # Cloudflare 1010s urllib's default UA
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            return json.loads(response.read() or b"{}")
    except urllib.error.HTTPError as error:
        raise SystemExit(f"{method} {path}: {error.code} {error.read()[:400]!r}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--image", required=True)
    ap.add_argument("--name", default="manifold-voice-enhancer")
    ap.add_argument("--endpoint-id", default="")
    ap.add_argument("--gpu", action="append", default=None, help="GPU type id (repeatable)")
    ap.add_argument("--workers-max", type=int, default=0)
    ap.add_argument("--idle", type=int, default=20)
    ap.add_argument("--disk-gb", type=int, default=60)
    ap.add_argument("--registry-auth-id", default="cmsi7jlxe006trzd95954dxpd", help="GHCR auth shared with the YuE lane")
    args = ap.parse_args()
    values = env()
    key = values["RUNPOD_API_KEY"]
    missing = [k for k in SECRET_KEYS if not values.get(k)]
    if missing:
        raise SystemExit(f"missing {missing}")
    template = {
        "name": f"{args.name}-tpl-{args.image.rsplit(':', 1)[-1]}", "imageName": args.image, "isServerless": True,
        "containerDiskInGb": args.disk_gb, "containerRegistryAuthId": args.registry_auth_id,
        "dockerStartCmd": ["python", "-u", "/src/ve/handler.py"],
        "env": {**{k: values[k] for k in SECRET_KEYS},
                "OPENPATHS_BASE_URL": values.get("OPENPATHS_BASE_URL", "https://openpaths.io"),
                "PYTORCH_CUDA_ALLOC_CONF": "expandable_segments:True"},
    }
    created = call("POST", "/templates", key, template)
    endpoint = {
        "name": args.name, "templateId": created["id"], "gpuTypeIds": args.gpu or ["NVIDIA GeForce RTX 4090"],
        "gpuCount": 1, "workersMin": 0, "workersMax": args.workers_max, "idleTimeout": args.idle,
        "executionTimeoutMs": 40 * 60 * 1000, "flashboot": True, "scalerType": "REQUEST_COUNT", "scalerValue": 1,
        "allowedCudaVersions": ["12.8", "12.9", "13.0"],
    }
    if args.endpoint_id:
        result = call("PATCH", f"/endpoints/{args.endpoint_id}", key, endpoint)
    else:
        result = call("POST", "/endpoints", key, endpoint)
    print(json.dumps({"template_id": created["id"], "endpoint_id": result.get("id"), "name": result.get("name"),
                      "gpu": endpoint["gpuTypeIds"], "workers_max": endpoint["workersMax"]}))


if __name__ == "__main__":
    main()
