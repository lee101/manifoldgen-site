---
name: footage-sorter
description: Log, bin and audio-sync a batch of clips into an edit-ready timeline (OTIO, FCPXML for Premiere/Resolve/Final Cut, and a ManifoldGen Studio project) with ManifoldGen's hosted footage sorter. Use when the user wants footage organized, tagged, grouped by scene or shot type, multicam-synced, or turned into a starting timeline.
---

# Footage Sorter

Service `footage-sorter`, MCP `organize_footage` (canonical names: service table in the `manifoldgen` skill). Async job, $0.05 + $0.02 per clip, up to 24 clips, 2 GB total.

## Ask first
- The clips (local files: upload with `create_upload` / the CLI uploads automatically), which clip is the sync reference if known, target NLE (Premiere, Resolve, Final Cut, Studio) and timeline fps.

## Run
```bash
mg generate footage-sorter --params '{"clips":["https://.../a.mp4","https://.../b.mp4"],"sync":true}' --wait --out out/sorted
```
MCP: `organize_footage {"clips":[...],"sync":true,"wait_seconds":300}`.

Each clip is probed and captioned, classified (A-roll/B-roll, wide/medium/close), binned by scene, camera and role, and synced to the reference by audio (search window ±60 s, with a confidence score; low-confidence clips stay unsynced instead of being misplaced).

## Deliver
- `fcpxml_url` (Premiere, Resolve, Final Cut), `otio_url`, `studio_project_url` (open in https://manifoldgen.com/studio), `contact_sheet_url`, and the `report` bins and offsets.
- NLE files reference the original media URLs: tell the user to relink to local copies if needed.
