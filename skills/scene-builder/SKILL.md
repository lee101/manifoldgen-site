---
name: scene-builder
description: Build and render a 3D scene in hosted Blender from a declarative spec (primitives, 3D text, uploaded or photo-generated models, materials, lights, camera moves, keyframes) with ManifoldGen, returning MP4, poster and editable .blend; also turns photos into GLB models. Use for previs, product staging, motion-graphics layouts, blocking a shot, or when the user wants a 3D scene from references.
---

# Scene Builder

Services `blender-scene` (MCP `blender_render_scene`, $0.30 base) and `image-to-3d` (MCP `image_to_3d`, $0.06, high $0.45). Canonical names and params: service table in the `manifoldgen` skill.

## Ask first
- Shot goal and references: what objects, where, camera framing and move, mood/lighting, duration 2-8 s, aspect.
- Assets: existing models, or photos to convert to 3D first.
- Output: final render or previs; do they need the .blend for their own pipeline.

## Run
1. Photos to models (one job each), keep `glb_url`:
```bash
mg generate image-to-3d --image chair.jpg --wait --out out/models --json
```
2. Write the spec. `objects[].model_index` points into `model_urls`. Shape:
`{objects:[{type,model_index,text,location,rotation,scale,material:{color,roughness,metallic,emission,emission_strength,toon},keyframes:[{frame,location,rotation,scale}]}], lights:[{type,location,rotation,color,energy}], camera:{location,look_at,lens,keyframes}, world:{color,strength,preset}, frames}` (max 64 objects, 16 models).
3. Draft, review, then final:
```bash
mg generate blender-scene --model https://.../chair.glb --model table.glb --params "{\"spec\":$(cat spec.json),\"quality\":\"draft\"}" --dry-run
mg generate blender-scene --model https://.../chair.glb --model table.glb --params "{\"spec\":$(cat spec.json),\"quality\":\"draft\"}" --wait --out out/scene-draft
```

MCP: `blender_render_scene {"model_urls":[...],"spec":{...},"quality":"draft","wait_seconds":300}`.
REST: `{"service":"blender-scene","model_urls":[...],"params":{"spec":{...}}}`.

## Deliver
- `blend_url` (full scene, editable), `video_url`, `poster_url`, plus each `glb_url` from step 1. Keep `spec.json` with the deliverables so the shot can be re-rendered.
