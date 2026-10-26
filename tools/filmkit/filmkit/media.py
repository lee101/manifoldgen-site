"""fal lane: FLUX 3 Max video (i2v / keyframes), TTS, generated SFX/audio. Sidecar JSON per output."""
from __future__ import annotations

import hashlib
import time
from pathlib import Path

from .common import Timer, data_uri, download, env, http_json, sidecar

VIDEO_MODELS = {"image": "blackforestlabs/flux-3-max/image-to-video",
                "keyframes": "blackforestlabs/flux-3-max/keyframes-to-video",
                "text": "blackforestlabs/flux-3-max/text-to-video"}


def _hdr() -> dict:
    return {"Authorization": f"Key {env('FAL_KEY')}"}


def flux3_video(prompt: str, out: Path, duration: int, *, start=None, end=None, keyframes: list[dict] | None = None,
                resolution: str = "720p", aspect: str = "16:9", audio: bool = False, reasoning: str = "high",
                seed: int | None = None, timeout: int = 2400) -> dict:
    """FLUX 3 Max. `start` -> image-to-video (+optional `end`), `keyframes` [{path, frame_index}] -> keyframes-to-video."""
    t = Timer()
    body = {"prompt": prompt, "duration": duration, "resolution": resolution, "aspect_ratio": aspect,
            "generate_audio": audio, "reasoning_level": reasoning}
    if keyframes:
        model = VIDEO_MODELS["keyframes"]
        body["keyframes"] = [{"image_url": data_uri(k["path"]), "frame_index": int(k["frame_index"])} for k in keyframes]
    elif start:
        model = VIDEO_MODELS["image"]
        body["image_url"] = data_uri(start)
        if end:
            body["end_image_url"] = data_uri(end)
    else:
        model = VIDEO_MODELS["text"]
    if seed is not None:
        body["seed"] = seed
    q = http_json("POST", f"https://queue.fal.run/{model}", body, _hdr())
    last = ""
    while time.time() - t.t0 < timeout:
        state = http_json("GET", q["status_url"], None, _hdr())
        status = str(state.get("status", "")).upper()
        last = str(state)[:400]
        if status == "COMPLETED":
            break
        if status in {"FAILED", "CANCELLED", "CANCELED", "ERROR"}:
            raise RuntimeError(f"video failed: {last}")
        time.sleep(4)
    else:
        raise TimeoutError(f"video timed out: {q['request_id']}")
    result = http_json("GET", q["response_url"], None, _hdr())
    nbytes = download(result["video"]["url"], Path(out))
    meta = {"kind": "flux3_video", "model": model, "request_id": q["request_id"], "prompt": prompt,
            "duration": duration, "resolution": resolution, "aspect": aspect, "audio": audio, "seed": seed,
            "keyframes": keyframes, "start": str(start) if start else None, "end": str(end) if end else None,
            "output": str(out), "bytes": nbytes, "seconds": t.seconds,
            "video": {k: result["video"].get(k) for k in ("width", "height", "duration", "fps")}}
    sidecar(Path(out), meta)
    return meta


def tts(text: str, out: Path, *, voice: str = "Lively_Girl", emotion: str = "neutral", speed: float = 1.0,
        pitch: int = 0, language: str = "English") -> dict:
    t = Timer()
    body = {"text": text, "language_boost": language, "output_format": "url",
            "voice_setting": {"voice_id": voice, "emotion": emotion, "speed": speed, "pitch": pitch, "vol": 1},
            "audio_setting": {"format": "mp3", "sample_rate": 44100, "bitrate": 128000, "channel": 1}}
    result = http_json("POST", "https://fal.run/fal-ai/minimax/speech-02-hd", body, _hdr(), timeout=300)
    nbytes = download(result["audio"]["url"], Path(out))
    meta = {"kind": "tts", "text": text, "voice": voice, "emotion": emotion, "speed": speed,
            "duration_ms": result.get("duration_ms"), "output": str(out), "bytes": nbytes, "seconds": t.seconds}
    sidecar(Path(out), meta)
    return meta


def sfx_generate(prompt: str, out: Path, seconds: int = 5, *, steps: int = 8) -> dict:
    """Text-to-audio foley/ambience (Stable Audio 2.5 on fal)."""
    t = Timer()
    body = {"prompt": prompt, "seconds_total": seconds, "num_inference_steps": steps, "guidance_scale": 1}
    result = http_json("POST", "https://fal.run/fal-ai/stable-audio-25/text-to-audio", body, _hdr(), timeout=600)
    url = result["audio"]["url"] if isinstance(result["audio"], dict) else result["audio"]
    nbytes = download(url, Path(out))
    sidecar(Path(out), {"kind": "sfx_generate", "prompt": prompt, "seconds_total": seconds,
                        "output": str(out), "bytes": nbytes, "seconds": t.seconds})
    return {"output": str(out), "bytes": nbytes}


def sfx_cached(prompt: str, cache: Path, seconds: int = 5) -> Path:
    """Generated SFX are cached by prompt hash so re-mixes never re-bill."""
    key = hashlib.sha1(f"{prompt}|{seconds}".encode()).hexdigest()[:12]
    out = Path(cache) / f"{key}.mp3"
    if not out.exists():
        out.parent.mkdir(parents=True, exist_ok=True)
        sfx_generate(prompt, out, seconds)
    return out
