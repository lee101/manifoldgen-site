---
name: tracked-fx
description: Effects locked to what moves in a video - blur, pixelate or hide a region that follows its subject, pin text or a sticker to a moving point, motion blur / jelly / light trails from measured per-pixel motion, visuals that pulse with music on tracked points, and first-frame mask propagation for inpainting or removal. Use for privacy blurs, name tags and callouts, stylised motion, music-reactive edits, or when an editing step needs a mask that follows an object.
---

# Tracked FX

Five services on one tracking engine (canonical names: service table in the `manifoldgen` skill). Async jobs, charged per started second on success, no charge on failure. Needs a GPU lane on the host; if a service answers `not available on this server`, say so and stop.

| Need | Service / MCP | Max | Price |
| --- | --- | --- | --- |
| Blur, pixelate or black out something that moves | `track-blur` / `blur_tracked_region` | 20 s | $0.06/s, $0.15 min |
| Text or sticker pinned to a moving point | `sticky-overlay` / `add_sticky_overlay` | 20 s | $0.06/s, $0.15 min |
| Motion blur, jelly, trails, flow colours | `flow-fx` / `apply_flow_fx` | 15 s | $0.08/s, $0.20 min |
| Visuals that pulse with music on tracked points | `reactive-fx` / `apply_reactive_fx` | 20 s | $0.08/s, $0.20 min |
| First-frame mask carried through the clip | `mask-propagate` / `propagate_mask` | 20 s | $0.05/s, $0.12 min |

## Ask first
- The clip and what to attach to. Positions are fractions of the FIRST frame (x, y from the top-left): `region {x,y,w,h}`, `point {x,y,radius}` (radius is a fraction of frame width), or an `image_url` mask (white = object). Look at a poster of the first frame to pick coordinates.
- For music-reactive: the song (`audio_url`, `audio_start` to skip an intro) or use the clip's own sound.
- Run a 3-5 s trial (`duration`) before the full clip.

## Choose the mode
- `track-blur` `mode: region` follows rigid or slow-deforming areas (a face, a logo, a screen) from tracked points around the box. `mode: mask` follows whole bodies and anything that deforms; give it an `image_url` mask or a `shape: ellipse` seed. `invert: true` blurs everything except the area.
- `sticky-overlay` needs texture around the anchor: raise `track_pad` (default 1.8) for flat walls or sky. `persp` 0 keeps the overlay flat (position, scale, rotation), 1 follows full perspective. The overlay fades while the anchor is hidden.
- `flow-fx` `effects` combine: `motion-blur`, `jelly`, `trails`, `flow-color`.
- `reactive-fx` `effects`: `glow`, `trails`, `sparks`, `warp`, `flash`; bass drives glow and warp, kicks throw sparks from the fastest points, snares split colour, onsets flash.
- `mask-propagate` returns `mask_url` (white-on-black mask video) and `video_url` (tinted preview). Feed the mask to removal, grading or compositing. Lower `segment` resists drift on long or fast clips.

## Run
```bash
mg generate track-blur --video clip.mp4 --params '{"point":{"x":0.34,"y":0.23,"radius":0.045},"style":"pixelate"}' --duration 5 --wait --out out/blur
mg generate sticky-overlay --video clip.mp4 --params '{"text":"K.O.","x":0.64,"y":0.15,"width":0.12,"track_pad":2.4,"color":"#ffd21f"}' --wait --out out/sticker
mg generate flow-fx --video clip.mp4 --params '{"effects":["motion-blur","trails"],"strength":1.2}' --wait --out out/flow
mg generate reactive-fx --video clip.mp4 --audio song.mp3 --params '{"palette":"neon","effects":["glow","sparks","warp"]}' --wait --out out/react
mg generate mask-propagate --video clip.mp4 --image mask.png --wait --out out/mask
```
MCP takes the same fields flat: `blur_tracked_region {"video_url":"...","region":{"x":0.1,"y":0.2,"w":0.2,"h":0.2},"style":"blur"}`. `duration` is top level.

## Track once, apply many
Tracks are cached on the worker by the exact frames, region and tracker settings, so a re-run of the same clip finishes much sooner when it lands on the same worker (billing is unchanged: per started second). Use that to iterate:
1. Trial 3-5 s with `duration: 4` and the final `region`/`point`/`text` anchor. Change only the look (`style`, `strength`, `feather`, `color`, `effects`, `palette`, `intensity`) between runs; keep `region`, `point`, `x`, `y`, `track_pad`, `hq` and the clip window identical, because those decide the cache key. For `sticky-overlay` the tracked area is the size of the text or sticker, so a different `text`, `width` or sticker re-tracks; vary only its `color`, `rotation`, `fade` and `pop`.
2. Stack looks by chaining: feed one result's `video_url` into the next tool (blur a face with `track-blur`, then `sticky-overlay` a name tag, then `reactive-fx` over the result). Each stage tracks the new frames once.
3. For edits that need a per-frame mask (removal, relight, grade only the subject): run `mask-propagate` once on the source and use its `mask_url` as the matte in your own compositing or grading step instead of re-masking per effect. No service here takes a mask video as input yet, only a first-frame mask image.
4. Run the full length last, with the settings the trial settled on.
Do not change `track_pad` or the anchor between trials of the same effect: that forces a fresh track and the trial no longer predicts the result.

## Deliver
- `video_url`, `poster_url`, `tracked_visible` (share of the anchor that stayed visible; under 0.5 means the anchor was lost, retry with a larger `track_pad` or `mode: mask`), `effects`, `audio_bpm`/`kicks`/`snares` for reactive, `mask_url`/`area_first`/`area_last` for masks.
- Known limits: a mask or anchor on something that is fully hidden behind another object drifts onto the occluder; very fast whip pans and hard cuts break tracking (split at the cut); the source audio is kept.
