---
name: shot-cleanup
description: Remove unwanted objects, people, logos, rigs or vehicles from video while keeping motion and texture, and pull clean alpha mattes, with ManifoldGen. Use for paint-out, de-branding, crew or boom removal, background removal on footage, or when the user asks to erase something from a clip.
---

# Shot Cleanup

Services `shot-cleanup` (MCP `remove_video_objects`, $0.24 per second, charged on success) and `video_background_removal` (MCP `generate_media`). Canonical names and params: service table in the `manifoldgen` skill.

## Ask first
- The clip, what to remove, and how long (max 30 s per job; split longer shots).
- Targeting: a short noun (`person`, `logo`, `car`) works up to 30 s; for precise picks on clips up to 4.8 s, first-frame points `[{x,y,type:"positive"|"negative"}]` (pixel coordinates).
- Keep original audio? Need an alpha matte instead (subject kept, background removed)?

## Run
```bash
mg generate shot-cleanup --video take3.mp4 --prompt "boom microphone" --duration 12 --param keep_audio=true --dry-run
mg generate shot-cleanup --video take3.mp4 --prompt "boom microphone" --duration 12 --param keep_audio=true --wait --out out/cleanup
```
Points: `--params '{"points":[{"x":812,"y":140,"type":"positive"}]}' --duration 4`.
Alpha matte: `mg generate video_background_removal --video take3.mp4 --wait --out out/matte`.

MCP: `remove_video_objects {"video_url":"...","prompt":"boom microphone","duration":12,"keep_audio":true,"wait_seconds":600}`.
REST: `{"service":"shot-cleanup","video_url":"...","prompt":"boom microphone","duration":12,"params":{"keep_audio":true}}`.

## Deliver
- Cleaned `video_url` (same length and framing). Keep the original alongside for comparison and for the edit (conform via `shot-composer` / Studio). Cost = $0.24 x seconds: quote it before running.
