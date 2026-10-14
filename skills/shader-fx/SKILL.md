---
name: shader-fx
description: Apply real-time GPU shader effects (glow, film grain, halftone, glitch, chromatic aberration, toon/posterize, VHS) to images or footage in ManifoldGen's browser shader-fx tool, export the render and a .cube LUT for the color part. Use for stylized looks on footage, music-video FX, social edits, or toon looks on 2D video.
---

# Shader FX

Client-side tool at https://manifoldgen.com/tools/shader-fx (canonical status: service table in the `manifoldgen` skill). Runs in the browser, no credits, no API job.

## Ask first
- Source clip or image, the look (references help), intensity, output resolution/aspect, and whether the color part must be reusable in an NLE.

## Run
1. Open https://manifoldgen.com/tools/shader-fx, load the media, stack and tune effects.
2. Export the rendered file and the `.cube` LUT for the color component.
3. Reuse the LUT on other shots: `ffmpeg -i shot.mp4 -vf lut3d=fx.cube -c:a copy out.mp4`.

Need the effect on a 3D asset rather than footage: use `toon-shader`. Need source footage first: `mg generate video --prompt ... --wait --out out/`.

## Deliver
- Rendered media, the `.cube` LUT, and the effect settings used (write them down so the look can be recreated). Keep originals untouched.
