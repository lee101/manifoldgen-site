#!/usr/bin/env python3
"""Local accelerated H3 gallery generator for ManifoldGen.

Bypasses RunPod: runs ghcr.io/lee101/h3-cog:accel-test on the host 5090,
uploads WebMs to manifoldgenstatic, inserts video_jobs, reindexes gobed.

Usage:
  python scripts/gen_gallery_local.py --count 3
  python scripts/gen_gallery_local.py --prompt 'neon alley…' --slug neon-alley
  python scripts/gen_gallery_local.py --stop   # stop the local cog when done
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import re
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTAINER = os.environ.get("H3_LOCAL_CONTAINER", "h3-gallery-local")
IMAGE = os.environ.get("H3_LOCAL_IMAGE", "ghcr.io/lee101/h3-cog:accel-test")
PORT = int(os.environ.get("H3_LOCAL_PORT", "18089"))
WEIGHTS = Path(os.environ.get("H3_WEIGHTS_DIR", "/nvme0n1-disk/h3-w4a8-weights"))
PATCH = Path(os.environ.get("H3_PATCH_DIR", "/tmp/h3-accel-patch"))
ACCEL_PROFILE = os.environ.get("H3_ACCEL_PROFILE", "off")
FACE_REFINE = os.environ.get("H3_LOCAL_FACE_REFINE", "0")
COG_URL = f"http://127.0.0.1:{PORT}"
API = os.environ.get("MANIFOLDGEN_API", "http://127.0.0.1:8116").rstrip("/")
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgres://manifoldgen:manifoldgen@localhost:5432/manifoldgen?sslmode=disable",
)
R2_ACCOUNT_ID = "f76d25b8b86cfa5638f43016510d8f77"
R2_BUCKET = "manifoldgenstatic"
R2_PUBLIC = "manifoldgenstatic.manifoldgen.com"
PATCH_MODULES = (
    "h3_workflow.py",
    "h3_runtime.py",
    "h3_face_refine.py",
    "rp_handler.py",
    "predict.py",
    "weights.py",
    "h3_media.py",
    "h3_tuning.py",
    "h3_sweep.py",
    "h3_prompt.py",
    "h3_serverless.py",
    "h3_chain.py",
    "h3_benchmark.py",
)

PROMPTS = [
    (
        "neon-monsoon-geisha",
        "Cyber-geisha walking through monsoon neon, tracking shot, rain beads on lacquer, reflective asphalt; rain ambience and distant traffic, cinematic 16:9",
    ),
    (
        "temple-chiffon-spin",
        "Dancer spinning in translucent gold chiffon among temple ruins at dusk, dust motes in god rays, IMAX wide motion; wind through stone and silk rustle",
    ),
    (
        "underwater-ballroom",
        "Underwater ballroom: floating chandeliers drift as camera glides past a velvet dress and bioluminescent plankton trails; muffled hydrophone hush",
    ),
    (
        "noir-jazz-scarlet",
        "Noir jazz singer in scarlet satin, slow dolly through cigarette haze, wet cobblestones catching neon; brushed snare and muted trumpet bed",
    ),
    (
        "glass-orchid-night",
        "Glass orchid greenhouse at night: condensation trails as a silhouette moves behind frosted panes; soft rain on glass, eerie beauty",
    ),
    (
        "astronaut-flower-field",
        "Astronaut removing helmet in a flower field, pollen rising, soft focus rack, editorial fashion motion; breeze and distant birds",
    ),
    (
        "marble-goddess-orbit",
        "Slow orbit around a marble goddess under candle smoke, camera push-in, museum hush; soft room tone and distant footsteps",
    ),
    (
        "chrome-ballerina",
        "Chrome android ballerina mid-arabesque in a museum atrium, hard speculars circling; quiet HVAC and heel clicks on marble",
    ),
    (
        "sakura-train-platform",
        "Night train platform under falling sakura petals, soft backlight, slow lateral camera slide; distant PA chime and wind in trees",
    ),
    (
        "desert-mirror-mirage",
        "Lone figure crossing a salt-flat mirage, heat shimmer warps the horizon, slow crane rise; dry wind and sparse insect drone",
    ),
    (
        "library-ember-motes",
        "Candlelit library stacks with floating ash motes, camera drifts between shelves, warm volumetric shafts; soft page-turn and wood creak",
    ),
    (
        "harbor-fog-ferry",
        "Ferry cutting through morning harbor fog, gulls, camera locked on the bow wake; foghorn far and water slap against hull",
    ),
]


def load_dotenv() -> None:
    mg_db = "postgres://manifoldgen:manifoldgen@localhost:5432/manifoldgen?sslmode=disable"
    mg = ROOT / ".env"
    if mg.exists():
        for line in mg.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            key, val = k.strip(), v.strip().strip('"').strip("'")
            if key in {"DATABASE_URL", "R2_BUCKET", "R2_PUBLIC_HOST", "R2_PATH_PREFIX", "MANIFOLDGEN_API"}:
                os.environ[key] = val
            else:
                os.environ.setdefault(key, val)
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
    os.environ["R2_BUCKET"] = "manifoldgenstatic"
    os.environ["R2_PUBLIC_HOST"] = "manifoldgenstatic.manifoldgen.com"
    os.environ.setdefault("R2_PATH_PREFIX", "gallery")
    if "manifoldgen" not in os.environ.get("DATABASE_URL", ""):
        os.environ["DATABASE_URL"] = mg_db
    global DATABASE_URL, API, R2_PUBLIC
    DATABASE_URL = os.environ["DATABASE_URL"]
    API = os.environ.get("MANIFOLDGEN_API", API).rstrip("/")
    R2_PUBLIC = os.environ.get("R2_PUBLIC_HOST", R2_PUBLIC)

def sync_patch() -> None:
    PATCH.mkdir(parents=True, exist_ok=True)
    src = Path("/nvme0n1-disk/code/h3-cog")
    for name in PATCH_MODULES:
        p = src / name
        if p.exists():
            subprocess.check_call(["cp", str(p), str(PATCH / name)])
    schema = src / ".cog" / "openapi_schema.json"
    if schema.exists():
        schema_dest = PATCH / ".cog" / "openapi_schema.json"
        schema_dest.parent.mkdir(parents=True, exist_ok=True)
        subprocess.check_call(["cp", str(schema), str(schema_dest)])
    sol = src / "vendor" / "ComfyUI-SolAttn_triton"
    if not sol.exists():
        sol = Path("/tmp/h3-accel-patch/ComfyUI-SolAttn_triton")
    if sol.exists() and not (PATCH / "ComfyUI-SolAttn_triton").exists():
        subprocess.check_call(["cp", "-a", str(sol), str(PATCH / "ComfyUI-SolAttn_triton")])
    spectrum = src / "vendor" / "ComfyUI-Spectrum-MiniMax-H3"
    if not spectrum.exists():
        spectrum = Path("/tmp/h3-accel-patch/ComfyUI-Spectrum-MiniMax-H3")
    if spectrum.exists():
        dest = PATCH / "ComfyUI-Spectrum-MiniMax-H3"
        if dest.exists():
            subprocess.call(["rm", "-rf", str(dest)])
        subprocess.check_call(["cp", "-a", str(spectrum), str(dest)])
    # Gallery T2V does not need Ref2VA; skip the multi-GB HF fetch on cold start.
    predict = PATCH / "predict.py"
    text = predict.read_text()
    old = "self.runtime = H3Runtime(include_ref2va=True)"
    new = (
        "import os as _os\n"
        "        include_ref2va = _os.getenv(\"H3_INCLUDE_REF2VA\", \"0\").lower() in {\"1\", \"true\", \"yes\"}\n"
        "        self.runtime = H3Runtime(include_ref2va=include_ref2va)"
    )
    if old in text:
        predict.write_text(text.replace(old, new, 1))

    # The upstream ranged downloader buffers each multi-GB range in memory before
    # writing it. Stream each range instead so cold setup does not thrash RAM.
    weights = PATCH / "weights.py"
    text = weights.read_text()
    old = '''                data = _http_get_range(url, start, end)
                if len(data) != end - start + 1:
                    raise IOError(f"range size mismatch {start}-{end}: got {len(data)}")
                with partial.open("r+b") as handle:
                    handle.seek(start)
                    handle.write(data)'''
    new = '''                headers = {"User-Agent": "appnz-h3-cog/0.1", "Range": f"bytes={start}-{end}"}
                request = urllib.request.Request(url, headers=headers)
                written = 0
                with urllib.request.urlopen(request, timeout=300) as response, partial.open("r+b") as handle:
                    handle.seek(start)
                    while True:
                        data = response.read(8 << 20)
                        if not data:
                            break
                        handle.write(data)
                        written += len(data)
                if written != end - start + 1:
                    raise IOError(f"range size mismatch {start}-{end}: got {written}")'''
    if old in text:
        weights.write_text(text.replace(old, new, 1))


def docker_running() -> bool:
    out = subprocess.check_output(["docker", "ps", "--format", "{{.Names}}"], text=True)
    return CONTAINER in out.splitlines()


def ensure_container() -> None:
    if docker_running():
        print(f"container {CONTAINER} already up")
        return
    if not WEIGHTS.exists():
        raise SystemExit(f"missing weights dir {WEIGHTS}")
    sync_patch()
    subprocess.call(["docker", "rm", "-f", CONTAINER], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    mounts = [
        "-v",
        f"{WEIGHTS}:/weights",
    ]
    for name in PATCH_MODULES:
        mounts += ["-v", f"{PATCH / name}:/src/{name}:ro"]
    schema = PATCH / ".cog" / "openapi_schema.json"
    if schema.exists():
        mounts += ["-v", f"{schema}:/src/.cog/openapi_schema.json:ro"]
    sol = PATCH / "ComfyUI-SolAttn_triton"
    if sol.exists():
        mounts += ["-v", f"{sol}:/opt/ComfyUI/custom_nodes/ComfyUI-SolAttn_triton:ro"]
    spectrum = PATCH / "ComfyUI-Spectrum-MiniMax-H3"
    if spectrum.exists():
        mounts += ["-v", f"{spectrum}:/opt/ComfyUI/custom_nodes/ComfyUI-Spectrum-MiniMax-H3:ro"]
    cmd = [
        "docker",
        "run",
        "-d",
        "--gpus",
        "all",
        "--network",
        "host",
        "--name",
        CONTAINER,
        "--restart",
        "unless-stopped",
        "-e",
        f"PORT={PORT}",
        "-e",
        "MINIMAX_H3_LICENSE_ACCEPTED=1",
        "-e",
        f"H3_ACCEL_PROFILE={ACCEL_PROFILE}",
        "-e",
        "H3_QUANT=int8_convrot",
        "-e",
        "H3_SKIP_SHA=1",
        "-e",
        "H3_INCLUDE_REF2VA=0",
        "-e",
        f"H3_FACE_REFINE_ENABLED={FACE_REFINE}",
        "-e",
        "H3_RESERVE_VRAM_GB=2",
        "-e",
        "H3_VRAM_BROKER_URL=http://127.0.0.1:8791",
        "-e",
        "H3_VRAM_BROKER_REQUIRED=1",
        "-e",
        "H3_VRAM_LEASE_MB=14336",
        "-e",
        "H3_VRAM_LEASE_MIN_MB=12288",
        "-e",
        "H3_VRAM_LEASE_TTL_SECONDS=3600",
        "-e",
        "H3_VRAM_LEASE_WAIT_SECONDS=900",
        "-e",
        "H3_IDLE_UNLOAD_SECONDS=30",
        "-e",
        "H3_CACHE_RESET_EVERY=16",
        "-e",
        "WEIGHTS_DIR=/weights",
        "-e",
        "HF_HOME=/weights/huggingface",
        "-e",
        "PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True",
        "-e",
        "NVIDIA_DRIVER_CAPABILITIES=all",
        *mounts,
        IMAGE,
    ]
    print("starting", CONTAINER, "…")
    subprocess.check_call(cmd)
    wait_healthy()


def wait_healthy(timeout: int = 900) -> None:
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            with urllib.request.urlopen(f"{COG_URL}/health-check", timeout=5) as resp:
                body = resp.read().decode()
                data = json.loads(body) if body else {}
                status = str(data.get("status") or "").upper()
                setup = data.get("setup") or {}
                setup_status = str(setup.get("status") or "").lower()
                if status in ("READY", "OK") or setup_status in ("succeeded", "ready", "done"):
                    print(f"ready in {time.time() - t0:.0f}s ({status or setup_status})")
                    return
                print(f"  setup={setup_status or status or 'starting'}…", flush=True)
        except Exception as e:
            print(f"  waiting ({e})…", flush=True)
        time.sleep(5)
    raise SystemExit("local H3 cog did not become ready")


def http_json(method: str, url: str, payload: dict | None = None, timeout: int = 300, headers: dict | None = None):
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, method=method)
    if payload is not None:
        req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = resp.read()
        return resp.status, json.loads(body) if body else {}


def generate(prompt: str, *, size: str, steps: int, duration: float, seed: int | None) -> Path:
    input_obj = {
        "prompt": prompt,
        "aspect_ratio": "16:9",
        "size": size,
        "duration": duration,
        "steps": steps,
        "structured_prompt": True,
        "include_audio": True,
        "output_codec": "webm-av1",
        "encode_quality": 22,
        "quant": "int8_convrot",
    }
    if seed is not None:
        input_obj["seed"] = seed
    # This coglet build only exposes POST /predictions (+ cancel). No GET poll route,
    # so wait synchronously (full-quality stable weights can take 10–20 min on a 5090).
    print(f"  predicting (sync, accel={ACCEL_PROFILE})…", flush=True)
    t0 = time.time()
    status, poll = http_json(
        "POST",
        f"{COG_URL}/predictions",
        {"input": input_obj},
        timeout=50 * 60,
    )
    if status >= 400:
        raise RuntimeError(f"predict {status}: {poll}")
    st = (poll.get("status") or "").lower()
    if st not in ("succeeded", "completed", ""):
        # Some cog builds return the completed payload without status.
        if poll.get("output") is None and poll.get("id") and st in ("starting", "processing"):
            raise RuntimeError(
                "cog returned an async prediction but this build has no poll route; "
                "omit Prefer: respond-async and wait on POST"
            )
        if st in ("failed", "canceled", "cancelled"):
            raise RuntimeError(f"prediction failed: {poll.get('error') or poll}")
    print(f"  done in {time.time() - t0:.0f}s")
    output = poll.get("output")
    # Cog may return file path, URL, or {url: …}
    url = None
    if isinstance(output, str):
        url = output
    elif isinstance(output, dict):
        url = output.get("url") or output.get("video_url")
        if not url and isinstance(output.get("outputs"), list) and output["outputs"]:
            first = output["outputs"][0]
            if isinstance(first, dict) and first.get("data"):
                # base64 data URL — write locally
                import base64

                raw = first["data"]
                if "," in raw:
                    raw = raw.split(",", 1)[1]
                path = Path(tempfile.mkdtemp(prefix="h3-gal-")) / "out.webm"
                path.write_bytes(base64.b64decode(raw))
                print(f"  wrote {path.stat().st_size} bytes")
                return path
    if not url and isinstance(poll.get("urls"), dict):
        url = poll["urls"].get("get")
    if not url:
        # File output field used by some cog versions
        for key in ("file", "path", "video"):
            if isinstance(poll.get(key), str) and poll[key]:
                url = poll[key]
                break
    if not url:
        raise RuntimeError(f"no output url in {json.dumps(poll)[:500]}")
    dest = Path(tempfile.mkdtemp(prefix="h3-gal-")) / "out.webm"
    if url.startswith("http://") or url.startswith("https://") or url.startswith("data:"):
        if url.startswith("data:"):
            import base64

            raw = url.split(",", 1)[1]
            dest.write_bytes(base64.b64decode(raw))
        else:
            urllib.request.urlretrieve(url, dest)
    else:
        # file inside container — docker cp
        subprocess.check_call(["docker", "cp", f"{CONTAINER}:{url}", str(dest)])
    print(f"  artifact {dest.stat().st_size} bytes")
    return dest


def aws_env() -> dict[str, str]:
    env = os.environ.copy()
    env["AWS_ACCESS_KEY_ID"] = env.get("CLOUDFLARE_R2_ACCESS_KEY_ID") or env.get("AWS_ACCESS_KEY_ID", "")
    env["AWS_SECRET_ACCESS_KEY"] = env.get("CLOUDFLARE_R2_SECRET_ACCESS_KEY") or env.get("AWS_SECRET_ACCESS_KEY", "")
    env["AWS_DEFAULT_REGION"] = "auto"
    if not env["AWS_ACCESS_KEY_ID"]:
        raise SystemExit("missing CLOUDFLARE_R2_ACCESS_KEY_ID")
    return env


def upload(local: Path, slug: str) -> str:
    key = f"gallery/videos/{slug}.webm"
    endpoint = f"https://{os.environ.get('R2_ACCOUNT_ID', R2_ACCOUNT_ID)}.r2.cloudflarestorage.com"
    subprocess.check_call(
        [
            "aws",
            "--endpoint-url",
            endpoint,
            "s3",
            "cp",
            str(local),
            f"s3://{R2_BUCKET}/{key}",
            "--content-type",
            "video/webm",
            "--cache-control",
            "public, max-age=31536000, immutable",
        ],
        env=aws_env(),
    )
    return f"https://{R2_PUBLIC}/{key}"


def psql(sql: str) -> str:
    return subprocess.check_output(["psql", os.environ.get("DATABASE_URL", DATABASE_URL), "-At", "-c", sql], text=True).strip()


def upsert(job_id: str, user_id: str, prompt: str, video_url: str, *, size: str, quant: str) -> None:
    result = json.dumps(
        {
            "video_url": video_url,
            "provider": "local-h3",
            "service": "h3_video",
            "codec": "av1",
            "accel": ACCEL_PROFILE,
            "quant": quant,
            "size": size,
            "featured": True,
            "output_codec": "webm-av1",
            "encode_quality": 22,
        }
    )
    prompt_lit = prompt.replace("'", "''")
    result_lit = result.replace("'", "''")
    sql = (
        "INSERT INTO video_jobs (id, user_id, provider_job_id, service, status, result_json, prompt, settled, created_at, updated_at) "
        f"VALUES ('{job_id}', '{user_id}', '{job_id}', 'h3_video', 'completed', '{result_lit}'::jsonb, "
        f"'{prompt_lit}', TRUE, NOW(), NOW()) "
        "ON CONFLICT (id) DO UPDATE SET status='completed', result_json=EXCLUDED.result_json, "
        "prompt=EXCLUDED.prompt, settled=TRUE, updated_at=NOW();"
    )
    subprocess.check_call(["psql", os.environ.get("DATABASE_URL", DATABASE_URL), "-c", sql], stdout=subprocess.DEVNULL)


def reindex() -> None:
    try:
        req = urllib.request.Request(f"{API}/api/search/reindex", method="POST")
        urllib.request.urlopen(req, timeout=15).read()
        print("reindex requested")
    except Exception as e:
        print("reindex skip:", e)


def free_vram_hint() -> None:
    try:
        free = subprocess.check_output(
            ["nvidia-smi", "--query-gpu=memory.free", "--format=csv,noheader,nounits"],
            text=True,
        ).strip()
        print(f"GPU free MiB: {free}")
    except Exception:
        pass


def prompt_slug(prompt: str, supplied: str = "") -> str:
    if supplied:
        cleaned = re.sub(r"[^a-z0-9]+", "-", supplied.lower()).strip("-")[:64]
        if cleaned:
            return cleaned
    digest = hashlib.sha256(prompt.encode("utf-8")).hexdigest()[:16]
    return f"catalog-{digest}"


def load_prompt_file(path: Path) -> list[tuple[str, str, int | None]]:
    """Read JSONL ({prompt, slug?, seed?}) or one plain prompt per line."""
    jobs: list[tuple[str, str, int | None]] = []
    seen: set[str] = set()
    with path.open(encoding="utf-8") as source:
        for number, raw in enumerate(source, 1):
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            supplied_slug = ""
            seed = None
            if line.startswith("{"):
                try:
                    row = json.loads(line)
                except json.JSONDecodeError as error:
                    raise SystemExit(f"{path}:{number}: invalid JSON: {error}") from error
                if not isinstance(row, dict):
                    raise SystemExit(f"{path}:{number}: JSONL rows must be objects")
                prompt = str(row.get("prompt") or "").strip()
                supplied_slug = str(row.get("slug") or "").strip()
                if row.get("seed") is not None:
                    try:
                        seed = int(row["seed"])
                    except (TypeError, ValueError) as error:
                        raise SystemExit(f"{path}:{number}: seed must be an integer") from error
            else:
                prompt = line
            if not prompt:
                raise SystemExit(f"{path}:{number}: prompt is required")
            if len(prompt) > 4000:
                raise SystemExit(f"{path}:{number}: prompt exceeds 4000 characters")
            if prompt in seen:
                continue
            seen.add(prompt)
            jobs.append((prompt_slug(prompt, supplied_slug), prompt, seed))
    if not jobs:
        raise SystemExit(f"no prompts found in {path}")
    return jobs


def stop_container() -> None:
    subprocess.call(["docker", "rm", "-f", CONTAINER])


def main() -> None:
    load_dotenv()
    global DATABASE_URL
    DATABASE_URL = os.environ.get("DATABASE_URL", DATABASE_URL)

    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=3)
    ap.add_argument("--prompt", default="")
    ap.add_argument("--slug", default="")
    ap.add_argument(
        "--prompts",
        type=Path,
        help="JSONL ({prompt, slug?, seed?}) or newline-delimited prompt catalog",
    )
    ap.add_argument("--offset", type=int, default=0, help="skip this many catalog rows after optional shuffle")
    ap.add_argument("--shuffle-seed", type=int, help="deterministically mix catalog prompts before offset/count")
    ap.add_argument("--steps", type=int, default=24)
    ap.add_argument("--duration", type=float, default=5)
    ap.add_argument("--size", choices=("preview", "balanced", "native"), default="native")
    ap.add_argument(
        "--actual-quant",
        choices=("int8_convrot", "w4a8"),
        default=os.environ.get("H3_LOCAL_ACTUAL_QUANT", "int8_convrot"),
        help="quant recorded in gallery metadata (stable int8_convrot unless explicitly overridden)",
    )
    ap.add_argument("--seed", type=int, default=None)
    ap.add_argument("--stop", action="store_true", help="stop local container and exit")
    ap.add_argument("--stop-when-done", action="store_true", help="stop the local Cog after this bounded batch")
    ap.add_argument("--no-start", action="store_true", help="assume container already running")
    args = ap.parse_args()

    if args.count < 1:
        raise SystemExit("--count must be positive")
    if args.offset < 0:
        raise SystemExit("--offset cannot be negative")
    if args.prompt and args.prompts:
        raise SystemExit("use either --prompt or --prompts, not both")

    if args.stop:
        stop_container()
        print("stopped", CONTAINER)
        return

    free_vram_hint()
    if not args.no_start:
        ensure_container()
    else:
        # A cold stable-weight worker verifies a ~20 GB checkpoint before it
        # reports ready. Allow that one-time setup to finish without aborting.
        wait_healthy(timeout=15 * 60)

    user_id = psql("SELECT id FROM users ORDER BY created_at ASC LIMIT 1;")
    if not user_id:
        raise SystemExit("no users; sign up on manifoldgen first")

    jobs: list[tuple[str, str, int | None]] = []
    if args.prompt:
        slug = args.slug or f"local-{uuid.uuid4().hex[:8]}"
        jobs.append((slug, args.prompt, args.seed))
    else:
        existing = set(
            psql(
                "SELECT id FROM video_jobs WHERE status='completed' AND service='h3_video';"
            ).splitlines()
        )
        catalog = load_prompt_file(args.prompts) if args.prompts else [
            (slug, prompt, None) for slug, prompt in PROMPTS
        ]
        if args.shuffle_seed is not None:
            random.Random(args.shuffle_seed).shuffle(catalog)
        catalog = catalog[args.offset : args.offset + args.count]
        for slug, prompt, seed in catalog:
            job_id = f"video_h3_{slug.replace('-', '_')}"
            if job_id in existing:
                print(f"skip existing {slug}")
                continue
            jobs.append((slug, prompt, seed))
        if not jobs:
            print("no new prompts to generate")
            if args.stop_when_done:
                stop_container()
            return

    ok = 0
    for slug, prompt, catalog_seed in jobs:
        print(f"[{slug}] {prompt[:70]}…")
        local: Path | None = None
        try:
            local = generate(
                prompt,
                size=args.size,
                steps=args.steps,
                duration=args.duration,
                seed=args.seed if args.seed is not None else catalog_seed,
            )
            url = upload(local, slug)
            job_id = f"video_h3_{slug.replace('-', '_')}"
            upsert(job_id, user_id, prompt, url, size=args.size, quant=args.actual_quant)
            print(f"  published {url}")
            ok += 1
        except Exception as e:
            print(f"  FAIL: {e}")
        finally:
            if local is not None:
                local.unlink(missing_ok=True)
                try:
                    local.parent.rmdir()
                except OSError:
                    pass
    reindex()
    if args.stop_when_done:
        stop_container()
        print("stopped", CONTAINER)
    print(f"done ok={ok}/{len(jobs)}")


if __name__ == "__main__":
    main()
