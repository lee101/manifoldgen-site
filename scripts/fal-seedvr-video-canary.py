#!/usr/bin/env python3
"""Submit a video to fal SeedVR2, download it, and save an audit summary."""

from __future__ import annotations

import argparse
import json
import os
import time
import urllib.request
from pathlib import Path


MODEL = "fal-ai/seedvr/upscale/video"


def request_json(method: str, url: str, payload: dict | None = None) -> dict:
    request = urllib.request.Request(
        url,
        data=None if payload is None else json.dumps(payload).encode(),
        method=method,
        headers={"Authorization": "Key " + os.environ["FAL_KEY"], "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--video-url", required=True)
    parser.add_argument("--upscale-factor", type=int, choices=(1, 2, 3, 4), default=2)
    parser.add_argument("--noise-scale", type=float, default=0.05)
    parser.add_argument("--seed", type=int, default=270827)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--summary", type=Path, required=True)
    args = parser.parse_args()
    payload = {
        "video_url": args.video_url,
        "upscale_mode": "factor",
        "upscale_factor": args.upscale_factor,
        "noise_scale": args.noise_scale,
        "seed": args.seed,
        "output_format": "X264 (.mp4)",
        "output_quality": "maximum",
        "output_write_mode": "balanced",
    }
    started = time.monotonic()
    queued = request_json("POST", "https://queue.fal.run/" + MODEL, payload)
    deadline = time.monotonic() + 3600
    while time.monotonic() < deadline:
        state = request_json("GET", queued["status_url"])
        status = str(state.get("status", "")).upper()
        if status == "COMPLETED":
            break
        if status in {"FAILED", "CANCELLED", "CANCELED"}:
            raise RuntimeError(json.dumps(state))
        time.sleep(3)
    else:
        raise TimeoutError(queued["request_id"])
    result = request_json("GET", queued["response_url"])
    video = result.get("video") or {}
    video_url = video.get("url")
    if not video_url:
        raise RuntimeError("SeedVR returned no video URL")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(video_url, timeout=300) as response:
        args.output.write_bytes(response.read())
    summary = {
        "model": MODEL,
        "request_id": queued["request_id"],
        "payload": payload,
        "elapsed_seconds": round(time.monotonic() - started, 3),
        "result": result,
        "output": str(args.output),
        "output_bytes": args.output.stat().st_size,
    }
    args.summary.write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n")
    print(json.dumps(summary, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
