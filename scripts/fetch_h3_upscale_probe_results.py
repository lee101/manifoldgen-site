#!/usr/bin/env python3
"""Wait for h3 upscale probe pod logs on R2, fetch them, then delete probe pods."""

from __future__ import annotations

import boto3
import gzip
import json
import os
import pathlib
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/upscale-results"
POD_PREFIX = "h3upscale-probe-"
PREFIX = "h3-upscale-probe/"
API = "https://rest.runpod.io/v1"
DEADLINE = time.time() + 110 * 60


def load_env() -> None:
    for line in open(ROOT / ".env"):
        line = line.strip()
        if line and "=" in line and not line.startswith("#"):
            key, value = line.split("=", 1)
            os.environ.setdefault(key, value.strip().strip('"'))


def s3_client():
    return boto3.client(
        "s3",
        endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["CLOUDFLARE_R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["CLOUDFLARE_R2_SECRET_ACCESS_KEY"],
        region_name="auto",
    )


def rest_call(path: str, method: str = "GET") -> object:
    request = urllib.request.Request(
        f"{API}{path}",
        method=method,
        headers={
            "Authorization": f"Bearer {os.environ['RUNPOD_API_KEY']}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        body = response.read()
    return json.loads(body) if body else None


def probe_pod_ids() -> list[str]:
    pods = rest_call("/pods")
    return [p["id"] for p in pods if str(p.get("name", "")).startswith(POD_PREFIX)]


def log_keys(client) -> dict[str, str]:
    keys: dict[str, str] = {}
    paginator = client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=os.environ["R2_BUCKET"], Prefix=PREFIX):
        for item in page.get("Contents", []):
            parts = item["Key"].split("/")
            if len(parts) == 3 and parts[2] == "log.txt.gz":
                keys[parts[1]] = item["Key"]
    return keys


def fetch_log(client, key: str, destination: pathlib.Path) -> None:
    url = client.generate_presigned_url(
        "get_object", Params={"Bucket": os.environ["R2_BUCKET"], "Key": key}, ExpiresIn=3600
    )
    with urllib.request.urlopen(url, timeout=120) as response:
        blob = response.read()
    destination.write_text(gzip.decompress(blob).decode("utf-8", "replace"))
    print(f"saved {destination} ({destination.stat().st_size} bytes)", flush=True)


def main() -> None:
    load_env()
    client = s3_client()
    OUT.mkdir(parents=True, exist_ok=True)
    fetched: set[str] = set()
    while time.time() < DEADLINE:
        found = log_keys(client)
        for slug_dir, key in sorted(found.items()):
            if slug_dir in fetched:
                continue
            fetch_log(client, key, OUT / f"probe-{slug_dir}.log")
            fetched.add(slug_dir)
        if fetched and not probe_pod_ids():
            break
        print(f"fetched={sorted(fetched)} pods={len(probe_pod_ids())}", flush=True)
        time.sleep(45)
    for pod_id in probe_pod_ids():
        try:
            rest_call(f"/pods/{pod_id}", "DELETE")
            print(f"deleted pod {pod_id}", flush=True)
        except Exception as error:
            print(f"delete {pod_id} failed: {error}", flush=True)
    print(json.dumps({"fetched": sorted(fetched)}), flush=True)


if __name__ == "__main__":
    main()
