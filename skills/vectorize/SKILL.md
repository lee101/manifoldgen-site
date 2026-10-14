---
name: vectorize
description: Convert raster images (logos, icons, illustrations, scans, line art) into layered SVG with ManifoldGen, one layer per color so it opens editable in Illustrator, Figma or Inkscape. Use when the user wants an SVG, vector trace, scalable logo, cutting/plotter file, or to clean up a pixelated logo.
---

# Vectorize

Service `vectorize`, MCP `vectorize_image` (canonical names and params: service table in the `manifoldgen` skill). $0.02 per image (trace), $0.03 with `engine=ai`.

## Ask first
- Source image and use: logo, icon, illustration, line art, print/cut file.
- Style: `mode` color, poster (flat), bw, lineart; number of colors (`colors` 2-8); keep fine detail or simplify (`detail` 0-1); `smooth` spline, polygon or pixel; corner sharpness (`corners` 0-180).
- Engine: `trace` (exact) or `ai` (cleaner shapes on noisy or low-res input).

## Run
```bash
mg pricing vectorize
mg generate vectorize --image logo.png --param mode=poster --param colors=4 --param smooth=spline --wait --out out/vector
```
Low-res or JPEG-noisy logo: optionally upscale first (`mg generate upscale-image --image logo.png --out out/`), then `--param engine=ai`.

MCP: `vectorize_image {"image_url":"...","mode":"poster","colors":4,"wait_seconds":120}`.
REST: `{"service":"vectorize","image_url":"...","params":{"mode":"poster","colors":4}}`.

## Deliver
- `svg_url`: grouped by color layer; tell the user layers map to colors. Batch multiple images with one job each and report the total cost first.
