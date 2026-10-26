"""Concept-art lane: Qwen Image 2.1 (omniserve-native) generate + Qwen edit, Google style transfer.

Every image gets a sidecar .json (prompt, seed, timing). Outputs are webp; reference
boards let one edit call carry several identities at once.
"""
from __future__ import annotations

import base64
import io
import os
import time
from pathlib import Path

from PIL import Image

from .common import Timer, data_uri, download, env, http_json, sidecar

OMNI = os.environ.get("RA2_URL", "http://127.0.0.1:8792")
FAL = "https://fal.run"
SIZE_WIDE = (1344, 768)
SIZE_TALL = (768, 1344)
SIZE_SQUARE = (1024, 1024)


def _omni_post(path: str, body: dict, retries: int = 5) -> dict:
    """The omniserve lane renders one image at a time: serialise callers across processes with a file lock."""
    import fcntl
    last = ""
    with open("/tmp/filmkit-omni.lock", "w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        for attempt in range(retries):
            try:
                return http_json("POST", f"{OMNI}{path}", body, timeout=900)
            except Exception as exc:  # admission / queue / transient lane failure
                last = str(exc)
                time.sleep(8 + attempt * 12)
    raise RuntimeError(last)


def _save_omni(result: dict, out: Path, meta: dict) -> dict:
    item = result["data"][0]
    im = Image.open(io.BytesIO(base64.b64decode(item["b64_json"]))).convert("RGB")
    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out, quality=94) if out.suffix.lower() in {".jpg", ".jpeg", ".webp"} else im.save(out)
    meta = {**meta, "output": str(out), "seed": item.get("seed"), "inference_ms": item.get("inference_time_ms"),
            "bytes": out.stat().st_size, "size_px": im.size}
    sidecar(out, meta)
    return meta


def qwen_generate(prompt: str, out: Path, *, size=SIZE_WIDE, seed: int = 1, steps: int = 30,
                  negative: str | None = None) -> dict:
    body = {"prompt": prompt, "size": f"{size[0]}x{size[1]}", "n": 1, "steps": steps, "seed": seed}
    if negative:
        body["negative_prompt"] = negative
    t = Timer()
    result = _omni_post("/v1/images/generations", body)
    return _save_omni(result, Path(out), {"kind": "qwen_generate", "prompt": prompt, "request_seed": seed,
                                          "steps": steps, "seconds": t.seconds})


def qwen_edit(prompt: str, ref: str | Path, out: Path, *, size=SIZE_WIDE, seed: int = 1, steps: int = 30) -> dict:
    """Reference edit. `ref` may be a board made with board() to carry several identities."""
    body = {"prompt": prompt, "size": f"{size[0]}x{size[1]}", "n": 1, "steps": steps, "seed": seed,
            "image_base64": data_uri(ref, 1280, 92).split(",", 1)[1]}
    t = Timer()
    result = _omni_post("/v1/images/edits", body)
    return _save_omni(result, Path(out), {"kind": "qwen_edit", "prompt": prompt, "ref": str(ref),
                                          "request_seed": seed, "steps": steps, "seconds": t.seconds})


def board(images: list[str | Path], out: str | Path, height: int = 900, gap: int = 40, bg=(150, 146, 142)) -> Path:
    """Side-by-side reference board (character sheets + location) so one edit locks them all."""
    out = Path(out)
    scaled = []
    for path in images:
        im = Image.open(path).convert("RGB")
        scaled.append(im.resize((round(im.width * height / im.height), height), Image.LANCZOS))
    sheet = Image.new("RGB", (sum(i.width for i in scaled) + gap * (len(scaled) - 1), height), bg)
    x = 0
    for im in scaled:
        sheet.paste(im, (x, 0))
        x += im.width + gap
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out, quality=93)
    return out


def contact_sheet(paths: list[str | Path], out: str | Path, height: int = 240, columns: int = 4) -> Path:
    out = Path(out)
    thumbs = []
    for path in paths:
        im = Image.open(path).convert("RGB")
        thumbs.append(im.resize((round(im.width * height / im.height), height), Image.LANCZOS))
    rows = (len(thumbs) + columns - 1) // columns
    cell = max(i.width for i in thumbs)
    sheet = Image.new("RGB", (cell * columns, height * rows), (18, 18, 18))
    for n, im in enumerate(thumbs):
        sheet.paste(im, ((n % columns) * cell, (n // columns) * height))
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out, quality=88)
    return out


GOOGLE_EDIT = os.environ.get("FILMKIT_GOOGLE_EDIT", "fal-ai/nano-banana/edit")


def google_edit(prompt: str, refs: list[str | Path], out: Path, aspect: str = "16:9", seed: int | None = None,
                model: str | None = None) -> dict:
    """Google image-edit (Nano Banana via fal): style transfer, new camera angle, cast re-lock.

    Qwen is the workhorse; this is the repair lane for shots Qwen cannot reframe or when a style
    reference must be matched exactly.
    """
    model = model or GOOGLE_EDIT
    body = {"prompt": prompt, "image_urls": [data_uri(p) for p in refs], "aspect_ratio": aspect,
            "output_format": "png", "num_images": 1, "limit_generations": True}
    if seed is not None:
        body["seed"] = seed
    t = Timer()
    result = http_json("POST", f"{FAL}/{model}", body, {"Authorization": f"Key {env('FAL_KEY')}"}, timeout=600)
    out = Path(out)
    tmp = out.with_suffix(".dl")
    download(result["images"][0]["url"], tmp)
    Image.open(tmp).convert("RGB").save(out, quality=94) if out.suffix.lower() != ".png" else Image.open(tmp).convert("RGB").save(out)
    tmp.unlink(missing_ok=True)
    meta = {"kind": "google_edit", "model": model, "prompt": prompt, "refs": [str(r) for r in refs],
            "aspect": aspect, "seed": seed, "output": str(out), "seconds": t.seconds}
    sidecar(out, meta)
    return meta


GEMINI_IMAGE_MODEL = os.environ.get("FILMKIT_GEMINI_IMAGE", "gemini-3-pro-image")


def gemini_edit(prompt: str, refs: list[str | Path], out: Path, aspect: str = "16:9",
                model: str | None = None) -> dict:
    """Native Google image edit (Gemini image models): style transfer / reframing against reference stills."""
    model = model or GEMINI_IMAGE_MODEL
    parts = [{"text": prompt}] + [
        {"inline_data": {"mime_type": "image/jpeg", "data": data_uri(p).split(",", 1)[1]}} for p in refs]
    body = {"contents": [{"parts": parts}],
            "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": aspect}}}
    t = Timer()
    res = http_json("POST", f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                    body, {"x-goog-api-key": env("GEMINI_API_KEY")}, timeout=600)
    for cand in res.get("candidates", []):
        for part in cand.get("content", {}).get("parts", []):
            blob = part.get("inlineData") or part.get("inline_data")
            if blob:
                im = Image.open(io.BytesIO(base64.b64decode(blob["data"]))).convert("RGB")
                out = Path(out)
                out.parent.mkdir(parents=True, exist_ok=True)
                im.save(out, quality=94) if out.suffix.lower() != ".png" else im.save(out)
                meta = {"kind": "gemini_edit", "model": model, "prompt": prompt, "refs": [str(r) for r in refs],
                        "aspect": aspect, "output": str(out), "size_px": im.size, "seconds": t.seconds}
                sidecar(out, meta)
                return meta
    raise RuntimeError(f"gemini_edit returned no image: {str(res)[:400]}")
