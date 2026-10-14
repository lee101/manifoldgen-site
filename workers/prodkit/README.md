# prodkit — hosted Blender production recipes

Headless Blender 5.2 recipes: destruction, exploded view, toon shader, declarative scene.

## Contract

```
blender -b --factory-startup -P workers/prodkit/run_blender.py -- /abs/args.json
```

args.json: `{"recipe": "destruction|exploded_view|toon_shader|scene", "out": "/abs/dir", "params": {...}, "inputs": {"model_path": "...", "model_paths": [...], "image_path": "..."}}` (image_path accepted but currently unused)

Writes `out/manifest.json`:
- ok: `{"ok":true,"recipe","video":"render.mp4","poster":"poster.jpg","blend":"scene.blend","glb":"scene.glb"?,"width","height","fps","frames","seconds","device":"OPTIX|CUDA|CPU|EEVEE","engine","render_seconds","total_seconds","stats":{...}}`
- fail: `{"ok":false,"error":"..."}`, exit 2 (bad input) or 1 (internal; traceback in `out/error.log`).

Also `out/blender.log` (raw Blender output). `.blend` is packed (textures embedded), rigid-body cache baked in, materials/modifiers/keyframes editable. Inputs are data only: no user code, numerics clamped, enums whitelisted, text sanitized, `.gltf` external URIs outside the model dir rejected, models >300 MB or >1.6M faces rejected and decimated to fixed face budgets.

Env: `PRODKIT_ENGINE=CYCLES|EEVEE` (force), `PRODKIT_FFMPEG` (default `/usr/bin/ffmpeg`), `PRODKIT_KEEP_FRAMES=1`, `PRODKIT_PREVIEW=1` (50% res, 4 spp, dev only).

Work cap: Cycles spp = min(preset, 7e9 / (w·h·frames)) on OptiX (5.5e9 CUDA, CPU 16 spp + res scaling); EEVEE spp = min(2×preset, 4e9 / (w·h·frames)). Max 240 frames.

## Common params

| param | values | default |
|---|---|---|
| duration | 2–8 s | 4 |
| fps | 12–30 | 24 |
| aspect | 16:9, 9:16, 1:1 | 16:9 |
| quality | draft (540p, 16 spp), standard (720p, 32), high (1080p, 64) | standard |
| seed | int | 7 |
| background | studio, dark, sky, white | studio |
| export_glb | bool | true |

## Recipes

**destruction** — Voronoi fracture (exact cells, adjacency-aware), breakable fixed-constraint bonds, Bullet rigid bodies, secondary debris, procedural GN dust (closed-form, also spawned where chunks hit the ground), auto-framing from the baked sim, camera shake.

| param | values | default |
|---|---|---|
| subject | tower, wall, pillar, statue, house, text (or `inputs.model_path`) | tower |
| text | ≤12 chars | BOOM |
| material | concrete, brick, glass, wood, marble, ice | per subject |
| pieces | 12–160 | 70 |
| impact | ball, explosion, quake, slice | ball |
| slowmo | bool (animated rigid-body time scale around impact) | false |
| dust / debris | 0–2 | 1 |
| strength | 0.3–2 | 1 |
| bond | 0–3 (bond strength multiplier; 0 = loose pieces) | 1 |

Uploaded models: long horizontal axis turned to X (camera sees the broad side, 3/4 front), normalized to 3.6 m, verts welded, decimated to 20k faces, voxel proxy for inside tests when non-manifold, original materials/UVs kept on outer faces, `material` (default concrete) on cut faces; glass/ice also convert the exterior to tinted transmissive (texture kept as tint). Bond adjacency falls back to cut-plane contact when caps can't be filled (open/shell meshes).

Ball: radius 0.25–0.5 m from subject size, mass 0.4× subject mass, 13 m/s; wide subjects are hit on the broad face at an angle away from camera; bonds within ~0.3×size of the impact are weakened to 3% so the ball always punches through, far bonds keep full strength (sections topple as blocks).

**exploded_view**

| param | values | default |
|---|---|---|
| demo | camera, watch, headphones (when no model) | camera |
| mode | explode, assemble, explode_assemble | explode_assemble |
| axis | auto, radial, vertical, forward | auto (designed dirs for demos, radial for models) |
| spread | 0.2–3 | 1 |
| stagger | 0–1 | 0.5 |
| turntable / turntable_degrees | bool / 0–720 | true / 90 |
| guides | bool | auto (on when ≤20 parts) |
| layers | 2–10 (planar slicing fallback) | 5 |

Split order: separate objects → loose parts → material slots → planar layers. Tiny parts merged, max 48 parts. Camera distance animates with the explode.

**toon_shader** — EEVEE Shader-to-RGB + constant ramp bands, shadow tint, toon specular, rim, halftone (comic), inverted-hull outline (Solidify, flipped, backface-culled). Falls back to Cycles with N·L bands (no cast shadows) if EEVEE cannot init. View transform Standard.

| param | values | default |
|---|---|---|
| demo | character, camera, headphones, watch | character |
| style | cel, anime, comic, flat | cel |
| bands | 2–5 | per style |
| outline_width | 0–5 | per style |
| outline_color | hex | #030303 |
| rim | bool | true |
| palette | list of hex (replaces per-material base colors) | — |
| turntable / turntable_degrees | bool / 0–720 | true / 120 |
| bounce | bool (demo character) | true |

**scene** — `params.spec` (caps: 64 objects, 64 keyframes each, 16 lights, 240 frames).

```
{"objects":[{"type":"cube|sphere|cylinder|cone|torus|plane|text|model","model_index":0,"name":"..","text":"..","size":1,"extrude":0.08,
   "bevel":0.0,"thickness":0.3,"location":[x,y,z],"rotation":[deg,deg,deg],"scale":s|[x,y,z],
   "material":{"color":"#hex","roughness":0.45,"metallic":0,"transmission":0,"emission":"#hex","emission_strength":2,"toon":false},
   "interpolation":"bezier|linear|constant","keyframes":[{"frame":1,"location":..,"rotation":..,"scale":..}]}],
 "lights":[{"type":"sun|area|point|spot","location":..,"look_at":..|"rotation":..,"color":"#hex","energy":..,"size":..,"spot_size":45}],
 "camera":{"location":..,"look_at":..,"lens":50,"fstop":4,"keyframes":[{"frame":..,"location":..,"look_at":..,"lens":..}]},
 "world":{"preset":"studio|sky|night|sunset|dark|white","color":"#hex","strength":1},
 "frames":96,"fps":24,"floor":true,"motion_blur":true}
```
Models (`inputs.model_paths[model_index]`) are normalized to a 1-unit box, then transformed. No camera → auto-fit orbit. No lights → preset lights. params.engine auto|cycles|eevee (auto = EEVEE if any toon material), params.toon_style.

## Demos (`demos/<recipe>-<n>/`: args.json, manifest.json, render.mp4, poster.jpg)

Standard 1280x720, 96 frames (4 s), RTX 3090 Ti **shared with other GPU services at ~80–100% util** (expect faster on an idle card / 5090).

| demo | setup | render s | total s | spp | .blend MB |
|---|---|---|---|---|---|
| destruction-1 | brick tower, ball punches through, studio (70 pcs, 324 bonds) | 65.2 | 72.0 | 32 | 0.53 |
| destruction-2 | marble statue, explosion, slowmo, dark | 64.5 | 70.3 | 32 | 0.72 |
| exploded_view-1 | demo camera, explode_assemble | 47.0 | 48.4 | 32 | 0.22 |
| exploded_view-2 | DamagedHelmet, 48 loose parts | 57.1 | 60.7 | 32 | 3.61 |
| toon_shader-1 | DamagedHelmet anime, sky (EEVEE) | 17.9 | 20.5 | 45 | 3.69 |
| toon_shader-2 | demo character comic, white (EEVEE) | 18.0 | 23.0 | 45 | 0.32 |
| scene-1 | helmet product shot on podium, dolly cam | 51.3 | 54.3 | 32 | 3.82 |
| scene-2 | text + primitives, 3-key moving camera | 38.5 | 41.1 | 32 | 0.19 |

Worst case measured: destruction high 1080p, 8 s (192 f), 160 pieces, slowmo, dust/debris 2: 22 spp, render 274 s, total 306 s on the shared 3090 Ti (budget since lowered to 7e9 → 17 spp, ≈ 240 s). Standard 720p 4 s ≈ 0.5–0.7 s/frame Cycles, 0.2 s/frame EEVEE. Draft 2 s runs: 6–19 s each (`test_recipes.sh`). Physics/fracture/bake are < 5 s; render dominates.

Uploaded-model draft runs (960x540, 3 s, 72 f, shared 3090 Ti): sneaker glass ball 34 s total (fracture 9.5 s), Duck concrete ball 27 s, tall figure marble ball 26 s, sneaker wood explosion 35 s, sneaker quake 27 s, tall figure ice slice 16 s.

## Tests

`./test_recipes.sh` (OUT=/tmp/prodkit-test): builds `testdata/` via `make_testdata.py` (Khronos DamagedHelmet + Duck, multi-part watch GLB, open OBJ), runs every recipe at draft incl. 9:16/1:1/slowmo/uploaded/failure cases, checks manifest + ffprobe size/frame count.
