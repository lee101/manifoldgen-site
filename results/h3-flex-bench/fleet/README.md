# Flex fleet study (2026-10-31): GPU pool, cold start, recovery

Pods (flex-r3 image, pika6 native 1344x768, 5 s, 4 scenes): `ws/ pcie/ a100/` status.json; spend $0.32 + $0.67 + $0.65.
NVL had no capacity (RunPod fell back to H100 SXM, pod deleted unused).

| GPU | s / 5 s clip | $/h | $ / clip | verdict |
|---|---|---|---|---|
| RTX PRO 6000 Server 96 GB | 55 | 2.49 | 0.038 | primary |
| RTX PRO 6000 Workstation 96 GB | 52.9 | 2.59 | 0.038 | **added** (same speed, more stock) |
| H100 PCIe | 91.4 | 2.89 | 0.073 | **added** ahead of SXM (cheaper per clip) |
| H100 SXM | 66-92 | 3.99 | 0.073-0.092 | fallback |
| A100 80GB | 173 | 1.79 | 0.086 | rejected: 2.3x the cost per clip |
| H200 | ~59 (est) | 5.29 | ~0.086 | last resort |

`estimate.py` is the virtual estimator: bf16 TFLOPS / HBM GB/s, w=0.63 compute share, leave-one-out error +5% and +9% (Hopper/Ampere
only; Blackwell is calibrated, not predicted). Cold-start table in its output uses measured R2 throughput; the 3 GB/s local-NVMe row is an
assumption, not a measurement.

Cold start: ~39.6 GB of weights (int8 UNET 20.97 GB, nvfp4 text encoder 15.69 GB, Pika LoRA 1.96 GB, VAEs) are fetched from R2 on every
boot (78 s, 175 s on a bad day, billed as execution). Lossless zstd-3 measured on 3 GB samples: UNET 0.891x, TE 0.973x (7.4% of total).
Lossy w4 UNET would cut about 27% of bytes but changes the model (worker `w4a8` option exists, no artifacts yet): needs the quality bench.

Applied: endpoint r2w5aaxyz1bx08 gpuTypeIds (5 types above) and executionTimeoutMs 1800000 (config/runpod-h3.json mirrors it).
Code: server h3FlexExecutionBudget (cold boot + 3x predicted), recoverStuckFlexJob (hung/TIMED_OUT/FAILED -> fal at the flex quote),
scripts/h3_endpoint_monitor.py (STUCK/BACKLOG/UNHEALTHY, recycle on --apply, triage gpt-6.1-terra -> deepseek-flash).

## 2026-10-31 weights experiments (tiny-sd stand-in, RTX 3090 Ti; script was scratch, numbers below)

Lossy sub-int8 storage, per-group(128) RTN, int8 codes re-rounded to k bits then expanded back, 6-step DDIM, PSNR vs the int8 images:

| stored | zstd bytes/param | PSNR vs int8 |
|---|---|---|
| int8 (needed quant) | 0.929 | - |
| 7-bit | 0.875 (-6%) | 36 dB |
| 6-bit | 0.726 (-22%) | 31 dB (visible drift) |
| 5-bit | 0.623 | 24 dB (bad) |
| 4-bit RTN | 0.427 | 16 dB (broken; needs GPTQ-class method) |

6-bit saves ~4.6 GB of the 21 GB UNET = ~10-20 s of a cold download, at a visible quality cost. Not worth it; 7-bit is nearly free quality-wise but saves ~1.3 GB. Keep int8 + lossless only. Tiny-model proxy: confirm on H3 with qualitybench before trusting any of this.

Layerwise loading bound, from the warm ws pod log: first prompt (TE 15 GB + UNET 20 GB load from local disk + 6 steps) took 41.7 s vs 25 s of sampling, so local load is only a few seconds. The cold cost is the 78-175 s *download*. Layerwise start can hide at most the TE pass + step 1 (~4.3 s) behind the download, ~5-10 s total (5-10%). Eliminating the download (locality) is the big lever.
