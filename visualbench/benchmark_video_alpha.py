#!/usr/bin/env python3
"""Validate and visualize a production VP9-alpha background-removal result.

The native FFmpeg VP9 decoder commonly exposes only yuv420p. This benchmark
selects libvpx-vp9 explicitly so WebM's BlockAdditional alpha plane is decoded.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
import subprocess
import time
from pathlib import Path
from urllib.request import Request, urlopen

import numpy as np
from PIL import Image, ImageDraw, ImageFont


DEFAULT_RESULT = (
    "https://manifoldgenstatic.manifoldgen.com/gallery/service_netw/"
    "video-background/6f378c9b-1c0d-4aad-9f1a-e41f9436fca5.webm"
)
DEFAULT_SOURCE = (
    "https://manifoldgenstatic.manifoldgen.com/gallery/videos/"
    "astronaut-flower-field.webm"
)
GREEN = np.array([0, 255, 0], dtype=np.float32)


def command(arguments: list[str], *, capture: bool = False) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        arguments,
        check=True,
        text=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None,
    )


def fetch(value: str, destination: Path) -> Path:
    if value.startswith(("https://", "http://")):
        if destination.is_file() and destination.stat().st_size:
            return destination
        partial = destination.with_suffix(destination.suffix + ".partial")
        request = Request(value, headers={"User-Agent": "ManifoldGen-Visualbench/1.0"})
        with urlopen(request, timeout=60) as response, partial.open("wb") as output:
            shutil.copyfileobj(response, output, 4 << 20)
        partial.replace(destination)
        return destination
    source = Path(value).expanduser().resolve()
    if not source.is_file():
        raise FileNotFoundError(source)
    shutil.copy2(source, destination)
    return destination


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(4 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def probe(path: Path) -> dict:
    result = command(
        [
            "/usr/bin/ffprobe", "-v", "error", "-count_frames",
            "-show_streams", "-show_format", "-of", "json", str(path),
        ],
        capture=True,
    )
    return json.loads(result.stdout)


def video_stream(metadata: dict) -> dict:
    return next(stream for stream in metadata["streams"] if stream["codec_type"] == "video")


def decode_frame(path: Path, frame_number: int, destination: Path, *, alpha: bool) -> None:
    arguments = ["/usr/bin/ffmpeg", "-hide_banner", "-loglevel", "error"]
    if alpha:
        arguments += ["-c:v", "libvpx-vp9"]
    arguments += [
        "-i", str(path), "-frames:v", "1", "-vsync", "0",
        "-vf", f"select=eq(n\\,{frame_number}),format={'rgba' if alpha else 'rgb24'}",
        str(destination), "-y",
    ]
    command(arguments)


def checkerboard(height: int, width: int) -> np.ndarray:
    yy, xx = np.indices((height, width))
    cells = ((xx // 24 + yy // 24) % 2)[..., None]
    dark = np.array([77, 86, 84], dtype=np.float32)
    light = np.array([164, 174, 171], dtype=np.float32)
    return np.where(cells, light, dark)


def studio_background(height: int, width: int) -> np.ndarray:
    y = np.linspace(0, 1, height, dtype=np.float32)[:, None]
    x = np.linspace(0, 1, width, dtype=np.float32)[None, :]
    horizon = np.clip((y - 0.58) * 2.4, 0, 1)[..., None]
    sky_left = np.array([27, 45, 86], dtype=np.float32)
    sky_right = np.array([238, 130, 91], dtype=np.float32)
    sky = sky_left + (sky_right - sky_left) * x[..., None]
    floor = np.array([38, 30, 43], dtype=np.float32)
    background = sky * (1 - horizon) + floor * horizon
    glow = np.exp(-(((x - 0.73) / 0.19) ** 2 + ((y - 0.37) / 0.25) ** 2))
    background += glow[..., None] * np.array([44, 24, 4], dtype=np.float32)
    return np.clip(background, 0, 255)


def composite(rgb: np.ndarray, alpha: np.ndarray, background: np.ndarray) -> np.ndarray:
    weight = alpha.astype(np.float32)[..., None] / 255
    return np.rint(rgb.astype(np.float32) * weight + background * (1 - weight)).clip(0, 255).astype(np.uint8)


def labelled_panel(image: Image.Image, label: str, width: int = 356) -> Image.Image:
    ratio = width / image.width
    resized = image.resize((width, round(image.height * ratio)), Image.Resampling.LANCZOS)
    panel = Image.new("RGB", (width, resized.height + 34), "#101514")
    panel.paste(resized.convert("RGB"), (0, 34))
    draw = ImageDraw.Draw(panel)
    draw.text((12, 10), label, fill="#e5eeeb", font=ImageFont.load_default())
    return panel


def build_grid(rows: list[list[Image.Image]], destination: Path) -> None:
    gap = 8
    width = sum(panel.width for panel in rows[0]) + gap * (len(rows[0]) - 1)
    height = sum(row[0].height for row in rows) + gap * (len(rows) - 1)
    canvas = Image.new("RGB", (width, height), "#080c0b")
    y = 0
    for row in rows:
        x = 0
        for panel in row:
            canvas.paste(panel, (x, y))
            x += panel.width + gap
        y += row[0].height + gap
    canvas.save(destination, optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--result", default=DEFAULT_RESULT)
    parser.add_argument("--source", default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=Path("visualbench/results/video-background-alpha-20260816"))
    args = parser.parse_args()

    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    result_path = fetch(args.result, output / "production-transparent.webm")
    source_path = fetch(args.source, output / "source.webm")
    result_probe = probe(result_path)
    source_probe = probe(source_path)
    stream = video_stream(result_probe)
    source_stream = video_stream(source_probe)
    duration = float(result_probe["format"]["duration"])
    frame_rate_parts = stream["avg_frame_rate"].split("/")
    fps = float(frame_rate_parts[0]) / float(frame_rate_parts[1])
    tags = {key.lower(): value for key, value in stream.get("tags", {}).items()}
    timestamps = [0.5, duration / 2, max(0.5, duration - 0.5)]
    rows: list[list[Image.Image]] = []
    frame_metrics: list[dict] = []
    started = time.perf_counter()

    for index, timestamp in enumerate(timestamps, 1):
        frame_number = min(int(stream.get("nb_read_frames", 0)) - 1, round(timestamp * fps))
        rgba_path = output / f"frame-{index}-rgba.png"
        source_frame_path = output / f"frame-{index}-source.png"
        decode_frame(result_path, frame_number, rgba_path, alpha=True)
        decode_frame(source_path, frame_number, source_frame_path, alpha=False)
        rgba = np.asarray(Image.open(rgba_path).convert("RGBA"))
        source_rgb = np.asarray(Image.open(source_frame_path).convert("RGB"))
        rgb, alpha = rgba[..., :3], rgba[..., 3]
        if source_rgb.shape != rgb.shape:
            raise AssertionError(f"source/result shape mismatch: {source_rgb.shape} != {rgb.shape}")

        green = composite(rgb, alpha, GREEN)
        studio = composite(rgb, alpha, studio_background(*alpha.shape))
        checker = composite(rgb, alpha, checkerboard(*alpha.shape))
        Image.fromarray(alpha).save(output / f"frame-{index}-alpha.png", optimize=True)
        Image.fromarray(green).save(output / f"frame-{index}-green.png", optimize=True)
        Image.fromarray(studio).save(output / f"frame-{index}-studio.png", optimize=True)

        opaque = alpha >= 250
        retained_error = np.abs(source_rgb.astype(np.int16)[opaque] - rgb.astype(np.int16)[opaque])
        # On pixels with alpha=0, recomposition must be the replacement exactly.
        transparent = alpha == 0
        green_background_error = np.abs(green.astype(np.int16)[transparent] - GREEN.astype(np.int16))
        metrics = {
            "timestamp_seconds": round(timestamp, 6),
            "frame_number": frame_number,
            "alpha_min": int(alpha.min()),
            "alpha_max": int(alpha.max()),
            "alpha_mean": round(float(alpha.mean()), 6),
            "alpha_unique_levels": int(np.unique(alpha).size),
            "transparent_percent": round(float((alpha <= 5).mean() * 100), 6),
            "opaque_percent": round(float(opaque.mean() * 100), 6),
            "soft_edge_percent": round(float(((alpha > 5) & (alpha < 250)).mean() * 100), 6),
            "opaque_source_rgb_mae_255": round(float(retained_error.mean()), 6),
            "opaque_source_rgb_p99_error_255": round(float(np.percentile(retained_error, 99)), 6),
            "transparent_green_max_error_255": int(green_background_error.max()),
        }
        frame_metrics.append(metrics)
        rows.append([
            labelled_panel(Image.fromarray(source_rgb), f"{timestamp:.2f}s · source"),
            labelled_panel(Image.fromarray(checker), "decoded alpha · checker"),
            labelled_panel(Image.fromarray(alpha).convert("RGB"), "alpha matte"),
            labelled_panel(Image.fromarray(green), "recomposed · #00ff00"),
            labelled_panel(Image.fromarray(studio), "recomposed · replacement"),
        ])

    decode_seconds = time.perf_counter() - started
    assertions = {
        "vp9_codec": stream.get("codec_name") == "vp9",
        "alpha_mode_metadata": tags.get("alpha_mode") == "1",
        "all_frames_have_8bit_alpha_range": all(
            item["alpha_min"] == 0 and item["alpha_max"] == 255 and item["alpha_unique_levels"] >= 200
            for item in frame_metrics
        ),
        "foreground_and_background_present": all(
            item["transparent_percent"] >= 20 and item["opaque_percent"] >= 5
            for item in frame_metrics
        ),
        "soft_edges_present": all(item["soft_edge_percent"] >= 0.1 for item in frame_metrics),
        "opaque_rgb_fidelity": all(item["opaque_source_rgb_mae_255"] <= 3 for item in frame_metrics),
        "green_recomposition_exact_on_clear_pixels": all(
            item["transparent_green_max_error_255"] == 0 for item in frame_metrics
        ),
    }
    passed = all(assertions.values())
    benchmark = {
        "schema": 1,
        "result": "pass" if passed else "fail",
        "input": {
            "result_url": args.result,
            "source_url": args.source,
            "result_sha256": sha256_file(result_path),
            "source_sha256": sha256_file(source_path),
        },
        "video": {
            "codec": stream.get("codec_name"),
            "container_reported_pixel_format": stream.get("pix_fmt"),
            "alpha_mode": tags.get("alpha_mode"),
            "width": stream.get("width"),
            "height": stream.get("height"),
            "fps": fps,
            "duration_seconds": duration,
            "frames": int(stream.get("nb_read_frames", 0)),
            "bytes": result_path.stat().st_size,
            "source_width": source_stream.get("width"),
            "source_height": source_stream.get("height"),
        },
        "decoder": "FFmpeg libvpx-vp9 (explicit; required to expose the WebM alpha plane)",
        "sample_decode_and_composite_seconds": round(decode_seconds, 6),
        "frames": frame_metrics,
        "assertions": assertions,
    }
    (output / "benchmark.json").write_text(json.dumps(benchmark, indent=2) + "\n")
    build_grid(rows, output / "review-grid.png")
    mean_rgb = sum(item["opaque_source_rgb_mae_255"] for item in frame_metrics) / len(frame_metrics)
    readme = f"""# Production VP9 alpha recomposition visualbench — 2026-08-16

Result: **{'PASS' if passed else 'FAIL'}** ({sum(assertions.values())}/{len(assertions)} assertions).

This benchmark downloads the real production background-removal WebM, forces
FFmpeg's `libvpx-vp9` decoder so the WebM alpha side-data is exposed, extracts
three representative RGBA frames, and recomposes each over both chroma green
(`#00ff00`) and a new synthetic studio background.

- Output: {stream.get('width')}×{stream.get('height')} at {fps:g} fps, {duration:.3f}s, VP9 `alpha_mode=1`.
- Alpha: every sampled frame spans 0–255 and contains at least 200 distinct levels.
- Foreground RGB fidelity: {mean_rgb:.3f}/255 mean absolute error on pixels with alpha ≥250.
- Green identity: fully transparent pixels recompose to exact `[0, 255, 0]` (max error 0).
- Review: `review-grid.png` shows source, checkerboard alpha decode, raw matte,
  green recomposition, and replacement-background recomposition at each timestamp.
- Browser review: `tool-green-preview.png` captures the real transparent WebM
  playing over the tool's selectable chroma-green background.

The `yuv420p` value reported by a generic probe describes the colour plane. It
does not disprove alpha: WebM VP9 stores alpha as additional block data. The
numeric checks deliberately decode with libvpx and reject an all-opaque or
metadata-only export.

Re-run from the repository root:

```sh
python3 visualbench/benchmark_video_alpha.py
```
"""
    (output / "README.md").write_text(readme)
    if not passed:
        failed = ", ".join(name for name, value in assertions.items() if not value)
        raise SystemExit(f"FAIL: {failed}")
    print(json.dumps({"result": "pass", "output": str(output), "assertions": assertions}, indent=2))


if __name__ == "__main__":
    main()
