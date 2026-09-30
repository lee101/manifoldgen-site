import sys
import time
from pathlib import Path

sys.path.insert(0, "/src")
sys.path.insert(0, str(Path(__file__).resolve().parent))

import runpod
from h3_media import encode_video
from h3_moderation import Moderation
from h3_serverless import frame_url, media_artifact, release_media
from rp_handler import _download_audio, _download_image, _upload_output

from ltx_runtime import LtxRuntime

_runtime = None
_moderation = None


def runtime():
    global _runtime
    if _runtime is None:
        _runtime = LtxRuntime()
    return _runtime


def moderation():
    global _moderation
    if _moderation is None:
        _moderation = Moderation()
    return _moderation


TIERS = {"standard": (8, 3, "quality"), "fast": (6, 3, "quality"), "xfast": (6, 3, "balanced")}


def handler(event):
    values = event.get("input") or {}
    tier_steps, tier_refine, tier_size = TIERS.get(values.get("tier"), TIERS["standard"])
    size = tier_size if values.get("tier") else ("preview" if values.get("size") == "preview" else tier_size)
    prompt = values.get("prompt", "")
    gate = moderation().prompt_gate(prompt)
    if gate is not None:
        return {"outputs": [], "moderation": gate}
    first = audio = raw = encoded = None
    try:
        first = _download_image(frame_url(values, "first_frame") or values.get("image_url"))
        audio = _download_audio(frame_url(values, "audio"))
        started = time.monotonic()
        raw, metrics = runtime().generate(
            prompt,
            aspect_ratio=values.get("aspect_ratio", "16:9"),
            size=size,
            duration=float(values.get("duration", 5)),
            seed=values.get("seed"),
            image=first,
            audio=audio,
            steps=int(values.get("ltx_steps", tier_steps)),
            refine_steps=int(values.get("refine_steps", tier_refine)),
            cfg=float(values.get("cfg", 3.5)),
            negative=values.get("negative_prompt"),
            two_stage=bool(values.get("two_stage", True)),
        )
        encode_started = time.monotonic()
        encoded = encode_video(
            raw,
            values.get("output_codec", "webm-av1"),
            int(values.get("encode_quality", 26)),
            bool(values.get("include_audio", True)),
        )
        metrics["encode_seconds"] = round(time.monotonic() - encode_started, 2)
        result = moderation().classify(prompt, encoded)
        if result.get("status") == "blocked":
            encoded.unlink(missing_ok=True)
            metrics["output_transport"] = "blocked"
            return {"outputs": [], "metrics": metrics, "moderation": result}
        upload_url = values.get("_output_upload_url")
        public_url = values.get("_output_public_url")
        if bool(upload_url) != bool(public_url):
            raise ValueError("output upload URL and public URL must be provided together")
        upload_started = time.monotonic()
        artifact = _upload_output(encoded, str(upload_url), str(public_url)) if upload_url else media_artifact(encoded)
        metrics["output_transport"] = "r2-direct" if upload_url else "inline-base64"
        metrics["output_upload_seconds"] = round(time.monotonic() - upload_started, 2)
        metrics["total_seconds"] = round(time.monotonic() - started, 2)
        return {"outputs": [artifact], "metrics": metrics, "moderation": result}
    finally:
        for path in (first, audio, raw):
            if path:
                Path(path).unlink(missing_ok=True)
        release_media(encoded)


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
