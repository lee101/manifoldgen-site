# motiontrack

Pose tracking, motion signals and track-driven video FX. CPU-only by default (ONNX), no GPU needed. Powers the motion-fx, beat-drop, motion-track and motion-score services.

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
