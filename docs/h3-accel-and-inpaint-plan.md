# H3 acceleration and inpainting plan (2026-11-06)

Local and free so far: `tools/gpusim` (cost model + Triton block-sparse attention, 11 tests pass on the RTX 3090 Ti). No RunPod spend, nothing deployed.

"Vera sparse attention" was taken to mean trainable video sparse attention (VSA), with Sol-Attn (already tested in `results/h3-flex-bench`), Radial and Sparse-VideoGen style static patterns as the comparison set. No attention method called "Vera" could be identified; tell me if a specific repo was meant.

## Measured on RunPod (2026-11-07, total spend $3.51 of the $45 cap, all pods deleted)

Raw data, scripts and spend log: `results/h3-accel/` (`spend.json`, `attn_probe_node.py`, `attn_session.py`, `attn_sparse.py`, `sparse_h100.json`, `archive/`, `inpaint/`).

Real DiT shape (read from the worker's ComfyUI): 50 DiT blocks, 56 heads x 128, hidden 5376, FFN 14336, full softmax attention in every layer (no windowing). A 5 s 1344x768 clip packs 37,826 tokens: 116 text, 414 audio, 37 latent frames x 1008 video tokens. The pre-measurement model below assumed 125k tokens, so its token counts and sparse-gain figures are superseded; its attention share (60-67%) held up.

### Attention audit (H100, pika-6 native 5 s, prod env: high VRAM, auto text encoder, `H3_ATTENTION_BACKEND=ck`)
Prod `ck` is Comfy Kitchen int8 attention, not a slow path. flash-attn and SageAttention are not installed.

| backend (H100) | attention per layer (full 56 heads) | attention per step | step | relL2 vs bf16 |
|---|---|---|---|---|
| ck int8 (prod) | 89.8-91.8 ms | 4.59 s (65% of step) | 7.02 s | 0.008 |
| torch flash SDPA | 110 ms | 5.81 s | 8.32 s | 0 |
| torch cuDNN SDPA (bf16) | 70-79 ms | 3.50 s | 6.13 s | 0 |
| torch efficient SDPA | 230 ms | - | - | 0 |

Forcing cuDNN attention on H100: attention -24%, step -12.7% (7.02 -> 6.13 s), generation 79.6 -> 77.7 s for the same seed. Same-seed output stays visually identical (PSNR 22.2 dB / SSIM 0.83 against `ck`, closer than the 17.7 dB between two `ck` runs that differ only in text-encoder numerics; sheet in `results/h3-accel/cudnn_vs_ck_sheet.png`). It also removes the int8 error.

| backend (RTX PRO 6000, random bf16, one layer) | 37,826 tokens | 76,010 tokens (1080p) |
|---|---|---|
| ck int8 | 72.8 ms (564 TFLOPs eq) | 273 ms (606) |
| cuDNN SDPA | 107 ms | 435 ms |
| flash SDPA | 112 ms | 451 ms |

On Blackwell `ck` is the fastest backend (1.5x cuDNN), so the backend must be chosen per GPU: cuDNN on H100/H200, `ck` on PRO 6000/B200. Recommended change: add `H3_ATTENTION_BACKEND=cudnn` as a worker option (wrap SDPA in `sdpa_kernel(CUDNN_ATTENTION)`, see `results/h3-accel/attn_probe_node.py`) and set it for H100/H200 endpoints only. Expected: about 0.9 s per step, 5 s per 5 s clip (-6% generation), larger on 1080p/15 s (attention is a bigger share there).

Not an attention problem: on H100 only 42 s of the ~80 s generation is DiT (6 x 7.0 s). About 36-40 s per clip sits outside the denoise loop, unchanged by `H3_COMFY_VRAM_MODE=high` (76.6 s vs 77.8 s) or the int8 text encoder. It is not decomposed yet; `H3ProfileStop`/`profile_trace_id` in the workflow is the tool to break it down, and it is now the largest remaining lever on H100.

### Sparse attention on real activations (H100 dumps of real Q/K/V, 8 of 56 heads, layers 4/24/45, two steps each)
Block density (128x64 blocks) an oracle needs to keep a given share of softmax mass:

| layer | 80% | 90% | 95% | 99% |
|---|---|---|---|---|
| 4 | 19% | 33% | 47% | 77% |
| 24 | 26% | 42% | 57% | 81% |
| 45 | 5% | 11% | 19% | 44% |

Early and middle layers are diffuse, only the last layers are sparse. Static patterns do poorly (sliding 3D window at 18% density keeps 35-70% of mass, layer error 0.29-0.45); content-adaptive top-k at 27% density keeps 71-95% with layer error 0.07-0.14, against 0.008 for the int8 path. The Triton prototype is 2.6x slower than flash when dense, so it only reaches 0.7x of cuDNN time at 27% density. Verdict: training-free sparse attention is not viable at six NFE (matches the Sol-Attn result), and even with a flash-parity kernel the best static schedule (dense first 25 layers, 15% density in the last 25) gives only 1.35x per step on 768p (1.47x at 1080p), before any quality cost. Sparse-aware fine-tuning is the only route and the gain is modest; idea #4 (LoRA, $100-250) is not justified. Ideas ranked below are re-ordered accordingly.

### Recalibrated model (`tools/gpusim/gpusim/real.py`, `real_sim.py`, 16 tests pass)
Step = rest (2.43 s H100, 2.36 s PRO 6000 at 37.8k tokens, linear in tokens) + 50 x 4 N^2 H D / (measured effective TFLOPs). Fit points: 5 s H100 ck/cuDNN, 5 s PRO 6000 ck. Held-out checks: H100 15 s step 44.6-45.3 s predicted vs 43.7 s measured (+2-4%), PRO 6000 1080p 148.6 s vs 143 (+4%), 1440p 363 s vs 367 (-1%). The earlier shape-free model missed PRO 6000 5 s by -20%.

### Inpainting prototype (H100, 1120x704 ROI of the 1344x768 fox clip, `inpaint/`)
Pipeline built from existing nodes: ROI crop, `H3InjectVideoLatent` (source latent), no first-frame anchor, Pika LoRA + `lcm` with truncated Pika sigmas as the partial denoise, `NativeAudioLock`, then a feathered pixel composite with the propagated mask. Warm run 46-55 s for 2-4 NFE at 4.6 s/step on the ROI (118 s cold).
- Outside the mask (68% of all pixels, alpha 0) the composite is byte-identical to the source in all three variants (max abs diff 0).
- Motion, pose and background are preserved; in-mask frame difference 9.4-10.4 vs 8.7 in the source.
- Edit strength is the weak point: prompt-only "white arctic wolf" with start sigma 0.8 or 0.57 barely changes the fox, 0.92 makes the fur paler and more wolf-like with a faint seam near the face. A real replacement needs the edited first-frame anchor (nano-banana, as in the design) plus start sigma >= 0.92.
- Mask propagation from a coarse ellipse seed with the dense tracker drifts (misses the head at 2.5 s, fragments and leaks onto a tree during the pounce at 4.8 s). Production needs a segmenter on keyframes; the tracker only carries a good seed.

## Pre-measurement model (superseded by the measurements above)

DiT layer/head dims are not available locally (Comfy loads quantised weights, no config in the repo), so `gpusim/dit.py` is shape-free: step time = a*N + b*N^2 per GPU, fit exactly on the measured bench points (H100 5 s and 15 s; RTX PRO 6000 1080p and 1440p totals). Latent grid is 48x84 per frame at 768p; temporal ratio is unknown (4 or 8, results barely depend on it).

| fit | attention share of a 5 s 768p step |
|---|---|
| H100 (7.0 s/step, 15 s = 43.7 s/step) | 60% (tc 4) to 67% (tc 8) |
| RTX PRO 6000 | 77% |

Validation: PRO 6000 5 s 768p is predicted 28.9 s vs 36 s measured (-20%, the 19 s non-denoise overhead is a guess). Other GPUs scale `a` by low-precision peak and `b` by bf16 peak from the nearest fitted architecture, so treat H200/B200/4090/L40S/A100 numbers as +-50%; H200 equals H100 here (no bandwidth term).

Two findings from the fit:
1. H100 attention costs more per N^2 than PRO 6000 (2.70e-10 vs 2.37e-10 s) although its bf16 peak is 2x higher. The H100 worker is probably not on a Hopper-tuned attention kernel (profile says `ck` everywhere) or is still paying emulated nvfp4 paths. Lossless candidate, tested first.
2. The measured attention cost implies the deployed DiT cannot be dense full attention over all tokens in every layer with a 20 B-class shape (it would exceed the whole step). Either part of the layers are local/windowed already or attention runs in a low-precision path, so sparse headroom is smaller than a naive N^2 estimate. The model uses only measured totals, so its speedups already reflect this.

## Sparse attention prototype (local RTX 3090 Ti, fp16, head dim 128, synthetic structured Q/K)

Triton kernel with per-head CSR block lists. Its dense mode is 0.62-0.66x of torch flash SDPA on sm_86, so absolute kernel speed here is not the production number; the useful result is that sparse time tracks the ideal 1/density to within 4-12% down to 6% density (selection cost for top-k pooling is 1.4-6 ms, <2%).

| N tokens | pattern | density | speed vs own dense kernel | relL2 vs dense (synthetic) |
|---|---|---|---|---|
| 125k (5 s 768p) | sliding 3D window wf2 wy12 | 0.108 | 9.2x | 0.46 |
| 125k | sliding wf4 wy24 | 0.241 | 3.9x | 0.36 |
| 125k | radial base 0.25 | 0.219 | 3.8x | 0.37 |
| 125k | top-k blocks 25% | 0.25 | 3.7x | 0.31 |
| 125k | top-k blocks 12.5% | 0.125 | 7.5x | 0.42 |
| 363k (15 s 768p) | sliding wf2 wy12 | 0.038 | 26x | 0.48 |
| 363k | top-k 25% | 0.25 | 3.8x | 0.25 |

Error numbers use synthetic activations with deliberately global heads, so they only rank patterns; real accuracy needs real H3 Q/K (session A below).

Predicted end-to-end denoise speedup (sparse kernel at parity with its own dense kernel, `tools/gpusim/out/sim_tc4.md` has all GPUs):

| GPU | clip | all 6 steps: sliding wf2 / radial / top-k 12.5% | steps 2-5 only (Sol-style window) |
|---|---|---|---|
| H100 | 5 s 768p | 2.2x / 1.8x / 2.1x | 1.56x / 1.42x / 1.53x |
| H100 | 5 s 1080p | 3.7x / 2.7x / 2.9x | 1.94x / 1.71x / 1.78x |
| H100 | 15 s 768p | 4.6x / 3.1x / 3.4x | 2.10x / 1.82x / 1.89x |
| PRO 6000 | 5 s 768p | 3.2x / 2.3x / 3.0x | 1.84x / 1.61x / 1.79x |
| PRO 6000 | 5 s 1080p | 6.2x / 3.6x / 4.1x | 2.26x / 1.92x / 2.02x |
| PRO 6000 | 15 s 768p | 7.8x / 4.0x / 4.7x | 2.39x / 2.00x / 2.10x |
| RTX 4090 | 5 s 768p | 2.3x / 1.9x / 2.2x | 1.59x / 1.45x / 1.56x |
| B200 | 5 s 768p | 3.2x / 2.3x / 3.0x | 1.84x / 1.61x / 1.79x |

Reality check: measured Sol-Attn on PRO 6000 gave 0.9-1.0x at 5 s 768p and 1.06-1.28x at 1080p/1440p, against 1.6-2.3x predicted for the same step window. So either Sol's tau policy keeps far more than 10-25% of the blocks at six NFE, or its kernel overhead is large; and the output changed (sharpness -2..-12%, spurious second tram). Model upper bounds are reachable only if a kernel really runs at 10-20% density, and training-free sparsity on a six-NFE distilled model visibly changes the shot. That is why the quality route is sparse-aware fine-tuning (VSA trains with the sparse pattern in the loop), not another training-free mask.

## Ranked ideas, updated with measurements (2026-11-07)

| # | idea | measured / expected gain | status |
|---|---|---|---|
| 1 | cuDNN SDPA on H100/H200 (keep `ck` on Blackwell) | step -12.7%, generation -5 s per 5 s clip, larger on 1080p/15 s; lossless | measured, ready to ship as a worker option |
| 2 | Break down the 36-40 s non-DiT time per clip on H100 (`profile_trace_id`) | up to ~45% of generation time | next, one short pod |
| 3 | Inpaint v1 with edited first-frame anchor, start sigma >= 0.92, keyframe segmenter masks | pixel-exact outside mask already verified | prototype works, needs anchor and segmenter |
| 4 | Sparse attention only in the last ~25 layers | <= 1.35x per step at 768p even with a flash-parity kernel, with quality risk | low priority |
| 5 | Sparse-aware LoRA training | not justified by the above | dropped |
| 6 | VDN linear attention for single long shots | 2.6x at 15 s (earlier measurement) | unchanged |

## Ranked ideas (pre-measurement, superseded)

| # | idea | predicted gain | risk / cost |
|---|---|---|---|
| 1 | Attention backend audit on H100 (FA3, SageAttention-style int8 QK, `ck` vs `flash`) with per-layer timing; PRO 6000 too | up to ~1.2-1.35x on H100 if attention gets PRO-6000-class efficiency (attention is 60% of the step); lossless or near-lossless | lowest; one short pod session |
| 2 | Log real Sol-Attn kept-density and Q/K statistics, dump real Q/K for 3 layers and 2 steps, then fit the sparse pattern offline on the 3090 Ti | turns synthetic error into real error; decides whether 3-8x attention reduction is viable | cheap, needed before any training |
| 3 | Sparse only on 1080p/1440p/15 s tiers (attention share 77%+, token counts 2-3.5x) | 1.9-2.4x at 4/6 steps, 3.5-7.8x if all steps, per the model | quality must be gated per tier; these tiers carry the margin (1080p costs $0.15/s) |
| 4 | Sparse-aware LoRA: fine-tune the Pika rank-128 LoRA with the chosen block pattern active, using our own H3 generations (trajectory farm) as self-distillation targets | removes the shot-change problem seen with Sol; realises the table above | only after #2 shows >=85% attention mass kept at <=20% density; ~8 GPUs x 4-8 h (about $100-250, my estimate) |
| 5 | Cache stacking: EasyCache (already prod) is multiplicative with sparse | extra 1.1-1.16x | already measured: do not stack FBC/Spectrum with it |
| 6 | VDN linear attention for single long shots only | 2.6x at 15 s (measured) | separate stack, no portrait; revisit only if sparse fails |
| 7 | Skip: compiled VAE, Sol-Attn as shipped, FBC 0.08 (all measured no gain) | - | - |

## H3 inpainting design

Building blocks already in the repo (`/vfast/data/code/h3-cog-flex`, `h3_workflow.py`, `h3_face_refine.py`):
- `H3InjectVideoLatent` + `BasicScheduler(denoise<1)` = SDEdit on a cropped video; `H3PerFrameDenoise` gives per-frame strength; `H3FaceStitch` composites the refined crop back with mask dilation, feather and colour match. This is already a working crop-regenerate-composite path (for faces).
- `MiniMaxH3ImageToVideo` first_frame, FL2VA first+last frame, `MiniMaxH3ReferenceToVideo` ref_videos, `MiniMaxH3NativeAudioLock` keeps audio untouched.

H3 Inpaint v1 (no model changes):
1. Mask: user paints one or more keyframes (or gives a prompt); SAM-class segmentation on keyframes, then propagate to every frame with dense tracks (below).
2. ROI: union box of the per-frame masks, padded 25%, temporally smoothed, snapped to multiples of 32 and to H3 native sizes; split at scene cuts (ffmpeg score 0.18, already used by character swap) into <=5 s shots.
3. Anchor: edit the first ROI frame with the image editor (OpenPaths gemini-nano-banana-2.1 or GPT Image 2, inside the mask only, same recipe as the character-swap keyframes) and use it as first_frame (and last frame when the shot allows, FL2VA).
4. Regenerate: SDEdit on the ROI clip at denoise 0.6-0.85 on the Pika six-NFE lane (3-5 NFE, roughly 40-60% of a full clip), prompt describing the replacement, audio locked.
5. Composite: feathered per-frame mask alpha in pixel space with Lab colour match against the surrounding ring. Outside the mask the output is the source bit for bit; only the feather band can differ.

v2 (true latent inpainting, only if v1 shows seams): RePaint-style blending inside the sampler loop, `x_t = m*x_gen + (1-m)*noise_to_t(x_src)`, mask max-pooled to the latent grid (16x spatial, tc temporal) so any latent cell touching the mask regenerates, audio half of the AV latent untouched. Needs a sampler callback or `SetLatentNoiseMask` support for the nested AV latent; unverified.

Pixel tracking for mask and edit propagation:
- Mask propagation: sample points inside the keyframe mask, track with CoTracker3 (grid, occlusion-aware) or AllTracker (dense, 768x1024 on a 40 GB GPU per its paper; a downscaled pass fits the local 24 GB card), rebuild per-frame masks from visible tracks plus morphology; compare against SAM2 propagation by per-frame IoU on 10 clips.
- Edit propagation: warp the edited first-frame texture along the dense tracks and use the warped ROI as the SDEdit init (texture stays pinned to the surface instead of drifting); occlusion/visibility drops trigger a new anchor frame.
- Existing `workers/motiontrack` (rtmlib + ByteTrack) already tracks people; it is the fallback for person masks.

Metrics (reuse `tools/swapscore`, `tools/qualitybench`): outside-mask max pixel diff (must be 0 beyond the feather), seam band PSNR, in-mask flicker (frame-diff vs source motion), mask IoU per frame vs SAM2, vision-judge prompt adherence, first-frame PSNR.

## Paid RunPod validation (needs your approval; rates from bench README: H100 $4.80/h, PRO 6000 $4.00/h billed serverless, pods are likely cheaper)

| session | GPU | hours | cost | purpose |
|---|---|---|---|---|
| A | 1x H100 | 2.5 | about $12 | per-layer attention timing across backends (idea 1), Sol kept-density log, dump real Q/K and the Sol/FA3 comparison; copy dumps to the 3090 Ti for offline sparse fitting (idea 2) |
| B | 1x RTX PRO 6000 | 2 | about $8 | same on Blackwell plus sparse kernel at 1080p and 15 s |
| C | 1x RTX PRO 6000 | 3 | about $12 | build and test H3 Inpaint v1 on 4 clips (person swap, object removal, background change, face), track-based masks |
| D (optional) | 1x B200 | 1 | about $8 | sm_100 numbers to replace the extrapolated B200 column |
| E (conditional) | 8x H100 | 4-8 | $100-250 | sparse-aware LoRA, only if A/B show a pattern keeping >=85% mass at <=20% density |

A+B+C is about $32 (budget $45 with failed starts); D adds $8. Run via `workers/h3-fast/pod.py` / `scripts/runpod_cost_guard.py` guards. Before E, repeat A on the trained LoRA.

## Local, free, next
- Run AllTracker vs CoTracker3 vs TAPNext on the 3090 Ti against the existing martial-arts clips in `testvids/motion/in` (mask-IoU and endpoint error vs SAM2 keyframes) to pick the propagation tracker before session C.
- Port the sparse-attention phase structure into openkernels' `virtualcuda` `Kernel` specs for an H200 estimate of a FA-style sparse kernel (that model is fitted to 40 H200 cases; gpusim is coarser and does not predict kernel-level behaviour).
- Reproduce: `cd tools/gpusim && python3 -m pytest -q && python3 bench_sparse.py --clip 5s-768p --tc 4 --heads 4 --out out/bench_5s_tc4.json && python3 simulate.py --bench out/bench_5s_tc4.json out/bench_15s_tc4.json`.

## Caveats
- Unknown: temporal VAE ratio, layer/head counts, which layers are windowed. Predictions rely on fitted totals only.
- The 3090 Ti is shared (another process held ~1.4 GB and up to 34% utilisation during runs), timings are min-of-3.
- PRO 6000 fit includes a guessed 19 s non-denoise overhead and one validation miss of -20%.
- Sparse speedups assume a production kernel at the same ratio to its dense kernel as the Triton prototype; Sol's measured 0.9-1.2x shows this is not automatic.
