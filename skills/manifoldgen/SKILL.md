---
name: manifoldgen
description: Generate images, video, music, voice, 3D and production assets with ManifoldGen (manifoldgen.com) via the `mg` CLI, MCP or REST. Use when the user wants media made or edited with ManifoldGen, asks for ManifoldGen prices, needs a ManifoldGen job polled or downloaded, or runs a ManifoldGen production tool (destruction, exploded view, toon shader, Blender scene, image to 3D, vectorize, shot cleanup, color grade, shader FX).
---

# ManifoldGen

One account, one credit balance, every model. The CLI, MCP server and REST API share the same API key.

## Setup

```bash
npm i -g manifoldgen-cli          # or: bunx manifoldgen-cli <command>
mg auth login                     # browser approval; add --no-browser on SSH/remote boxes
mg auth status                    # account + balance
```

CI or sandboxed agents: `export MANIFOLDGEN_API_KEY=sk-mg-...` (overrides the stored key). `MANIFOLDGEN_BASE_URL` points at another deployment.

## Spend rules

1. Check cost before every paid call: `mg pricing <service>` or `mg generate <service> ... --dry-run`. State the price to the user; get explicit approval for anything over $1, batches, or long video.
2. Submit once. Keep the job ID. Recover with `mg job <id> --wait`; never resubmit because polling timed out.
3. Use `--json` when parsing output. Exit code 1 = error, 2 = usage.
4. 401: run `mg auth login`. 402: user must add credits at https://manifoldgen.com/account. 429/503: back off and retry later.

## Generate

```bash
mg services                                            # names + prices
mg generate image --prompt "editorial portrait, hard light" --width 1024 --height 1024 --out out/
mg generate video --prompt "rain on a glass roof" --duration 5 --aspect-ratio 16:9 --wait --out out/
mg generate music --prompt "warm modular synths" --duration 60 --wait --out out/
mg generate image-edit --image photo.jpg --prompt "make it dusk" --out out/
```

- `--model` with a .glb/.gltf/.obj/.fbx/.stl/.ply path or URL becomes `model_url` (repeat for `model_urls`); any other value stays the `model` selector.
- `--image/--video/--audio/--mask/--model` and any `--<name>_url` / `--<name>_urls` accept a local path or URL. Local files are uploaded (presigned R2) automatically.
- Tool options go in `params`: `--param pieces=80 --param impact=ball` or `--params '{"pieces":80}'`.
- Other `--kebab-case value` flags become `snake_case` JSON fields (`--aspect-ratio 16:9` -> `aspect_ratio`).
- Async services return a job; `--wait` or `--out` polls until done and downloads every output (video, poster, .blend, .glb, .svg).

```bash
mg job <id> --wait --out out/     # resume / download
mg jobs [--kind audio]            # recent jobs
mg search "glass architecture" --kind images|videos|audio
```

## MCP

```bash
mg mcp config                     # snippets for Claude Code, Codex, Cursor
claude mcp add --transport http manifoldgen https://manifoldgen.com/api/mcp --header "Authorization: Bearer $MANIFOLDGEN_API_KEY"
```

Tools: `get_pricing`, `list_services`, `search_media`, `create_upload`, `generate_media`, `get_job`, `wait_for_job`, `list_jobs`, plus the production tools below. `generate_media` takes the REST body; unknown fields are rejected. Local files: `create_upload`, PUT the bytes, pass `public_url`.

## REST

```bash
curl https://manifoldgen.com/api/service -H "Authorization: Bearer $MANIFOLDGEN_API_KEY" -H "Content-Type: application/json" \
  -d '{"service":"destruction-studio","image_url":"https://...png","params":{"pieces":80,"impact":"ball","quality":"draft"}}'
curl https://manifoldgen.com/api/video-jobs/<job_id> -H "Authorization: Bearer $MANIFOLDGEN_API_KEY"
```

`GET /api/pricing` (public), `POST /api/studio/assets/presign` (`project_id`, `asset_id` UUIDs, `filename`, `content_type` image/*, video/*, audio/*, model/*, `size`) then PUT the bytes to `upload_url` and pass `public_url`. Jobs: 202 while queued/processing, then `job.status` completed|failed|payment_required with `job.result`.

## Production tools (canonical names)

Update names here only; the workflow skills defer to this table. Prices are base list prices; confirm with `mg pricing <service>` or MCP `list_services`.

| Skill | Service (`mg generate` / REST) | MCP tool | Inputs | Key `params` | Outputs | Base |
| --- | --- | --- | --- | --- | --- | --- |
| destruction-studio | `destruction-studio` | `blender_destruction` | `model_url`, `image_url` (+$0.06 photo-to-3D) or preset | `subject` tower/wall/pillar/statue/house/text, `text`, `pieces` 12-160, `material`, `impact` ball/explosion/quake/slice, `slowmo`, `dust` | `video_url`, `poster_url`, `blend_url` | $0.40 |
| exploded-view | `exploded-view` | `blender_exploded_view` | `model_url` or `image_url` | `mode` explode/assemble/explode_assemble, `split` auto/loose/material/slices, `axis`, `spread`, `stagger`, `turntable`, `guides`, `demo` | `video_url`, `poster_url`, `blend_url` | $0.40 |
| toon-shader | `toon-shader` | `blender_toon_shader` | `model_url` or `image_url` | `style` cel/anime/comic/flat, `bands` 2-5, `outline_width`, `outline_color`, `rim`, `palette`, `turntable`, `demo` | `video_url`, `poster_url`, `blend_url` | $0.30 |
| scene-builder | `blender-scene` | `blender_render_scene` | `model_urls` (max 16) | `spec` {objects, lights, camera, world, frames} | `video_url`, `poster_url`, `blend_url` | $0.30 |
| scene-builder | `image-to-3d` | `image_to_3d` | `image_url` | `quality` standard/high ($0.45) | `glb_url` | $0.06 |
| vectorize | `vectorize` | `vectorize_image` | `image_url` | `mode` color/poster/bw/lineart, `colors` 2-32 (= layers), `detail`, `corners`, `smooth`, `engine` trace/ai ($0.03) | `svg_url` (one layer per color) | $0.02 |
| shot-cleanup | `shot-cleanup` | `remove_video_objects` | `video_url`, `prompt` (what to erase), `duration` 1-30 | `points` [{x,y,type}] (clips up to 4.8 s), `keep_audio` | `video_url` | $0.24/s |
| shot-cleanup | `video_background_removal` | `generate_media` | `video_url` | - | alpha video | per s |
| image-fixer | `image-edit`, `remove-background`, `relight`, `upscale-image`, `extend-image`, `smart-resize` | `generate_media` | `image_url` (+ `mask_url`, `prompt`) | - | PNG | per image |
| shot-composer | `shot-composer` | `composite_shot` | `video_url` (subject), `image_url` or `prompt` (background), `duration` 1-30 | `background_video_url`, `key` ai/chroma, `key_color`, `position`, `scale`, `match_color`, `light_wrap`, `grain`, `shadow`, `keep_audio` | `video_url`, `fg_alpha_url`, `background_url`, `lut_url`, Studio project | $0.10 + matte per s |
| timeline-edit | `timeline-render` (`mg render edit.json`) | `render_timeline` | `params.document` (PortableStudioDocument v6, `get_studio_schema`) or `params.project_id` | `format` mp4/webm, `quality`, `resolution`, `fps` 1-60, `name` | `video_url`, `poster_url`, `studio_url` | $0.01/s (<=1080p), $0.02/s above, $0.05 min |
| timeline-edit | `POST /api/studio/projects/import` (`mg studio open edit.json`) | `create_studio_project` | `document`, `name` | - | `project_id`, `studio_url` | free |
| color-grade | client tool `/tools/color-grade` | none | image/video | - | `.cube` LUT | free |
| shader-fx | client tool `/tools/shader-fx` | none | image/video | - | `.cube` LUT, rendered video | free |
| motion-fx | `motion-fx` | `apply_motion_fx` | `video_url` (people visible), `audio_url` (song, optional), `duration` 1-20 | `preset` anime-fight/ki-aura/lightning/neon-trails/game-hud/spotlight/slowmo-impacts/exaggerate/echo, `intensity` 0.3-1.6, `palette`, `slowmo`, `sfx`, `text`, `target`, `names`, `extra`, `seed` | `video_url`, `poster_url`, `tracks_url`, `events`, `bpm` | $0.06/s, $0.15 min |
| beat-drop | `beat-drop` | `beat_drop_video` | `video_url`, `audio_url` (required), `duration` 1-30 | `intensity`, `palette`, `seed` | `video_url`, `poster_url`, `audio_bpm` | $0.04/s, $0.10 min |
| motion-track | `motion-track` | `track_motion` | `video_url` (people visible), `duration` 1-60 | - | `tracks_url`, `signals_url`, `preview_url` (= `video_url`), `guide_url`, `events` | $0.02/s, $0.05 min |
| motion-score | `motion-score` | `score_motion_video` | `video_url` (people visible), `audio_url` (music to fit, optional), `duration` 1-30 | `keep_audio` | `video_url`, `audio_url`, `cues_url`, `bpm`, `music_prompt` | $0.05/s, $0.20 min |
| footage-sorter | `footage-sorter` | `organize_footage` | `params.clips` (1-24 URLs) | `sync`, `reference_audio`, `fps` | `otio_url`, `fcpxml_url`, `studio_project_url`, `contact_sheet_url`, `report` | $0.05 + $0.02/clip |

Blender tools share `params`: `duration` 2-8 s, `aspect` 16:9/9:16/1:1, `quality` draft (~540p) / standard (720p) / high (1080p, +$0.20), `background` studio/dark/sky/white, `seed`. Preview with `quality=draft`, then render final. 3D inputs: `.glb .gltf .obj .fbx .stl .ply`.

MCP production tools take these fields flat (no `params` wrapper) plus optional `wait_seconds` (0-600). REST and the CLI put tool options in `params`; `image_url`, `model_url`, `model_urls`, `video_url`, `prompt` stay top level; `duration` is top level for shot-cleanup, shot-composer and the motion tools and inside `params` for Blender tools; `audio_url` is top level too. If a service answers `unknown service`, it is not deployed on that host yet: say so and stop.

MCP also serves workflow prompts (`prompts/list`) mirroring these skills.
