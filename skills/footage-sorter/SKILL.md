---
name: footage-sorter
description: Organize a folder of clips into scenes, shot types and selects for an edit. ManifoldGen's hosted footage sorter is coming soon; until then this skill sorts locally with ffprobe and ManifoldGen captions. Use when the user wants footage logged, tagged, binned or turned into an edit-ready timeline.
---

# Footage Sorter (coming soon)

No hosted service yet (status: service table in the `manifoldgen` skill). Do not call an unlisted service name.

## Ask first
- Folder of clips, what to sort by (scene, shot size, subject, take quality, timecode), and the editor they use (Premiere, Resolve, Final Cut, ManifoldGen Studio).

## Interim workflow
1. Metadata: `ffprobe -v error -show_entries format=duration:stream=width,height,r_frame_rate -of json clip.mp4` per clip.
2. Grab a mid-frame still per clip (`ffmpeg -ss <mid> -i clip.mp4 -frames:v 1 thumb.jpg`) and caption it with ManifoldGen `caption` (check `mg pricing caption`; quote the total for the batch).
3. Group by caption keywords and shot size; write `sorted.csv` (file, duration, resolution, scene, shot, caption).
4. Editable timeline: write OTIO or FCPXML referencing the original files in sorted order; for ManifoldGen Studio, import the sorted files.

## Deliver
- `sorted.csv`, the OTIO/FCPXML timeline, and folders or bins per scene. Never move or rename originals without asking.
