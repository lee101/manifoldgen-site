# H3 character swap worker

RunPod serverless worker for `/tools/character-swap-lora`: MiniMax H3 Ref2VA (int8 convrot) plus the
Akatz Labs character-swap LoRA. The source clip is `<Video 1>`, the new characters are `<Picture 1>`.

- `swap_graph.py` builds the ComfyUI API graph (LoadVideo, MiniMaxH3ReferenceToVideo with `ref_videos`,
  swap LoRA, optional Turbo LoRA / EasyCache), frame and size rules (24 fps, 17n+5 frames, multiples of 32).
- `swap_weights.py` installs only the Ref2VA weights, text encoder, both VAEs and the LoRA, 48 ranged connections.
- `swap_runtime.py` owns the ComfyUI process; `swap_handler.py` is the RunPod handler (moderation, R2 direct upload).
- `Dockerfile` overlays the validated `h3-cog` face-judge image; build and push with
  `docker build -t ghcr.io/lee101/h3-swap:<tag> workers/h3-swap && docker push ...`, then update
  `config/runpod-h3-swap.json` and the template.
- `pod.py`, `push.py`, `run.sh`, `swaptest2.py`, `endpoint_test.py` are the scratch-pod and endpoint helpers used to
  measure quality and speed (see below).

Measured on an H100 (832x480, 107 frames = 4.5 s, two characters in one pass, seed 7):

| setting | wall s | note |
| --- | --- | --- |
| 20 steps | 108 | LoRA author's recipe |
| 20 steps + EasyCache 0.12 | 80 | 34.7 dB PSNR vs uncached, visually identical (standard tier) |
| 20 steps + EasyCache 0.20 | 66 | 28.3 dB, softer faces |
| 12 steps + EasyCache | 62 | |
| 8 steps (+ EasyCache) | 52 (48) | same look, different sample |
| 4 steps + Turbo LoRA | 39 | clean with a two-character reference image (fast tier) |
| Sol attention | 113 | slower, not used |
| `--highvram` | no gain | default flags kept |
| 0.98 MP (1344x768), 20 steps | 419 | 3.9x the 0.4 MP time (18.8 s/step vs 4.5) |

About 18 s of each clip is fixed (text encode, reference VAE encode, decode), so short clips gain little from fewer steps.
The reference video must be padded, not shorter than the generation: the worker rounds the clip up to H3's 17n+5 grid and
holds the last source frame (`grid=hold`); the server trims the extra frames. A 124-frame generation against a 108-frame reference
once invented a third person (the original performer) in the middle of the clip.

One pass with a single reference image holding all characters replaces everyone left to right; a single-character
reference with a turbo run invented a third person, so the image always carries every replacement.
