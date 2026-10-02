"""Minimal weight installer for the character-swap lane: Ref2VA transformer, text encoder, VAEs, swap LoRA."""

import hashlib
import json
import os
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

BASE = os.environ.get("SWAP_MODELS_BASE", "https://appstatic.app.nz/models/Comfy-Org/MiniMax-H3").rstrip("/")
LORA_BASE = os.environ.get("SWAP_LORA_BASE", "https://manifoldgenstatic.manifoldgen.com/models/h3-character-swap").rstrip("/")
HF_LORA = "https://huggingface.co/akatz-ai/MiniMax-H3-Character-Swap-LoRA/resolve/62407e0cc8089c363abd9ce4b0b27662abb237af/h3_character_swap_pro4500_1000.safetensors"
LORA_NAME = "h3_character_swap_pro4500_1000.safetensors"
LORA_SIZE = 155_110_320
LORA_SHA = "4b2a3f420ae804c0aa3422761ff84dbd1bf52eef6900ffab6d2e66df63cb4e79"
TURBO_NAME = "minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors"
BASE_FILES = (
    "text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors",
    "vae/minimax_h3_video_vae_fp16.safetensors",
    "vae/minimax_h3_audio_vae_fp32.safetensors",
)
# Not on the appstatic mirror: copied to manifoldgenstatic from Comfy-Org/MiniMax-H3 at this revision.
HF_REVISION = "e5eb578a89295337b8ff433a035929ce0279e0b6"
MIRROR_FILES = {
    "diffusion_models/minimax_h3_ref2va_pruned_int8_convrot.safetensors": (20970379616, "9255f52b6677845ad238f20dfaafa94727053694127ab7f255c048f0f9365779"),
    f"loras/{TURBO_NAME}": (1956193000, "5b9ab5ade15d0775676d01a907268a69a1468dc6033b3b0d3ded5502f3ebb84c"),
}
COMFY_MODELS = Path(os.environ.get("SWAP_COMFY_MODELS", "/opt/ComfyUI/models"))
ROOT = Path(os.environ.get("SWAP_MODELS_DIR") or ("/runpod-volume/h3-swap-models" if Path("/runpod-volume").is_dir() else str(COMFY_MODELS)))
PART_BYTES = int(os.environ.get("SWAP_WEIGHT_PART_MB", "256")) << 20
CONNECTIONS = int(os.environ.get("SWAP_WEIGHT_CONNECTIONS", "48"))
RETRIES = 6
UA = {"User-Agent": "manifoldgen-h3-swap/1.0"}
T0 = time.monotonic()


def log(message):
    print(f"[swap-weights {time.monotonic() - T0:7.1f}s] {message}", flush=True)


def fetch_json(url):
    return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60))


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(32 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download_part(url, fd, start, end):
    expected = end - start + 1
    last = None
    for attempt in range(RETRIES):
        try:
            request = urllib.request.Request(url, headers={**UA, "Range": f"bytes={start}-{end}"})
            with urllib.request.urlopen(request, timeout=60) as response:
                if response.status != 206:
                    raise RuntimeError(f"range request returned {response.status}")
                offset = start
                while chunk := response.read(4 << 20):
                    os.pwrite(fd, chunk, offset)
                    offset += len(chunk)
            if offset - start != expected:
                raise RuntimeError(f"short read {offset - start} of {expected}")
            return expected
        except Exception as error:
            last = error
            time.sleep(min(2 ** attempt, 15))
    raise RuntimeError(f"part {start}-{end} of {url} failed: {last}")


def plan():
    manifest = fetch_json(f"{BASE}/manifest.json")
    if isinstance(manifest, list):
        manifest = {entry["path"]: entry for entry in manifest}
    entries = [{**manifest[path], "url": f"{BASE}/{path}", "path": path} for path in BASE_FILES]
    entries.append({"path": f"loras/{LORA_NAME}", "size": LORA_SIZE, "sha256": LORA_SHA, "url": f"{LORA_BASE}/{LORA_NAME}", "fallback": HF_LORA})
    for path, (size, digest) in MIRROR_FILES.items():
        entries.append({"path": path, "size": size, "sha256": digest, "url": f"{LORA_BASE}/{path}",
                        "fallback": f"https://huggingface.co/Comfy-Org/MiniMax-H3/resolve/{HF_REVISION}/{path}"})
    return entries


def ensure_weights():
    wanted = plan()
    pending = [e for e in wanted if not ((ROOT / e["path"]).exists() and (ROOT / e["path"]).stat().st_size == e["size"])]
    total = sum(e["size"] for e in pending)
    log(f"{len(pending)} of {len(wanted)} files to fetch, {total / 1e9:.1f} GB")
    if pending:
        started = time.monotonic()
        handles, tasks = {}, []
        for entry in pending:
            target = ROOT / entry["path"]
            target.parent.mkdir(parents=True, exist_ok=True)
            partial = target.with_suffix(target.suffix + ".part")
            fd = os.open(partial, os.O_RDWR | os.O_CREAT | os.O_TRUNC)
            os.ftruncate(fd, entry["size"])
            handles[entry["path"]] = (fd, partial, target)
            for start in range(0, entry["size"], PART_BYTES):
                tasks.append((entry, fd, start, min(start + PART_BYTES, entry["size"]) - 1))

        def run(task):
            entry, fd, start, end = task
            try:
                return download_part(entry["url"], fd, start, end)
            except Exception:
                if entry.get("fallback"):
                    return download_part(entry["fallback"], fd, start, end)
                raise

        with ThreadPoolExecutor(CONNECTIONS) as pool:
            for future in [pool.submit(run, task) for task in tasks]:
                future.result()
        elapsed = time.monotonic() - started
        log(f"downloaded {total / 1e9:.1f} GB in {elapsed:.0f}s ({total / max(elapsed, 1e-3) / 1e6:.0f} MB/s)")
        for fd, _, _ in handles.values():
            os.close(fd)
        started = time.monotonic()
        with ThreadPoolExecutor(len(pending)) as pool:
            digests = list(pool.map(lambda e: sha256(handles[e["path"]][1]) if e.get("sha256") else "", pending))
        for entry, digest in zip(pending, digests):
            fd, partial, target = handles[entry["path"]]
            if entry.get("sha256") and digest != entry["sha256"]:
                partial.unlink(missing_ok=True)
                raise RuntimeError(f"sha256 mismatch for {entry['path']}")
            partial.rename(target)
        log(f"verified in {time.monotonic() - started:.0f}s")
    if ROOT != COMFY_MODELS:
        for entry in wanted:
            link = COMFY_MODELS / entry["path"]
            link.parent.mkdir(parents=True, exist_ok=True)
            if not link.exists():
                link.symlink_to(ROOT / entry["path"])
    return [e["path"] for e in wanted]
