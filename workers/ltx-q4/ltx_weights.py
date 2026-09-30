import hashlib
import json
import os
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

BASE = os.environ.get("LTX_MODELS_BASE", "https://manifoldgenstatic.manifoldgen.com/models/ltx23-uncensored-v1.4").rstrip("/")
ROOT = Path(os.environ.get("LTX_MODELS_DIR") or ("/runpod-volume/ltx-models" if Path("/runpod-volume").is_dir() else "/opt/ComfyUI/models"))
COMFY_MODELS = Path(os.environ.get("LTX_COMFY_MODELS", "/opt/ComfyUI/models"))
PART_BYTES = int(os.environ.get("LTX_WEIGHT_PART_MB", "256")) << 20
CONNECTIONS = int(os.environ.get("LTX_WEIGHT_CONNECTIONS", "48"))
RETRIES = 6
UA = {"User-Agent": "manifoldgen-ltx-worker/1.0"}
T0 = time.monotonic()


def log(message):
    print(f"[ltx-weights {time.monotonic() - T0:7.1f}s] {message}", flush=True)


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


def ensure_weights(unet):
    manifest = fetch_json(f"{BASE}/manifest.json")
    wanted = [e for e in manifest["files"] if e["path"].startswith(("text_encoders/", "vae/", "latent_upscale_models/")) or Path(e["path"]).name == unet]
    pending = []
    for entry in wanted:
        target = ROOT / entry["path"]
        if not (target.exists() and target.stat().st_size == entry["size"]):
            pending.append(entry)
    total = sum(e["size"] for e in pending)
    log(f"{len(pending)} of {len(wanted)} files to fetch, {total / 1e9:.1f} GB")
    if pending:
        started = time.monotonic()
        handles = {}
        tasks = []
        for entry in pending:
            target = ROOT / entry["path"]
            target.parent.mkdir(parents=True, exist_ok=True)
            partial = target.with_suffix(target.suffix + ".part")
            fd = os.open(partial, os.O_RDWR | os.O_CREAT | os.O_TRUNC)
            os.ftruncate(fd, entry["size"])
            handles[entry["path"]] = (fd, partial, target)
            url = f"{BASE}/{entry['path']}"
            for start in range(0, entry["size"], PART_BYTES):
                tasks.append((url, fd, start, min(start + PART_BYTES, entry["size"]) - 1))
        with ThreadPoolExecutor(CONNECTIONS) as pool:
            for future in [pool.submit(download_part, *task) for task in tasks]:
                future.result()
        elapsed = time.monotonic() - started
        log(f"downloaded {total / 1e9:.1f} GB in {elapsed:.0f}s ({total / elapsed / 1e6:.0f} MB/s)")
        for fd, _, _ in handles.values():
            os.close(fd)
        started = time.monotonic()
        with ThreadPoolExecutor(len(pending)) as pool:
            digests = list(pool.map(lambda e: sha256(handles[e["path"]][1]), pending))
        for entry, digest in zip(pending, digests):
            fd, partial, target = handles[entry["path"]]
            if digest != entry["sha256"]:
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
