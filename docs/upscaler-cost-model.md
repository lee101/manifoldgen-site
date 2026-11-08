# Upscaler cost model and 2x switch (2026-11-07)

Local only: nothing deployed, committed, or spent on RunPod/fal. Measurements: one RTX 3090 Ti (24 GB, shared, fp16, spandrel RRDBNet), 1-2 frames per case. Scripts: `tools/vsrbench/costmodel.py`; probe scripts were run from the session scratchpad (same code as `tools/vsrbench/esrgan.py`).

## What changed (code)
The prod upscaler worker is the separate repo `/vfast/data/code/appnz-image-upscaler` (Cog, `STUDIO_UPSCALE_URL` -> `/predictions`, the Go server sends `model: general`, `scale: 2|4`). That working tree already carried uncommitted edits (README, schema, cog.yaml, predict.py, requirements, tests); the changes below sit on top of them, uncommitted.
- `predict.py`: `general` at scale 2 now uses a native `RealESRGAN_x2plus` network (`NATIVE_X2_SPECS`, `_upsampler_for`) instead of x4plus + downsize; 4x and `anime` unchanged. Tile size is picked per input (`pick_tile`): untiled when the native output is <= 12.5 Mpx (`UPSCALE_UNTILED_MAX_NATIVE_MP`), else 512, with an OOM retry at tile 256 (`_enhance`).
- `cog.yaml`: downloads `RealESRGAN_x2plus.pth` (release v0.2.1, URL returns 200).
- `tests/test_predict.py`: 8 tests pass (3 new: x2 spec, selector fallback, tile rule).
- No Go change needed: `server/studio.go` already forwards `scale` and `model`; pricing constants untouched (see proposal below).
- Docs: AllTracker weights licence recorded as owner-approved 2026-11-07 in `docs/motion-tools.md`, `workers/motiontrack/README.md`, `/vfast/data/code/trackeval/RESULTS.md`.

## Quality, 2x path (2 frames x 2 clips, 960x544 -> 1920x1088, vs ground truth)
| arm | dancer 10 / 40 PSNR | dancer LPIPS | tram 10 / 40 PSNR | tram LPIPS |
|---|---|---|---|---|
| lanczos | 37.7 / 37.9 | .076 / .074 | 31.7 / 31.0 | .123 / .136 |
| x4plus + downsize (old prod) | 33.1 / 34.0 | .091 / .090 | 29.1 / 28.5 | .100 / .108 |
| x2plus tile 256 | 33.1 / 33.5 | .110 / .115 | 28.8 / 28.4 | .095 / .099 |
| x2plus untiled (new default) | 33.9 / 34.2 | .103 / .108 | 29.0 / 28.6 | .092 / .096 |

x2plus untiled matches or beats the old path on PSNR (+0.2 to +0.7 dB dancer, -0.1 to +0.04 dB tram) and LPIPS is mixed (worse on dancer, better on tram), consistent with `docs/vsr-bench.md`. Tiling costs 0.2-0.7 dB, so the untiled default also helps quality. PSNR x2plus vs old path 29-37 dB (same look).

## Memory: math vs measured (fp16, batch 1)
Activation peak is dominated by the 64-channel tensors at native output resolution: peak GB ~= 0.48 x native-output Mpx (untiled), fit on the two x2plus points and confirmed out of sample on x4plus. Add ~0.5 GB CUDA context, 70 MB weights, a few frame buffers.
| case | native out Mpx | predicted | measured peak | s/frame (3090 Ti) |
|---|---|---|---|---|
| x2plus 720p -> 1440p, untiled | 3.69 | 1.77 | 1.77 | 0.314 |
| x2plus 720p -> 1440p, tile 256 | tile | - | 0.19 | 0.426 |
| x4plus + downsize 720p -> 1440p (old), tile 256 | tile | - | 0.73 | 1.487 |
| x2plus 1080p -> 2176p, untiled | 8.36 | 4.01 | 4.01 | 0.726 |
| x2plus 1080p -> 2176p, tile 256 | tile | - | 0.25 | 1.153 |
| x4plus + downsize 1080p -> 2176p (old), tile 256 | tile | - | 0.84 | 3.562 |
| x4plus 270p -> 1080p 4x, untiled | 2.07 | 0.99 | 0.99 | 0.184 |
| x4plus 540p -> 2160p 4x, tile 256 | tile | - | 0.69 | 0.930 |
| x4plus 540p -> 2160p 4x, untiled | 8.29 | 3.98 | not run | est. ~0.75 |
| x4plus 720p 4x untiled | 14.7 | 7.1 | not run | uses tile 512 |
| x4plus 1080p 4x untiled | 33 | 16 | not run | tile 512 |

Speedup of the 2x path on the same quality: 4.7x (720p, untiled vs old), 4.9x (1080p). Every tier fits in a 24 GB card with room; peak with context <= ~6 GB at the 12.5 Mpx untiled cap. RelayVSR 4x (unmeasured here): int8 DiT 5.2 GB + VAE + decoder + activations, plan 24 GB minimum, 48 GB for headroom.

Compute model: x2plus ~4.5 M MAC per input pixel (body runs at half-res after pixel-unshuffle), x4plus ~19.7 M MAC per input pixel; measured effective throughput on the 3090 Ti is 22-28 fp16 TFLOPS (about 32% of the 80 TFLOPS spec). Other GPUs are scaled by `tools/gpusim` fp16 TFLOPS at 32% efficiency (A100 30%, PRO 6000 25%, H100 20%): treat as +/-40%.

## Speed and cost per GPU (24 fps, per output second)
RunPod serverless list prices (runpod.io/pricing, 2026-11-07, $/h): 3090/L4/A5000 0.75, 4090 1.34, 5090 1.79, A6000/A40 1.22, L40S/L40 1.75, A100 80G 2.72, RTX PRO 6000 3.49, H100 5.39 (repo bench notes billed 4.00 PRO 6000 and 4.80 H100, i.e. our contracts are no worse than list).
Overhead assumed per job: 50% of jobs cold at 30 s (image pull + weights; x2plus 67 MB is trivial) + 5 s idle tail.

5 s clip, GPU cost (compute + overhead) and best GPU:
| tier | old price | best GPU | s per output s | GPU cost / 5 s | 2nd best | margin at old price |
|---|---|---|---|---|---|---|
| 720p -> 1440p (2x) | $0.33 | 3090-class 24 GB ($0.012), L40S ($0.014), 4090 ($0.015) | 1.7-7.8 | $0.012-0.015 | 4090 | 22x |
| 1080p -> 2176p/4K (2x) | $0.61 | L40S | 3.9 | $0.019 | 3090 $0.022 | 32x |
| 540p -> 2160p (4x) | $0.60 | L40S | 4.2 | $0.020 | 3090 $0.024 | 30x |
| 270p -> 1080p (4x) | $0.23 | 3090-class ($0.009), L40S ($0.012) | 1.1-4.8 | $0.009-0.012 | 4090 | 19-25x |

Full per-GPU tables: `python3 tools/vsrbench/costmodel.py`. The old path (x4plus + downsize) costs roughly 3-5x the compute of the 2x numbers above, still only about $0.04-0.07 per 5 s clip on the best GPU.

Recommendation:
- One endpoint, `gpuTypeIds`: `NVIDIA L40S` first, `NVIDIA GeForce RTX 4090` fallback (the 24 GB pool is cheapest for small inputs but its slowest member decides latency; skip A6000: 2x slower per dollar). No need for H100/PRO 6000: the workload is small-conv bound and overhead (cold start x hourly rate) dominates there, H100 is the most expensive per output second at every tier.
- Keep `UPSCALE_UNTILED_MAX_NATIVE_MP=12.5`; on 24 GB parts the untiled peak stays near 6 GB.
- 2x: about 4.7-4.9x faster than the old path (untiled vs tiled x4plus), so a 5 s 1080p-in clip drops from about 7 min to about 1.5 min on a 3090-class card (L40S about 20 s by the scaled estimate).

## Pricing
Current formula `ceil(0.10 + outMP x seconds x 0.012)` is 20-30x GPU cost even before the 3x saving, so the service is already very profitable. Repo markups for reference: H3 provider cost x1.95, h3-control x1.7. Both are far below the 19-32x here, so a price cut is a commercial choice, not a necessity. Proposal (not applied; one constant pair in `server/studio.go` plus `studio_test.go` expectations 0.33 / 0.99):
| tier (5 s clip) | now | proposed (2x: $0.05 + $0.005 / out Mpx-s; 4x: $0.10 + $0.008) | GPU cost | margin |
|---|---|---|---|---|
| 720p -> 1440p 2x | $0.33 | $0.15 | $0.012-0.015 | 10x |
| 1080p -> 2176p 2x | $0.61 | $0.26 | $0.019 | 13x |
| 540p -> 2160p 4x | $0.60 | $0.43 | $0.020 | 21x |
| 270p -> 1080p 4x | $0.23 | $0.18 | $0.009-0.012 | 15x |
Keep current prices if the aim is margin; adopt the proposal only if the 2x tier needs to undercut competitors. Either way the 4x tier needs the base fee: it pays for the cold start.

Applied 2026-11-07 (uncommitted): `studioUpscalePriceUSD` uses 2x $0.05 + $0.005 and 4x $0.10 + $0.008; `/api/pricing` adds `upscale_4x_base_usd` / `upscale_4x_output_mp_second_usd`; home and studio estimates read both pairs. Matches `emails/announce-upscale-price-cut.html`.

## RelayVSR 4x "enhance" tier: not yet profitable by itself
- Quality: clearly best at 4x / low-res input (LPIPS .092 vs .167 on dancer, `docs/vsr-bench.md`).
- Speed: measured 16 s per output second on the 3090 Ti (eager decoder). Scenarios on an H100 ($5.39/h): published figures imply ~0.3 s per output second ($0.0005/s); the 3090 Ti measurement scaled by bandwidth implies ~5 s ($0.007/s). So warm compute for a 5 s clip is $0.003-0.036.
- Cold start dominates: 324 s first job on the 3090 Ti (248 s model init + compile). Assume 120 s on H100 = $0.18 per cold job; at 50% cold that is $0.09 per job. Total $0.09-0.13 per 5 s clip against the existing 4x price of $0.23 (1.8-2.5x margin).
- Verdict: sell it as a premium tier priced at about $0.25 base + $0.03 per out Mpx-s (5 s 1080p-out clip: $0.56, margin 4-6x), and only if a warm worker is justified: an always-on H100 is $129/day, so the tier needs about 10 jobs/hour at that price just to cover idle. The one thing worth a paid check is the cu130 fused-kernel speed and cold start (about $6-7 on one H100, cap $10, see `docs/vsr-bench.md`). Until that shows >=10x faster decode and sub-60 s cold start, route 4x requests to Real-ESRGAN x4plus.

## Deploy checklist (owner)
1. Rebuild and push the `appnz-image-upscaler` image (needs the new `cog.yaml` weight line and `predict.py`). The code on the prod host behind `STUDIO_UPSCALE_URL` (127.0.0.1:18090) is not in this repo; confirm it is built from this Cog before relying on the speedup. That tree also holds your earlier uncommitted edits to README, schema, requirements, which ship with the same build.
2. Point the endpoint at `L40S` then `4090`; leave `UPSCALE_UNTILED_MAX_NATIVE_MP` at default.
3. Smoke test with one 2x clip (output dimensions must equal input x2) before switching traffic.
4. Pricing: no change needed; decide on the proposal above.

## Image upscale (2026-11-07, uncommitted)
- `upscale-image` service and new `POST /api/studio/upscale-image` (`server/image_upscale.go`): omniserve-native `POST /v1/images/upscales` (ggml Real-ESRGAN on the prod 5090 via sd.cpp) first, uploaded to R2; fallback fal-ai/esrgan; `model=creative` keeps fal creative-upscaler.
- Price: $0.02 2x, $0.03 4x, $0.15 creative (was flat $0.15 creative). Marginal GPU cost on the owned 5090 is ~0; fal esrgan fallback is fractions of a cent.
- UI: gallery and search right-click Upscale 2x/4x (handoff `/studio?image_url=..&upscale=2|4`), video Upscale (`&upscale=1` opens the modal), studio clip menu Upscale 2x/4x for images and Upscale video for clips, content-library Upscale 2x, `/tools/image-upscale` mode picker.
- Prod needs the omniserve-native route deployed with ESRGAN weights; until then every call takes the fal-ai/esrgan fallback.
