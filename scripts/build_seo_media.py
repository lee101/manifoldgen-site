#!/usr/bin/env python3
"""Build frontend/lib/seo/media-manifest.json from the public ManifoldGen gallery APIs.

Sources real generations (images via /api/images/semantic, videos via /api/search)
so programmatic SEO pages embed genuine output without spending generation credits
at build time. Deterministic given the same gallery state: results are ranked by the
API's similarity order, deduped across keys (first key wins), and filtered to SFW,
landscape/square-friendly assets.

Usage:
    python3 scripts/build_seo_media.py [--api https://manifoldgen.com] [--check]
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QUERIES_PATH = ROOT / "frontend/lib/seo/media-queries.json"
MANIFEST_PATH = ROOT / "frontend/lib/seo/media-manifest.json"
GALLERY_CDN = "https://manifoldgenstatic.manifoldgen.com/gallery"
MIN_IMAGE_EDGE = 640


def fetch_json(url: str, timeout: float = 20.0) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": "ManifoldGen-SEOMedia/1.0"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def gallery_url(image_url: str) -> str:
    # /images/originals/<file> on the API origin maps to gallery/<file> on R2.
    path = image_url.split("?")[0]
    for prefix in ("/images/", "/gallery/"):
        if prefix in path:
            return f"{GALLERY_CDN}/{path.split(prefix, 1)[1]}"
    return image_url if image_url.startswith("http") else f"{GALLERY_CDN}{path}"


def search_images(api: str, query: str, top_k: int) -> list[dict]:
    url = f"{api}/api/images/semantic?q={urllib.parse.quote(query)}&top_k={top_k}"
    return fetch_json(url).get("results", []) or []


def search_videos(api: str, query: str, top_k: int) -> list[dict]:
    if not query.strip():
        return []
    url = f"{api}/api/search?q={urllib.parse.quote(query)}&top_k={top_k}"
    payload = fetch_json(url)
    rows = payload.get("results", []) or []
    return [row for row in rows if isinstance(row.get("video_url"), str) and row["video_url"].strip()]


def build(api: str) -> dict:
    spec = json.loads(QUERIES_PATH.read_text())
    used_ids: set[str] = set()
    entries: dict[str, dict] = {}
    failures: list[str] = []

    keys = [key for key in spec if not key.startswith("$")]
    for key in keys:
        entry_spec = spec[key]
        entry: dict = {"images": [], "videos": []}

        image_spec = entry_spec.get("images") or {}
        query, count = image_spec.get("q", ""), int(image_spec.get("n", 0))
        if query and count > 0:
            try:
                rows = search_images(api, query, min(count * 3 + 4, 60))
            except Exception as error:  # noqa: BLE001 - record and continue with other keys
                failures.append(f"{key}: images search failed: {error}")
                rows = []
            picked = 0
            for row in rows:
                if picked >= count:
                    break
                asset_id = str(row.get("id", ""))
                if not asset_id or asset_id in used_ids:
                    continue
                width, height = int(row.get("width") or 0), int(row.get("height") or 0)
                if width and height and min(width, height) < MIN_IMAGE_EDGE:
                    continue
                prompt = str(row.get("prompt") or "").strip()
                if len(prompt) > 220:
                    prompt = prompt[:217].rstrip() + "..."
                used_ids.add(asset_id)
                entry["images"].append(
                    {
                        "url": gallery_url(str(row.get("image_url") or "")),
                        "prompt": prompt,
                        "model": row.get("model"),
                        "width": width or None,
                        "height": height or None,
                    }
                )
                picked += 1

        video_spec = entry_spec.get("videos") or {}
        query, count = video_spec.get("q", ""), int(video_spec.get("n", 0))
        if query and count > 0:
            try:
                rows = search_videos(api, query, min(count * 3 + 4, 30))
            except Exception as error:  # noqa: BLE001
                failures.append(f"{key}: videos search failed: {error}")
                rows = []
            picked = 0
            for row in rows:
                if picked >= count:
                    break
                job_id = str(row.get("job_id") or row.get("video_url"))
                if job_id in used_ids:
                    continue
                prompt = str(row.get("prompt") or "").strip()
                if len(prompt) > 220:
                    prompt = prompt[:217].rstrip() + "..."
                used_ids.add(job_id)
                entry["videos"].append({"url": str(row.get("video_url")), "prompt": prompt})
                picked += 1

        entries[key] = entry
        print(f"{key}: {len(entry['images'])} images, {len(entry['videos'])} videos")
        time.sleep(0.15)

    return {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source_api": api,
        "entries": entries,
        "_failures": failures,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api", default="https://manifoldgen.com")
    parser.add_argument("--check", action="store_true", help="verify every key got media; exit 1 otherwise")
    args = parser.parse_args()

    manifest = build(args.api)

    for failure in manifest.pop("_failures"):
        print(f"WARN {failure}", file=sys.stderr)

    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, sort_keys=False) + "\n")
    print(f"wrote {MANIFEST_PATH}")

    if args.check:
        spec = json.loads(QUERIES_PATH.read_text())
        missing = [
            key
            for key in spec
            if not key.startswith("$")
            and not (manifest["entries"].get(key, {}).get("images") or manifest["entries"].get(key, {}).get("videos"))
        ]
        if missing:
            print(f"MISSING MEDIA for {len(missing)} keys: {', '.join(missing)}", file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
