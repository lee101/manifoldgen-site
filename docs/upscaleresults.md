# Latent upscaling vs ESRGAN — real-generation results (2026-08-26)

Local A/B/C/D on real MiniMax H3 generations. Hardware: one RTX 3090 Ti 24 GB,
ComfyUI pinned to the exact production revision (`62b3c94b`, includes the H3
peak-memory fix), int8_convrot FL2VA weights, same backend as prod (comfy-kitchen
eager). All runs share seed/prompt/canvas per group; preview 16:9 = 896×512,
22 frames, 20 steps.

## Variants

| variant | pipeline | output | marginal time (3090 Ti) |
|---|---|---|---|
| base | sample → decode | 896×512 | — (392 s prompt A / 1239 s B incl. cold model loads) |
| latent-v1_mamad8 | sample → clean-latent 2× (Mamad8 v1) → decode | 1792×1024 | **+12 s** |
| latent-film_epoch200 | sample → clean-latent 2× (Tridae film_epoch200) → decode | 1792×1024 | **+12 s** |
| twopass-* | sample → learned 2× + CONST re-noise → short pass 2 (σ≈0.45, ~4 steps) → decode | 1792×1024 | **+132–202 s** |

ESRGAN second stage = RealESRGAN_x4plus applied to a decoded frame of each
variant (the same model the studio `studio_upscale` service uses).

## Images

Single-pass latent comparison (columns: base, latent-film200, latent-mamad8,
twopass-film200, twopass-mamad8):

![lighthouse](./upscale-results/lighthouse-latent-compare.png)
![fisherman](./upscale-results/fisherman-latent-compare.png)

ESRGAN second stage on top of each path (portrait crops matter most):

![esrgan fisherman](./upscale-results/fisherman-esrgan-second-stage.png)
![esrgan lighthouse](./upscale-results/lighthouse-esrgan-second-stage.png)

## Findings

1. **Checkpoint choice dominates.** Tridae `film_epoch200` beats Mamad8 v1
   everywhere: crisper rock/water texture, real iris fibers, natural pores.
   Mamad8 v1 trends soft/smoothed — on faces it reads waxy and gives ESRGAN
   nothing to refine (worst column of the second-stage sheet).
2. **Single-pass latent 2× is nearly free** (+12 s ≈ 3% over base sampling) and
   doubles output pixels. Quality gain is modest but consistent.
3. **Two-pass is the big quality jump** (+130–200 s locally for ~4 extra steps
   at 4× pixel area): hair strands, wrinkle micro-texture, defined foam.
4. **Latent → ESRGAN > base → ESRGAN on faces.** ESRGAN over-invents crunchy
   skin on soft base decodes; with film200 latents its added texture lands on
   real structure and looks natural. With mamad8-v1 latents it turns to mush.
5. **No OOM anywhere** — including two-pass at 2× latents — on 24 GB at preview
   size. Balanced/native were not runnable locally; the H100 80 GB endpoints
   have 3× the headroom, and A40 stays excluded per runpod-h3 notes.

## Decisions

- **Keep Preview/Balanced/Native.** They are the price/resolution tiers
  (0.45×/0.7×/1×). Labels now carry true dimensions; fixed stale
  "preview 1024×576" everywhere — worker truth is 896×512 (`SCALES 0.44`),
  verified against production jobs (balanced = 1184×672 matches).
- **Ship `latent_upscale` as a separate per-request flag** (landed):
  tri-state bool on `/api/service` h3_video, forwarded to the worker;
  omitted = worker env default (`H3_LATENT_UPSCALE_ENABLED`, off in prod
  config). It stacks with, and is independent of, the Real-ESRGAN
  `studio_upscale` stage.
- **Serve film_epoch200** as the upscaler checkpoint (landed): baked into the
  worker image from
  `https://manifoldgenstatic.manifoldgen.com/models/h3_clean_latent_upscaler_film_epoch200.safetensors`
  (sha256 `984afb58…d99b371d3e4`, same Mamad8 architecture loader), pinned via
  `H3_LATENT_UPSCALER_MODEL` in `config/runpod-h3.json` and as the
  `H3_LATENT_UPSCALER` default in `h3_workflow.py`. **Mamad8 v1 is dropped**:
  waxy on faces and gives ESRGAN nothing to refine — excluded from serving and
  from future comparison sheets (2026-08-26 review).
- **Billing needs no change**: h3_video settles from measured RunPod
  `predict_seconds` × rate × margin (video.go), so extra upscale compute is
  billed automatically. The static homepage estimator will under-quote
  latent_upscale=true until the UI toggle ships — add a factor there then.
- **OOM policy**: fail the job with refund (existing worker/server failure
  path), no silent quality downgrade. Single-pass is safe down to 24 GB cards;
  gate two-pass to the H100 endpoints when exposing it.

## Reproduce

```bash
cd /vfast/data/code/h3-cog
/vfast/data/h3-venv/bin/python scripts/latent_upscale_experiment.py \
  --prompt "…" --size preview --frames 22 --steps 20 --seed 1234 \
  --variants base,latent,twopass
/vfast/data/h3-venv/bin/python scripts/esrgan_frames.py /vfast/data/h3-exp/*/raw-*.mp4
```

ComfyUI: `COMFY_ROOT=/vfast/data/code/ComfyUI`, port 8189 (running as
`comfy-h3`). Weights in `/vfast/data/h3-weights` (R2/HF, sha256-verified),
symlinked into ComfyUI models dirs.
