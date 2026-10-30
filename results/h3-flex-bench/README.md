# H3 acceleration bench: Pika H3 Flex vs VDN-H3 vs our 20-step worker vs fal H3 Max (2026-10-30)

Scenes (scenes.json, seed 1, 5 s, prompts identical for every arm): dancer and fox (text-to-video 16:9),
tram (image-to-video 16:9, frames/tram.png) and potter (image-to-video 9:16 with a spoken line, frames/potter.png).
Audit: `uv run tools/qualitybench/qualitybench.py OUT clipdir... --inputs frames` writes first/middle/last frame sheets
(audit1/ all Comfy arms vs fal, audit2/ fal vs base vs Pika native vs VDN, audit15/ 15 s Pika vs VDN).

## Candidates
- **Pika H3 Flex** (Pika-Labs/Pika-H3-Flex): LoRA adapters on MiniMax H3 (rank 128, Comfy bf16 file 1.96 GB), six NFE on
  fixed knots 1000/750/500/250/100/40/0 with shift 12 (sigmas 1.0, .972973, .923077, .8, .571429, .333333, 0), lcm (renoise)
  sampler, no CFG. Drops into our ComfyUI worker on the same int8 UNET: worker profile `pika-6` (h3-cog-flex).
- **VDN-H3** (OpenVDN/vdn-minimax-h3): H3 finetune with a frame-wise linear-attention branch beside window softmax, DMD
  distilled to 8 NFE, fp8. Separate diffusers stack (torch 2.13 cu129, patched diffusers, FA4, Triton needs gcc).
- **NVIDIA Open-H3-Regenerate-2K**: the HF repo does not exist / is not public (401, then "Repository not found"). Not tested.
- Licence for all H3 derivatives: MiniMax H3 Community License, territory excludes EU, UK, KR, US (same as our self-hosted H3).

## Speed, 5 s clip, warm worker (generation seconds)
| arm | res | GPU | text encoder | total | denoise |
|---|---|---|---|---|---|
| fal H3 Max (prod normal lane) | 1344x768 | fal | - | 11-17 wall | - |
| base 20 steps (EasyCache balanced) | 1184x672 | H100 | nvfp4 (emulated) | 94-109 | ~60 |
| turbo6 (our old Turbo LoRA) | 1184x672 | H100 | nvfp4 | 91-105 | - |
| **pika6 native** | 1344x768 | H100 | nvfp4 (emulated) | 83-92 | 42 (7.0 s/step) |
| pika6 native | 1344x768 | H100 | int8_convrot | 63-69 | 42 |
| **pika6 native** | 1344x768 | **RTX PRO 6000** | nvfp4 (native) | **53-58** | 36 (6.1 s/step) |
| pika6 balanced | 1184x672 | RTX PRO 6000 | nvfp4 | 40-42 | 24-27 |
| base 20 steps | 1184x672 | RTX PRO 6000 | nvfp4 | 65-76 | 57-60 |
| pika6 hd | 1920x1088 | H100 (low vram) | nvfp4 | 186-205 | - |
| VDN 8 NFE fp8 | 1344x768 | H100 | own bf16 encoder | n/a (process per clip) | 31.5-35.6 (3.9-4.5 s/NFE) |

15 s, 1344x768, H100: Pika 262 s denoise (43.7 s/step) vs **VDN 99 s** (12.3 s/NFE): linear attention wins 2.6x on long clips.

Key finding: on Hopper the nvfp4 Qwen3-VL text encoder is *emulated* (Comfy log: "emulated ops: mxfp8, nvfp4") and costs
30-40 s per new prompt, more than Pika's whole denoise. Blackwell runs it natively; on H100 use
`H3_TEXT_ENCODER=qwen3vl_32b_minimax_h3_int8_convrot.safetensors`. `H3_COMFY_VRAM_MODE=high` keeps all models resident
(the worker defaults to low and re-stages 35 GB per clip).

Cost per 5 s 768p clip at billed serverless rates: Pika on PRO 6000 ~55 s x $4.00/h = **$0.061**; on H100 int8 TE ~66 s x
$4.80/h = $0.088; fal H3 Max $0.40 (we charge $0.48).

## Quality (sheets in audit1/ audit2/)
- Pika native 768p matches fal H3 Max and our 20-step base by eye on all four scenes: the fox pounce lands, the dancer stays
  coherent (lowest flicker of all arms, 1.4), the tram holds the input frame (first-frame PSNR 37 vs fal 25), the potter keeps
  identity and speaks the line. Pika at 1184x672 is slightly softer than base; render it at native.
- Our old turbo6 LoRA breaks the potter (hands leave the cup); retire it.
- PinkCherry UNET + Pika LoRA works (68 s at balanced on H100, coherent): the adult lane can drop from 14 steps to 6.
- Pika 1080p (hd, 1920x1088) is the sharpest output, stable, ~3.5x the native time: a paid 1080p tier.
- VDN: good but a step behind Pika at 5 s (dancer background drifts, a curtain appears; flicker 3.9); at 15 s it is as good as
  Pika. The potter VDN render is invalid (bench bug: render.num_frames only, latent size stayed landscape).

## Production endpoint canary (cog-manifold-h3-flex r2w5aaxyz1bx08, image flex-r3, 2026-10-30)
Direct RunPod submissions (scripts/runpod-h3-direct-canary.py), audit in audit-canary/ against the fal clips:
| clip | worker | res | generation s | execution s |
|---|---|---|---|---|
| fox t2v | cold (boot 78 s) | 1344x768 | 54.1 | 139.5 |
| dancer t2v hd | warm | 1920x1088 | 141.2 | 145.4 |
| potter i2v 9:16 | cold | 768x1344 | 61.2 | 245.5 |
All three match fal by eye (potter speaks the line, first-frame PSNR 43 vs fal 32; the 1080p dancer is visibly
sharper). 1080p costs ~$0.16 of GPU per 5 s and is listed at $0.15/s ($0.75 per 5 s).

## VDN verdict: not a production lane yet
- The render hard-codes the latent canvas (src/inference/render.py LATENT_H, LATENT_W = 48, 84): 1344x768 16:9 only,
  no portrait, square or 1080p without retraining/patching (this is the "potter rendered landscape" result above).
- Its own stack (torch 2.13 cu129, patched diffusers, FA4) and a bf16 32B text encoder; another warm endpoint
  would split traffic and double cold starts.
- It wins only on single long shots (15 s: 99 s vs Pika 262 s denoise on H100); at 5 s it is a step behind Pika.
  At list price the 15 s Pika clip already costs ~$0.26 of GPU against $1.44 charged, so the gain is latency.
Revisit if VDN ships aspect-ratio support or a ComfyUI port.

## Spend
Pods: $0.45 (failed, cu129 torch clobbered system torch) + $3.58 + $5.33 (VDN) + $0.69 (PRO 6000) + $1.13 (H100 int8 TE);
fal reference $1.60. All pods deleted.

## Reproduce
`uv run --with boto3 python launch.py --image ghcr.io/lee101/h3-cog:cu130-20261030-flex-r2 --vram high --arms pika6_native --phases comfy [--gpu ...] [--env H3_TEXT_ENCODER=...]`
(pods use any datacenter: `allowedCudaVersions` must be omitted, hosts report CUDA 13.2 and the API enum stops at 13.0).
