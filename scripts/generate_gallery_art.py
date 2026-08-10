#!/usr/bin/env python3
"""Generate and index gallery art from a JSONL or newline-delimited prompt file.

The runner is resumable: prompts already present in ``generated_images`` are
skipped. It is intended for low-priority native Z-Image endpoints; each result
is normalized to WebP quality 85 before it is indexed.

Example:
  nice -n 19 python3 scripts/generate_gallery_art.py \
    --prompts scripts/prompts/manifold-gallery.jsonl \
    --endpoint http://127.0.0.1:8791 --limit 48 --low-priority
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import signal
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

import boto3
import psycopg2
from botocore.config import Config
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
STOP = False


def stop(_signum: int, _frame: object) -> None:
    global STOP
    STOP = True


signal.signal(signal.SIGINT, stop)
signal.signal(signal.SIGTERM, stop)


def load_dotenv() -> None:
    for path in (ROOT / '.env',):
        if not path.exists():
            continue
        for line in path.read_text().splitlines():
            if '=' not in line or line.lstrip().startswith('#'):
                continue
            key, value = line.split('=', 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def read_prompts(path: Path) -> list[str]:
    prompts: list[str] = []
    seen: set[str] = set()
    for raw in path.read_text().splitlines():
        raw = raw.strip()
        if not raw or raw.startswith('#'):
            continue
        try:
            value = json.loads(raw)
            prompt = value.get('prompt', '') if isinstance(value, dict) else ''
        except json.JSONDecodeError:
            prompt = raw
        prompt = str(prompt).strip()
        if 12 <= len(prompt) <= 900 and prompt not in seen:
            prompts.append(prompt)
            seen.add(prompt)
    return prompts


def generate(endpoint: str, model: str, prompt: str, width: int, height: int, seed: int, low_priority: bool) -> bytes:
    # The direct CuteDSL worker is the durable local art path. OmniServe's
    # OpenAI route is retained for deployments that expose it with auth.
    direct_worker = endpoint.rstrip('/').endswith(':8100')
    body = json.dumps({
        'prompt': prompt,
        'seed': seed,
        **({'width': width, 'height': height, 'num_inference_steps': 8} if direct_worker else {
            'model': model, 'size': f'{width}x{height}', 'n': 1, 'low_priority': low_priority,
        }),
    }).encode()
    headers = {'Content-Type': 'application/json'}
    if secret := os.getenv('OMNISERVE_NATIVE_SECRET', os.getenv('OMNISERVE_SECRET', '')):
        headers['Authorization'] = f'Bearer {secret}'
    request = urllib.request.Request(
        endpoint.rstrip('/') + ('/generate_image' if direct_worker else '/v1/images/generations'),
        data=body,
        headers=headers,
        method='POST',
    )
    with urllib.request.urlopen(request, timeout=600) as response:
        if response.status != 200:
            raise RuntimeError(f'inference returned HTTP {response.status}')
        result = response.read()
    # Native image workers return a direct WebP while the CuteDSL-compatible
    # worker returns JSON with image_base64. Accept both without a proxy.
    if result.lstrip().startswith(b'{'):
        payload = json.loads(result)
        encoded = payload.get('image_base64', '')
        if not encoded and isinstance(payload.get('data'), list) and payload['data']:
            encoded = payload['data'][0].get('b64_json', '')
        if not encoded:
            raise RuntimeError('image worker response has no image_base64')
        import base64
        return base64.b64decode(encoded)
    return result


def ensure_free_space(directory: Path, minimum_gib: float) -> None:
    free = os.statvfs(directory).f_bavail * os.statvfs(directory).f_frsize
    if free < int(minimum_gib * 1024**3):
        raise RuntimeError(f"stopping safely: only {free / 1024**3:.1f} GiB free in {directory}")


def r2_client() -> object:
    account = os.getenv("R2_ACCOUNT_ID", "")
    key = os.getenv("CLOUDFLARE_R2_ACCESS_KEY_ID", "")
    secret = os.getenv("CLOUDFLARE_R2_SECRET_ACCESS_KEY", "")
    bucket = os.getenv("R2_BUCKET", "")
    if not all((account, key, secret, bucket)):
        raise RuntimeError("R2_ACCOUNT_ID, R2_BUCKET, and R2 credentials are required for --upload-r2")
    return boto3.client("s3", endpoint_url=f"https://{account}.r2.cloudflarestorage.com", aws_access_key_id=key,
                        aws_secret_access_key=secret, region_name="auto", config=Config(s3={"addressing_style": "path"}))


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser()
    parser.add_argument('--prompts', type=Path, required=True)
    parser.add_argument('--endpoint', default=os.getenv('GALLERY_IMAGE_WORKER_URL', 'http://127.0.0.1:8100'),
                        help='CuteDSL/OmniServe image worker; it accepts jobs behind the native gateway')
    parser.add_argument('--database-url', default=os.getenv('DATABASE_URL'))
    parser.add_argument('--images-dir', type=Path, default=Path(os.getenv('IMAGES_DIR', '/sdb-disk/manifoldgen-images')))
    parser.add_argument('--model', default='z_image_turbo-Q8_0')
    parser.add_argument('--width', type=int, default=1024)
    parser.add_argument('--height', type=int, default=1024)
    parser.add_argument('--limit', type=int, default=0, help='0 means all pending prompts')
    parser.add_argument('--low-priority', action='store_true')
    parser.add_argument('--delay', type=float, default=2.0)
    parser.add_argument('--upload-r2', action='store_true', help='publish each file before it becomes searchable')
    parser.add_argument('--min-free-gib', type=float, default=80.0, help='stop before the local spool gets too full')
    parser.add_argument('--retries', type=int, default=8, help='retries per prompt for busy/temporarily unavailable workers')
    parser.add_argument('--retry-delay', type=float, default=15.0, help='initial retry delay; exponential backoff is capped at 5 minutes')
    args = parser.parse_args()
    if not args.database_url:
        raise SystemExit('DATABASE_URL is required')
    prompts = read_prompts(args.prompts)
    if not prompts:
        raise SystemExit(f'no prompts found in {args.prompts}')

    conn = psycopg2.connect(args.database_url)
    conn.autocommit = False
    with conn.cursor() as cur:
        cur.execute('SELECT prompt FROM generated_images')
        existing = {row[0] for row in cur}
    pending = [prompt for prompt in prompts if prompt not in existing]
    if args.limit:
        pending = pending[:args.limit]
    print(f'{len(prompts)} prompts, {len(existing)} indexed, {len(pending)} pending', flush=True)

    originals = args.images_dir / 'originals'
    originals.mkdir(parents=True, exist_ok=True)
    client = r2_client() if args.upload_r2 else None
    bucket = os.getenv("R2_BUCKET", "")
    prefix = os.getenv("R2_PATH_PREFIX", "gallery").strip("/")
    for number, prompt in enumerate(pending, 1):
        if STOP:
            print('stop requested; current work is indexed and the next run will resume', flush=True)
            break
        digest = hashlib.sha256(prompt.encode()).hexdigest()[:16]
        seed = int(digest[:8], 16) % (2**31)
        try:
            ensure_free_space(args.images_dir, args.min_free_gib)
            raw = b''
            for attempt in range(args.retries + 1):
                try:
                    raw = generate(args.endpoint, args.model, prompt, args.width, args.height, seed, args.low_priority)
                    break
                except urllib.error.HTTPError as error:
                    if error.code not in (429, 500, 502, 503, 504) or attempt == args.retries:
                        raise
                    wait = min(args.retry_delay * (2 ** attempt), 300)
                    print(f'[{number}/{len(pending)}] worker HTTP {error.code}; retrying in {wait:.0f}s', flush=True)
                    time.sleep(wait)
            image = Image.open(io.BytesIO(raw)).convert('RGB')
            image_id = str(uuid.uuid4())
            relpath = f'originals/{digest}_{image_id[:8]}.webp'
            destination = args.images_dir / relpath
            image.save(destination, 'WEBP', quality=85, method=6)
            size = destination.stat().st_size
            if client:
                object_key = f"{prefix}/{relpath}"
                client.upload_file(str(destination), bucket, object_key, ExtraArgs={"ContentType": "image/webp", "CacheControl": "public, max-age=31536000, immutable"})
                # Do not put a broken URL in the catalog when an endpoint,
                # credential, or bucket mapping is misconfigured.
                client.head_object(Bucket=bucket, Key=object_key)
            with conn.cursor() as cur:
                cur.execute(
                    '''INSERT INTO generated_images
                       (id, prompt, width, height, file_path, thumb_path, med_path, file_size, model, seed, steps, created_by_user_id)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, '')''',
                    (image_id, prompt, image.width, image.height, relpath, relpath, relpath, size, 'zimage-turbo-native', seed, 4),
                )
            conn.commit()
            print(f'[{number}/{len(pending)}] indexed {relpath}', flush=True)
        except (OSError, RuntimeError, urllib.error.URLError, urllib.error.HTTPError) as error:
            conn.rollback()
            print(f'[{number}/{len(pending)}] failed: {error}', flush=True)
        if args.delay:
            time.sleep(args.delay)


if __name__ == '__main__':
    main()
