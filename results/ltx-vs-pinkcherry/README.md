# LTX-2.3 v1.4 (fp8 / Q4_K_M) vs PinkCherry H3 - results

Scenes: rooftop, apartment, beach (male/female kiss), prompts in prompts.json. 5 s clips, 24 fps, native audio.

## Files
- pinkcherry/*.webm   prod adult lane (H3 PinkCherry, balanced 16:9 = 1184x672, H100)
- ltx/fp8_*.mp4, ltx/q4_*.mp4   LTX two-stage (base 640x352 -> x2 latent upscale -> refine) 1280x704, seed 1
- sheets/ab_*.jpg   contact sheets, row 1 PinkCherry, row 2 LTX fp8, row 3 LTX Q4 (frames 12/36/60/84/108)
- wm/all.jpg        bottom-strip watermark check of all 9 clips (clean)
- variants/         speed variants + watermark repro with the new negative prompt (clean, 5/5 incl. exact old repro)
- bench/            raw per-GPU JSON (bench/cold_run_cached_invalid is the first attempt where run 2 was a ComfyUI cache hit - ignore)
- All 10 samples are published in the gallery (video_kiss_*, provider manifold-alt / manifold-h3-adult)

## Quality read (subjective, frames in sheets/)
- LTX: sharper eyes/skin/hair detail, sustained kiss in every frame, strong backlight and lens flare. Tends to expose bright and saturated (apartment scene is blown out vs PinkCherry's moody grade). fp8 and Q4 are visually indistinguishable.
- PinkCherry: more cinematic grade, softer faces, follows the prompt's "gaze, then kiss" sequence literally (apartment barely reaches the kiss), lower perceived detail at 1184x672.
- Watermark: one of the first 3 LTX clips hallucinated a cam-site watermark. After adding text, signature, nnbycam.com to the negative prompt the exact repro and 4 more seeds were clean. n=5, so keep an OCR/vision QA pass in the worker before shipping.
- Speed variants (same seed): base8/refine3 and base6/refine3 are not distinguishable from base8/refine4 by eye; 1024x576 is sharp.

## Speed, same 5 s clip (1280x704 two-stage unless noted)
PinkCherry on H100 (same endpoint as prod): 43-58 s generation at 1184x672.

| GPU | pod $/h | fp8 s/clip | fp8 $/clip | Q4 s/clip | Q4 $/clip |
|---|---|---|---|---|---|
| RTX 5090 32GB | 0.99 | 28.6 | 0.0079 | 50.0 | 0.0138 |
| RTX PRO 6000 96GB | 2.09 | 28.8 | 0.0167 | 50.0 | 0.0290 |
| H100 80GB HBM3 | 3.49 | 27.0 | 0.0262 | 45.6 | 0.0442 |
| H100 PCIe | 2.89 | 39.3 | 0.0315 | 80.0 | 0.0642 |
| A100 80GB | 1.59 | 50.2 | 0.0222 | 82.0 | 0.0362 |
| L40S 48GB | 1.09 | 55.4 | 0.0168 | 82.0 | 0.0248 |

- fp8 is 1.7-1.9x faster than Q4 GGUF on every card (Q4 pays dequant each step). Q4 only matters for <=24 GB cards (4090 ~96 s single-stage, and its pod died during the run).
- fp8 (29 GB) fits and runs on the 32 GB 5090 via offload at the same 28.6 s as an H100. The 5090 host RAM cgroup is tight (123 GB visible): a cfg 1.0 run was OOM-killed there.
- Sage attention, --fast: no gain. torch.compile fails on the GGUF/dynamic-VRAM path.
- cfg 1.0 saves ~23% (22 s) but disables the negative prompt, so the watermark guard is gone - not recommended.
- Cold worker adds ~22-30 s model load on top of the warm time (first job 50-59 s).

## Cost per clip
Pod price is used as a proxy. Serverless flex bills a premium over pod price, so treat absolute numbers as a floor and use the ratios.
Current PinkCherry: 43-58 s on H100 at $3.49/h = $0.042-0.056 per clip. LTX fp8 on 5090 = $0.0079, ~5-7x cheaper and ~1.5-2x faster.

| variant | settings | warm s (5090) | $/clip at 5090 pod rate | $/clip at 100% util H100 |
|---|---|---|---|---|
| standard | 1280x704, base 8 / refine 4, cfg 3.5 | 28.6 | 0.0079 | 0.0277 |
| standard-lite | 1280x704, base 8 / refine 3 | 24.4 | 0.0067 | 0.0237 |
| fast | 1280x704, base 6 / refine 3 | 22.7 | 0.0062 | 0.0220 |
| xfast | 1024x576, base 6 / refine 3 | 14.1 | 0.0039 | 0.0137 |

Keeping a worker warm (what fast/xfast need) is dominated by idle:

| warm-worker utilisation | $/clip (5090 kept warm, 22.7 s clips) |
|---|---|
| 100% | 0.0062 |
| 50% | 0.0125 |
| 25% | 0.0250 |
| 10% | 0.0624 |

## Recommended defaults
- GPU order for the endpoint: RTX 5090, then RTX PRO 6000 Blackwell Server (same speed, stock High, $/clip about equal to L40S but half the latency), then H100 80GB HBM3 / PCIe / NVL. Skip A100, L40S (slow), 4090 (Q4 only). 5090 capacity was intermittently "no instances" during the benchmark, so keep PRO 6000 in the list.
- Standard (best effort, scale to zero, flex): 5090, fp8, 1280x704, base 8 / refine 3, cfg 3.5, expanded negative prompt. ~24 s warm, ~$0.007 compute.
- Fast (paid): same model and quality, dedicated warm worker plus queue priority, base 6 / refine 3 (~23 s). Main value is removing the 30-60 s cold start, so price it to cover idle time (see utilisation table; at 25% utilisation it is ~3x standard).
- xFast (paid, best effort): 1024x576, base 6 / refine 3, ~14 s warm on the same card. GPU class does not change latency (H100 27 s vs 5090 28.6 s), so do not pay for H100 for speed; use H100 only as capacity fallback.
