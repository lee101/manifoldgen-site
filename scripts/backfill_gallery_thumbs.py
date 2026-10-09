#!/usr/bin/env python3
"""Create grid thumbnails for gallery rows whose thumb_path still points at the original.

Dry-run by default: reports how many rows qualify and the measured byte savings on a
sample. --apply uploads gallery/thumbs/<name>.webp to R2 and updates thumb_path.

  python3 scripts/backfill_gallery_thumbs.py --sample 200
  python3 scripts/backfill_gallery_thumbs.py --apply --workers 8
"""

from __future__ import annotations

import argparse
import importlib.util
import io
import os
import sys
import tempfile
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import psycopg2
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CDN = os.getenv('MANIFOLDGEN_GALLERY_CDN', 'https://manifoldgenstatic.manifoldgen.com/gallery')


def load_farm():
    spec = importlib.util.spec_from_file_location('manifold_gallery_generator', ROOT / 'scripts' / 'generate_gallery_art.py')
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def original_bytes(images_dir: Path, relpath: str) -> bytes:
    local = images_dir / relpath
    if local.exists():
        return local.read_bytes()
    request = urllib.request.Request(f'{CDN}/{relpath}', headers={'User-Agent': 'manifoldgen-thumb-backfill/1.0'})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def main() -> None:
    farm = load_farm()
    farm.load_dotenv()
    parser = argparse.ArgumentParser()
    parser.add_argument('--database-url', default=os.getenv('DATABASE_URL'))
    parser.add_argument('--images-dir', type=Path, default=Path(os.getenv('IMAGES_DIR', '/sdb-disk/manifoldgen-images')))
    parser.add_argument('--thumb-size', type=int, default=512)
    parser.add_argument('--thumb-quality', type=int, default=78)
    parser.add_argument('--sample', type=int, default=100, help='dry-run rows to measure')
    parser.add_argument('--limit', type=int, default=0)
    parser.add_argument('--workers', type=int, default=8)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()

    conn = psycopg2.connect(args.database_url)
    with conn.cursor() as cur:
        cur.execute('''SELECT id, file_path FROM generated_images
                       WHERE thumb_path = file_path AND file_path LIKE 'originals/%%' AND is_nsfw = FALSE
                         AND GREATEST(width, height) > %s
                       ORDER BY created_at DESC''', (args.thumb_size,))
        rows = cur.fetchall()
    conn.commit()
    if args.limit:
        rows = rows[:args.limit]
    print(f'{len(rows)} rows need thumbnails', flush=True)
    if not args.apply:
        rows = rows[:args.sample]

    r2 = farm.gallery_r2_config() if args.apply else None
    client = farm.r2_client(r2) if r2 else None
    tmp = Path(tempfile.mkdtemp(prefix='gallery-thumbs-'))

    def work(row: tuple[str, str]) -> tuple[str, str, int, int] | None:
        image_id, relpath = row
        try:
            raw = original_bytes(args.images_dir, relpath)
            thumb_rel = 'thumbs/' + relpath.split('/', 1)[1]
            out = tmp / thumb_rel.replace('/', '_')
            farm.save_thumbnail(Image.open(io.BytesIO(raw)).convert('RGB'), out, args.thumb_size, args.thumb_quality)
            size = out.stat().st_size
            if client:
                farm.upload_public(client, r2.bucket, f'{r2.prefix}/{thumb_rel}', out)
            out.unlink()
            return image_id, thumb_rel, len(raw), size
        except Exception as error:
            print(f'{relpath}: {error}', flush=True)
            return None

    done = before = after = 0
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        for result in pool.map(work, rows):
            if result is None:
                continue
            image_id, thumb_rel, original_size, thumb_size = result
            before += original_size
            after += thumb_size
            done += 1
            if args.apply:
                with conn.cursor() as cur:
                    cur.execute('UPDATE generated_images SET thumb_path = %s WHERE id = %s AND thumb_path = file_path', (thumb_rel, image_id))
                conn.commit()
            if done % 500 == 0:
                print(f'{done}/{len(rows)}', flush=True)
    if done:
        print(f'{"updated" if args.apply else "measured"} {done}: original avg {before / done / 1024:.1f} KiB -> thumb avg {after / done / 1024:.1f} KiB ({before / max(after, 1):.1f}x)', flush=True)


if __name__ == '__main__':
    main()
