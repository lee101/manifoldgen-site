---
name: motion-score
description: Score a video from its motion - beat-locked drums whose density follows the action plus impact and whoosh sound design on every detected strike, optionally fitting your own music track to the motion beat. Use for fight and action edits that need sound, video-reactive music, syncing a music bed to movement, or getting a tempo and a music prompt from a clip.
---

# Motion Score

Service `motion-score`, MCP `score_motion_video` (canonical names: service table in the `manifoldgen` skill). Async job, max 30 s, $0.05 per second (minimum $0.20), charged on success. Needs at least one fully visible person; otherwise it fails with no charge.

## Ask first
- The clip, whether to fit an existing music track (`--audio`: stretched up to 12% to the motion tempo, phase-aligned to the beat and ducked on impacts) or use the generated drum and impact bed alone, whether to keep the clip's own audio (`keep_audio`).

## Run
```bash
mg generate motion-score --video fight.mp4 --audio theme.mp3 --params '{"keep_audio":false}' --wait --out out/score
```
MCP: `score_motion_video {"video_url":"...","audio_url":"...","wait_seconds":300}`. `duration` is top level (1-30).

## Deliver
- `video_url` (scored MP4), `audio_url` (WAV), `cues_url` (JSON cue sheet with events and beat grid), `bpm`, `music_prompt` (feed it to a music generator for a matching track, then run again with that track as `audio_url`), `music` (stretch and shift that were applied).
