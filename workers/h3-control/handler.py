"""RunPod Serverless handler for H3 ControlNet Union."""

from __future__ import annotations

import base64
import http.client
import ipaddress
import os
import socket
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path

import runpod

from preprocess import preprocess_video
from runtime import H3ControlRuntime

_runtime = None
MAX_VIDEO_BYTES = 256 * 1024 * 1024


def _public_https(url: str):
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname:
        raise ValueError("media URLs must use HTTPS")
    for row in socket.getaddrinfo(parsed.hostname, parsed.port or 443):
        if not ipaddress.ip_address(row[4][0]).is_global:
            raise ValueError("media URL resolves to a non-public address")


def _download(url: str, label: str) -> Path:
    _public_https(url)
    request = urllib.request.Request(url, headers={"User-Agent": "manifoldgen-h3-control/1.0"})
    suffix = Path(urllib.parse.urlparse(url).path).suffix or ".mp4"
    descriptor, filename = tempfile.mkstemp(prefix=f"h3-{label}-", suffix=suffix)
    os.close(descriptor)
    path = Path(filename)
    try:
        with urllib.request.urlopen(request, timeout=180) as response, path.open("wb") as handle:
            length = int(response.headers.get("content-length", "0") or 0)
            if length > MAX_VIDEO_BYTES:
                raise ValueError(f"{label} exceeds 256 MB")
            received = 0
            for chunk in iter(lambda: response.read(8 << 20), b""):
                received += len(chunk)
                if received > MAX_VIDEO_BYTES:
                    raise ValueError(f"{label} exceeds 256 MB")
                handle.write(chunk)
    except BaseException:
        path.unlink(missing_ok=True)
        raise
    return path


def _get_runtime():
    global _runtime
    if _runtime is None:
        if os.environ.get("MINIMAX_H3_LICENSE_ACCEPTED") != "1":
            raise RuntimeError("MINIMAX_H3_LICENSE_ACCEPTED=1 is required")
        _runtime = H3ControlRuntime()
    return _runtime


def _upload_output(path: Path, upload_url: str, public_url: str):
    parsed = urllib.parse.urlparse(upload_url)
    if parsed.scheme != "https" or not (parsed.hostname or "").endswith(".r2.cloudflarestorage.com"):
        raise ValueError("output upload must be a signed Cloudflare R2 URL")
    target = parsed.path + ("?" + parsed.query if parsed.query else "")
    connection = http.client.HTTPSConnection(parsed.hostname, parsed.port or 443, timeout=600)
    try:
        connection.putrequest("PUT", target)
        connection.putheader("Content-Type", "video/mp4")
        connection.putheader("Content-Length", str(path.stat().st_size))
        connection.endheaders()
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(4 << 20), b""):
                connection.send(chunk)
        response = connection.getresponse()
        detail = response.read(2048)
        if response.status >= 300:
            raise RuntimeError(f"R2 upload returned {response.status}: {detail.decode(errors='replace')}")
    finally:
        connection.close()
    return {"video_url": public_url, "url": public_url, "content_type": "video/mp4", "bytes": path.stat().st_size}


def handler(event):
    values = event.get("input") or {}
    kind = str(values.get("control_type", "")).lower()
    if kind not in {"canny", "depth", "hed", "mlsd", "pose", "inpaint"}:
        raise ValueError("invalid control_type")
    source = control = mask = output = None
    try:
        source = _download(str(values.get("video_url", "")), "source")
        if bool(values.get("preprocess", True)) and kind != "inpaint":
            control = preprocess_video(source, kind, int(values.get("duration", 5)))
        else:
            control = source
        if kind == "inpaint":
            mask = _download(str(values.get("mask_video_url", "")), "mask")
        output = _get_runtime().generate(control_video=control, inpaint_video=source if kind == "inpaint" else None,
            mask_video=mask, prompt=str(values.get("prompt", "")), negative_prompt=str(values.get("negative_prompt", "")),
            resolution=str(values.get("resolution", "480p")), duration=int(values.get("duration", 5)),
            steps=int(values.get("steps", 40)), control_scale=float(values.get("control_scale", 1)), seed=values.get("seed"))
        upload_url = str(values.get("_output_upload_url", ""))
        public_url = str(values.get("_output_public_url", ""))
        if bool(upload_url) != bool(public_url):
            raise ValueError("output upload URL and public URL must be provided together")
        if upload_url:
            result = _upload_output(output, upload_url, public_url)
            result["duration_seconds"] = int(values.get("duration", 5))
            return result
        return {"outputs": [{"filename": output.name, "content_type": "video/mp4", "data": base64.b64encode(output.read_bytes()).decode("ascii")}]}
    finally:
        for path in {source, control, mask, output}:
            if path is not None:
                path.unlink(missing_ok=True)


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
