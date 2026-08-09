#!/usr/bin/env python3
"""Publish showcase videos to manifoldgenstatic + video_jobs for gobed.

- Uploads local H3 demo webms (spectrum-sol / hummingbird)
- Remuxes completed LTX fal clips onto the gallery CDN
- Triggers /api/search/reindex

Usage:
  python scripts/publish_gallery_videos.py [--skip-ltx] [--dry-run]
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import tempfile
import uuid
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
API = os.environ.get("MANIFOLDGEN_API", "http://127.0.0.1:8116").rstrip("/")
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgres://manifoldgen:manifoldgen@localhost:5432/manifoldgen?sslmode=disable",
)
R2_ACCOUNT_ID = os.environ.get("R2_ACCOUNT_ID", "f76d25b8b86cfa5638f43016510d8f77")
R2_BUCKET = os.environ.get("R2_BUCKET", "manifoldgenstatic")
R2_PUBLIC = os.environ.get("R2_PUBLIC_HOST", "manifoldgenstatic.manifoldgen.com")
ENDPOINT = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

H3_DEMOS = [
    {
        "slug": "glass-hummingbird-spectrum-sol",
        "prompt": (
            "A glass hummingbird drinks from a bright orange flower, soft morning light, "
            "gentle camera push-in; crystalline wing chimes, quiet garden ambience"
        ),
        "path": Path("/nvme0n1-disk/code/app-site/public/static/cogs/h3/spectrum-sweep/t2v-spectrum-sol-s7.webm"),
        "meta": "h3 spectrum-sol w4a8 accelerated",
    },
    {
        "slug": "glass-hummingbird-stack",
        "prompt": (
            "A glass hummingbird drinks from a bright orange flower, soft morning light, "
            "gentle camera push-in; crystalline wing chimes, quiet garden ambience"
        ),
        "path": Path("/nvme0n1-disk/code/app-site/public/static/cogs/h3/accel-sweep/stack-balanced.webm"),
        "meta": "h3 stack-balanced w4a8 accelerated",
    },
    {
        "slug": "glass-hummingbird-live",
        "prompt": (
            "Macro glass hummingbird unfolding translucent wings over nectar, "
            "locked-off cinematic 16:9, synchronized crystalline chimes"
        ),
        "path": Path("/nvme0n1-disk/code/app-site/public/static/cogs/h3/glass-hummingbird-t2v-live.webm"),
        "meta": "h3 live t2v",
    },
    {
        "slug": "glass-hummingbird-w4a8",
        "prompt": (
            "Glass hummingbird in soft morning light, slow push-in, dew on petals, "
            "native stereo ambience with delicate wing shimmer"
        ),
        "path": Path("/nvme0n1-disk/code/app-site/public/static/cogs/h3/glass-hummingbird-t2v-w4a8.webm"),
        "meta": "h3 w4a8",
    },
]


def load_dotenv() -> None:
    """Load manifoldgen .env authoritatively; only borrow R2 keys from app-site."""
    mg = ROOT / ".env"
    if mg.exists():
        for line in mg.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ[k.strip()] = v.strip().strip('"').strip("'")
    shared = Path("/nvme0n1-disk/code/app-site/.env")
    if shared.exists():
        for line in shared.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            key = k.strip()
            if key in ("CLOUDFLARE_R2_ACCESS_KEY_ID", "CLOUDFLARE_R2_SECRET_ACCESS_KEY", "R2_ACCOUNT_ID") and not os.environ.get(key):
                os.environ[key] = v.strip().strip('"').strip("'")
    # Hard defaults for this product's CDN — never inherit another site's bucket.
    os.environ.setdefault("DATABASE_URL", "postgres://manifoldgen:manifoldgen@localhost:5432/manifoldgen?sslmode=disable")
    os.environ["R2_BUCKET"] = os.environ.get("R2_BUCKET") if os.environ.get("R2_BUCKET") == "manifoldgenstatic" else "manifoldgenstatic"
    os.environ["R2_PUBLIC_HOST"] = (
        os.environ.get("R2_PUBLIC_HOST")
        if os.environ.get("R2_PUBLIC_HOST", "").endswith("manifoldgen.com")
        else "manifoldgenstatic.manifoldgen.com"
    )
    os.environ.setdefault("R2_PATH_PREFIX", "gallery")
    # If a shared env overwrote DATABASE_URL to another product, restore.
    if "manifoldgen" not in os.environ.get("DATABASE_URL", ""):
        os.environ["DATABASE_URL"] = "postgres://manifoldgen:manifoldgen@localhost:5432/manifoldgen?sslmode=disable"


def aws_env() -> dict[str, str]:
    env = os.environ.copy()
    env["AWS_ACCESS_KEY_ID"] = env.get("CLOUDFLARE_R2_ACCESS_KEY_ID") or env.get("AWS_ACCESS_KEY_ID", "")
    env["AWS_SECRET_ACCESS_KEY"] = env.get("CLOUDFLARE_R2_SECRET_ACCESS_KEY") or env.get("AWS_SECRET_ACCESS_KEY", "")
    env["AWS_DEFAULT_REGION"] = "auto"
    if not env["AWS_ACCESS_KEY_ID"] or not env["AWS_SECRET_ACCESS_KEY"]:
        raise SystemExit("missing CLOUDFLARE_R2_ACCESS_KEY_ID / CLOUDFLARE_R2_SECRET_ACCESS_KEY")
    return env


def s3_cp(local: Path, key: str, content_type: str, dry_run: bool) -> str:
    url = f"https://{R2_PUBLIC}/{key}"
    if dry_run:
        print(f"  would upload {local} -> {url}")
        return url
    cmd = [
        "aws",
        "--endpoint-url",
        ENDPOINT,
        "s3",
        "cp",
        str(local),
        f"s3://{R2_BUCKET}/{key}",
        "--content-type",
        content_type,
        "--cache-control",
        "public, max-age=31536000, immutable",
    ]
    subprocess.check_call(cmd, env=aws_env())
    return url


def psql(sql: str) -> str:
    return subprocess.check_output(["psql", DATABASE_URL, "-At", "-c", sql], text=True).strip()


def ensure_seed_user() -> str:
    out = psql("SELECT id FROM users ORDER BY created_at ASC LIMIT 1;")
    if not out:
        raise SystemExit("no users in DB; create one via signup first")
    return out


def upsert_completed(job_id: str, user_id: str, prompt: str, service: str, video_url: str, dry_run: bool) -> None:
    result = json.dumps(
        {
            "video_url": video_url,
            "provider": "gallery-seed",
            "service": service,
            "codec": "av1" if video_url.endswith(".webm") else "h264",
        }
    )
    if dry_run:
        print(f"  would upsert {job_id}: {prompt[:60]}… -> {video_url}")
        return
    prompt_lit = prompt.replace("'", "''")
    result_lit = result.replace("'", "''")
    sql = (
        "INSERT INTO video_jobs (id, user_id, provider_job_id, service, status, result_json, prompt, settled, created_at, updated_at) "
        f"VALUES ('{job_id}', '{user_id}', '{job_id}', '{service}', 'completed', '{result_lit}'::jsonb, "
        f"'{prompt_lit}', TRUE, NOW(), NOW()) "
        "ON CONFLICT (id) DO UPDATE SET status='completed', result_json=EXCLUDED.result_json, "
        "prompt=EXCLUDED.prompt, settled=TRUE, updated_at=NOW();"
    )
    subprocess.check_call(["psql", DATABASE_URL, "-c", sql], stdout=subprocess.DEVNULL)


def publish_h3_demos(user_id: str, dry_run: bool) -> int:
    n = 0
    for demo in H3_DEMOS:
        local = demo["path"]
        if not local.exists():
            print(f"  skip missing {local}")
            continue
        key = f"gallery/videos/{demo['slug']}.webm"
        url = s3_cp(local, key, "video/webm", dry_run)
        job_id = f"video_h3_{demo['slug'].replace('-', '_')}"
        upsert_completed(job_id, user_id, demo["prompt"], "h3_video", url, dry_run)
        print(f"  + {demo['slug']} ({demo['meta']})")
        n += 1
    return n


def remux_ltx(user_id: str, dry_run: bool) -> int:
    rows = psql(
        "SELECT id || E'\\t' || prompt || E'\\t' || COALESCE(result_json->>'video_url','') || E'\\t' || "
        "COALESCE(result_json->>'original_video_url','') FROM video_jobs "
        "WHERE service='ltx_video' AND status='completed';"
    )
    if not rows:
        return 0
    n = 0
    for line in rows.splitlines():
        parts = line.split("\t")
        if len(parts) < 3:
            continue
        job_id, prompt, video_url = parts[0], parts[1], parts[2]
        original = parts[3] if len(parts) > 3 else ""
        source = original or video_url
        if not source or "manifoldgenstatic.manifoldgen.com" in video_url:
            continue
        slug = job_id.replace("video_", "")[:12]
        key = f"gallery/videos/ltx-{slug}.webm"
        with tempfile.TemporaryDirectory(prefix="mg-ltx-") as tmp:
            src = Path(tmp) / "src.mp4"
            out = Path(tmp) / "out.webm"
            print(f"  remux {job_id}…")
            if dry_run:
                print(f"    would remux {source} -> https://{R2_PUBLIC}/{key}")
                continue
            urllib.request.urlretrieve(source, src)
            cmd = [
                "ffmpeg",
                "-y",
                "-i",
                str(src),
                "-map",
                "0:v:0",
                "-map",
                "0:a?",
                "-c:v",
                "libsvtav1",
                "-crf",
                "38",
                "-preset",
                "8",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "libopus",
                "-b:a",
                "96k",
                str(out),
            ]
            subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            url = s3_cp(out, key, "video/webm", dry_run=False)
            result = json.dumps(
                {
                    "video_url": url,
                    "original_video_url": source,
                    "provider": "fal-ltx",
                    "codec": "av1",
                    "service": "ltx_video",
                }
            )
            result_lit = result.replace("'", "''")
            prompt_lit = prompt.replace("'", "''")
            sql = (
                f"UPDATE video_jobs SET result_json='{result_lit}'::jsonb, prompt='{prompt_lit}', "
                f"updated_at=NOW() WHERE id='{job_id}';"
            )
            subprocess.check_call(["psql", DATABASE_URL, "-c", sql], stdout=subprocess.DEVNULL)
            n += 1
            print(f"    -> {url}")
    return n


def reindex() -> None:
    try:
        req = urllib.request.Request(f"{API}/api/search/reindex", method="POST")
        urllib.request.urlopen(req, timeout=15).read()
        print("reindex requested")
    except Exception as e:
        print("reindex skip:", e)


def main() -> None:
    load_dotenv()
    global DATABASE_URL, R2_ACCOUNT_ID, R2_BUCKET, R2_PUBLIC, ENDPOINT
    # Never inherit another product's DATABASE_URL from a shared shell env.
    if "manifoldgen" not in os.environ.get("DATABASE_URL", ""):
        os.environ["DATABASE_URL"] = "postgres://manifoldgen:manifoldgen@localhost:5432/manifoldgen?sslmode=disable"
    DATABASE_URL = os.environ["DATABASE_URL"]
    R2_ACCOUNT_ID = os.environ.get("R2_ACCOUNT_ID", R2_ACCOUNT_ID)
    R2_BUCKET = "manifoldgenstatic"
    R2_PUBLIC = "manifoldgenstatic.manifoldgen.com"
    os.environ["R2_BUCKET"] = R2_BUCKET
    os.environ["R2_PUBLIC_HOST"] = R2_PUBLIC
    ENDPOINT = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-ltx", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    user_id = ensure_seed_user()
    print(f"user={user_id} bucket={R2_BUCKET} host={R2_PUBLIC} db=manifoldgen")
    n_h3 = publish_h3_demos(user_id, args.dry_run)
    n_ltx = 0 if args.skip_ltx else remux_ltx(user_id, args.dry_run)
    print(f"published h3={n_h3} remuxed_ltx={n_ltx}")
    if not args.dry_run:
        reindex()


if __name__ == "__main__":
    main()
