#!/usr/bin/env python3
"""Batch-generate widescreen festival poster art from scripts/prompts/poster-prompts.jsonl
through the native Z-Image-Turbo gateway (default 127.0.0.1:8791/v1/images/generations).

Resumable: any image already on disk by content key is skipped. Outputs raw
webp (1152x640) files named <sha16>.webp plus a sidecar manifest. Intended for
DJ / music-video poster art; gitignored output dir.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import signal
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "scripts" / "prompts" / "poster-prompts.jsonl"
DEFAULT_OUT = ROOT / "artifacts" / "poster-art"
DEFAULT_ENDPOINT = os.getenv("OMNISERVE_IMAGE_ENDPOINT", "http://127.0.0.1:8791/v1/images/generations")

STOP = False


def stop(_signum: int, _frame: object) -> None:
    global STOP
    STOP = True


signal.signal(signal.SIGINT, stop)
signal.signal(signal.SIGTERM, stop)


def load_secret() -> str:
    for key in ("OMNISERVE_NATIVE_SECRET", "OMNISERVE_SECRET", "IMAGE_API_SECRET"):
        value = os.getenv(key)
        if value:
            return value
    secret_file = Path("/tmp/omniserve_native_secret")
    if secret_file.is_file():
        return secret_file.read_text(encoding="utf-8").strip()
    return ""


def load_source(path: Path) -> list[dict]:
    items: list[dict] = []
    seen: set[str] = set()
    for number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        raw = raw.strip()
        if not raw or raw.startswith("#"):
            continue
        value = json.loads(raw)
        prompt = str(value.get("prompt", "")).strip()
        if not prompt or prompt in seen:
            continue
        seen.add(prompt)
        items.append({
            "prompt": prompt,
            "seed": value.get("seed", -1),
            "width": int(value.get("width", 1152)),
            "height": int(value.get("height", 640)),
        })
    return items


def generate(endpoint: str, prompt: str, width: int, height: int, seed: int,
             low_priority: bool) -> bytes:
    body = json.dumps({
        "prompt": prompt,
        "width": width,
        "height": height,
        "steps": 9,
        "guidance_scale": 0.0,
        "seed": seed,
    }, separators=(",", ":")).encode()
    headers = {"Content-Type": "application/json", "Accept": "application/json, image/*"}
    if low_priority:
        headers["X-Omniserve-Tier"] = "background"
    if secret := load_secret():
        headers["Authorization"] = f"Bearer {secret}"
    request = urllib.request.Request(endpoint, data=body, headers=headers, method="POST")
    with urllib.request.urlopen(request, timeout=600) as response:
        result = response.read()
    if result.lstrip().startswith(b"{"):
        payload = json.loads(result)
        encoded = payload.get("image_base64", "")
        if not encoded and isinstance(payload.get("data"), list) and payload["data"]:
            encoded = payload["data"][0].get("b64_json", "")
        if not encoded:
            raise RuntimeError("image worker response has no image_base64")
        import base64
        return base64.b64decode(encoded)
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--endpoint", default=DEFAULT_ENDPOINT)
    parser.add_argument("--limit", type=int, default=0, help="0 = all prompts")
    parser.add_argument("--retries", type=int, default=4)
    parser.add_argument("--retry-delay", type=float, default=8.0)
    parser.add_argument("--delay", type=float, default=2.0)
    parser.add_argument("--low-priority", action="store_true")
    args = parser.parse_args()

    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    (out / ".gitkeep").touch(exist_ok=True)
    manifest_path = out / "manifest.jsonl"
    done: set[str] = set()
    if manifest_path.is_file():
        for line in manifest_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line:
                done.add(json.loads(line)["key"])

    items = load_source(args.source)
    if args.limit > 0:
        items = items[: args.limit]

    generated = skipped = failed = 0
    started = time.perf_counter()
    for number, item in enumerate(items, 1):
        if STOP:
            print(f"stop requested at {number}/{len(items)}; resume later", flush=True)
            break
        prompt = item["prompt"]
        key = hashlib.sha256(prompt.encode()).hexdigest()[:16]
        if not (out / f"{key}.webp").exists():
            if key in done:
                print(f"[{number}/{len(items)}] missing file but done; will regen", flush=True)
        if (out / f"{key}.webp").is_file() and key in done:
            skipped += 1
            if number % 50 == 0:
                print(f"[{number}/{len(items)}] skipped {skipped}", flush=True)
            continue
        try:
            raw = b""
            for attempt in range(args.retries + 1):
                try:
                    raw = generate(args.endpoint, prompt, item["width"], item["height"],
                                   item["seed"], args.low_priority)
                    break
                except urllib.error.HTTPError as error:
                    if error.code not in (429, 500, 502, 503, 504) or attempt == args.retries:
                        raise
                    wait = min(args.retry_delay * (2 ** attempt), 300)
                    print(f"[{number}/{len(items)}] HTTP {error.code}; retry in {wait:.0f}s", flush=True)
                    time.sleep(wait)
            if not raw:
                raise RuntimeError("empty response")
            dest = out / f"{key}.webp"
            dest.write_bytes(raw)
            with manifest_path.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps({"key": key, "prompt": prompt, "seed": item["seed"]}) + "\n")
            done.add(key)
            generated += 1
            elapsed = time.perf_counter() - started
            rate = elapsed / number
            print(f"[{number}/{len(items)}] +{key} {dest.stat().st_size//1024}KB "
                  f"({rate:.1f}s/img)", flush=True)
        except (OSError, RuntimeError, urllib.error.URLError, urllib.error.HTTPError) as error:
            failed += 1
            print(f"[{number}/{len(items)}] FAILED: {error}", flush=True)
        time.sleep(args.delay)

    total = time.perf_counter() - started
    print(f"done: generated={generated} skipped={skipped} failed={failed} "
          f"wall={total:.0f}s rate={(total/max(1,(generated+skipped))):.1f}s/img", flush=True)


if __name__ == "__main__":
    main()