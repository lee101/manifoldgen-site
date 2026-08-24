#!/usr/bin/env python3
"""Render crawled Higgsfield text-to-video prompts through the local H3 coglet
and publish them into video_jobs + R2 so the video search engine indexes them.

Run on the production host:
  python3 scripts/render_higgsfield_videos.py \
    --queue scripts/prompts/higgsfield/video-queue.jsonl --limit 6

Mirrors scripts/publish_gallery_videos.py conventions (R2 keys borrowed from
app-site .env, psql upsert of completed rows) and drives the same cog endpoint
the server uses for local H3 work (POST {cog}/predictions, synchronous).
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
R2_ACCOUNT_ID = os.environ.get("R2_ACCOUNT_ID", "f76d25b8b86cfa5638f43016510d8f77")
R2_BUCKET = "manifoldgenstatic"
R2_PUBLIC_HOST = "manifoldgenstatic.manifoldgen.com"
ENDPOINT = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"


def load_dotenv() -> None:
    mg = ROOT / ".env"
    if mg.exists():
        for line in mg.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ[key.strip()] = value.strip().strip('"').strip("'")
    shared = Path("/nvme0n1-disk/code/app-site/.env")
    if shared.exists():
        for line in shared.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            if key in ("CLOUDFLARE_R2_ACCESS_KEY_ID", "CLOUDFLARE_R2_SECRET_ACCESS_KEY", "R2_ACCOUNT_ID") and not os.environ.get(key):
                os.environ[key] = value.strip().strip('"').strip("'")
    os.environ.setdefault("DATABASE_URL", "postgres://manifoldgen:manifoldgen@localhost:5432/manifoldgen?sslmode=disable")


def psql(sql: str) -> str:
    return subprocess.check_output(["psql", os.environ["DATABASE_URL"], "-At", "-c", sql], text=True).strip()


def aws_env() -> dict[str, str]:
    env = os.environ.copy()
    env["AWS_ACCESS_KEY_ID"] = env.get("CLOUDFLARE_R2_ACCESS_KEY_ID", "")
    env["AWS_SECRET_ACCESS_KEY"] = env.get("CLOUDFLARE_R2_SECRET_ACCESS_KEY", "")
    env["AWS_DEFAULT_REGION"] = "auto"
    if not env["AWS_ACCESS_KEY_ID"] or not env["AWS_SECRET_ACCESS_KEY"]:
        raise SystemExit("missing CLOUDFLARE_R2_ACCESS_KEY_ID / CLOUDFLARE_R2_SECRET_ACCESS_KEY")
    return env


def s3_cp(local: Path, key: str, content_type: str) -> str:
    subprocess.check_call([
        "aws", "--endpoint-url", ENDPOINT, "s3", "cp", str(local), f"s3://{R2_BUCKET}/{key}",
        "--content-type", content_type, "--cache-control", "public, max-age=31536000, immutable",
    ], env=aws_env(), stdout=subprocess.DEVNULL)
    return f"https://{R2_PUBLIC_HOST}/{key}"


def lit(value: str) -> str:
    return value.replace("'", "''")


def already_published(job_id: str) -> bool:
    return psql(f"SELECT count(*) FROM video_jobs WHERE id = '{lit(job_id)}' AND status = 'completed';") == "1"


def predict(cog: str, job_id: str, prompt: str, timeout_s: int) -> dict:
    # Keys mirror appNZH3Input's well-understood subset. output_codec and loop
    # are omitted: this coglet build validates output_codec against a strict
    # enum and the server-side defaults already produce mp4/h264.
    payload = json.dumps({
        "id": job_id,
        "input": {
            "prompt": prompt,
            "aspect_ratio": "16:9",
            "duration": 5,
            "steps": 20,
            "structured_prompt": True,
            "include_audio": True,
        },
    }).encode()
    request = urllib.request.Request(
        cog.rstrip("/") + "/predictions", data=payload,
        headers={"Content-Type": "application/json"}, method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout_s) as response:
        return json.load(response)


def output_url(poll: dict) -> str:
    output = poll.get("output")
    if isinstance(output, str):
        return output
    if isinstance(output, dict):
        for key in ("video_url", "url"):
            value = output.get(key)
            if isinstance(value, str) and value.startswith("http"):
                return value
    return ""


def upsert_completed(job_id: str, user_id: str, prompt: str, video_url: str) -> None:
    result = json.dumps({
        "video_url": video_url,
        "provider": "higgsfield-crawl",
        "service": "h3_video",
        "codec": "h264",
    })
    sql = (
        "INSERT INTO video_jobs (id, user_id, provider_job_id, service, status, result_json, prompt, settled, created_at, updated_at) "
        f"VALUES ('{lit(job_id)}', '{lit(user_id)}', '{lit(job_id)}', 'h3_video', 'completed', '{lit(result)}'::jsonb, "
        f"'{lit(prompt)}', TRUE, NOW(), NOW()) "
        "ON CONFLICT (id) DO UPDATE SET status='completed', result_json=EXCLUDED.result_json, "
        "prompt=EXCLUDED.prompt, settled=TRUE, updated_at=NOW();"
    )
    subprocess.check_call(["psql", os.environ["DATABASE_URL"], "-c", sql], stdout=subprocess.DEVNULL)


def reindex() -> None:
    api_key = psql("SELECT api_key FROM users WHERE api_key <> '' ORDER BY created_at ASC LIMIT 1;")
    if not api_key:
        print("reindex skipped: no api key", file=sys.stderr)
        return
    request = urllib.request.Request(
        os.getenv("MANIFOLDGEN_API", "http://127.0.0.1:8116").rstrip("/") + "/api/search/reindex",
        method="POST", headers={"Authorization": f"Bearer {api_key}"},
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        if response.status != 202:
            raise RuntimeError(f"reindex returned HTTP {response.status}")
    print("search reindex requested", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--queue", type=Path, required=True)
    parser.add_argument("--limit", type=int, default=6, help="max render attempts")
    parser.add_argument("--cog", default=os.getenv("H3_LOCAL_COG_URL", "http://127.0.0.1:18089"))
    parser.add_argument("--timeout-s", type=int, default=3300)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    load_dotenv()
    user_id = psql("SELECT id FROM users ORDER BY created_at ASC LIMIT 1;")
    rows = [json.loads(line) for line in args.queue.read_text().splitlines() if line.strip()]
    published = 0
    attempts = 0
    for row in rows:
        if attempts >= args.limit:
            break
        slug = row["id"]
        job_id = f"video_{slug}"
        if already_published(job_id):
            print(f"skip published {job_id}", flush=True)
            continue
        attempts += 1
        prompt = row["prompt"]
        print(f"[{attempts}/{args.limit}] rendering {job_id}: {prompt[:80]}...", flush=True)
        started = time.time()
        try:
            poll = predict(args.cog, job_id, prompt, args.timeout_s)
        except urllib.error.HTTPError as error:
            print(f"  HTTP {error.code}: {error.read()[:200]!r}", flush=True)
            continue
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            print(f"  predict failed: {error}", flush=True)
            continue
        status = str(poll.get("status", "")).lower()
        url = output_url(poll)
        if status not in ("succeeded", "success", "completed") or not url:
            print(f"  bad result status={status} keys={list(poll)}", flush=True)
            continue
        if args.dry_run:
            print(f"  would publish {url} ({time.time() - started:.0f}s)", flush=True)
            published += 1
            continue
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as handle:
            temp_path = Path(handle.name)
            with urllib.request.urlopen(url, timeout=600) as media:
                while chunk := media.read(1 << 20):
                    handle.write(chunk)
        try:
            r2_url = s3_cp(temp_path, f"gallery/videos/{slug}.mp4", "video/mp4")
        finally:
            temp_path.unlink(missing_ok=True)
        upsert_completed(job_id, user_id, prompt, r2_url)
        published += 1
        print(f"  published {r2_url} ({time.time() - started:.0f}s)", flush=True)

    if published and not args.dry_run:
        reindex()
    print(json.dumps({"published": published, "attempted": attempts}, sort_keys=True))


if __name__ == "__main__":
    main()
