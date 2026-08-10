#!/usr/bin/env python3
"""Classify pending gallery images with the local OmniServe NSFW worker.

Unsafe images are retained for audit but immediately excluded by the gallery and
semantic-search filters. The script is resumable: only NULL is_nsfw rows run.
"""

from __future__ import annotations

import argparse
import os
import time
from pathlib import Path

import psycopg2
import requests

ROOT = Path(__file__).resolve().parents[1]


def load_env() -> None:
    for raw in (ROOT / ".env").read_text().splitlines():
        if "=" in raw and not raw.lstrip().startswith("#"):
            key, value = raw.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip("\"'") )


def main() -> None:
    load_env()
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=500)
    parser.add_argument("--threshold", type=float, default=0.5)
    parser.add_argument("--endpoint", default=os.getenv("GALLERY_IMAGE_WORKER_URL", "http://127.0.0.1:8100"))
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL"))
    parser.add_argument("--images-dir", type=Path, default=Path(os.getenv("IMAGES_DIR", "/sdb-disk/manifoldgen-images")))
    args = parser.parse_args()
    if not args.database_url:
        raise SystemExit("DATABASE_URL is required")
    conn = psycopg2.connect(args.database_url)
    with conn.cursor() as cur:
        cur.execute("SELECT id, file_path FROM generated_images WHERE is_nsfw IS NULL ORDER BY created_at ASC LIMIT %s", (args.limit,))
        rows = cur.fetchall()
    safe = nsfw = failed = 0
    for number, (image_id, relpath) in enumerate(rows, 1):
        path = args.images_dir / relpath
        if not path.exists():
            failed += 1
            continue
        try:
            headers = {}
            secret = os.getenv("OMNISERVE_NATIVE_SECRET", os.getenv("OMNISERVE_SECRET", ""))
            if secret:
                headers["Authorization"] = "Bearer " + secret
            with path.open("rb") as image:
                response = requests.post(args.endpoint.rstrip("/") + "/nsfw_detect_file", headers=headers, files={"image_file": (path.name, image, "image/webp")}, timeout=90)
            response.raise_for_status()
            payload = response.json()
            score = float(payload.get("nsfw_score", payload.get("score", 0)))
            flagged = score >= args.threshold
            with conn.cursor() as cur:
                cur.execute("UPDATE generated_images SET is_nsfw = %s WHERE id = %s", (flagged, image_id))
            conn.commit()
            safe += not flagged
            nsfw += flagged
        except (OSError, requests.RequestException, ValueError) as error:
            conn.rollback()
            failed += 1
            print(f"[{number}/{len(rows)}] {image_id} failed: {error}", flush=True)
        if number % 25 == 0:
            print(f"[{number}/{len(rows)}] safe={safe} nsfw={nsfw} failed={failed}", flush=True)
    print(f"done: safe={safe} nsfw={nsfw} failed={failed}")


if __name__ == "__main__":
    main()
