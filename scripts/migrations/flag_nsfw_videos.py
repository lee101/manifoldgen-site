#!/usr/bin/env python3
"""Optionally backfill video_jobs.is_nsfw from the first frame of each completed video.

Not part of any live path and never run automatically. New adult-lane jobs are
flagged at creation for free; every other row defaults to FALSE. This only ever
sets is_nsfw = TRUE (never clears it) and is a dry run unless --apply is given.
Resumable: re-run with --after <last id printed>.

  DATABASE_URL=... OMNISERVE_NATIVE_URL=http://127.0.0.1:8791 \
    python3 scripts/migrations/flag_nsfw_videos.py --limit 200            # dry run
  python3 scripts/migrations/flag_nsfw_videos.py --apply --reindex          # write + rebuild search indexes
"""
import argparse
import base64
import json
import os
import subprocess
import sys
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

DEFAULT_DB = "postgres://manifoldgen:manifoldgen@localhost:5432/manifoldgen?sslmode=disable"


def psql(db, sql):
    out = subprocess.run(["psql", db, "-At", "-F", "\t", "-c", sql], capture_output=True, text=True)
    if out.returncode:
        raise SystemExit(out.stderr.strip())
    return [line.split("\t") for line in out.stdout.splitlines() if line]


def first_frame(url, ffmpeg):
    if not url.startswith(("http://", "https://")) or len(url) > 4000:
        raise RuntimeError("unsupported video url")
    proc = subprocess.run(
        [ffmpeg, "-loglevel", "error", "-ss", "0", "-i", url, "-frames:v", "1", "-vf", "scale=512:-2",
         "-f", "image2pipe", "-vcodec", "mjpeg", "-"],
        capture_output=True, timeout=120)
    if proc.returncode or not proc.stdout:
        raise RuntimeError(proc.stderr.decode(errors="replace")[-200:] or "no frame")
    return proc.stdout


def classify(image, endpoint, secret):
    target = endpoint.rstrip("/") + "/nsfw_detect"
    if secret:
        target += "?" + urllib.parse.urlencode({"secret": secret})
    request = urllib.request.Request(
        target, data=json.dumps({"image_base64": base64.b64encode(image).decode()}).encode(),
        headers={"Content-Type": "application/json", **({"Authorization": "Bearer " + secret} if secret else {})})
    with urllib.request.urlopen(request, timeout=60) as response:
        verdict = json.load(response)
    return float(verdict.get("nsfw_score") or verdict.get("score") or 0)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="write is_nsfw = TRUE (default: dry run)")
    parser.add_argument("--limit", type=int, default=0, help="stop after N videos (0 = all)")
    parser.add_argument("--batch", type=int, default=100)
    parser.add_argument("--after", default="", help="resume after this video_jobs id")
    parser.add_argument("--threshold", type=float, default=float(os.environ.get("H3_IMAGE_NSFW_THRESHOLD", "0.5")))
    parser.add_argument("--concurrency", type=int, default=4)
    parser.add_argument("--verbose", action="store_true", help="print every score")
    parser.add_argument("--reindex", action="store_true", help="POST /api/search/reindex after applying")
    parser.add_argument("--database-url", default=os.environ.get("DATABASE_URL", DEFAULT_DB))
    parser.add_argument("--omniserve", default=os.environ.get("OMNISERVE_NATIVE_URL", "http://127.0.0.1:8791"))
    parser.add_argument("--ffmpeg", default=os.environ.get("FFMPEG", "ffmpeg"))
    args = parser.parse_args()
    secret = os.environ.get("OMNISERVE_IMAGE_WORKER_SECRET") or os.environ.get("OMNISERVE_NATIVE_SECRET") or os.environ.get("OMNISERVE_SECRET", "")
    has_column = bool(psql(args.database_url, "SELECT 1 FROM information_schema.columns WHERE table_name = 'video_jobs' AND column_name = 'is_nsfw'"))
    if not has_column and args.apply:
        psql(args.database_url, "ALTER TABLE video_jobs ADD COLUMN IF NOT EXISTS is_nsfw BOOLEAN NOT NULL DEFAULT FALSE")
        has_column = True
    unflagged = "AND is_nsfw = FALSE " if has_column else ""

    seen = flagged = failed = 0
    after = args.after
    while not args.limit or seen < args.limit:
        take = args.batch if not args.limit else min(args.batch, args.limit - seen)
        rows = psql(args.database_url,
                    "SELECT id, result_json->>'video_url' FROM video_jobs WHERE status = 'completed' " + unflagged +
                    "AND COALESCE(result_json->>'video_url', '') <> '' AND id > '" + after.replace("'", "''") + "' "
                    f"ORDER BY id LIMIT {take}")
        if not rows:
            break

        def check(row):
            try:
                return row[0], classify(first_frame(row[1], args.ffmpeg), args.omniserve, secret)
            except Exception as error:
                return row[0], error

        with ThreadPoolExecutor(args.concurrency) as pool:
            results = list(pool.map(check, rows))
        hits = []
        for job_id, score in results:
            if isinstance(score, Exception):
                failed += 1
                print(f"skip {job_id}: {score}", file=sys.stderr)
            elif args.verbose and score < args.threshold:
                print(f"sfw  {job_id} score={score:.3f}")
            if not isinstance(score, Exception) and score >= args.threshold:
                hits.append(job_id)
                print(f"nsfw {job_id} score={score:.3f}")
        if hits and args.apply:
            ids = ",".join("'" + h.replace("'", "''") + "'" for h in hits)
            psql(args.database_url, f"UPDATE video_jobs SET is_nsfw = TRUE, updated_at = NOW() WHERE id IN ({ids}) AND is_nsfw = FALSE")
        seen += len(rows)
        flagged += len(hits)
        after = rows[-1][0]
        print(f"progress seen={seen} flagged={flagged} failed={failed} last_id={after}", flush=True)
    print(f"done seen={seen} flagged={flagged} failed={failed} apply={args.apply} last_id={after}")
    if args.apply and args.reindex and flagged:
        key = os.environ.get("MANIFOLDGEN_API_KEY", "")
        base = os.environ.get("MANIFOLDGEN_API", "http://127.0.0.1:8116").rstrip("/")
        request = urllib.request.Request(base + "/api/search/reindex", method="POST", headers={"Authorization": "Bearer " + key} if key else {})
        print("reindex", urllib.request.urlopen(request, timeout=30).status)


if __name__ == "__main__":
    main()
