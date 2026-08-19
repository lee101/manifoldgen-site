# Production VP9 alpha recomposition visualbench — 2026-08-16

Result: **PASS** (7/7 assertions).

This benchmark downloads the real production background-removal WebM, forces
FFmpeg's `libvpx-vp9` decoder so the WebM alpha side-data is exposed, extracts
three representative RGBA frames, and recomposes each over both chroma green
(`#00ff00`) and a new synthetic studio background.

- Output: 1184×672 at 24 fps, 5.168s, VP9 `alpha_mode=1`.
- Alpha: every sampled frame spans 0–255 and contains at least 200 distinct levels.
- Foreground RGB fidelity: 1.704/255 mean absolute error on pixels with alpha ≥250.
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
