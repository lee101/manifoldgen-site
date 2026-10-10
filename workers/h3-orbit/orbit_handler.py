import sys
import time
from pathlib import Path

sys.path.insert(0, "/src")
sys.path.insert(0, str(Path(__file__).resolve().parent))

import runpod
from h3_moderation import Moderation
from h3_serverless import media_artifact, release_media
from rp_handler import _download_image, _upload_output

import orbit_graph
import orbit_weights
from orbit_runtime import OrbitRuntime

_runtime = None
_moderation = None


def runtime():
    global _runtime
    if _runtime is None:
        orbit_weights.ensure_weights()
        _runtime = OrbitRuntime()
    return _runtime


def moderation():
    global _moderation
    if _moderation is None:
        _moderation = Moderation()
    return _moderation


def handler(event):
    values = event.get("input") or {}
    prompt = str(values.get("prompt") or orbit_graph.PROMPT)
    gate = moderation().prompt_gate(prompt)
    if gate is not None:
        return {"outputs": [], "moderation": gate}
    image = output = None
    try:
        started = time.monotonic()
        image = _download_image(str(values.get("image_url", "")))
        output, metrics = runtime().generate(
            image=image, prompt=prompt, steps=int(values.get("steps", orbit_graph.DEFAULT_STEPS)),
            frames=int(values.get("frames", orbit_graph.DEFAULT_FRAMES)), size=int(values.get("size", orbit_graph.DEFAULT_SIZE)),
            seed=values.get("seed"), lora_strength=float(values.get("lora_strength", 1.0)))
        result = moderation().classify(prompt, output)
        if result.get("status") == "blocked":
            metrics["output_transport"] = "blocked"
            return {"outputs": [], "metrics": metrics, "moderation": result}
        upload_url, public_url = values.get("_output_upload_url"), values.get("_output_public_url")
        if bool(upload_url) != bool(public_url):
            raise ValueError("output upload URL and public URL must be provided together")
        upload_started = time.monotonic()
        artifact = _upload_output(output, str(upload_url), str(public_url)) if upload_url else media_artifact(output)
        metrics["output_transport"] = "r2-direct" if upload_url else "inline-base64"
        metrics["output_upload_seconds"] = round(time.monotonic() - upload_started, 2)
        metrics["total_seconds"] = round(time.monotonic() - started, 2)
        return {
            "video_url": artifact.get("url", ""), "content_type": artifact.get("content_type", "video/mp4"),
            "duration_seconds": metrics["video_seconds"], "outputs": [artifact], "metrics": metrics, "moderation": result,
        }
    finally:
        if image:
            Path(image).unlink(missing_ok=True)
        release_media(output)


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
