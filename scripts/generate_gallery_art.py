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
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid
from dataclasses import dataclass
from pathlib import Path

import boto3
import psycopg2
from botocore.config import Config
from concurrent.futures import Future, ThreadPoolExecutor
from PIL import Image
import requests


ROOT = Path(__file__).resolve().parents[1]
STOP = False

# The native gateway accepts 64-pixel aligned canvases. These keep the same
# approximate pixel budget as a 1024px square while giving the public gallery
# a useful mix of portrait and landscape work, even for older prompt files.
MIXED_DIMENSIONS = (
    (1024, 1024),
    (768, 1344),
    (1344, 768),
    (768, 1024),
    (1024, 768),
)


@dataclass(frozen=True)
class PromptSpec:
    prompt: str
    seed: int | None = None
    width: int | None = None
    height: int | None = None


@dataclass
class RenderedImage:
    number: int
    prompt: str
    image_id: str
    relpath: str
    thumb_relpath: str
    destination: Path
    thumb_destination: Path | None
    width: int
    height: int
    size: int
    seed: int
    is_nsfw: bool | None
    timings: dict[str, float]


@dataclass(frozen=True)
class GalleryR2Config:
    account: str
    endpoint: str
    bucket: str
    prefix: str
    access_key: str
    secret_key: str


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


def parse_dimension(value: object) -> tuple[int, int] | None:
    if isinstance(value, str):
        parts = value.lower().split('x')
        if len(parts) == 2 and all(part.isdigit() for part in parts):
            width, height = (int(part) for part in parts)
        else:
            return None
    elif isinstance(value, dict):
        width, height = value.get('width'), value.get('height')
        if not isinstance(width, int) or isinstance(width, bool) or not isinstance(height, int) or isinstance(height, bool):
            return None
    else:
        return None
    if not (64 <= width <= 4096 and 64 <= height <= 4096 and width % 64 == 0 and height % 64 == 0):
        return None
    return width, height


def read_prompts(path: Path) -> list[PromptSpec]:
    prompts: list[PromptSpec] = []
    seen: set[str] = set()
    for line_number, raw in enumerate(path.read_text().splitlines(), 1):
        raw = raw.strip()
        if not raw or raw.startswith('#'):
            continue
        value = None
        dimensions = None
        try:
            value = json.loads(raw)
            prompt = value.get('prompt', '') if isinstance(value, dict) else ''
            seed_value = value.get('seed') if isinstance(value, dict) else None
            if isinstance(value, dict):
                dimensions = parse_dimension(value.get('size'))
                if dimensions is None and 'width' in value and 'height' in value:
                    dimensions = parse_dimension({'width': value.get('width'), 'height': value.get('height')})
        except json.JSONDecodeError:
            prompt = raw
            seed_value = None
        prompt = str(prompt).strip()
        if 12 <= len(prompt) <= 900 and prompt not in seen:
            seed = seed_value if isinstance(seed_value, int) and not isinstance(seed_value, bool) else None
            if isinstance(value, dict) and any(value.get(key) is not None for key in ('size', 'width', 'height')) and dimensions is None:
                raise ValueError(f'{path}:{line_number}: size/width/height must describe 64-aligned dimensions')
            prompts.append(PromptSpec(prompt, seed, *(dimensions or (None, None))))
            seen.add(prompt)
    return prompts


def generate(endpoint: str, model: str, prompt: str, width: int, height: int, seed: int, low_priority: bool) -> bytes:
    # The direct CuteDSL worker is the durable local art path. OmniServe's
    # OpenAI route is retained for deployments that expose it with auth.
    direct_worker = endpoint.rstrip('/').endswith(':8100')
    body = json.dumps({
        'prompt': prompt,
        'seed': seed,
        **({
            'width': width,
            'height': height,
            'num_inference_steps': 8,
            # This script is a resumable gallery farm. Direct worker requests
            # must remain background traffic even when an older service unit
            # omitted --low-priority; otherwise a capacity retry can sit ahead
            # of interactive image requests for the full HTTP budget.
            'low_priority': True,
        } if direct_worker else {
            'model': model, 'size': f'{width}x{height}', 'n': 1, 'low_priority': low_priority,
        }),
    }).encode()
    headers = {'Content-Type': 'application/json'}
    if secret := image_worker_secret():
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


def gallery_r2_config() -> GalleryR2Config:
    account = os.getenv("MANIFOLDGEN_R2_ACCOUNT_ID", os.getenv("R2_ACCOUNT_ID", ""))
    endpoint = os.getenv("MANIFOLDGEN_R2_ENDPOINT", f"https://{account}.r2.cloudflarestorage.com")
    bucket = os.getenv("MANIFOLDGEN_R2_BUCKET", "manifoldgenstatic").strip()
    prefix = os.getenv("MANIFOLDGEN_R2_PATH_PREFIX", "gallery").strip("/")
    key = os.getenv("MANIFOLDGEN_R2_ACCESS_KEY_ID", os.getenv("CLOUDFLARE_R2_ACCESS_KEY_ID", ""))
    secret = os.getenv("MANIFOLDGEN_R2_SECRET_ACCESS_KEY", os.getenv("CLOUDFLARE_R2_SECRET_ACCESS_KEY", ""))
    if not all((account, endpoint, bucket, prefix, key, secret)):
        raise RuntimeError("ManifoldGen R2 account, bucket, prefix, and credentials are required for --upload-r2")
    return GalleryR2Config(account, endpoint, bucket, prefix, key, secret)


def r2_client(config: GalleryR2Config) -> object:
    return boto3.client("s3", endpoint_url=config.endpoint, aws_access_key_id=config.access_key,
                        aws_secret_access_key=config.secret_key, region_name="auto", config=Config(s3={"addressing_style": "path"}))


def image_worker_secret(preferred_env: str = "OMNISERVE_NATIVE_SECRET") -> str:
    return os.getenv(
        preferred_env,
        os.getenv("OMNISERVE_IMAGE_WORKER_SECRET", os.getenv("OMNISERVE_SECRET", os.getenv("IMAGE_API_SECRET", ""))),
    )


def moderate_image(endpoint: str, path: Path, threshold: float, secret_env: str, unload_after: bool = True) -> tuple[bool, float]:
    secret = image_worker_secret(secret_env)
    params = {"secret": secret} if secret else {}
    if not unload_after:
        params["unload_after"] = "false"
    with path.open("rb") as image:
        response = requests.post(
            endpoint.rstrip("/") + "/nsfw_detect_file",
            params=params,
            files={"image_file": (path.name, image, "image/webp")},
            timeout=120,
        )
    response.raise_for_status()
    payload = response.json()
    score = float(payload.get("nsfw_score", payload.get("score", 0)))
    return score >= threshold, score


def save_thumbnail(image: Image.Image, destination: Path, max_side: int, quality: int) -> None:
    thumb = image.copy()
    thumb.thumbnail((max_side, max_side), Image.LANCZOS)
    thumb.save(destination, 'WEBP', quality=quality, method=4)


def upload_public(client: object, bucket: str, key: str, path: Path) -> None:
    client.upload_file(str(path), bucket, key, ExtraArgs={"ContentType": "image/webp", "CacheControl": "public, max-age=31536000, immutable"})
    # Do not put a broken URL in the catalog when an endpoint,
    # credential, or bucket mapping is misconfigured.
    client.head_object(Bucket=bucket, Key=key)


def publish_image(item: RenderedImage, conn: object, client: object | None, bucket: str, prefix: str) -> None:
    started = time.monotonic()
    uploaded: list[str] = []
    try:
        if client and item.is_nsfw is not True:
            for relpath, path in ((item.relpath, item.destination), (item.thumb_relpath, item.thumb_destination)):
                if path is None:
                    continue
                key = f"{prefix}/{relpath}"
                upload_public(client, bucket, key, path)
                uploaded.append(key)
        with conn.cursor() as cur:
            cur.execute(
                '''INSERT INTO generated_images
                   (id, prompt, width, height, file_path, thumb_path, med_path, file_size, model, seed, steps, is_nsfw, created_by_user_id)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, '')''',
                (item.image_id, item.prompt, item.width, item.height, item.relpath, item.thumb_relpath, item.relpath,
                 item.size, 'zimage-turbo-native', item.seed, 4, item.is_nsfw),
            )
        conn.commit()
    except BaseException:
        try:
            conn.rollback()
        except psycopg2.Error:
            pass
        for key in uploaded:
            try:
                client.delete_object(Bucket=bucket, Key=key)
            except Exception:
                pass
        for path in (item.destination, item.thumb_destination):
            if path is not None:
                try:
                    path.unlink()
                except OSError:
                    pass
        raise
    item.timings['publish'] = time.monotonic() - started
    if uploaded:
        for path in (item.destination, item.thumb_destination):
            if path is None:
                continue
            try:
                path.unlink()
            except FileNotFoundError:
                pass
            except OSError as error:
                print(f'[{item.number}] R2 copy is safe; local spool cleanup failed: {error}', flush=True)


def moderate_and_publish(item: RenderedImage, moderation: tuple | None, conn: object, client: object | None,
                         bucket: str, prefix: str) -> None:
    if moderation is not None:
        endpoint, threshold, secret_env, unload_after, moderate_full, total = moderation
        started = time.monotonic()
        moderation_input = item.destination if moderate_full or item.thumb_destination is None else item.thumb_destination
        item.is_nsfw, score = moderate_image(endpoint, moderation_input, threshold, secret_env, unload_after=unload_after)
        item.timings['moderate'] = time.monotonic() - started
        print(f'[{item.number}/{total}] nsfw_score={score:.4f} flagged={item.is_nsfw}', flush=True)
    publish_image(item, conn, client, bucket, prefix)


def claim_prompt(conn: object, prompt: str) -> bool:
    with conn.cursor() as cur:
        cur.execute("SELECT pg_try_advisory_lock(hashtext(%s))", (prompt,))
        claimed = bool(cur.fetchone()[0])
    conn.commit()
    return claimed


def prompt_is_indexed(conn: object, prompt: str) -> bool:
    with conn.cursor() as cur:
        cur.execute('SELECT EXISTS (SELECT 1 FROM generated_images WHERE prompt = %s)', (prompt,))
        indexed = bool(cur.fetchone()[0])
    conn.commit()
    return indexed


def release_prompt(conn: object, prompt: str) -> None:
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT pg_advisory_unlock(hashtext(%s))", (prompt,))
        conn.commit()
    except psycopg2.Error:
        conn.rollback()


def reindex(database_url: str) -> None:
    api_key = subprocess.check_output(
        ["psql", database_url, "-At", "-c", "SELECT api_key FROM users WHERE api_key <> '' ORDER BY created_at ASC LIMIT 1;"],
        text=True,
    ).strip()
    if not api_key:
        raise RuntimeError("no API key is available to authorize search reindexing")
    request = urllib.request.Request(
        os.getenv("MANIFOLDGEN_API", "http://127.0.0.1:8116").rstrip("/") + "/api/search/reindex",
        method="POST",
        headers={"Authorization": f"Bearer {api_key}"},
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        if response.status != 202:
            raise RuntimeError(f"reindex returned HTTP {response.status}")
    print("search reindex requested", flush=True)
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
    parser.add_argument('--mixed-aspect', action='store_true', help='use a deterministic square/portrait/landscape mix when a row has no dimensions')
    parser.add_argument('--webp-quality', type=int, default=85, help='WebP quality for indexed files (default: 85)')
    parser.add_argument('--webp-method', type=int, default=4, help='WebP encoder effort 0-6; 6 is ~2x slower for the same size')
    parser.add_argument('--thumb-size', type=int, default=512, help='max side of the gallery grid thumbnail; 0 serves originals in the grid')
    parser.add_argument('--thumb-quality', type=int, default=78)
    parser.add_argument('--limit', type=int, default=0, help='0 means all pending prompts')
    parser.add_argument('--low-priority', action='store_true')
    parser.add_argument('--delay', type=float, default=2.0)
    parser.add_argument('--upload-r2', action='store_true', help='publish each file before it becomes searchable')
    parser.add_argument('--min-free-gib', type=float, default=80.0, help='stop before the local spool gets too full')
    parser.add_argument('--retries', type=int, default=8, help='retries per prompt for busy/temporarily unavailable workers')
    parser.add_argument('--retry-delay', type=float, default=15.0, help='initial retry delay; exponential backoff is capped at 5 minutes')
    parser.add_argument('--moderate-before-index', action='store_true', help='classify locally before publishing or indexing; unsafe output is quarantined locally')
    parser.add_argument('--moderation-endpoint', default='', help='separate nsfw_detect_file endpoint when the image worker lacks moderation')
    parser.add_argument('--nsfw-threshold', type=float, default=0.5)
    parser.add_argument('--moderation-secret-env', default='OMNISERVE_NATIVE_SECRET')
    parser.add_argument('--moderate-full', action='store_true', help='send the full-size image to moderation instead of the grid thumbnail')
    parser.add_argument('--moderation-unload', action='store_true', help='ask the worker to unload the classifier after every image')
    parser.add_argument('--reindex-every', type=int, default=0, help='request a search rebuild after each N indexed rows; 0 means only at the end when --reindex-after is set')
    parser.add_argument('--moderate-after', action='store_true', help='moderate this bounded batch after generation')
    parser.add_argument('--reindex-after', action='store_true', help='request authenticated search reindexing after moderation')
    args = parser.parse_args()
    if not 1 <= args.webp_quality <= 100:
        raise SystemExit('--webp-quality must be between 1 and 100')
    if parse_dimension({'width': args.width, 'height': args.height}) is None:
        raise SystemExit('--width and --height must be 64-aligned dimensions between 64 and 4096')
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
    conn.commit()
    pending = [spec for spec in prompts if spec.prompt not in existing]
    if args.limit:
        pending = pending[:args.limit]
    print(f'{len(prompts)} prompts, {len(existing)} indexed, {len(pending)} pending', flush=True)

    originals = args.images_dir / 'originals'
    originals.mkdir(parents=True, exist_ok=True)
    if args.thumb_size:
        (args.images_dir / 'thumbs').mkdir(parents=True, exist_ok=True)
    ensure_free_space(args.images_dir, args.min_free_gib)
    r2 = gallery_r2_config() if args.upload_r2 else None
    client = r2_client(r2) if r2 else None
    bucket = r2.bucket if r2 else ""
    prefix = r2.prefix if r2 else "gallery"
    publish_conn = psycopg2.connect(args.database_url)
    publish_conn.autocommit = False
    publisher = ThreadPoolExecutor(max_workers=1, thread_name_prefix='gallery-publish')
    in_flight: tuple[Future, RenderedImage] | None = None
    generated = 0

    def finish_publish() -> None:
        nonlocal in_flight, generated
        if in_flight is None:
            return
        future, item = in_flight
        in_flight = None
        try:
            future.result()
            generated += 1
            t = item.timings
            stages = ' '.join(f'{name}={t[name]:.1f}s' for name in ('generate', 'encode', 'moderate', 'publish') if name in t)
            verb = 'quarantined' if item.is_nsfw is True else 'indexed'
            print(f'[{item.number}/{len(pending)}] {verb} {item.relpath} {stages}', flush=True)
            if args.reindex_every and generated % args.reindex_every == 0:
                reindex(args.database_url)
        except (OSError, RuntimeError, urllib.error.URLError, requests.RequestException, ValueError, psycopg2.Error) as error:
            print(f'[{item.number}/{len(pending)}] failed: {error}', flush=True)
        except Exception as error:
            print(f'[{item.number}/{len(pending)}] failed: {type(error).__name__}: {error}', flush=True)
        finally:
            release_prompt(conn, item.prompt)

    for number, spec in enumerate(pending, 1):
        prompt = spec.prompt
        prompt_seed = spec.seed
        if STOP:
            print('stop requested; current work is indexed and the next run will resume', flush=True)
            break
        digest = hashlib.sha256(prompt.encode()).hexdigest()[:16]
        if spec.width is not None and spec.height is not None:
            width, height = spec.width, spec.height
        elif args.mixed_aspect:
            width, height = MIXED_DIMENSIONS[int(digest[:8], 16) % len(MIXED_DIMENSIONS)]
        else:
            width, height = args.width, args.height
        seed = prompt_seed if prompt_seed is not None else int(digest[:8], 16) % (2**31)
        if not claim_prompt(conn, prompt):
            print(f'[{number}/{len(pending)}] claimed by another worker; skipping', flush=True)
            continue
        if prompt_is_indexed(conn, prompt):
            print(f'[{number}/{len(pending)}] indexed by another worker; skipping', flush=True)
            release_prompt(conn, prompt)
            continue
        destination: Path | None = None
        thumb_destination: Path | None = None
        handed_off = False
        stop_run = False
        try:
            ensure_free_space(args.images_dir, args.min_free_gib)
            timings: dict[str, float] = {}
            started = time.monotonic()
            raw = b''
            for attempt in range(args.retries + 1):
                try:
                    raw = generate(args.endpoint, args.model, prompt, width, height, seed, args.low_priority)
                    break
                except urllib.error.HTTPError as error:
                    if error.code not in (429, 500, 502, 503, 504) or attempt == args.retries:
                        raise
                    wait = min(args.retry_delay * (2 ** attempt), 300)
                    print(f'[{number}/{len(pending)}] worker HTTP {error.code}; retrying in {wait:.0f}s', flush=True)
                    time.sleep(wait)
            timings['generate'] = time.monotonic() - started
            started = time.monotonic()
            image = Image.open(io.BytesIO(raw)).convert('RGB')
            image_id = str(uuid.uuid4())
            name = f'{digest}_{image_id[:8]}.webp'
            relpath = f'originals/{name}'
            destination = args.images_dir / relpath
            image.save(destination, 'WEBP', quality=args.webp_quality, method=args.webp_method)
            thumb_relpath = relpath
            if args.thumb_size and max(image.size) > args.thumb_size:
                thumb_relpath = f'thumbs/{name}'
                thumb_destination = args.images_dir / thumb_relpath
                save_thumbnail(image, thumb_destination, args.thumb_size, args.thumb_quality)
            timings['encode'] = time.monotonic() - started
            item = RenderedImage(number, prompt, image_id, relpath, thumb_relpath, destination, thumb_destination,
                                 image.width, image.height, destination.stat().st_size, seed, None, timings)
            moderation = None
            if args.moderate_before_index:
                moderation = (args.moderation_endpoint or args.endpoint, args.nsfw_threshold,
                              args.moderation_secret_env, args.moderation_unload, args.moderate_full, len(pending))
            finish_publish()
            in_flight = (publisher.submit(moderate_and_publish, item, moderation, publish_conn, client, bucket, prefix), item)
            handed_off = True
        except (OSError, RuntimeError, urllib.error.URLError, urllib.error.HTTPError, requests.RequestException, ValueError, psycopg2.Error) as error:
            for path in (destination, thumb_destination):
                if path is not None:
                    try:
                        path.unlink()
                    except OSError:
                        pass
            print(f'[{number}/{len(pending)}] failed: {error}', flush=True)
            stop_run = isinstance(error, RuntimeError) and str(error).startswith('stopping safely:')
        finally:
            if not handed_off:
                release_prompt(conn, prompt)
        if stop_run:
            break
        if args.delay:
            time.sleep(args.delay)

    finish_publish()
    publisher.shutdown(wait=True)
    publish_conn.close()

    if args.moderate_after and generated:
        print(f"moderating up to {generated} generated images", flush=True)
        subprocess.check_call([
            sys.executable,
            str(ROOT / "scripts" / "moderate_gallery_art.py"),
            "--limit", str(generated),
            "--endpoint", args.moderation_endpoint or args.endpoint,
            "--images-dir", str(args.images_dir),
        ])
    if args.reindex_after:
        reindex(args.database_url)
    print(f"batch complete: generated={generated} requested={len(pending)}", flush=True)


if __name__ == '__main__':
    main()
