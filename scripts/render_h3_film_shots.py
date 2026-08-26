#!/usr/bin/env python3
"""Render every shot of a created-film spec through the local H3 coglet.

Usage (on the production host):
  python3 scripts/render_h3_film_shots.py --spec createdfilms/ember/spec.json

Shots upload to R2 under films/<slug>/shots/<id>.mp4 and cache locally under
createdfilms/<slug>/shots/ for ffmpeg assembly. Resumable: existing complete
shot files are skipped.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
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
    for candidate in (ROOT / ".env", Path("/nvme0n1-disk/code/app-site/.env")):
        if not candidate.exists():
            continue
        for line in candidate.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    os.environ.setdefault("DATABASE_URL", "postgres://manifoldgen:manifoldgen@localhost:5432/manifoldgen?sslmode=disable")


def aws_env() -> dict[str, str]:
    env = os.environ.copy()
    env["AWS_ACCESS_KEY_ID"] = env.get("CLOUDFLARE_R2_ACCESS_KEY_ID", "")
    env["AWS_SECRET_ACCESS_KEY"] = env.get("CLOUDFLARE_R2_SECRET_ACCESS_KEY", "")
    env["AWS_DEFAULT_REGION"] = "auto"
    if not env["AWS_ACCESS_KEY_ID"] or not env["AWS_SECRET_ACCESS_KEY"]:
        raise SystemExit("missing CLOUDFLARE_R2_ACCESS_KEY_ID / CLOUDFLARE_R2_SECRET_ACCESS_KEY")
    return env


def s3_cp(local: Path, key: str) -> str:
    subprocess.check_call([
        "aws", "--endpoint-url", ENDPOINT, "s3", "cp", str(local), f"s3://{R2_BUCKET}/{key}",
        "--content-type", "video/mp4", "--cache-control", "public, max-age=31536000, immutable",
    ], env=aws_env(), stdout=subprocess.DEVNULL)
    return f"https://{R2_PUBLIC_HOST}/{key}"


def predict(cog: str, job_id: str, prompt: str, timeout_s: int) -> dict:
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


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--spec", type=Path, required=True)
    parser.add_argument("--cog", default=os.getenv("H3_LOCAL_COG_URL", "http://127.0.0.1:18089"))
    parser.add_argument("--timeout-s", type=int, default=3300)
    parser.add_argument("--only", help="render a single shot id")
    args = parser.parse_args()

    load_dotenv()
    spec = json.loads(args.spec.read_text())
    slug = spec["slug"]
    out_dir = ROOT / "createdfilms" / slug / "shots"
    out_dir.mkdir(parents=True, exist_ok=True)

    done, failed = 0, 0
    for index, shot in enumerate(spec["shots"], 1):
        shot_id = shot["id"]
        if args.only and shot_id != args.only:
            continue
        local = out_dir / f"{shot_id}.mp4"
        if local.exists() and local.stat().st_size > 100_000:
            print(f"[{index}/{len(spec['shots'])}] skip cached {shot_id}", flush=True)
            continue
        job_id = f"film_{slug}_{shot_id}"
        print(f"[{index}/{len(spec['shots'])}] rendering {job_id}...", flush=True)
        started = time.time()
        try:
            poll = predict(args.cog, job_id, shot["prompt"], args.timeout_s)
        except urllib.error.HTTPError as error:
            print(f"  HTTP {error.code}: {error.read()[:200]!r}", flush=True)
            failed += 1
            continue
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            print(f"  predict failed: {error}", flush=True)
            failed += 1
            continue
        status = str(poll.get("status", "")).lower()
        url = output_url(poll)
        if status not in ("succeeded", "success", "completed") or not url:
            print(f"  bad result status={status} keys={list(poll)}", flush=True)
            failed += 1
            continue
        with urllib.request.urlopen(url, timeout=600) as media, local.open("wb") as handle:
            while chunk := media.read(1 << 20):
                handle.write(chunk)
        public = s3_cp(local, f"films/{slug}/shots/{shot_id}.mp4")
        done += 1
        print(f"  {public} ({time.time() - started:.0f}s, {local.stat().st_size >> 20} MiB)", flush=True)

    print(json.dumps({"slug": slug, "rendered": done, "failed": failed}, sort_keys=True))


if __name__ == "__main__":
    main()
