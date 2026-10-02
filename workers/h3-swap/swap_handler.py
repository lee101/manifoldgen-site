import os
import sys
import tempfile
import time
import urllib.parse
import urllib.request
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
_moderation = None


def runtime():
    global _runtime
    if _runtime is None:
        _runtime = SwapRuntime()
    return _runtime


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


def handler(event):
    values = event.get("input") or {}
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
        source = download_video(str(values.get("video_url", "")))
        images = [_download_image(url) for url in urls]
        easycache = values.get("easycache")
        output, metrics = runtime().generate(
            prompt=prompt, source_video=source, character_images=images, steps=int(values.get("steps", 20)),
            seed=values.get("seed"), megapixels=float(values.get("megapixels", 0.4)), turbo=bool(values.get("turbo", False)),
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
    runpod.serverless.start({"handler": handler})
