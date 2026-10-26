"""Shared plumbing: env, JSON HTTP, downloads, lightweight webp re-encode, sidecars."""
from __future__ import annotations

import base64
import io
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image

LIGHT_MAX_SIDE = 800  # every image an LLM or an agent looks at is capped to this
LIGHT_QUALITY = 82


def env(name: str, required: bool = True) -> str:
    value = os.environ.get(name, "")
    if not value and required:
        raise RuntimeError(f"{name} is not set")
    return value


def http_json(method: str, url: str, payload: dict | None = None, headers: dict | None = None,
              timeout: int = 180) -> dict:
    body = None if payload is None else json.dumps(payload).encode()
    hdr = {"Content-Type": "application/json", "User-Agent": "filmkit/0.1", **(headers or {})}
    req = urllib.request.Request(url, body, hdr, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:1500]
        raise RuntimeError(f"{exc.code} {exc.reason} {url}: {detail}") from exc


def download(url: str, out: Path, timeout: int = 600) -> int:
    out.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "filmkit/0.1"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = resp.read()
    out.write_bytes(data)
    return len(data)


def lightweight(path: str | Path, out: str | Path | None = None, max_side: int = LIGHT_MAX_SIDE,
                quality: int = LIGHT_QUALITY) -> Path:
    """Re-encode any image as a <= max_side webp. Returns the new path (default: same stem .webp)."""
    src = Path(path)
    dest = Path(out) if out else src.with_suffix(".webp")
    im = Image.open(src).convert("RGB")
    scale = max_side / max(im.size)
    if scale < 1:
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, "WEBP", quality=quality, method=6)
    return dest


def webp_bytes(path: str | Path, max_side: int = LIGHT_MAX_SIDE, quality: int = LIGHT_QUALITY) -> bytes:
    im = Image.open(path).convert("RGB")
    scale = max_side / max(im.size)
    if scale < 1:
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=quality, method=4)
    return buf.getvalue()


def data_uri(path: str | Path, max_side: int = 1280, quality: int = 90) -> str:
    """JPEG data URI for provider uploads (providers want broad format support)."""
    im = Image.open(path).convert("RGB")
    scale = max_side / max(im.size)
    if scale < 1:
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=quality)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def webp_data_uri(path: str | Path, max_side: int = LIGHT_MAX_SIDE) -> str:
    return "data:image/webp;base64," + base64.b64encode(webp_bytes(path, max_side)).decode()


def sidecar(out: Path, meta: dict) -> None:
    out.with_suffix(out.suffix + ".json").write_text(json.dumps(meta, indent=2, ensure_ascii=False, default=str))


class Timer:
    def __init__(self) -> None:
        self.t0 = time.time()

    @property
    def seconds(self) -> float:
        return round(time.time() - self.t0, 2)
