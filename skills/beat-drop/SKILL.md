---
name: beat-drop
description: Edit a video so zoom punches, flashes, camera shake and color splits land exactly on the kicks and snares of a song, which replaces the soundtrack. Use for music-synced edits, beat-drop transitions, TikTok/Reels edits, audio-reactive video, and "make the video hit with the beat". No people required.
---

# Beat Drop

Service `beat-drop`, MCP `beat_drop_video` (canonical names: service table in the `manifoldgen` skill). Async job, max 30 s, $0.04 per second of video (minimum $0.10), charged on success.

## Ask first
- The video and the song (both public URLs; the song up to 60 MB), `intensity` (default 1, 0.3-1.6), `palette` for the flash and split colors, how many seconds.

## Run
```bash
mg generate beat-drop --video clip.mp4 --audio song.mp3 --params '{"intensity":1.2}' --wait --out out/beat
```
MCP: `beat_drop_video {"video_url":"...","audio_url":"...","duration":15,"wait_seconds":300}`. `duration` is top level (1-30, from the start of both files).

## Deliver
- `video_url` (MP4 with the song as audio), `poster_url`, `audio_bpm` (detected tempo). To add effects that follow people as well, run the result through `motion-fx` with the same `audio_url`.
