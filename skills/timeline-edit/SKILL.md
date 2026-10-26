---
name: timeline-edit
description: Edit video by JSON. Assemble clips, title cards, transitions, color grades, LUTs, shader FX and a music bed into a ManifoldGen Studio timeline (PortableStudioDocument), render it to MP4/WebM with the exact Studio export pipeline, and hand the user an editable Studio project. Use when the user wants a montage, trailer, slideshow, recap, social cut or any multi-clip edit from existing or generated media.
---

# Timeline Edit

Service table entry: `timeline-edit` in the `manifoldgen` skill. The document format is served live by MCP `get_studio_schema` and `GET https://manifoldgen.com/api/studio/schema` (fields, limits, worked example). Read it before writing a document.

## When to use
- Several clips, stills or generated shots need cutting together with titles, transitions, a grade and music.
- The user wants to keep refining the edit by hand: every render also saves a Studio project (`studio_url`).
- Not for single-clip generation (`mg generate video`), object removal (`shot-cleanup`) or 3D renders (Blender tools).

## Rules of the document
- `assets[]` holds every clip. Required: `id`, `kind` (`video`/`image`/`audio`) and `cloudURL` (public http(s) URL, or a local path when using the CLI). Title cards are `kind: "image"` with `text` and no `cloudURL`.
- Times are seconds. Clip length is `trimEnd - trimStart` of the source. Omit `timelineStart` to place a clip right after the previous clip on the same track; omitted `duration`/`width`/`height` are probed.
- `visualTrack` 0 is the bottom layer; overlays (titles, logos) go on 1+. Audio clips mix into A1 with `volume`, `fadeIn`, `fadeOut`.
- A `transition` on a clip blends it with the clip that ends exactly where it starts on the same track (`crossfade`, `dip`, `wipe-*`); with no previous clip it fades in from black.
- Grade per clip in `adjustments` (exposure, contrast, saturation, temperature, lift/gamma/gain, curves, vignette, grain, `fx` shader layers). LUTs live in `document.luts` as `.cube` text (`cube`) or URL (`url`) and are referenced by `adjustments.lutID` with `lutIntensity`.
- `stageX`/`stageY` offset by fractions of the canvas, `stageScale` 1 fits the clip, `opacity`, `blendMode`, `crop` per side.
- Limits: 512 KB, 200 clips, 10 minutes, canvas up to 3840x2160, fps up to 60.

## Example
```json
{
  "version": 6,
  "canvas": { "width": 1280, "height": 720 },
  "luts": {
    "warm": { "name": "Warm", "cube": "LUT_3D_SIZE 2\n0 0 0.02\n1 0.05 0\n0 0.95 0\n1 0.98 0\n0.03 0 0.9\n1 0.05 0.85\n0.03 0.95 0.85\n1 1 0.95\n" }
  },
  "assets": [
    { "id": "title", "kind": "image", "visualTrack": 1, "timelineStart": 0, "trimEnd": 3,
      "transition": { "type": "dip", "duration": 0.6 },
      "text": { "content": "Northern Lights", "fontSize": 140, "fontFamily": "Bebas Neue", "fontWeight": 800, "color": "#ffffff", "align": "center" } },
    { "id": "shot-1", "kind": "video", "cloudURL": "https://example.com/aurora-wide.mp4", "trimStart": 1, "trimEnd": 5,
      "adjustments": { "lutID": "warm", "lutIntensity": 0.8, "contrast": 0.1 } },
    { "id": "shot-2", "kind": "video", "cloudURL": "https://example.com/aurora-close.mp4", "trimEnd": 4,
      "transition": { "type": "crossfade", "duration": 1 },
      "adjustments": { "lutID": "warm", "lutIntensity": 0.8, "saturation": 0.15 } },
    { "id": "music", "kind": "audio", "cloudURL": "https://example.com/ambient-bed.mp3", "timelineStart": 0, "trimEnd": 8,
      "volume": 0.7, "fadeIn": 0.5, "fadeOut": 1.5 }
  ]
}
```
Shot 1 runs 0-4 s, shot 2 starts at 4 s with a 1 s crossfade, the title sits over the first 3 s, and the music bed fades out at 8 s.

## Run
CLI (local `cloudURL` paths upload and local `luts.*.url` .cube files are inlined automatically):
```bash
mg studio open edit.json                  # free: editable project, prints studio_url
mg render edit.json --wait --out renders  # MP4 + poster, prints studio_url
mg render --project <project_id> --format webm --wait
```
MCP: `get_studio_schema` -> `create_studio_project {document, name}` -> `render_timeline {document | project_id, format, quality, resolution, fps, wait_seconds}`; poll with `wait_for_job` if `wait_seconds` runs out.
REST: `POST /api/service {"service":"timeline-render","params":{"document":{...},"format":"mp4"}}`, poll `/api/video-jobs/<job_id>`; `POST /api/studio/projects/import {"name","document"}`.

Pricing: $0.01 per output second up to 1920x1080, $0.02 above, $0.05 minimum, charged only on success. Opening a project is free.

## Deliver
- `video_url`, `poster_url` and `studio_url` (https://manifoldgen.com/studio?project=<id>), plus a one-line shot list with timings. Mention that the edit stays fully editable in Studio.
- Validation errors name the field (`assets[2] (shot-2): ...`); fix the document and resubmit rather than guessing.
