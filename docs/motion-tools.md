# Motion tools (motion-fx, beat-drop, motion-track, motion-score, track-blur, sticky-overlay, flow-fx, reactive-fx, mask-propagate)

Server engine `motion` (server/prodkit_motion.go) shells out to the Python worker in `workers/motiontrack` (RTMPose + YOLOX via rtmlib/onnxruntime, own ByteTrack, OpenCV render, ffmpeg).

| Service | Price | Max | Needs people |
| --- | --- | --- | --- |
| motion-fx | $0.06/s, min $0.15 | 20 s | yes |
| beat-drop | $0.04/s, min $0.10 | 30 s | no (`audio_url` required) |
| motion-track | $0.02/s, min $0.05 | 60 s | yes |
| motion-score | $0.05/s, min $0.20 | 30 s | yes |

Charge = rate x ceil(min(clip length, top-level `duration`, max)), settled on success. The create-time estimate uses `duration` when given, else 5 s. A result with zero tracked people fails with "no people found in the video; try a clip where a person is fully visible" and is not charged (beat-drop is exempt).

## Prod setup

- `cd workers/motiontrack && uv sync` (creates `.venv`; Python >= 3.10). The server runs `<root>/.venv/bin/python -m motiontrack.cli job args.json` with cwd = the worker root.
- Env: `PRODKIT_MOTION_PYTHON` (interpreter override), `PRODKIT_MOTION_DIR` (worker root override), `PRODKIT_MOTION_HOME` (HOME used by the worker; default the server's HOME), `PRODKIT_MOTION_SLOTS` (concurrent jobs, default 2), optional `OMP_NUM_THREADS` / `ORT_NUM_THREADS` passed through.
- First run downloads the ONNX models (YOLOX-m, RTMPose-m, ~100 MB) into `$HOME/.cache/rtmlib`; the host needs outbound network once, and that HOME must be writable and persistent (do not use a per-job HOME). Warm it with `uv run motiontrack track some.mp4 /tmp/t.json`.
- ffmpeg and ffprobe must be on the server (same binary the other prodkit tools use). CPU only: about 5 frames/s tracking on 32 cores for a 1280x704 clip, render about 3-5 frames/s; expect 30-90 s for a 5 s clip.
- The service answers 503 "... is not available on this server" until the venv and `motiontrack/job.py` exist.

## Result keys

`video_url`, `poster_url`, plus per tool `tracks_url`, `signals_url`, `preview_url`, `guide_url`, `audio_url`, `cues_url`; `tracks_count`, `events_count`, `events` (max 64), `bpm`, `audio_bpm`, `preset`, `slowmo_hits`, `music_prompt`, `music`, `seconds` (output length, longer than the source with slow-mo), `duration_seconds` (source seconds processed = billing unit), `width`, `height`, `source_video_url`. For motion-track `video_url` equals `preview_url`.

## Tracker-driven tools (track-blur, sticky-overlay, flow-fx, reactive-fx, mask-propagate)

Same engine and job contract as above (`prodkit_motion_pt.go`, `motiontrack/ptfx.py`), but they need a GPU interpreter: set `PRODKIT_PTFX_PYTHON` (torch + cv2 + scipy + numpy + pillow, plus `MOTIONTRACK_CKPT_DIR`, `MOTIONTRACK_TAPNET_SRC`, `MOTIONTRACK_ALLTRACKER_SRC`, see the worker README). Until it is set the services answer "not available on this server". No people are required and there is no "no people found" check. MCP: blur_tracked_region, add_sticky_overlay, apply_flow_fx, apply_reactive_fx, propagate_mask; skill `skills/tracked-fx`.

| Service | Price | Max | Tracker |
| --- | --- | --- | --- |
| track-blur | $0.06/s, min $0.15 | 20 s | sparse points (region) or dense flow (mask) |
| sticky-overlay | $0.06/s, min $0.15 | 20 s | sparse points |
| flow-fx | $0.08/s, min $0.20 | 15 s | dense flow, consecutive pairs |
| reactive-fx | $0.08/s, min $0.20 | 20 s | sparse points + audio features |
| mask-propagate | $0.05/s, min $0.12 | 20 s | dense flow |

Backends (chosen in the 2026-11-06 bake-off, `/vfast/data/code/trackeval/RESULTS.md`): TAPNext++ for sparse points (Apache-2.0, 2-3 GB VRAM, 19-36 fps on a 3090 Ti, best commercially usable occlusion recovery) and AllTracker for dense flow (MIT code, 31 fps at 512 px, 8 GB at 896 px). CoTracker3 and DOT are CC BY-NC and were not used. Licence: the AllTracker weights are trained on research datasets (FlyingThings/Kubric/KITTI/VIPER etc.); the owner approved commercial use on 2026-11-07, so track-blur mask mode, flow-fx and mask-propagate may be charged. Never name the models in user-facing text, MCP descriptions or marketing.

Params (all positions are fractions of the first frame, top-left origin): `region {x,y,w,h}`, `point {x,y,radius}` (radius = fraction of frame width), `image_url` mask. track-blur `mode` region|mask, `style` blur|pixelate|solid, `strength`, `feather`, `grow`, `invert`, `color`; sticky-overlay `text` or `image_url` PNG, `x`,`y`,`width`,`rotation`,`persp`,`track_pad`,`pop`,`fade`; flow-fx `effects` motion-blur|jelly|trails|flow-color, `strength`, `palette`; reactive-fx `effects` glow|trails|sparks|warp|flash, `intensity`, `palette`, `seed`, `audio_start`, `audio_url` (else the clip's sound); mask-propagate `shape`, `segment`. Result adds `mode`, `style`, `tracked_visible`, `effects`, `audio_bpm`, `kicks`, `snares`, `mask_url`, `area_first`, `area_last` where relevant.

Known limits: the dense tracker reports positions for occluded pixels instead of dropping them, so a mask on an object that goes fully behind another drifts onto the occluder; hard cuts and whip pans break tracking; mask seeds are rects/ellipses or a user mask (no automatic person segmentation yet, a SAM-class segmenter on the GPU lane would give person-shaped seeds).

### Evaluation on the test clips (RTX 3090 Ti, 5 s 1280x704 clips, warm models)

| Tool (clip) | Wall time incl. process start and cold weights | Result |
| --- | --- | --- |
| track-blur region, pixelate head (spar) | 90 s first run (cold 2.5 GB checkpoint read), 17 s warm disk | blur stays on the head through a kick exchange, `tracked_visible` 0.84 |
| track-blur mask, ellipse seed on a fighter (spar) | 23 s | mask follows the fighter's motion; floor pixels inside the seed stay put (as they should), so the seed shape matters |
| sticky-overlay "K.O." above a head (spar) | 20 s | follows through the exchange, `tracked_visible` 0.79 |
| flow-fx motion-blur (kungfu) | 30 s | real shutter blur on kicks and fists only, background sharp |
| flow-fx trails (spar), jelly (solo), flow-color (kungfu) | 24-25 s | coloured motion ghosts; springy lag on limbs; direction-coloured motion |
| reactive-fx glow/trails/sparks/warp/flash (spar, kungfu) | 15-28 s | orbs and trails on the fastest tracked points, kicks throw sparks, snares split colour |
| mask-propagate (spar) | 22 s | `mask_url` + tinted preview |

Warm-model throughput on the 3090 Ti from the bake-off: sparse points 19-36 fps at 512-896 px, dense flow 31 fps at 512 px; the rest of each job is H.264 encode and effect rendering (OpenCV, CPU). A cold start is dominated by reading weights from disk, so keep the GPU lane warm.

Existing pose tools on the same clips (CPU, `workers/motiontrack/.venv`, tracks cached after the first call): tracking 20-38 s per 5 s clip, then anime-fight 13-24 s, echo 15 s, exaggerate 12 s, spotlight 7 s, neon-trails and beat-drop 3-4 s. They are faster and richer for fighters (named limbs, hit events, slow-mo, sound) but only know people; the new tools are scene-general (any moving thing, any camera move), need a GPU, and give the editing agent masks, anchored overlays and blur that the pose tools cannot. Keep both: pose tools for fight edits, tracker-driven tools for everything else.

Showcase renders and the side-by-side grid (top-left existing anime-fight, top-right existing neon-trails, bottom-left new flow motion-blur, bottom-right new music-reactive): `/vfast/data/code/trackeval/showcase/final/`.

### Pages, GPU lane and speed (2026-11-07)

Pages: /tools/track-blur, /tools/sticky-overlay, /tools/flow-fx, /tools/reactive-fx, /tools/mask-propagate (registered in `lib/production-tools.ts`, catalog, footer, both sitemaps; e2e `tests/e2e/tracked-tools.spec.js`, 12 tests). The first frame is a picker: drag a box (track-blur, mask-propagate) or click a point (sticky-overlay); an optional exact mask / sticker image goes in the image slot. Demo media is staged in `testvids/motion/cdn/<slug>/` (not yet synced to R2: rsync to `static/tools/production/<slug>/`).

GPU lane: `workers/ptfx` (uv project, lock, `fetch_assets.py` with pinned repos and sha256 weights, `smoke.py`, README with env and sizing) and `deploy/manifoldgen-ptfx.service` for the warm worker. `deploy.sh` rsyncs `workers/ptfx`; creating the venv and fetching weights on the host is a manual first-time step.

Speed, 5 s 1280x704 clips, RTX 3090 Ti, in-process with warm models (cProfile on in both columns), seconds. "Cache hit" re-renders the same clip and anchor with a different look.

| tool | before | after, no cache | after, cache hit |
| --- | --- | --- | --- |
| track-blur (point) | 4.8 | 4.8 | 2.2 |
| sticky-overlay | 5.2 | 4.3 | 4.1 (text change re-tracks) |
| flow-fx | 15.3 | 3.9 | 2.4 |
| reactive-fx | 9.8 | 7.0 | 3.4 |
| mask-propagate | 7.7 | 5.6 | 3.7 |

What changed: render stages of flow-fx run on the GPU (`ptgpu.py`: motion blur, jelly, trails, flow colour; parity tests `tests/test_ptgpu.py` against the CPU path); dense flow uses 2 refinement iterations (0.06 px mean difference from 4) and fp16 in the warm worker (0.002 px difference, 1.8x faster flow; fp16 is not used in per-process mode because the first cuDNN fp16 call costs 6-10 s); mask splatting on the GPU; the reactive warp field is blurred at quarter resolution; the sticky overlay warps only its bounding box; tracks and flows are cached on disk by content hash (`ptcache.py`, `MOTIONTRACK_CACHE_MB`, default 3000). The point tracker is latency-bound per frame (about 25 ms), unaffected by fp16 and by a bigger GPU.

Per-job process overhead (python and torch import, CUDA init, loading both models, first-use kernels) was 10-18 s of a 22-30 s job. `python -m motiontrack.cli serve --socket ... --preload` keeps the models resident and `PRODKIT_PTFX_SOCKET` makes the server use it (falls back to a process per job when the socket is down). Timing a cold per-process run on this shared box was not reliable (load average 12-30, a 2.5 GB checkpoint read from slow disk took 100-140 s on a cold page cache), so no per-process figure is claimed.

## Local UI testing

Next dev cannot fetch Google Fonts in a sandbox. Point it at the font mock (answers every font CSS request with a stub `@font-face`; production code paths are untouched):

```
cd frontend
NEXT_FONT_GOOGLE_MOCKED_RESPONSES=$PWD/tests/fixtures/google-fonts-mock.js bunx next dev -p 3927
```

e2e (mocks `/api/service`, `/api/video-jobs/*`, uploads and result media; no backend needed):

```
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3927 PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_WORKERS=3 \
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome bunx playwright test tests/e2e/motion-tools.spec.js
```

Visual bench (desktop + mobile full-page screenshots, idle and completed state, fails on horizontal overflow; uses the local showcase renders when present):

```
VISUALBENCH_BASE_URL=http://127.0.0.1:3927 VISUALBENCH_OUT=/tmp/vb node visualbench/capture-motion-tools.cjs
```

Unit and parity tests: `bun test --coverage tests/production-tools.test.ts` (checks prices, params, presets, palettes and aspects against `server/prodkit*.go`).
