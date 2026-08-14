#!/usr/bin/env python3
"""Run one H3 canary through RunPod's direct-to-R2 output transport."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import hmac
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def required(*names: str) -> str:
    for name in names:
        if value := os.environ.get(name):
            return value
    raise RuntimeError(f"required environment variable is missing: {' or '.join(names)}")


def hmac_sha256(key: bytes, value: str) -> bytes:
    return hmac.new(key, value.encode(), hashlib.sha256).digest()


def canonical_query(values: dict[str, str]) -> str:
    quote = lambda value: urllib.parse.quote(value, safe="-_.~")
    return "&".join(f"{quote(key)}={quote(values[key])}" for key in sorted(values))


def presign_put(key: str, expires: int = 7200) -> str:
    account = required("R2_ACCOUNT_ID")
    bucket = required("R2_BUCKET")
    access = required("R2_ACCESS_KEY_ID", "CLOUDFLARE_R2_ACCESS_KEY_ID")
    secret = required("R2_SECRET_ACCESS_KEY", "CLOUDFLARE_R2_SECRET_ACCESS_KEY")
    host = f"{account}.r2.cloudflarestorage.com"
    now = dt.datetime.now(dt.timezone.utc)
    date_stamp = now.strftime("%Y%m%d")
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    scope = f"{date_stamp}/auto/s3/aws4_request"
    query = {
        "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
        "X-Amz-Credential": f"{access}/{scope}",
        "X-Amz-Date": amz_date,
        "X-Amz-Expires": str(expires),
        "X-Amz-SignedHeaders": "host",
    }
    escaped_path = "/".join(urllib.parse.quote(part, safe="-_.~") for part in key.split("/"))
    uri = f"/{urllib.parse.quote(bucket, safe='-_.~')}/{escaped_path}"
    request = "\n".join([
        "PUT", uri, canonical_query(query), f"host:{host}\n", "host", "UNSIGNED-PAYLOAD",
    ])
    to_sign = "\n".join([
        "AWS4-HMAC-SHA256", amz_date, scope, hashlib.sha256(request.encode()).hexdigest(),
    ])
    k_date = hmac_sha256(("AWS4" + secret).encode(), date_stamp)
    k_region = hmac_sha256(k_date, "auto")
    k_service = hmac_sha256(k_region, "s3")
    signature = hmac.new(hmac_sha256(k_service, "aws4_request"), to_sign.encode(), hashlib.sha256).hexdigest()
    query["X-Amz-Signature"] = signature
    return f"https://{host}{uri}?{canonical_query(query)}"


def request_json(url: str, api_key: str, payload: dict | None = None, *, method: str | None = None) -> dict:
    data = json.dumps(payload).encode() if payload is not None else None
    request = urllib.request.Request(url, data=data, method=method)
    request.add_header("Authorization", f"Bearer {api_key}")
    if data is not None:
        request.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


def main() -> int:
    config = json.loads((ROOT / "config/runpod-h3.json").read_text())
    parser = argparse.ArgumentParser()
    parser.add_argument("--endpoint", default=config["endpoints"][0]["id"])
    parser.add_argument("--timeout", type=int, default=2400)
    parser.add_argument("--prompt", default="Medium waist-up portrait of an adult woman seated beside a window, face occupies about fifteen percent of the frame, natural blinking, subtle head movement")
    args = parser.parse_args()

    runpod_key = required("RUNPOD_API_KEY")
    prefix = os.environ.get("R2_PATH_PREFIX", "gallery").strip("/")
    object_key = f"{prefix}/tests/h3-direct-canary/{uuid.uuid4()}.webm"
    public_url = f"https://{required('R2_PUBLIC_HOST')}/{object_key}"
    payload = {
        "input": {
            "prompt": args.prompt,
            "aspect_ratio": "9:16",
            "size": "preview",
            "duration": 5,
            "steps": 8,
            "seed": 20260814,
            "structured_prompt": True,
            "include_audio": True,
            "output_codec": "webm-av1",
            "encode_quality": 26,
            "_output_upload_url": presign_put(object_key),
            "_output_public_url": public_url,
        }
    }
    base = f"https://api.runpod.ai/v2/{args.endpoint}"
    control_url = f"https://rest.runpod.io/v1/endpoints/{args.endpoint}"
    previous_max = int(request_json(control_url, runpod_key).get("workersMax") or 0)
    activation = {"workersMax": 2, "workersMin": 0, "scalerType": "REQUEST_COUNT", "scalerValue": 1}
    if previous_max == 0:
        request_json(control_url, runpod_key, activation, method="PATCH")
    submitted = None
    for attempt in range(7):
        try:
            submitted = request_json(base + "/run", runpod_key, payload)
            break
        except urllib.error.HTTPError as exc:
            detail = exc.read(2048).decode(errors="replace")
            if exc.code != 409 or "ENDPOINT_PAUSED" not in detail or attempt == 6:
                raise RuntimeError(f"RunPod submission returned HTTP {exc.code}: {detail}") from exc
            request_json(control_url, runpod_key, activation, method="PATCH")
            time.sleep(5)
    assert submitted is not None
    job_id = submitted["id"]
    deadline = time.monotonic() + args.timeout
    state = submitted
    terminal = {"COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"}
    try:
        while state.get("status") not in terminal:
            if time.monotonic() >= deadline:
                raise TimeoutError(f"RunPod job {job_id} exceeded {args.timeout}s")
            time.sleep(5)
            state = request_json(base + "/status/" + urllib.parse.quote(job_id, safe=""), runpod_key)
    finally:
        if previous_max == 0 and state.get("status") in terminal:
            health = request_json(base + "/health", runpod_key)
            jobs = health.get("jobs") or {}
            active_jobs = int(jobs.get("inProgress") or 0) + int(jobs.get("inQueue") or 0)
            if active_jobs == 0:
                request_json(control_url, runpod_key, {"workersMax": 0}, method="PATCH")

    output = state.get("output") or {}
    artifact = (output.get("outputs") or [{}])[0]
    metrics = output.get("metrics") or {}
    summary = {
        "id": job_id,
        "status": state.get("status"),
        "delay_ms": state.get("delayTime"),
        "execution_ms": state.get("executionTime"),
        "artifact": {key: artifact.get(key) for key in ("url", "content_type", "bytes", "sha256")},
        "contains_inline_data": bool(artifact.get("data")),
        "metrics": {key: metrics.get(key) for key in (
            "total_seconds", "generation_seconds", "face_refine_seconds", "encode_seconds",
            "output_upload_seconds", "output_transport", "output_bytes", "frames", "width", "height",
            "attention_backend", "face_refine",
        )},
        "error": state.get("error"),
    }
    print(json.dumps(summary, indent=2, sort_keys=True))
    if state.get("status") != "COMPLETED":
        return 1
    if artifact.get("url") != public_url or artifact.get("data") or metrics.get("output_transport") != "r2-direct":
        raise RuntimeError("RunPod completed without the expected direct-output contract")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except urllib.error.HTTPError as exc:
        detail = exc.read(2048).decode(errors="replace")
        raise SystemExit(f"HTTP {exc.code}: {detail}") from exc
