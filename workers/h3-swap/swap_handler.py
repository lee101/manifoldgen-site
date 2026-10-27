import os
import queue
import subprocess
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

import swap_weights as weights
from swap_runtime import SwapRuntime

MAX_VIDEO_BYTES = 256 * 1024 * 1024
MAX_BATCH_CLIPS = 12
BOOT_EVENT_SECONDS = 15
DONE = object()
PROCESS_START = time.monotonic()
_runtime = None
_runtime_lock = threading.Lock()
_preload = None
_moderation = None
_ready_at = None


def _turbo(value):
    return value if isinstance(value, str) and value else bool(value)


def runtime():
    global _runtime, _ready_at
    with _runtime_lock:
        if _runtime is None:
            _runtime = SwapRuntime()
            _ready_at = time.monotonic()
        return _runtime


def boot_seconds():
    return round((_ready_at or time.monotonic()) - PROCESS_START, 1)


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


def cut_clip(source, start, length):
    fd, filename = tempfile.mkstemp(prefix="swap-cut-", suffix=".mp4")
    os.close(fd)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", f"{float(start):.3f}", "-i", str(source), "-t", f"{float(length):.3f}", "-an",
                    "-vf", "fps=24,scale='min(1280,iw)':-2,format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", filename], check=True)
    return Path(filename)


def clip_specs(values):
    clips = values.get("clips")
    if clips is None:
        return [{"id": 0, "video_url": values.get("video_url"), "seed": values.get("seed"),
                 "_output_upload_url": values.get("_output_upload_url"), "_output_public_url": values.get("_output_public_url")}], False
    if not isinstance(clips, list) or not 1 <= len(clips) <= MAX_BATCH_CLIPS:
        raise ValueError(f"clips must hold between 1 and {MAX_BATCH_CLIPS} entries")
    specs = []
    for index, clip in enumerate(clips):
        if not isinstance(clip, dict):
            raise ValueError("every clip must be an object")
        spec = {"id": clip.get("id", index), "video_url": clip.get("video_url") or values.get("video_url"), "seed": clip.get("seed"),
                "start": clip.get("start"), "length": clip.get("length"), "_shared": not clip.get("video_url") and bool(values.get("video_url")),
                "_output_upload_url": clip.get("_output_upload_url"), "_output_public_url": clip.get("_output_public_url")}
        if not spec["video_url"]:
            raise ValueError(f"clip {spec['id']} has no video_url")
        if bool(spec["_output_upload_url"]) != bool(spec["_output_public_url"]):
            raise ValueError("output upload URL and public URL must be provided together")
        if not spec["_output_upload_url"]:
            raise ValueError(f"clip {spec['id']} needs _output_upload_url and _output_public_url in a batch")
        specs.append(spec)
    return specs, True


def finish_clip(prompt, output, metrics, spec, started):
    result = moderation().classify(prompt, output)
    if result.get("status") == "blocked":
        metrics["output_transport"] = "blocked"
        release_media(output)
        return {"clip": spec["id"], "outputs": [], "metrics": metrics, "moderation": result}
    upload_url, public_url = spec.get("_output_upload_url"), spec.get("_output_public_url")
    if bool(upload_url) != bool(public_url):
        raise ValueError("output upload URL and public URL must be provided together")
    upload_started = time.monotonic()
    try:
        artifact = _upload_output(output, str(upload_url), str(public_url)) if upload_url else media_artifact(output)
    finally:
        release_media(output)
    metrics["output_transport"] = "r2-direct" if upload_url else "inline-base64"
    metrics["output_upload_seconds"] = round(time.monotonic() - upload_started, 2)
    metrics["total_seconds"] = round(time.monotonic() - started, 2)
    return {"clip": spec["id"], "outputs": [artifact], "metrics": metrics, "moderation": result}


def process_clips(values, prompt, urls, specs, batch, results):
    shared_url = values.get("video_url") if batch and any(spec["_shared"] for spec in specs) else None
    shared, images, pending = None, [], {}
    pool = ThreadPoolExecutor(2, thread_name_prefix="swap-io")

    def fetch(spec):
        if spec.get("_shared"):
            if spec.get("start") is None or spec.get("length") is None:
                raise ValueError(f"clip {spec['id']} needs start and length with a shared video")
            return cut_clip(shared, spec["start"], spec["length"])
        return download_video(str(spec["video_url"]))

    def prefetch(index):
        if index < len(specs) and index not in pending:
            pending[index] = pool.submit(fetch, specs[index])

    def uploaded(spec):
        def done(future):
            try:
                results.put(future.result())
            except Exception as error:
                results.put(error if not batch else {"clip": spec["id"], "error": truncate(error)})
        return done

    try:
        if shared_url:
            shared, images = fetch_inputs(str(shared_url), urls)
        else:
            prefetch(0)
            with ThreadPoolExecutor(len(urls)) as images_pool:
                images = list(images_pool.map(_download_image, urls))
        easycache = values.get("easycache")
        for index, spec in enumerate(specs):
            prefetch(index)
            prefetch(index + 1)
            source = None
            try:
                source = pending.pop(index).result()
                clip_started = time.monotonic()
                output, metrics = runtime().generate_resilient(
                    prompt=prompt, source_video=source, character_images=images, steps=int(values.get("steps", 20)),
                    seed=spec.get("seed"), megapixels=float(values.get("megapixels", 0.4)), turbo=_turbo(values.get("turbo", False)),
                    sampler=str(values.get("sampler", "res_multistep")), scheduler=str(values.get("scheduler", "simple")),
                    lora_strength=float(values.get("lora_strength", 1.0)),
                    easycache=tuple(float(x) for x in easycache) if easycache else None, sol=bool(values.get("sol", False)),
                )
                metrics["batch_index"], metrics["batch_size"] = index, len(specs)
                metrics["worker_boot_seconds"] = boot_seconds()
                pool.submit(finish_clip, prompt, output, metrics, spec, clip_started).add_done_callback(uploaded(spec))
            except Exception as error:
                if not batch:
                    raise
                print(f"clip {spec['id']} failed: {error!r}", flush=True)
                results.put({"clip": spec["id"], "error": truncate(error)})
            finally:
                if source:
                    Path(source).unlink(missing_ok=True)
    except BaseException as error:
        results.put(error)
    finally:
        pool.shutdown(wait=True)
        for future in pending.values():
            try:
                Path(future.result()).unlink(missing_ok=True)
            except Exception:
                pass
        for path in [shared, *images]:
            if path:
                Path(path).unlink(missing_ok=True)
        results.put(DONE)


def handler(event):
    values = event.get("input") or {}
    start_preload()
    prompt = str(values.get("prompt", ""))
    gate = moderation().prompt_gate(prompt)
    if gate is not None:
        yield {"outputs": [], "moderation": gate}
        return
    urls = values.get("image_urls") or ([values["image_url"]] if values.get("image_url") else [])
    if not isinstance(urls, list) or not 1 <= len(urls) <= 3:
        raise ValueError("image_urls must hold one to three character images")
    specs, batch = clip_specs(values)
    results = queue.Queue()
    threading.Thread(target=process_clips, args=(values, prompt, urls, specs, batch, results), name="swap-clips", daemon=True).start()
    while True:
        try:
            item = results.get(timeout=BOOT_EVENT_SECONDS)
        except queue.Empty:
            if _ready_at is None:
                yield {"event": "boot", "seconds": round(time.monotonic() - PROCESS_START), **weights.progress()}
            continue
        if item is DONE:
            return
        if isinstance(item, BaseException):
            raise item
        yield item


def truncate(error):
    return repr(error)[:400]


if __name__ == "__main__":
    start_preload()
    runpod.serverless.start({"handler": handler, "return_aggregate_stream": True})
