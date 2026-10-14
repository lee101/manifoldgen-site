---
name: exploded-view
description: Turn a product or mechanical 3D model (or a photo) into an exploded-view or assembly animation with studio staging in hosted Blender via ManifoldGen, returning MP4, poster and editable .blend. Use for product launches, teardown explainers, assembly instructions, technical marketing, or when the user asks for an exploded view.
---

# Exploded View

Service `exploded-view`, MCP `blender_exploded_view` (canonical names and params: service table in the `manifoldgen` skill). Async job, $0.40 base, +$0.06 photo-to-3D, +$0.20 high quality.

## Ask first
- Asset: CAD-derived .glb/.obj/.fbx/.stl/.ply (best; keep parts as separate meshes) or a product photo.
- Motion: `mode` explode, assemble or explode_assemble; `axis` radial, vertical or forward; spread and stagger; turntable; guide lines.
- How parts split: `split` auto, loose (mesh islands), material, or slices.
- Delivery: aspect, duration 2-8 s, background (`studio dark sky white`), quality.

## Run
```bash
mg generate exploded-view --model headphones.glb --param mode=explode_assemble --param split=loose --param axis=radial --param guides=true --param quality=draft --dry-run
mg generate exploded-view --model headphones.glb --param mode=explode_assemble --param split=loose --param axis=radial --param guides=true --param quality=draft --wait --out out/exploded-draft
```
No model yet? Preview with `--param demo=headphones` (or `camera`, `watch`). Approve the draft, then rerun with `--param quality=standard|high`.

MCP: `blender_exploded_view {"model_url":"...","mode":"explode_assemble","split":"loose","quality":"draft","wait_seconds":300}`.
REST: `{"service":"exploded-view","model_url":"...","params":{"mode":"explode_assemble","split":"loose"}}`.

## Deliver
- `blend_url` with the keyed part animation: adjust timing, callouts and lighting in Blender.
- `video_url` MP4 and `poster_url`. If parts did not separate well, try `split=material` or `slices`, or ask for a model with separate meshes.
