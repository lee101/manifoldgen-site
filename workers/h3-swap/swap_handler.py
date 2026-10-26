import os
import sys
import tempfile
import threading
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, "/src")
sys.path.insert(0, str(Path(__file__).resolve().parent))

import runpod
from h3_moderation import Moderation
from h3_serverless import media_artifact, release_media
from rp_handler import _download_image, _public_https, _upload_output

from swap_runtime import SwapRuntime

MAX_VIDEO_BYTES = 256 * 1024 * 1024
_runtime = None
_runtime_lock = threading.Lock()
_preload = None
_moderation = None


def _turbo(value):
    return value if isinstance(value, str) and value else bool(value)


def runtime():
    global _runtime
    with _runtime_lock:
        if _runtime is None:
            _runtime = SwapRuntime()
        return _runtime


def start_preload():
    """Fetch weights and boot ComfyUI in the background so they overlap job pickup, moderation and downloads."""
    global _preload
    if _preload is None:
        def load():
            try:
                runtime()
            except Exception as error:
                print(f"runtime preload failed, will retry on first job: {error!r}", flush=True)
        _preload = threading.Thread(target=load, name="swap-preload", daemon=True)
        _preload.start()


def moderation():
    global _moderation
    if _moderation is None:
        _moderation = Moderation()
    return _moderation


def download_video(url):
    _public_https(url)
    suffix = Path(urllib.parse.urlparse(url).path).suffix or ".mp4"
    fd, filename = tempfile.mkstemp(prefix="swap-video-", suffix=suffix)
    request = urllib.request.Request(url, headers={"User-Agent": "manifoldgen-h3-swap/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=120) as response, os.fdopen(fd, "wb") as handle:
            received = 0
            for chunk in iter(lambda: response.read(4 << 20), b""):
                received += len(chunk)
                if received > MAX_VIDEO_BYTES:
                    raise ValueError("source video exceeds 256 MB")
                handle.write(chunk)
    except BaseException:
        Path(filename).unlink(missing_ok=True)
        raise
    return Path(filename)


def fetch_inputs(video_url, image_urls):
    """Source video and character images downloaded concurrently (the video dominates; images hide behind it)."""
    with ThreadPoolExecutor(1 + len(image_urls)) as pool:
        futures = [pool.submit(download_video, video_url), *(pool.submit(_download_image, url) for url in image_urls)]
        results, error = [], None
        for future in futures:
            try:
                results.append(future.result())
            except BaseException as exc:
                error = error or exc
    if error is not None:
        for path in results:
            Path(path).unlink(missing_ok=True)
        raise error
    return results[0], results[1:]


def handler(event):
    values = event.get("input") or {}
    start_preload()
    prompt = str(values.get("prompt", ""))
    gate = moderation().prompt_gate(prompt)
    if gate is not None:
        return {"outputs": [], "moderation": gate}
    urls = values.get("image_urls") or ([values["image_url"]] if values.get("image_url") else [])
    if not isinstance(urls, list) or not 1 <= len(urls) <= 3:
        raise ValueError("image_urls must hold one to three character images")
    source = output = None
    images = []
    try:
        started = time.monotonic()
        source, images = fetch_inputs(str(values.get("video_url", "")), urls)
        easycache = values.get("easycache")
        output, metrics = runtime().generate(
            prompt=prompt, source_video=source, character_images=images, steps=int(values.get("steps", 20)),
            seed=values.get("seed"), megapixels=float(values.get("megapixels", 0.4)), turbo=_turbo(values.get("turbo", False)),
            sampler=str(values.get("sampler", "res_multistep")), scheduler=str(values.get("scheduler", "simple")),
            lora_strength=float(values.get("lora_strength", 1.0)),
            easycache=tuple(float(x) for x in easycache) if easycache else None, sol=bool(values.get("sol", False)),
        )
        result = moderation().classify(prompt, output)
        if result.get("status") == "blocked":
            metrics["output_transport"] = "blocked"
            return {"outputs": [], "metrics": metrics, "moderation": result}
        upload_url = values.get("_output_upload_url")
        public_url = values.get("_output_public_url")
        if bool(upload_url) != bool(public_url):
            raise ValueError("output upload URL and public URL must be provided together")
        upload_started = time.monotonic()
        artifact = _upload_output(output, str(upload_url), str(public_url)) if upload_url else media_artifact(output)
        metrics["output_transport"] = "r2-direct" if upload_url else "inline-base64"
        metrics["output_upload_seconds"] = round(time.monotonic() - upload_started, 2)
        metrics["total_seconds"] = round(time.monotonic() - started, 2)
        return {"outputs": [artifact], "metrics": metrics, "moderation": result}
    finally:
        for path in [source, *images]:
            if path:
                Path(path).unlink(missing_ok=True)
        release_media(output)


if __name__ == "__main__":
    start_preload()
    runpod.serverless.start({"handler": handler})
