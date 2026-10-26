---
name: motion-fx
description: Track every fighter or dancer in a clip and add effects that follow the motion (ki aura, speed trails, lightning, impact flashes with comic hit words, slow-mo on big hits, neon skeleton, fighting-game HUD, spotlight) with synthesized impact sound. Use for martial arts, sports and dance clips, anime fight edits, viral action edits, and "make this video look like Dragon Ball / a fighting game".
---

# Motion FX

Service `motion-fx`, MCP `apply_motion_fx` (canonical names: service table in the `manifoldgen` skill). Async job, max 20 s, $0.06 per second of video (minimum $0.15), charged on success. Needs at least one fully visible person; a clip with nobody in it fails with no charge. Confirm with `list_services`.

## Ask first
- The clip (full-body, fairly steady camera works best), the look (`preset`), optional song (`--audio`, effects pulse on its kicks and snares and it becomes the soundtrack), fighter names for the HUD, how many seconds.

## Run
```bash
mg generate motion-fx --video fight.mp4 --params '{"preset":"anime-fight","intensity":1.1}' --wait --out out/fx
```
Presets: `anime-fight` (aura, trails, comic hits, slow-mo), `ki-aura`, `lightning`, `neon-trails`, `game-hud` (add `"names":["Sensei","Rival"]`), `spotlight` (`"target":2` picks a track ID), `slowmo-impacts`, `exaggerate` (limbs whip further along their path with smear streaks; `intensity` is the amount), `echo` (coloured afterimage ghosts). Other `params`: `intensity` 0.3-1.6, `palette` gold-blue/fire/neon/ice, `slowmo`, `sfx`, `text` (bool overrides of the preset), `extra` (layers to add: trails, aura, lightning, speedlines, impact), `seed`. `duration` is top level (1-20, from the start).
MCP: `apply_motion_fx {"video_url":"...","preset":"ki-aura","wait_seconds":300}`.

## Deliver
- `video_url` (MP4 with sound), `poster_url` (the strongest hit), `tracks_url` (pose tracks JSON), `events` (strikes and impacts with time, position and power), `bpm`. Run a cheap 3-5 s trial of a preset before a full clip, and offer another preset or `beat-drop` / `motion-score` for the audio.
