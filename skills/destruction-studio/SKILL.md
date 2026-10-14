---
name: destruction-studio
description: Simulate rigid-body destruction (shatter, collapse, explosion, quake, slice) of a model, photo, preset building or 3D text in hosted Blender with ManifoldGen, returning an MP4, poster and baked editable .blend. Use for VFX destruction shots, product smash tests, title crumbles, or when the user asks to blow up, break, shatter or collapse something.
---

# Destruction Studio

Service `destruction-studio`, MCP `blender_destruction` (canonical names and params: service table in the `manifoldgen` skill). Async job, $0.40 base, +$0.06 photo-to-3D, +$0.20 high quality.

## Ask first
- Subject: uploaded model (.glb/.obj/.fbx/.stl/.ply), a photo, a preset (`tower wall pillar statue house`) or 3D text.
- Look: material (`concrete brick glass wood marble ice`), impact (`ball explosion quake slice`), piece count, slow motion, dust.
- Delivery: aspect (16:9, 9:16, 1:1), duration 2-8 s, final quality, whether they need the .blend for further sim/lighting work.

## Run
```bash
mg auth status
mg generate destruction-studio --model vase.glb --param material=glass --param impact=ball --param pieces=80 --param quality=draft --dry-run
mg generate destruction-studio --model vase.glb --param material=glass --param impact=ball --param pieces=80 --param quality=draft --wait --out out/destruction-draft
```
Show the draft poster/video, adjust, then render `--param quality=standard` (or `high`) once approved.

3D text: `--param subject=text --param text="LAUNCH" --param material=concrete --param impact=explosion`.
Photo: `--image object.png` (converted to 3D first).

MCP: `blender_destruction {"model_url":"https://...glb","material":"glass","impact":"ball","pieces":80,"quality":"draft","wait_seconds":300}`.
REST: `{"service":"destruction-studio","model_url":"...","params":{"material":"glass","impact":"ball","pieces":80,"quality":"draft"}}`.

## Deliver
- `blend_url`: baked simulation, editable in Blender (re-light, re-time, swap materials, re-render). Always hand this over with the MP4.
- `video_url` MP4 and `poster_url` still. Keep the same `seed` param when iterating so the fracture stays consistent.
