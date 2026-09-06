#!/usr/bin/env python3
"""Submit and download a real fal H3 Max text or image canary."""

from __future__ import annotations

import argparse
import json
import os
import time
import urllib.parse
import urllib.request
from pathlib import Path


def request_json(method: str, url: str, payload: dict | None = None) -> dict:
    data = None if payload is None else json.dumps(payload).encode()
    request = urllib.request.Request(url, data=data, method=method)
    request.add_header("Authorization", "Key " + os.environ["FAL_KEY"])
    request.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=("text", "image"), default="text")
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--image-url")
    parser.add_argument("--end-image-url")
    parser.add_argument("--duration", type=int, choices=range(5, 16), default=5)
    parser.add_argument("--resolution", choices=("480P", "768P"), default="480P")
    parser.add_argument("--aspect-ratio", default="16:9")
    parser.add_argument("--seed", type=int)
    parser.add_argument("--prompt-expansion-mode", choices=("disabled", "balanced", "quality"), default="balanced")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--summary", type=Path, required=True)
    args = parser.parse_args()
    if args.mode == "image" and not args.image_url:
        parser.error("--image-url is required in image mode")

    model = f"minimax/h3-max/{args.mode}-to-video"
    payload = {
        "prompt": args.prompt,
        "duration": args.duration,
        "resolution": args.resolution,
        "enable_safety_checker": True,
        "prompt_expansion_mode": args.prompt_expansion_mode,
    }
    if args.seed is not None:
        payload["seed"] = args.seed
    if args.mode == "text":
        payload["aspect_ratio"] = args.aspect_ratio
    else:
        payload["image_url"] = args.image_url
        if args.end_image_url:
            payload["end_image_url"] = args.end_image_url

    started = time.monotonic()
    queued = request_json("POST", "https://queue.fal.run/" + model, payload)
    request_id = queued["request_id"]
    status_url = queued["status_url"]
    response_url = queued["response_url"]
    deadline = time.monotonic() + 3600
    state = queued
    while time.monotonic() < deadline:
        state = request_json("GET", status_url)
        if str(state.get("status", "")).upper() == "COMPLETED":
            break
        if str(state.get("status", "")).upper() in {"FAILED", "CANCELLED", "CANCELED"}:
            raise RuntimeError(json.dumps(state))
        time.sleep(3)
    else:
        raise TimeoutError(request_id)

    result = request_json("GET", response_url)
    video_url = result["video"]["url"]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(video_url, timeout=300) as response:
        args.output.write_bytes(response.read())
    summary = {
        "model": model, "request_id": request_id, "payload": payload,
        "elapsed_seconds": round(time.monotonic() - started, 3), "result": result,
        "output": str(args.output), "output_bytes": args.output.stat().st_size,
    }
    args.summary.parent.mkdir(parents=True, exist_ok=True)
    args.summary.write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n")
    print(json.dumps(summary, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
