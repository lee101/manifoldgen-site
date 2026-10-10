# H3 360 orbit worker

RunPod serverless worker for `/tools/orbit-video` (service `orbit_video`): MiniMax H3 FL2VA (int8 convrot) plus
[pablodawson/MiniMax-H3-360-Orbit-LoRA](https://huggingface.co/pablodawson/MiniMax-H3-360-Orbit-LoRA) at strength 1.0.
The photo is both the first and the last frame, so the clip orbits the camera 360 degrees and closes on its own first frame.

- `orbit_graph.py` builds the ComfyUI graph (`MiniMaxH3ImageToVideo` with `first_frame` = `last_frame`, LoRA, no audio, no CFG),
  the author's recommended prompt and the 17n+5 frame grid. Defaults: 768 px, 73 frames (3 s at 24 fps), 28 steps.
- `orbit_weights.py` swaps the `swap_weights` plan for FL2VA, text encoder, video VAE (appstatic mirror) and the LoRA
  (manifoldgenstatic `models/h3-orbit/`, sha256 pinned, falls back to Hugging Face revision 5ddbc2d).
- `orbit_runtime.py` / `orbit_handler.py` reuse the `h3-swap` ComfyUI process owner, moderation and R2 direct upload.
- `Dockerfile` overlays `ghcr.io/lee101/h3-swap`; build with `docker build -t ghcr.io/lee101/h3-orbit:<tag> workers/h3-orbit`,
  push, then update the template image and `config/runpod-h3-orbit.json`.
- `endpoint_test.py` runs one real job against the endpoint (`ORBIT_ENDPOINT` or `/tmp/orbit_endpoint.json`).

App env: `H3_ORBIT_RUNPOD_ENDPOINT_ID` (and optional `H3_ORBIT_GPU_USD_PER_SECOND`, default 0.00126).

Measured 2026-10-04 (witch portrait, 768x768, 73 frames, 28 steps, seed 7, LoRA 1.0): 64 s generation on an H100 80GB
HBM3 serverless worker (110 s on an H100 NVL pod, first run), cold job 197 s execution (weights ~90 s, ComfyUI up ~10 s) and
about 9.5 min queue on the first cold start. One bad RunPod host (machineId hww1j96x9u1f) exited the container in 2 s with no
logs: set workersMax to 0 then 1 to get a fresh worker. The sampled frames 0/18/36/54/72 show the full orbit back to frame 0.
