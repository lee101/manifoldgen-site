---
name: motion-track
description: Multi-person pose tracking as an API - persistent IDs, COCO-17 keypoints and boxes per frame, motion energy, tempo, strike and impact events, a skeleton overlay video and a colored spline guide video of head, wrist, ankle and hip trajectories for motion-control models. Use to extract motion data from video, drive other generators from movement, find hits and beats in action footage, or analyze athletes.
---

# Motion Track

Service `motion-track`, MCP `track_motion` (canonical names: service table in the `manifoldgen` skill). Async job, max 60 s, $0.02 per second (minimum $0.05), charged on success. Needs at least one fully visible person; otherwise it fails with no charge. No `params`; `duration` is top level (1-60, from the start).

## Run
```bash
mg generate motion-track --video clip.mp4 --wait --out out/track
```
MCP: `track_motion {"video_url":"...","wait_seconds":300}`.

## Deliver
- `tracks_url`: JSON `{fps,width,height,frames,keypoints,tracks:[{id,first,last,frames:[{box,kp:[[x,y,confidence]x17]}|null]}]}` in source pixels.
- `signals_url`: `{bpm,beats,energy,events,intensity}`; `events` also come back in the job result (capped at 64) with `frame`, `t`, `track`, `joint`, `x`, `y`, `speed`, `kind` (`strike` or `impact` with `target`), `power`.
- `preview_url` (also `video_url`): skeleton, ID and trail overlay on the clip. `guide_url`: black canvas with colored trajectory splines, usable as a motion guide for video models that accept track guides.
Pipe `tracks_url` or the events into `motion-fx`, `motion-score` or your own code.
