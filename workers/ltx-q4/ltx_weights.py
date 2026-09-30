import hashlib
import json
import os
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

BASE = os.environ.get("LTX_MODELS_BASE", "https://manifoldgenstatic.manifoldgen.com/models/ltx23-uncensored-v1.4").rstrip("/")
ROOT = Path(os.environ.get("LTX_MODELS_DIR") or ("/runpod-volume/ltx-models" if Path("/runpod-volume").is_dir() else "/opt/ComfyUI/models"))
COMFY_MODELS = Path(os.environ.get("LTX_COMFY_MODELS", "/opt/ComfyUI/models"))
PARTS = int(os.environ.get("LTX_WEIGHT_PARTS", "8"))
WORKERS = int(os.environ.get("LTX_WEIGHT_WORKERS", "3"))
UA = {"User-Agent": "manifoldgen-ltx-worker/1.0"}
SKIP_Q4 = "Q4_K_M.gguf"


def fetch_json(url):
    return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60))


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(16 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download_part(url, target, start, end):
    request = urllib.request.Request(url, headers={**UA, "Range": f"bytes={start}-{end}"})
    with urllib.request.urlopen(request, timeout=120) as response, open(target, "r+b") as handle:
        handle.seek(start)
        while chunk := response.read(8 << 20):
            handle.write(chunk)


def download(entry):
    rel = entry["path"]
    target = ROOT / rel
    if target.exists() and target.stat().st_size == entry["size"]:
        return rel, False
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_suffix(target.suffix + ".part")
    with open(partial, "wb") as handle:
        handle.truncate(entry["size"])
    url = f"{BASE}/{rel}"
    size = entry["size"]
    step = -(-size // PARTS)
    ranges = [(i, min(i + step, size) - 1) for i in range(0, size, step)]
    with ThreadPoolExecutor(PARTS) as pool:
        for future in [pool.submit(download_part, url, partial, a, b) for a, b in ranges]:
            future.result()
    if sha256(partial) != entry["sha256"]:
        partial.unlink(missing_ok=True)
        raise RuntimeError(f"sha256 mismatch for {rel}")
    partial.rename(target)
    return rel, True


def ensure_weights(unet):
    manifest = fetch_json(f"{BASE}/manifest.json")
    wanted = [e for e in manifest["files"] if e["path"].startswith(("text_encoders/", "vae/", "latent_upscale_models/")) or Path(e["path"]).name == unet]
    with ThreadPoolExecutor(WORKERS) as pool:
        results = list(pool.map(download, wanted))
    if ROOT != COMFY_MODELS:
        for entry in wanted:
            link = COMFY_MODELS / entry["path"]
            link.parent.mkdir(parents=True, exist_ok=True)
            if not link.exists():
                link.symlink_to(ROOT / entry["path"])
    return {rel: fetched for rel, fetched in results}
