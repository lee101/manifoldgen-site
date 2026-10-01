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

## Production rollout (2026-10-01)
- Weights mirrored to R2: https://manifoldgenstatic.manifoldgen.com/models/ltx23-uncensored-v1.4/ (manifest.json with size + sha256; fp8mixed, Q4_K_M, Gemma Q4, projections, VAEs, x2 upscaler; 56 GB). Public bucket, same as the H3 weight mirror.
- Image ghcr.io/lee101/ltx-cog:cu130-20261001-r4 (overlay on the H3 image, code only, no weights). RunPod template 737rq4h3l7, endpoint cog-manifold-ltx 0r09mfyja4xf7y, config/runpod-ltx.json. Paused (workersMax 0) between bursts by the app scaler.
- Prod env H3_LTX_RUNPOD_ENDPOINT=0r09mfyja4xf7y, H3_LTX_RUNPOD_MAX_WORKERS=2. h3AdultLane() now prefers it over PinkCherry (PinkCherry endpoint and env left in place; unset H3_LTX_RUNPOD_ENDPOINT to fall back).
- Request contract is H3-compatible. H3 `steps` is ignored (LTX uses tier steps); `size: preview` -> 768 wide, everything else -> 1280x704; `tier` standard|fast|xfast selects steps and size explicitly; `ltx_steps`, `refine_steps` override. last_frame, keyframes, loop, quant are ignored.
- Canary through the real endpoint (seed 7/8/9, 5 s, webm-av1 delivered to R2, audio present): generation 50-63 s on a fresh worker (includes model load; ~28 s once warm), encode 2 s, upload 2-3 s.
- Cold start is the weak point: container start 25-140 s plus a 41.6 GB weight download onto container disk: 204 s (244 MB/s) on a test pod, 300-700 s on the serverless hosts that ran the canaries (3 samples). PinkCherry's own cold jobs took 10-28 min in the A/B, so this is still better, but a network volume in the datacenter with the best 5090/PRO 6000 stock (worker already uses /runpod-volume/ltx-models when a volume is mounted) or a warm worker for paid tiers would cut it to about a minute.
- RunPod capacity: 5090 and PRO 6000 returned "no instances" repeatedly during the day and the endpoint reported throttled; H100 was the one that was reliably available.
- Not verified live: an adult-routed job through the app itself (route selection is unit-tested; the worker is verified by direct canary).

## Follow-up (2026-10-02): network volume, routing, steps, video NSFW flag
- Network volume manifold-models (id 65aknc5k8g, 150 GB, EU-NL-1, ~$10.5/mo) mounted at /runpod-volume on the LTX and PinkCherry endpoints. EU-NL-1 was chosen because it is the datacenter that offers both RTX PRO 6000 Blackwell and H100 80GB HBM3; the volume pins both endpoints there (5090 is not offered in that DC, H100 PCIe/NVL are not offered either). The normal H3 endpoint is NOT attached (it would pin the main lane to one datacenter with "Low" H100 stock).
- Contents (~105 GB): ltx-models/ (fp8mixed, Gemma Q4, projections, VAEs, x2 upscaler: 41.6 GB), models/MiniMax-H3/ (text encoder, video + audio VAE: 21.5 GB), huggingface-cache/ (H3 ref2va 21 GB and the PinkCherry beta-0.6 fl2va 21 GB, symlinked from models/). Q4 GGUF, w4a8 and the normal fl2va are intentionally absent; ltx_weights.py / weights.py fetch anything missing on demand. Populate with workers/ltx-q4/populate_volume_pod.py (HF xet downloads crashed once: HF_HUB_DISABLE_XET=1 and a retry loop fixed it).
- Routing: prompts that go to the LTX lane but carry last_frame, keyframes (>2) or loop are sent to PinkCherry instead (h3RouteForRequest); retries reuse the lane stored on the job (h3RouteForStoredJob).
- LTX steps: H3 steps 8..30 remap to base steps 6..10 (20 -> 8) and refine 3 (4 from step 26); tier or ltx_steps override.
- video_jobs.is_nsfw defaults FALSE; jobs routed down an adult lane (LTX or PinkCherry) are flagged TRUE at creation (no classifier). Video feed and search hide flagged rows unless the caller is an authenticated opted-in user; separate SFW and NSFW video search engines; video sitemap excludes them.
- Optional backfill, never run live: scripts/migrations/flag_nsfw_videos.py (dry run by default, --apply to write, sets TRUE only, classifies the first frame with omniserve /nsfw_detect, resumable with --after, --reindex afterwards). Dry-run verified against prod data.
