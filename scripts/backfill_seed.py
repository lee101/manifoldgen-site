#!/usr/bin/env python3
"""Seed ManifoldGen shared gallery (omniserve-native) + queue H3 videos (native).

Usage:
  python scripts/backfill_seed.py [--images N] [--videos N] [--dry-run]
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import random
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OMNI = os.environ.get("OMNISERVE_NATIVE_URL", "http://127.0.0.1:8791").rstrip("/")
ZIMAGE = os.environ.get("ZIMAGE_BACKEND_URL", "http://127.0.0.1:8100").rstrip("/")
API = os.environ.get("MANIFOLDGEN_API", "http://127.0.0.1:8116").rstrip("/")
IMAGES_DIR = Path(os.environ.get("IMAGES_DIR", "/nvme0n1-disk/manifoldgen-images"))
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgres://manifoldgen:manifoldgen@localhost:5432/manifoldgen?sslmode=disable",
)

PROMPTS = [
    "Baroque oil portrait of a marble goddess half-lit by candle smoke, cracked varnish, museum dusk",
    "Cyber-geisha under monsoon neon, rain beading on lacquered skin, reflective puddles, anamorphic bokeh",
    "Surreal desert cathedral of bone-white arches, lone dancer silhouette, golden hour god rays",
    "Intimate chiaroscuro study: silk robe slipping from a shoulder, Rembrandt window light, soft grain",
    "Art-nouveau femme fatale with peacock halo, emerald jewelry, Alphonse Mucha linework, ink wash",
    "Underwater ballroom: floating chandeliers, velvet dress drifting, bioluminescent plankton trails",
    "Brutalist rooftop at blue hour, lingerie model against concrete ribs, film still, Contax G2 look",
    "Renaissance bacchanal remix: grapes, gold leaf, flushed cheeks, Caravaggio drama, tasteful nude study",
    "Glass orchid greenhouse at night, condensation, orchid glow, soft body silhouette behind frosted panes",
    "Noir alley jazz singer in scarlet satin, cigarette haze, wet cobblestones, 50mm cinema still",
    "Dreamlike Japanese bathhouse steam, tattooed back, lanterns, wood grain, erotic stillness, Ukiyo-e mood",
    "Astronaut peeling helmet in flower field, pollen floating, soft focus, editorial fashion photography",
    "Obsidian sculpture of intertwined lovers, museum spotlight, specular highlights, hyperreal marble",
    "Midnight carnival carousel, silk carnival costume, motion blur lights, sensual confidence, Kodak Portra",
    "Solarpunk terrace breakfast, sheer linen dress in wind, citrus steam, volumetric morning light",
    "Ink-black ink wash of a fox spirit woman, loose calligraphy strokes, erotic folklore illustration",
    "Industrial loft mirror selfie study, artistic nude, window blinds stripes, Helmut Newton attitude",
    "Temple ruins at dusk, dancer mid-spin in translucent gold chiffon, dust motes, IMAX wide",
    "Velvet boudoir still life: pearls, perfume, silk stockings, painterly, Flemish masters color",
    "Glacier cave fashion editorial, crystalline teal walls, reflective bodysuit, alien elegance",
    "Mythic siren on black volcanic rock, salt spray, moonlit skin, romantic horror beauty",
    "Paper lantern night market, rain-slick hair, open coat, cinematic depth, Wong Kar-wai palette",
    "Biolab orchid hybrid portrait, translucent petals fused with skin, clinical beauty, glossy catalog",
    "Holographic kimono runway, rain of code, sensual stride, Tokyo after-hours, speculative couture",
    "Copper desert observatory at twilight, silk cape in wind, radio telescopes, Magnum color negative",
    "Foggy Scottish castle corridor, candle sconces, velvet gown, spectral portrait, medium format film",
    "Chrome android ballerina mid-arabesque, museum atrium, hard speculars, fashion still life",
    "Rainforest canopy walkway, bioluminescent vines, explorer silhouette, volumetric god rays",
    "Art deco penthouse terrace, champagne mist, city grid below, Contax night flash",
    "Frozen fjord kayak wake, aurora ribbons, reflective dry suit, National Geographic stillness",
    "Calligraphy ink explosion forming a crane, washi texture, erotic brush economy, gallery white",
    "Subway car empty at 3am, neon ads strobing, trench coat, Wong Kar-wai push-in still",
    "Marble quarry noon, dust haze, sculptor at rest, linen shirt, large-format landscape",
    "Zero-g greenhouse dome, floating citrus, astronaut gardener, soft HDR editorial",
    "Black sand beach ritual, gold leaf mask, tide pools, mythic fashion campaign",
]

VIDEO_PROMPTS = [
    "A glass hummingbird above trumpet flowers moves in one calm continuous cycle; locked-off macro shot, cinematic 16:9, soft dawn mist; audio: soft glass harmonics",
    "A cliffside observatory above a storm sea slowly unfolds and returns to its opening pose; slow aerial orbit, cinematic 16:9, distant lightning; audio: waves against stone",
    "A lunar greenhouse filled with floating pollen drifts forward through layered atmosphere; gentle dolly forward, cinematic 16:9, moonlight and warm practical lights; audio: low mechanical resonance",
    "A ceramic fox crosses a moss garden while the environment responds naturally; low tracking shot, cinematic 16:9, sun shafts through moving leaves; audio: quiet forest ambience",
    "A solar sail skims a planet's cloud tops and settles into a clean hero composition; wide lateral glide, cinematic 16:9, golden-hour backlight; audio: soft electrical shimmer",
    "A clockwork orchid opens at midnight and returns to its opening pose; close focus pull, cinematic 16:9, deep indigo night; audio: subtle room tone and wood creaks",
    "A sea turtle glides over a coral library as particles stream past; steady arc camera, cinematic 16:9, subtle bioluminescent glow; audio: underwater hush",
    "A paper crane flies through a rain-soaked station in one continuous loop; low tracking shot, cinematic 16:9, blue-hour reflections; audio: rain and a far bell",
    "A glass torus suspended in a greenhouse rotates as reflected light travels across its surface; slow pedestal rise, cinematic 16:9; audio: soft glass harmonics",
    "A ring habitat passes from night into dawn while terraced gardens unfold; impossible pass-through camera, cinematic 16:9; audio: low mechanical resonance",
]


def read_prompt_catalog(path: Path) -> list[str]:
    prompts: list[str] = []
    seen: set[str] = set()
    for number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError as error:
            raise SystemExit(f"{path}:{number}: invalid JSON: {error}") from error
        prompt = str(row.get("prompt") or "").strip() if isinstance(row, dict) else ""
        if not prompt:
            raise SystemExit(f"{path}:{number}: prompt is required")
        if prompt not in seen:
            prompts.append(prompt)
            seen.add(prompt)
    return prompts


def completed_video_prompts() -> set[str]:
    output = subprocess.check_output(
        [
            "psql",
            DATABASE_URL,
            "-At",
            "-c",
            "SELECT prompt FROM video_jobs WHERE status = 'completed' OR status IN ('queued','processing','starting');",
        ],
        text=True,
    )
    return {line.strip() for line in output.splitlines() if line.strip()}


def http_json(method: str, url: str, payload: dict | None = None, headers: dict | None = None, timeout: int = 180):
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = resp.read()
        return resp.status, json.loads(body) if body else {}


def gen_image(prompt: str, size: str = "1024x1024") -> bytes:
    w, h = (int(x) for x in size.lower().split("x"))
    # Prefer local CuteDSL Z-Image worker (fast, reliable); fall back to omniserve-native.
    try:
        status, data = http_json(
            "POST",
            f"{ZIMAGE}/generate_image",
            {
                "prompt": prompt,
                "width": w,
                "height": h,
                "num_inference_steps": 8,
            },
            timeout=240,
        )
        if status < 400 and data.get("image_base64"):
            return base64.b64decode(data["image_base64"])
    except Exception as e:
        print(f"  zimage worker miss: {e}", file=sys.stderr)

    status, data = http_json(
        "POST",
        f"{OMNI}/v1/images/generations",
        {"prompt": prompt, "size": size, "n": 1},
        timeout=240,
    )
    if status >= 400:
        raise RuntimeError(f"omniserve {status}: {data}")
    b64 = data["data"][0]["b64_json"]
    return base64.b64decode(b64)


def insert_image_pg(prompt: str, image_bytes: bytes, width: int, height: int) -> str:
    image_id = str(uuid.uuid4())
    digest = hashlib.sha1(prompt.encode()).hexdigest()[:16]
    rel = f"originals/{digest}_{image_id[:8]}.webp"
    full = IMAGES_DIR / rel
    full.parent.mkdir(parents=True, exist_ok=True)
    full.write_bytes(image_bytes)

    # Use psql so we don't need psycopg2 on the host.
    sql = (
        "INSERT INTO generated_images "
        "(id, prompt, width, height, file_path, thumb_path, med_path, file_size, model, seed, steps, created_at) "
        "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,'zimage',0,8,NOW());"
    )
    # escape via dollar-quoting
    def dq(s: str) -> str:
        tag = "mg"
        while f"${tag}$" in s:
            tag += "x"
        return f"${tag}${s}${tag}$"

    stmt = (
        "INSERT INTO generated_images "
        "(id, prompt, width, height, file_path, thumb_path, med_path, file_size, model, seed, steps, created_at) VALUES ("
        f"{dq(image_id)}, {dq(prompt)}, {width}, {height}, {dq(rel)}, {dq(rel)}, {dq(rel)}, {len(image_bytes)}, "
        "'zimage', 0, 8, NOW());"
    )
    import subprocess

    env = os.environ.copy()
    # parse user/db from DATABASE_URL roughly
    # postgres://user:pass@host:port/db
    u = DATABASE_URL
    # Prefer libpq env
    if u.startswith("postgres://") or u.startswith("postgresql://"):
        env["PGPASSWORD"] = u.split(":", 2)[2].split("@", 1)[0] if "@" in u else env.get("PGPASSWORD", "")
    subprocess.check_call(
        ["psql", DATABASE_URL, "-v", "ON_ERROR_STOP=1", "-c", stmt],
        env=env,
        stdout=subprocess.DEVNULL,
    )
    return image_id


def ensure_seed_user(api_key_hint: str | None = None) -> str:
    """Return an API key with credits for H3 backfill."""
    key = api_key_hint or os.environ.get("MANIFOLDGEN_API_KEY", "")
    if key:
        return key
    email = os.environ.get("BACKFILL_EMAIL", "seed@manifoldgen.com")
    password = os.environ.get("BACKFILL_PASSWORD", "manifoldgen-seed-2026")
    try:
        _, data = http_json(
            "POST",
            f"{API}/api/auth/email-login",
            {"email": email, "password": password},
            timeout=30,
        )
        key = data.get("api_key") or (data.get("user") or {}).get("api_key") or ""
        if key:
            return key
    except Exception as e:
        print("email-login failed:", e, file=sys.stderr)

    import subprocess

    out = subprocess.check_output(
        [
            "psql",
            DATABASE_URL,
            "-tA",
            "-c",
            f"SELECT api_key FROM users WHERE email='{email}' LIMIT 1;",
        ],
        text=True,
    ).strip()
    if out:
        subprocess.check_call(
            [
                "psql",
                DATABASE_URL,
                "-c",
                f"UPDATE users SET credits = GREATEST(credits, 50) WHERE email='{email}';",
            ],
            stdout=subprocess.DEVNULL,
        )
        return out
    raise SystemExit("No API key for video backfill; set MANIFOLDGEN_API_KEY")


def queue_h3_video(api_key: str, prompt: str) -> dict:
    status, data = http_json(
        "POST",
        f"{API}/api/service",
        {
            "service": "h3_video",
            "prompt": prompt,
            "aspect_ratio": "16:9",
            "size": "native",
            "duration": 5,
            "num_steps": 20,
            "include_audio": True,
            "structured_prompt": True,
            "output_format": "webm-av1",
        },
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=60,
    )
    if status >= 400:
        raise RuntimeError(f"h3 queue {status}: {data}")
    return data


def request_reindex(api_key: str) -> None:
    if not api_key:
        return
    try:
        req = urllib.request.Request(
            f"{API}/api/search/reindex",
            method="POST",
            headers={"Authorization": f"Bearer {api_key}"},
        )
        urllib.request.urlopen(req, timeout=10).read()
        print("reindex requested")
    except Exception as error:
        print("reindex skip:", error)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--images", type=int, default=16)
    ap.add_argument("--videos", type=int, default=6)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--size", default="1024x1024")
    ap.add_argument("--video-prompts", type=Path, help="JSONL prompt catalog built with --kind video")
    ap.add_argument("--video-offset", type=int, default=0, help="skip this many pending video prompts")
    ap.add_argument("--shuffle-seed", type=int, help="deterministically shuffle pending video prompts")
    ap.add_argument("--queue-delay", type=float, default=1.0, help="seconds between video submissions")
    args = ap.parse_args()
    if args.images < 0 or args.videos < 0 or args.video_offset < 0:
        raise SystemExit("counts and offsets cannot be negative")

    w, h = (int(x) for x in args.size.lower().split("x"))
    print(f"omni={OMNI} api={API} images_dir={IMAGES_DIR}")

    for i, prompt in enumerate(PROMPTS[: args.images]):
        print(f"[image {i+1}/{args.images}] {prompt[:70]}…")
        if args.dry_run:
            continue
        try:
            raw = gen_image(prompt, args.size)
            image_id = insert_image_pg(prompt, raw, w, h)
            print(f"  saved {image_id} ({len(raw)} bytes)")
        except Exception as e:
            print(f"  FAIL: {e}", file=sys.stderr)
            time.sleep(1)

    reindex_key = ""
    if args.videos > 0:
        video_prompts = read_prompt_catalog(args.video_prompts) if args.video_prompts else list(VIDEO_PROMPTS)
        if args.shuffle_seed is not None:
            random.Random(args.shuffle_seed).shuffle(video_prompts)
        if not args.dry_run:
            existing = completed_video_prompts()
            video_prompts = [prompt for prompt in video_prompts if prompt not in existing]
        video_prompts = video_prompts[args.video_offset : args.video_offset + args.videos]
        print(f"video catalog selected={len(video_prompts)} requested={args.videos}")
        if args.dry_run:
            print(f"would queue {len(video_prompts)} H3 videos")
        else:
            key = ensure_seed_user()
            reindex_key = key
            # top up credits
            try:
                import subprocess

                subprocess.check_call(
                    [
                        "psql",
                        DATABASE_URL,
                        "-c",
                        f"UPDATE users SET credits = GREATEST(credits, 80) WHERE api_key='{key}';",
                    ],
                    stdout=subprocess.DEVNULL,
                )
            except Exception as e:
                print("credit topup warn:", e, file=sys.stderr)

            for i, prompt in enumerate(video_prompts):
                print(f"[video {i+1}/{len(video_prompts)}] {prompt[:70]}…")
                try:
                    data = queue_h3_video(key, prompt)
                    print("  queued:", json.dumps(data)[:200])
                except Exception as e:
                    print(f"  FAIL: {e}", file=sys.stderr)
                    time.sleep(2)
                if args.queue_delay:
                    time.sleep(args.queue_delay)

    if not args.dry_run:
        request_reindex(reindex_key)


if __name__ == "__main__":
    main()
