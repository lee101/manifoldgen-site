# RelayVSR vs our video upscaler (2026-11-06)

Local bench on one RTX 3090 Ti (24 GB, shared with other jobs, driver 575 so torch cu129 only). No RunPod or fal spend, nothing deployed, no prod code changed.
Scripts: `tools/vsrbench/`. Outputs, crop sheets and comparison videos: `/vfast/data/code/vsrbench/out/` (`out/sheets/*.png`, `video_*.mp4`). Weights and venv: `/vfast/data/code/vsrbench/` (10 GB).

## What RelayVSR is
Wan-based, Apache-2.0 (Comfy-Org repack tags apache-2.0; the LightX2V X2 card states no licence, confirm before shipping X2). One Wan step (cfg 1) on a keyframe every 15 frames, plus a small per-frame "Flash" decoder (10-block window-attention transformer, 128 MB) that fills the other frames from the bicubic upscale and the two surrounding keyframes. int8_convrot DiT files are 5.16 GB each (x4, x2 trained by LightX2V on H3 clips), VAE 128 MB each. No EU/UK/KR/US territory clause (unlike H3).
ComfyUI support exists only in recent ComfyUI (tested 2f89433, 2026-11-05: `RelayVSRConditioning`, `VSRDecode`). Our pinned H3 ComfyUI (62b3c94b) does not have it.

## What prod does today
- `studio_upscale` (server/studio.go): Real-ESRGAN `RealESRGAN_x4plus` per frame, 2x/4x, local worker at `STUDIO_UPSCALE_URL` (127.0.0.1:18090), price `ceil(0.10 + outMP x seconds x 0.012)`: a 5 s 1344x768 -> 2x clip is $0.35, a 5 s 1080p-output clip $0.23.
- 2x is computed as x4plus then downsized (4x the compute needed).
- H3 native 1080p tier (pika6 hd) lists $0.15/s, about 3.5x a 768p clip's GPU time; `latent_upscale` flag exists but is off in prod. `scripts/fal-seedvr-video-canary.py` exists, no service wired.

## Method
- Full-reference: two native 1080p Pika clips (3 s, 72 frames) degraded by bicubic downscale + crf22 to 960x544 (2x) and 480x272 (4x); score against the 1080p original (PSNR, SSIM, LPIPS-alex).
- Real: four fal H3 Max 1344x768 clips (dancer, fox, tram, potter 9:16), 48 frames, 2x; no reference: MUSIQ, CLIP-IQA, Laplacian variance, temporal warp error (Farneback flow from the source, occlusion-masked, outputs area-downscaled to source size).
- Arms: lanczos, Real-ESRGAN x4plus (prod path), Real-ESRGAN x2plus (native 2x), RelayVSR x2 / x4 in ComfyUI.

## Results

### Full reference (dancer / tram), lower LPIPS better
| factor | arm | PSNR | LPIPS | Laplacian var (GT 51 / 417) |
|---|---|---|---|---|
| 2x | lanczos | 37.8 / 31.3 | 0.069 / 0.123 | 17 / 117 |
| 2x | ESRGAN x4plus (prod) | 33.7 / 28.2 | 0.094 / 0.108 | 115 / 660 |
| 2x | ESRGAN x2plus | 33.5 / 28.1 | 0.117 / 0.100 | 97 / 490 |
| 2x | RelayVSR x2 | 32.5 / 25.9 | 0.101 / 0.157 | 51 / 391 |
| 4x | lanczos | 32.9 / 25.8 | 0.182 / 0.403 | 6 / 17 |
| 4x | ESRGAN x4plus | 30.2 / 24.3 | 0.167 / 0.226 | 116 / 362 |
| 4x | RelayVSR x4 | 32.6 / 24.5 | **0.092 / 0.200** | 42 / 367 |

- 4x: RelayVSR is clearly best by LPIPS (dancer 0.092 vs 0.167) and visually closest to ground truth (`out/sheets/fr4_dancer.png`; ESRGAN leaves dark smudges, over-sharpens).
- 2x on easy bicubic inputs: lanczos beats every learned arm on PSNR and LPIPS; no model recovers real detail at 2x. Generative arms are judged on perceptual naturalness instead.
- ESRGAN over-sharpens (Laplacian 2x GT); RelayVSR matches GT sharpness.

### Real H3 clips, 2x, no reference (dancer / fox / tram / potter)
| arm | MUSIQ | CLIP-IQA | warp error vs source |
|---|---|---|---|
| source 768p | 43.9 / 53.7 / 68.8 / 65.1 | .278 / .328 / .518 / .408 | 2.39 / 5.13 / 1.58 / 1.29 |
| lanczos | 21.0 / 28.3 / 43.6 / 33.5 | .245 / .253 / .226 / .259 | 2.36 / 5.11 / 1.40 / 1.25 |
| ESRGAN x4plus | 40.6 / 41.1 / 61.3 / 51.0 | .393 / .365 / .435 / .356 | 2.31 / 4.84 / 1.61 / 1.25 |
| ESRGAN x2plus (dancer and potter only) | 36.1 / - / - / 52.2 | .418 / - / - / .368 | 2.34 / - / - / 1.28 |
| RelayVSR x2 | 38.2 / 38.9 / 59.8 / 56.9 | .343 / .335 / .323 / .339 | 2.86 / 5.72 / 2.01 / 1.49 |

- By eye (`out/sheets/real_*.png`, `video_*_x2.mp4`): RelayVSR gives the most natural fabric and strap texture on the portrait clip; dancer is close to a tie, ESRGAN slightly crunchier.
- No-reference scores favour ESRGAN on 3 of 4 clips (they reward sharpness).
- Temporal: RelayVSR x2 adds +11% to +28% warp error over the source (a raised floor across all frames, not pops at keyframes 15/30/45), where ESRGAN stays at source level. This contradicts the "suppresses flicker" claim in this setup (one-step int8 ComfyUI path, 48-frame clips; not tested on long clips).

### Speed (3090 Ti, shared, warm, per output second)
| arm | workload | s per output s |
|---|---|---|
| ESRGAN x4plus (prod 2x path) | 1344x768 -> 2688x1536 | 31 |
| ESRGAN x2plus | same | 11-12 (2.7x faster) |
| ESRGAN x4plus | 480x272 -> 1920x1088 (4x) | 4 |
| RelayVSR x2, eager window attention | 1344x768 -> 2688x1536 | 25 |
| RelayVSR x2, fused-flex window attention (below) | same | decoder 2.5-3.5x faster, end to end noisy |
| RelayVSR x4 | 480x272 -> 1920x1088 | 16 |

Cold start: first RelayVSR job took 324 s (model init and compile 248 s), warm 47-50 s. Plan for it on serverless.

Published (LightX2V card, one H100, 243 frames 1024x768 -> 2048x1536, third-party, not reproduced here): RelayVSR X2 5.35 s (45 fps), x4 19.3 s, FlashVSR+ Turbo 54 s, SeedVR2-3B 353 s, Open-H3-Regenerate-2K 785 s. Scaled to 2688x1536 that is about 0.7 GPU-seconds per output second, around $0.001/s at $4.80/h, against our estimated ~9 s/s (about $0.012/s) for Real-ESRGAN on an H100 (extrapolated from the 3090 Ti, not measured).

## Optimisations found
1. **Real-ESRGAN 2x: use `RealESRGAN_x2plus`** instead of x4plus + downsize: 2.7-3.1x faster (19.4 s vs 60 s for 72 frames; 23 s vs 62 s for 48 frames at 768p), quality equal or better (LPIPS dancer .117 vs .094, tram .100 vs .108; Laplacian closer to GT; CLIP-IQA .418 vs .393 and .368 vs .356). Lowest-risk change, no new model class.
2. **RelayVSR Flash decoder is 80% of warm time** (decoder 38 s, DiT 5-6 s for 48 frames at 1344x768). Cause: torch cu129 makes `comfy_kitchen` reject its fused CUDA `window_attention` ("need pytorch with cu130"), so the eager fallback runs ~2,700 masked math-path SDPA calls (89% of decode time). A FlexAttention replacement (`tools/vsrbench/flexwin.py` + `flexwin_patch.py`, a ComfyUI custom node) is numerically equal (max err 1e-4 on attention, 42.5 dB PSNR end to end) and 5x faster on the attention op; decode went 38 s -> 11-19 s. Prod RunPod hosts report CUDA 13.2 and our images are cu130, so prod should get the fused kernel and need no patch; unverified.
3. Not tried: int8 decoder, torch.compile of the decoder, batching frames, fp8 DiT, 4x -> 2x via `sr_ratio`.

## Verdict
RelayVSR is **not clearly more effective than the current upscaler at 2x**, so I would not spend on a pod to adopt it for 2x yet. It is clearly better at 4x / low-res input and has the most natural texture on faces and fabric. Against it at 2x: lower CLIP-IQA/MUSIQ on 3/4 clips, +11-28% temporal warp error vs source, 10 GB of weights, minute-scale cold start, a newer ComfyUI than our pinned H3 build, and a speed advantage that only the unreproduced H100 numbers support (locally it is 1.2x faster than prod ESRGAN, 2.7x slower than x2plus).
Do now (free): switch the 2x path to x2plus, about 3x cheaper per second.

## Prod adaptation plan (if the pod check passes)
- Add `engine: relayvsr` as an option on `studio_upscale`, served by a RunPod serverless ComfyUI worker on the cu130 H3 image with ComfyUI >= 2f89433, weights on the network volume (x2 + x4 + VAEs, 10.5 GB), warm via the existing adaptive idle timeout. Keep Real-ESRGAN x2plus as default and fallback.
- Keep the per-MP-second price formula; GPU cost at the published speed is ~$0.001-0.005/s so it can be priced as a premium "enhance" tier (4x especially) rather than a discount.
- 1080p H3 tier: A/B 768p + RelayVSR x2 (via `sr_ratio` ~1.43) against native pika6 hd; only worth it if it also beats native 1080p quality, which this bench did not test.

## Paid validation (needs your approval)
One H100 80 GB (or PRO 6000) pod, cu130 image, ~1.5 h: set up 20 min, 10 GB weights 10 min, then the 12-clip bench plus a 15 s clip for long-range temporal behaviour and the fused-kernel speed. About $6-7 on H100 at $4.80/h, cap $10; +$5 if SeedVR2 / FlashVSR+ are run as extra comparisons. Proceed only if the goal is 4x/low-res enhance or if the fused kernel is >= 10x faster than eager here. Gate to adopt: warp error <= +10% over source and CLIP-IQA not below ESRGAN on 3/4 clips.

## Not covered
SeedVR2, FlashVSR and other candidates were not run (no cheap local path; only RelayVSR and Real-ESRGAN were benchmarked). Clips are 2-3 s; GPU timings are noisy because the 3090 Ti was shared with other work; daisy was not used (same driver, runs a live trading job).
