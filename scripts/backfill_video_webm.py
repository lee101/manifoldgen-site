#!/usr/bin/env python3
"""Re-encode completed video_jobs that still point at MP4 or data: URIs as hosted AV1 WebM.

Search and featured feeds only serve https .webm, so these rows are invisible until backfilled.
Dry-run by default (lists what qualifies). --apply encodes, uploads next to the original
(<key>.webm; data: URIs go to gallery/videos/<job id>.webm) and rewrites result_json URLs.
Originals are left in place.

  python3 scripts/backfill_video_webm.py
  python3 scripts/backfill_video_webm.py --apply --workers 2
"""

from __future__ import annotations

import argparse
import base64
import importlib.util
import os
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[1]
STATIC_HOST = os.getenv('MANIFOLDGEN_STATIC_HOST', 'manifoldgenstatic.manifoldgen.com')
FFMPEG = os.getenv('FFMPEG', '/usr/bin/ffmpeg')
URL_SQL = """COALESCE(result_json->>'video_url', result_json->>'url', result_json->'result'->>'video_url', result_json->'result'->>'url')"""


def load_farm():
    spec = importlib.util.spec_from_file_location('manifold_gallery_generator', ROOT / 'scripts' / 'generate_gallery_art.py')
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def is_webm(url: str) -> bool:
    return urllib.parse.urlparse(url).path.lower().endswith('.webm')


def encode(src: Path, dst: Path) -> None:
    base = [FFMPEG, '-y', '-i', str(src), '-map', '0:v:0', '-map', '0:a?']
    audio = ['-c:a', 'libopus', '-b:a', '96k', '-pix_fmt', 'yuv420p', str(dst)]
    nvenc = base + ['-c:v', 'av1_nvenc', '-preset', 'p5', '-tune', 'hq', '-rc', 'vbr', '-cq', '38', '-b:v', '0'] + audio
    if subprocess.run(nvenc, capture_output=True).returncode == 0:
        return
    svt = base + ['-c:v', 'libsvtav1', '-crf', '38', '-preset', '10', '-svtav1-params', 'lp=8'] + audio
    result = subprocess.run(svt, capture_output=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.decode(errors='replace')[-400:])


def main() -> None:
    farm = load_farm()
    farm.load_dotenv()
    parser = argparse.ArgumentParser()
    parser.add_argument('--database-url', default=os.getenv('DATABASE_URL'))
    parser.add_argument('--limit', type=int, default=0)
    parser.add_argument('--workers', type=int, default=2)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()

    conn = psycopg2.connect(args.database_url)
    with conn.cursor() as cur:
        cur.execute(f"""SELECT id, {URL_SQL} FROM video_jobs
                        WHERE status = 'completed' AND COALESCE(prompt, '') <> ''
                          AND COALESCE(service, '') NOT IN ('sfx_generation', 'music_generation')
                        ORDER BY created_at DESC""")
        rows = [(i, u) for i, u in cur.fetchall() if u and not (u.startswith('https://') and is_webm(u))]
    conn.commit()
    if args.limit:
        rows = rows[:args.limit]
    kinds = {'data': sum(1 for _, u in rows if u.startswith('data:')), 'mp4': sum(1 for _, u in rows if u.startswith('https://')), 'other': 0}
    kinds['other'] = len(rows) - kinds['data'] - kinds['mp4']
    print(f'{len(rows)} rows need webm: {kinds}', flush=True)
    for job_id, url in rows[:40]:
        print(f'  {job_id} {url[:100]}', flush=True)
    if not args.apply:
        return

    r2 = farm.gallery_r2_config()
    client = farm.r2_client(r2)
    tmp = Path(tempfile.mkdtemp(prefix='video-webm-'))

    def work(row: tuple[str, str]) -> tuple[str, str, str, int, int] | None:
        job_id, url = row
        src = tmp / f'{job_id}.src'
        dst = tmp / f'{job_id}.webm'
        try:
            if url.startswith('data:'):
                header, _, payload = url.partition(',')
                if ';base64' not in header:
                    return None
                raw = base64.b64decode(payload)
                src.write_bytes(raw)
                key = f'{r2.prefix}/videos/{job_id}.webm'
            else:
                parsed = urllib.parse.urlparse(url)
                if parsed.netloc != STATIC_HOST:
                    return None
                request = urllib.request.Request(url, headers={'User-Agent': 'manifoldgen-webm-backfill/1.0'})
                with urllib.request.urlopen(request, timeout=300) as response, src.open('wb') as out:
                    while chunk := response.read(1 << 20):
                        out.write(chunk)
                key = parsed.path.lstrip('/').rsplit('.', 1)[0] + '.webm'
            if url.startswith('data:video/webm'):
                src.rename(dst)
            else:
                encode(src, dst)
            size = dst.stat().st_size
            if size == 0:
                return None
            client.upload_file(str(dst), r2.bucket, key, ExtraArgs={'ContentType': 'video/webm', 'CacheControl': 'public, max-age=31536000, immutable'})
            client.head_object(Bucket=r2.bucket, Key=key)
            return job_id, url, f'https://{STATIC_HOST}/{key}', src.stat().st_size if src.exists() else 0, size
        except Exception as error:
            print(f'{job_id}: {error}', flush=True)
            return None
        finally:
            src.unlink(missing_ok=True)
            dst.unlink(missing_ok=True)

    done = before = after = 0
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        for result in pool.map(work, rows):
            if result is None:
                continue
            job_id, old, new, original_size, size = result
            with conn.cursor() as cur:
                cur.execute("UPDATE video_jobs SET result_json = replace(result_json::text, %s, %s)::jsonb WHERE id = %s",
                            (old.replace('\\', '\\\\').replace('"', '\\"'), new, job_id))
            conn.commit()
            done += 1
            before += original_size
            after += size
            print(f'{job_id}: {original_size / 1048576:.1f} MiB -> {size / 1048576:.1f} MiB {new}', flush=True)
    print(f'updated {done}/{len(rows)}: {before / 1048576:.1f} MiB -> {after / 1048576:.1f} MiB', flush=True)


if __name__ == '__main__':
    main()
