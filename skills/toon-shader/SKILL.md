---
name: toon-shader
description: Apply cel, anime, comic or flat toon shading with outlines to a 3D model (or photo-to-3D) and render a turntable in hosted Blender via ManifoldGen, returning MP4, poster and a .blend with editable toon materials. Use for stylized character or product renders, NPR looks, anime-style 3D, or when the user asks for a toon or cel shader.
---

# Toon Shader

Service `toon-shader`, MCP `blender_toon_shader` (canonical names and params: service table in the `manifoldgen` skill). Async job, $0.30 base, +$0.06 photo-to-3D, +$0.20 high quality.

## Ask first
- Asset: .glb/.obj/.fbx/.stl/.ply or a photo; or preview with `demo` (`character car helmet`).
- Style: `cel anime comic flat`, shading bands 2-5, outline width and hex color, rim light, palette (up to 8 hex colors).
- Delivery: turntable or still poster, aspect, duration 2-8 s, background, quality.

## Run
```bash
mg generate toon-shader --model hero.glb --param style=anime --param bands=3 --param outline_width=3 --param outline_color="#111111" --param turntable=true --param quality=draft --dry-run
mg generate toon-shader --model hero.glb --param style=anime --param bands=3 --param outline_width=3 --param turntable=true --param quality=draft --wait --out out/toon-draft
```
Palette: `--params '{"palette":["#f4d35e","#ee964b","#0d3b66"]}'`. Approve the draft, then `--param quality=standard|high`.

MCP: `blender_toon_shader {"model_url":"...","style":"anime","bands":3,"outline_width":3,"quality":"draft","wait_seconds":300}`.
REST: `{"service":"toon-shader","model_url":"...","params":{"style":"anime","bands":3}}`.

## Deliver
- `blend_url`: toon materials and outline modifiers stay editable for the user's own shots.
- `video_url` turntable and `poster_url`. For footage (not 3D), use `shader-fx` instead.
