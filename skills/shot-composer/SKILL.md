---
name: shot-composer
description: Plan and assemble a multi-shot sequence (shot list, generated or uploaded clips, stills, music and SFX) into an editable ManifoldGen Studio project and rendered cut. Use for trailers, ads, music videos, social edits, storyboards to animatic, or when the user wants several shots composed into one piece.
---

# Shot Composer

A workflow over existing services (canonical names: service table in the `manifoldgen` skill): `video`, `reference-video`, `image`, `music`, `sfx`, plus Studio at https://manifoldgen.com/studio for the timeline.

## Ask first
- Brief, total duration, aspect ratio, number of shots, style references, existing footage or stills.
- Audio: generated music (genre, tempo), SFX, voice-over, or the user's track.
- Delivery: rendered MP4, Studio project for further editing, or both.

## Run
1. Write a shot list (shot #, duration, framing, action, prompt). Price it: `mg pricing video` x shots (+ music). Get approval for the total.
2. Generate shots once each, in parallel, keep job IDs:
```bash
mg generate video --prompt "<shot 1>" --duration 5 --aspect-ratio 16:9 --json > out/shot1.json
mg job <id> --wait --out out/shots
```
Consistent characters/products: `reference-video` with `--ref-image hero.png`. Stills to animate: `--image still.png`.
3. Score: `mg generate music --prompt "<mood, bpm>" --duration <total> --wait --out out/audio`; SFX with `sfx`.
4. Assemble in Studio: open https://manifoldgen.com/studio, import the files from `out/` in shot order, trim to the shot list, add audio, export. Clean or matte shots with `shot-cleanup`; grade with `color-grade`.

## Deliver
- The Studio project (editable timeline), each shot file, the audio stems and the shot list. Note per-shot job IDs so any shot can be regenerated without redoing the rest.
