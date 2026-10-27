# H3 character swap worker

RunPod serverless worker for `/tools/character-swap-lora`: MiniMax H3 Ref2VA (int8 convrot) plus the
Akatz Labs character-swap LoRA. The source clip is `<Video 1>`, the new characters are `<Picture 1>`.

## Files

- `swap_graph.py` builds the ComfyUI API graph (LoadVideo, MiniMaxH3ReferenceToVideo with `ref_videos`, swap LoRA, optional Turbo LoRA / EasyCache,
  optional tiled VAE decode and TorchCompileModel), frame and size rules (24 fps, 17n+5 frames, multiples of 32).
- `gpu_profile.py` detects GPU name, compute capability and VRAM (nvidia-smi) and picks a profile; `python gpu_profile.py` prints the choice and the ComfyUI flags.
- `swap_weights.py` installs the Ref2VA weights, text encoder, both VAEs, the swap LoRA and the 4-step Turbo LoRA (44.7 GB). The 8-step/FL2V Turbo LoRAs (5.9 GB) are fetched on the first request that names them.
- `swap_runtime.py` owns the ComfyUI process, per-stage timing (ComfyUI websocket) and the fail-soft retry; `swap_handler.py` is the RunPod handler (moderation, R2 direct upload, batches).
- `Dockerfile` is a thin overlay (`ARG BASE`, default r4) so hosts that already cached the base layers pull only the changed files; `.dockerignore` whitelists the files it copies.
- `scale_pool.py` shows and widens the endpoint GPU pool (dry run unless `--apply`); `rp.py` is a REST helper; `pod.py`/`push.py`/`run.sh`/`swaptest2.py` are the scratch-pod benchmark helpers
  (`pod.py` takes `ALLOWED_CUDA=` and `POD_IMAGE=`); `run_batch_endpoint.py` drives an endpoint like the server does (cut clips, presigned outputs, batch jobs, stream) and prints per-clip stage seconds.
- Tests: `uv run --with pytest python -m pytest workers/h3-swap`.

## Input contract

Single clip (still supported, yields exactly one result):
`{video_url, image_urls[1-3], prompt, steps, turbo, easycache, megapixels, seed, _output_upload_url, _output_public_url}`.

Batch (one job, clips run one after another on the warm ComfyUI graph, each uploaded and streamed as soon as it is ready):
`{image_urls, prompt, steps, turbo, easycache, megapixels, video_url?, clips: [{id, video_url? | start+length (cut from the shared video_url), seed, _output_upload_url, _output_public_url}]}`,
1-12 clips, upload URLs required. The handler is a generator with `return_aggregate_stream`: every item is `{clip, outputs[], metrics, moderation}` or `{clip, error}`; a failed clip does not stop the rest.
`/stream/<job>` delivers items while the job runs, `/status/<job>` returns the aggregated list at the end. `metrics` carries `gpu`, `profile`, `profile_path` (`fast`, `safe`, `safe-retry`), `fast_path_error`,
`stage_seconds` {prep, comfy, load, encode, sample, decode, save}, `generation_seconds`, `worker_boot_seconds`.

What a batch saves per clip: handler start and RunPod job scheduling, the prompt moderation gate, the shared video/reference downloads (done once; the next clip's source is prefetched during generation), the upload (overlaps the next clip), and model reloads.
What it cannot save: `encode` (about 10 s warm) is Qwen3-VL reading the reference video frames inside `MiniMaxH3ReferenceToVideo`, so the text conditioning differs for every clip and is not cacheable.
Real handler on an RTX PRO 6000, 3 clips of 5 s at 480p: results arrived 91.8 s, 174.8 s and 258.4 s after the job started (81, 86 and 84 s of generation each), clip 1 available while clip 2 was generating.

## GPU profiles (`gpu_profile.py`)

Profile fields: attention backend, VRAM mode, reserve, max megapixels, tiled VAE decode, torch.compile backend, weight quant. Env overrides for benchmarks: `SWAP_PROFILE`, `SWAP_ATTENTION`, `SWAP_VRAM`, `SWAP_COMPILE`, `SWAP_QUANT`, `SWAP_DYNAMIC_VRAM`, `SWAP_MAX_MP`, `SWAP_VAE_TILED`, `SWAP_GPU_OVERRIDE="name|9.0|80"`.
If the first job on a non-safe profile raises (not a bad request), the runtime relaunches ComfyUI with the safe profile, retries the clip once and reports `profile_path=safe-retry` with the original error in `fast_path_error`; later failures are not retried.
That path ran for real twice on an RTX PRO 6000 (`SWAP_COMPILE=inductor` fails: no C compiler in the image; `cudagraphs` fails inside ComfyUI) and produced the clip on the safe profile.

| profile | matches | attention | VRAM mode | max MP | tiled VAE | verified |
| --- | --- | --- | --- | --- | --- | --- |
| blackwell-ws-96 | sm_120, >=90 GB (RTX PRO 6000 Server/Workstation) | ck | normal | 0.98 | no | RTX PRO 6000 Server |
| blackwell-ws-48 | sm_120, 48 GB (RTX PRO 5000) | ck | normal | 0.98 | yes | no |
| blackwell-dc-180 | sm_100/sm_103 (B200, B300) | ck | normal | 0.98 | no | B200; sm_103 runs sm_100 cubins, untested |
| hopper-80 | sm_90, <130 GB (H100) | ck | normal | 0.98 | no | older README runs, not re-run on this code |
| hopper-141 | sm_90, >=130 GB (H200) | ck | normal | 0.98 | no | H200 |
| ada-48 | sm_89 (L40S, L40, RTX 6000 Ada) | ck | normal | 0.98 | yes | L40S |
| ampere-80 | sm_80/86, 70-90 GB (A100 80 GB) | ck | normal | 0.98 | no | A100 PCIe |
| ampere-48 | sm_80/86, 48 GB (A40, RTX A6000) | ck | normal | 0.98 | yes | no |
| safe | any other GPU, and the fallback | ck | normal | 0.98 | no | all of the above |

What the measurements decided (RTX PRO 6000 Server, 5 s clip, 480p, 20 steps + EasyCache 0.12, second clip so weights and kernels are warm):
`ck` attention 76.5 s vs `sdpa` 116 s (ck is 34% faster; `flash_attn` and `sageattention` are not installed in the image); `--highvram` 81 s (6% slower, and no gain on H100); `--disable-dynamic-vram` 82 s;
`fp8_scaled` Ref2VA (21 GB, loads and runs on sm_120) 81.7 s vs int8 convrot 76.5 s, so int8 stays; torch.compile `inductor` and `cudagraphs` fail and fall back. No profile therefore differs by speed flags today:
profiles differ in what they guard (tiled decode on 48 GB cards, VRAM caps) and are where a faster path goes once one exists. openkernels and omniserve-native-* were checked and not integrated: they hold LLM decode
kernels (muse_*) and an OMatte kernel, nothing for int8 convrot GEMM, bidirectional video attention or the video VAE, and `sample` (attention + GEMM) is 77% of a clip while decode is 4%.

## Speed and cost per 5 s clip (124 frames, 24 fps, two characters in one reference image, standard tier)

Measured on RunPod secure-cloud pods with the new worker code. Warm = second clip on the same ComfyUI process. $/s is the RunPod serverless price (runpod.io/pricing, hourly / 3600, read 2026-10-27); the pods themselves were billed at pod rates.
480p = 0.4 MP (832x480), 768p = 0.98 MP (about 1312x736 for this source).

| GPU (profile) | 480p s warm | 768p s | serverless $/s | $/clip 480p | $/clip 768p | pod up, then weights + ComfyUI |
| --- | --- | --- | --- | --- | --- | --- |
| RTX PRO 6000 Blackwell Server 96 GB (blackwell-ws-96) | 76.5 | 313.6 (first job, older code) | 0.000969 | 0.074 | 0.304 | 2.5-5 min, then 62-113 s |
| L40S 48 GB (ada-48, tiled VAE) | 184.4 | 683.7 (365.7 at 0.66 MP) | 0.000486 | 0.090 | 0.332 | 140 s, then 406 s |
| H100 80 GB (hopper-80) | about 92 (estimate, see the 4.5 s run below) | about 356 (estimate) | 0.001331 | 0.122 | 0.474 | not measured here |
| A100 80 GB PCIe (ampere-80) | 197.1 | about 808 (estimate: 480p x 4.1) | 0.000756 | 0.149 | 0.611 | 111 s, then 118 s |
| H200 141 GB (hopper-141) | 90.8 | 375.1 | 0.001647 | 0.150 | 0.618 | 92 s, then 249 s |
| B200 180 GB (blackwell-dc-180) | 75.7 | 317.7 | 0.002400 | 0.182 | 0.762 | 89 s, then 105 s |
| RTX 6000 Ada, L40 (48 GB) | not run; same AD102 die as the L40S, expect about its numbers | | 0.000486 | about 0.09 (estimate) | about 0.33 (estimate) | |
| RTX A6000, A40 (48 GB) | not run; estimate 2.3x slower than L40S from bf16 FLOPs | | 0.000339 | about 0.14 (estimate) | about 0.5 (estimate) | |

Per-stage seconds, RTX PRO 6000, 480p warm: prep 0.3, load 1.1, encode 10.2, sample 58.4, decode 3.4, save 2.8 (total 76.5). The B200 and H200 do not beat the RTX PRO 6000 although they have several times its tensor throughput and bandwidth:
the swap graph (int8 convrot GEMMs through comfy-kitchen plus the `ck` attention) does not scale with them, so the cheapest card per clip is the RTX PRO 6000, then the L40S. 768p on the 48 GB L40S needs the tiled VAE and ran without OOM at 0.98 MP.
Swap quality is unchanged across cards; swapscore on the first 5 s of rapviddario with one reference image (the two characters share it, so identity is only indicative): LoRA 768p 60 WARN, LoRA 480p 64 WARN, fal H3 768p 44 FAIL
(pose 66/81/57, framing 59/75/46). The LoRA output keeps the source framing and motion; its dark studio background comes from the reference frame, which swapscore counts as background drift.

gpuTypeIds are ordered by $/clip among verified types, unverified types last (`gpuTypesUnverified` in `config/runpod-h3-swap.json`: RTX PRO 6000 Workstation, A100 SXM, RTX 6000 Ada, L40, RTX A6000, A40; never run by us).
RunPod's REST docs say "The order of the list determines the order to rent GPU types". Observed on a scratch endpoint: a list is stored in the order given when its types sit in different pools, but a 4-type list mixing L40S, RTX 6000 Ada and RTX PRO 6000 came back
reordered (6000 Ada, L40S, PRO 6000, A40), so treat the order as a preference and read it back (`scale_pool.py order` warns when it differs). RunPod's serverless list also rejects RTX PRO 5000 Blackwell and B300 (silently dropped on write).

## Why the endpoint had no workers on 2026-10-27

`allowedCudaVersions: ["13.0"]` on the endpoint (and on pods) matches hosts that report CUDA 13.0 exactly. The REST enum stops at 13.0, but new capacity runs driver 595 (CUDA 13.2). On the pod API that filter returned
"no instances currently available" for every GPU type tried (RTX PRO 6000, H100 x3, H200, B200, A100, L40S, A40, A6000, 6000 Ada, ...) and the same GPU types were obtainable seconds later without it. A scratch endpoint with `minCudaVersion: "13.0"` and no
`allowedCudaVersions` had a worker initializing 14 s after the first job and served it. Fix: `scale_pool.py cuda --apply` (PATCH `{"allowedCudaVersions": [], "minCudaVersion": "13.0"}`; an empty list clears the filter, verified on a scratch endpoint), and `minCudaVersion` in the config.
The same `["13.0"]` filter is set in config/runpod-h3-orbit.json, config/runpod-ltx.json, tools/fightswap/fightswap/pod.py and results/pinkcherry-opt/launch.py and probably starves those lanes the same way.

## Cold start and the 9.5 GB image

Pod create to container up (image pull included) on four hosts: 89-140 s (H200 92, B200 89, A100 111, L40S 140); the RTX PRO 6000 host that never came up in September needed 25+ min, the ones used today 2.5-5 min.
Weights arrive at 225-974 MB/s depending on the host (62 s to 406 s for 44.7-50.5 GB). Levers, in order of effect: the 5.9 GB of extra Turbo LoRAs are now fetched on demand; the new image is a thin overlay on r4, so a host that already pulled r4 downloads kilobytes;
the pool is ordered cheapest first; `flashboot: true` revives a stopped worker without pulling. Not done: a network volume would hold the weights (`/runpod-volume/h3-swap-models` is used automatically when mounted) but pins the endpoint to one datacenter and removes the stock
diversity that matters most today; slimming the image would need about 12 GB of local disk the build machine does not have, and the only removable weight (FaceRefine 715 MB, onnxruntime 445 MB) is about 12% of the pull.

## Capacity-aware dispatch (server/character_swap_lora_dispatch.go, character_swap_lora_fallback.go)

Clips are cut and uploaded once, then packed into batches of at most 6 clips, one batch per available worker (`/health`: idle+ready+running+initializing, else a cold-pool target of about 6 GPU-minutes of work per worker, capped by `H3_SWAP_WORKERS_MAX`, default 4).
Each pass re-reads health, retries only the clips that failed (3 attempts per clip, new seed per retry), and follows every batch through `/stream` and `/status`. A queue with no worker for `H3_SWAP_QUEUE_GRACE_SECONDS` (default 240), or workers initializing for `H3_SWAP_INIT_GRACE_SECONDS` (default 900) with none serving,
cancels the queued jobs. Before the first submit, if no worker is up and every GPU type of the pool reports no stock in RunPod GraphQL, the job fails at once (`H3_SWAP_STOCK_PRECHECK=0` disables that check).
On a capacity failure the job runs on the fal H3 character swap lane (768P, the default kind's pipeline) when `FAL_API_KEY` is set and `H3_SWAP_FAL_FALLBACK` is not `0`; the charge is `min(LoRA quote, fal 768P price)`, so it never exceeds the estimate shown.
Without fallback the job fails after the grace (about 4 min, not 90) with "GPU capacity ... unavailable ... not charged". Recast jobs never fall back a second time. `H3_SWAP_BATCH=0` sends one old-style single-clip job per clip (use it with a worker image older than r6).
Deploy order: worker image and template first, server second (batch input needs a worker that understands `clips`).

## Images and rollback

- r4 `ghcr.io/lee101/h3-swap:cu130-20261001-r4`: production today, template jm5rc2f10w; keep it as the rollback (template update back to r4, and `H3_SWAP_BATCH=0` on the server).
  r4 predates the relay module: the old `.dockerignore` never copied `swap_relay.py`, which the current `swap_runtime.py` imports.
- r5 (`cu130-20261027-r5`) was the first overlay build; its handler delivered a clip only after the next clip finished. Superseded by r6, do not use.
- r6 (`cu130-20261027-r6`, sha256:4930986c...): GPU-verified candidate (pod harness on RTX PRO 6000, endpoint run on RTX PRO 6000 with the stream shape the server parses).
- r7 (`cu130-20261027-r7`, sha256:755ba2e5...): r6 plus `{"event":"boot","seconds","weights_gb","weights_total_gb"}` items every 15 s while the worker is still loading, so `/stream` shows a cold start instead of silence; unit-tested and import-smoked in the image only. Server ignores these items.
  Both are built `FROM` r4 (`docker build -t ghcr.io/lee101/h3-swap:cu130-20261027-rN workers/h3-swap`). The production template is still on r4: it is not switched until the server is deployed (see Deploy order), and the second-GPU endpoint run
  failed to finish (below).
- Endpoint cold starts are the weak spot: of five cold workers on the scratch endpoint, one finished in 4.3 min (r4), one in 13.5 min, and three had produced no clip after 15, 30 and 31 minutes (two L40S/RTX hosts; the job was cancelled). The same image on pods fetched the weights in 62-406 s, so the cause is
  most likely a slow weight download on those serverless hosts, not the handler; r7's boot events will show it (`weights_gb` stuck). Until that is known, a cold L40S worker should not be trusted inside a 4 minute grace.
- torch 2.11+cu130 ships sm_75/80/86/90/100/120 SASS: sm_89 runs the sm_86 cubins, sm_103 runs sm_100, sm_121 runs sm_120. Run on sm_80, 89, 90 (earlier), 100, 120.

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

## V1.5 and Turbo variants (H100, 5 s clip, 832x480, seed 7, 2 characters in one reference image)

The worker now defaults to `h3_character_swap_v1.5.safetensors` (strength 1.0, sha256 8f2c3c3e...) and accepts
`turbo` as a key (`ref2v4`, `ref2v8`, `fl2v4`, `fl2v8`; `true` still means `ref2v4` at 4 steps) plus `sampler` / `scheduler`.
The extra Turbo LoRAs come from `lightx2v/Minimax-h3-Turbo` (pinned revision, sha256 in `swap_weights.py`).

| setting | wall s | note |
| --- | --- | --- |
| 20 steps + EasyCache 0.12 | 129 | reference quality |
| ref2v4 (v0.1), 4 steps | 58 | previous fast tier |
| ref2v8 (v1.0 768p), 8 / 6 / 4 steps, er_sde + normal | 86 / 72 / 57 | all visually match the 20-step run; 6 steps is the pick |
| fl2v8, 6 steps / fl2v4 v1.2, 4 steps | 72 / 58 | similar, no better than ref2v8 |
| ref2v8, 6 steps, 1088x608 (0.66 MP) | 119 | much sharper faces; best quality per second |
| ref2v8, 6 steps, 1344x768 (0.98 MP) | 199 | background drifted from orange to brown, not used |

Long generations straddling a hard cut in the source drift (background colour, ghosting at a crossfade). Cut the source at
scene changes (ffmpeg `select='gt(scene,0.12)'`) and generate each shot on its own; hard-cut the results.
The 17n+5 grid is now sized on 24 fps frames: a 30 fps 5 s clip used to get 158 frames (1.5 s of held padding), now 124.
