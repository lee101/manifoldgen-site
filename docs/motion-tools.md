# Motion tools (motion-fx, beat-drop, motion-track, motion-score)

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
