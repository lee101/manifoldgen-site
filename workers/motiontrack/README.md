# motiontrack

Pose tracking, motion signals and track-driven video FX. CPU-only by default (ONNX), no GPU needed. Powers the motion-fx, beat-drop, motion-track and motion-score services. The tracker-driven tools (`motiontrack pt ...`, services track-blur, sticky-overlay, flow-fx, reactive-fx, mask-propagate) need a GPU interpreter, see "Tracker-driven FX" below.

```
uv sync
uv run motiontrack track in.mp4 tracks.json                    # tracks + signals.json (bpm, strike/impact events)
uv run motiontrack fx in.mp4 out.mp4 --preset anime-fight --tracks tracks.json
uv run motiontrack fx in.mp4 out.mp4 --preset beat-drop --reactive-audio song.mp3
uv run motiontrack job args.json                               # server contract, writes out/manifest.json
uv run pytest -q tests
```

## Pipeline

1. `track.py` person detector + body pose per frame (rtmlib, RTMPose-m, Apache-2.0), own ByteTrack (`bytetrack.py`, two-stage IoU + velocity), tracklet stitching for ID switches, gap interpolation, Gaussian smoothing. ~5 fps on CPU at 1280 px; tracks cached as `tracks.json`.
2. `signals.py` per-joint speeds normalised by body height, energy envelope, strike events (effector speed peaks), `impact` when the effector is inside another track's box, tempo and beat grid from the energy onsets.
3. `fx.py` renderers: `aura`, `trails`, `lightning`, `impact` (flash, shockwave, sparks, shake, chroma split, comic words), `speedlines`, `neon`, `spotlight`, `hud`, `beats` (audio reactive), plus analysis views `overlay` and `guide`.
4. `retime.py` slow-motion ramps into big hits (optical-flow frame interpolation, audio `atempo` segments), `sfx.py` synthesised hit/whoosh/riser, `score.py` beat-locked drum bed and music fitting, `beats.py` audio onset/kick/snare/tempo analysis.

## Presets

`anime-fight`, `ki-aura`, `lightning`, `neon-trails`, `game-hud`, `spotlight`, `slowmo-impacts`, `exaggerate`, `echo`, `beat-drop` (needs audio, no tracking). `uv run motiontrack presets`.

## Server contract (`job`)

`args.json`: `{"tool": "motion-fx|beat-drop|motion-track|motion-score", "video": "/abs", "audio": "/abs" (fx reactive song), "music": "/abs" (score), "out": "/abs/dir", "params": {...}, "device": "cpu"}`.

`out/manifest.json` ok: `{"ok": true, "tool", "video", "poster", "tracks", "signals", "preview", "guide", "audio", "cues", "seconds", "width", "height", "tracks_count", "events_count", "bpm", "events": [...], "elapsed"}` (file names relative to `out`). Fail: `{"ok": false, "error"}`, exit 2 bad input, 1 internal (`out/error.log`).

Params (all clamped): `preset`, `intensity` 0.3-1.6, `palette` gold-blue|fire|neon|ice, `slowmo`, `sfx`, `text`, `target` (track id), `names` (<=4), `extra`, `seed`, `max_seconds`, `max_side`, `keep_audio`.

## track guide (motion-control export)

`guide.mp4` renders head, wrists, ankles and hips as coloured splines (history bright, next 0.5 s dim) on black. It is shaped for motion-track IC-LoRA style conditioning of video models; `tracks.json` holds the raw COCO-17 keypoints per frame (`[x, y, conf]`).

## Deploy

`cd workers/motiontrack && uv sync` on the host, set `PRODKIT_MOTION_PYTHON=/path/to/workers/motiontrack/.venv/bin/python`. First run downloads the detector and pose ONNX models into `~/.cache/rtmlib` (about 100 MB), so the host needs outbound HTTPS once (or copy the cache). ffmpeg must be on PATH. The bundled font is Bangers (SIL OFL, `motiontrack/assets/OFL-Bangers.txt`).

Licences: rtmlib, onnxruntime, OpenCV, SciPy, Pillow and the RTMPose/YOLOX code are permissive (Apache-2.0/MIT/BSD). The published RTMPose body7 and YOLOX HumanArt weights are Apache-2.0 but trained on mixed research datasets; commercial use was reviewed and accepted by the owner (2026-10-26). The pipeline avoids AGPL trackers (ultralytics) by design; swapping in ultralytics is accepted if it ever helps accuracy.


## Tracker-driven FX (GPU)

`motiontrack pt <tool> video out_dir [--params json] [--audio file]`, or the job contract with tool `track-blur|sticky-overlay|flow-fx|reactive-fx|mask-propagate` (`args.image` is the sticker for sticky-overlay and the first-frame mask for track-blur and mask-propagate). Code: `motiontrack/ptbackend.py` (backends), `motiontrack/ptfx.py` (geometry, effects, pipeline).

- Backends are loaded lazily and need torch plus the model code and weights, none of which are in this venv: a sparse point tracker (TAPNext++, Apache-2.0, commercial use OK) and a dense flow tracker (AllTracker, MIT code, weights trained on research datasets: commercial use approved by the owner 2026-11-07). Env: `MOTIONTRACK_CKPT_DIR` (`tapnextpp_ckpt.pt`, `tapnextpp_512.ckpt`, `alltracker.pth`), `MOTIONTRACK_TAPNET_SRC` (google-deepmind/tapnet checkout), `MOTIONTRACK_ALLTRACKER_SRC` (aharley/alltracker checkout), `MOTIONTRACK_HOME` default `~/.cache/motiontrack/{src,ckpt}`. Missing pieces raise `BackendUnavailable` (job exit 1 with the reason).
- Server: `PRODKIT_PTFX_PYTHON` = interpreter with torch+cv2+scipy+numpy+pillow (the pose venv works for everything but the backends); the services are hidden (`not available on this server`) until it is set.
- Sparse tracking drives `track-blur` region mode, `sticky-overlay` (5x5 point grid -> homography/similarity blend per frame, odd-reflected smoothing) and `reactive-fx` (28-wide point grid). Dense flow drives `track-blur` mask mode and `mask-propagate` (flow from the segment's first frame, forward splat with normalised hole fill, re-anchored every `segment` frames) and `flow-fx` (batched consecutive-pair flow). Tracking runs at `track_side` (640) and effects render at `max_side` (1280).
- GPU interpreter, asset fetch, smoke test and the warm worker (`motiontrack serve`, `PRODKIT_PTFX_SOCKET`): `../ptfx/README.md`. Track cache: `motiontrack/ptcache.py`. GPU render: `motiontrack/ptgpu.py` (tests need torch and CUDA: run `tests/test_ptgpu.py` in the GPU interpreter, it skips elsewhere).
- Tests: `.venv/bin/python -m pytest tests/test_ptfx.py` uses synthetic translating video and fake backends, so it runs on CPU in this venv.
