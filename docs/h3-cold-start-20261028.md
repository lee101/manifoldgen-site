# H3 cold start and polling (2026-10-28, branch perf/h3-cold)

Nothing here is deployed. No RunPod endpoint settings were changed, and no paid jobs were run ($0 spent).

## What the data shows

Sources: RunPod REST (`/v1/endpoints`, `/v1/billing/endpoints` hourly), `/v2/<ep>/health`, the August `video_jobs` rows in the local DB mirror (79 completed H3 RunPod jobs, 08-13..08-24), and the prod journal. The prod journal only goes back to 10-27 23:47, and the prod root disk is 100% full (529 MB free).

- **The normal H3 RunPod lane has had no traffic since 2026-09-06.** Commit b8e73fd (09-06) sends plain H3 requests to fal H3 Max (`h3FalCanHandle`: 5-15 s, no audio, no loop, no more than 2 keyframes, no latent upscale). Billing for `snzfeqekxdmw1v` (cog-manifold-h3-normal) shows nothing after 09-06 06:00.
- Other H3-family RunPod lanes in the last 14 days: only h3-swap (character swap) on 10-27, with 3.3 billed hours and $12.06. PinkCherry last ran on 10-09, LTX on 10-01, turbo on 10-13. So there are no recent t2v jobs to measure a cold fraction on.
- The `/v2/<ep>/requests` and `/status` endpoints keep nothing for old jobs, and the prod DB is not readable by the deploy user. The per-request timeline below therefore comes from the August rows.

The live endpoint is `cog-manifold-h3-normal`: H100 PCIe/SXM/NVL billed at $4.80/h, image `h3-cog:cu130-20260826-face-judge-r7`, **no network volume, no model cache**, 100 GB container disk, `idleTimeout` 5, `workersMin` 0, FlashBoot on. The site also forces `workersMax` to 0 between bursts (h3_scale.go reaper).

August per-request timeline (79 jobs; `load` = `executionTime` − handler `total_seconds`):

| | jobs | load (s) | notes |
|---|---|---|---|
| cold (load > 30 s) | 42 (53%) | p25 138, **p50 163**, p75 249, max 2363 | `H3Runtime()` built inside the first job: R2 download of ~40 GB onto container disk, then ComfyUI boot, serially |
| warm | 37 | median 3.2 | runtime already up; nearly all of these queued behind a busy worker, none came from the idle window |
| isolated jobs (no overlap) | 17, of which 15 were cold | | wall − exec (queue, container start, polling, validation, upload) 6-241 s, median ~94 |

Generation at 896x512..672x124 frames, 12-20 steps: 29-51 s warm. The first job on a fresh worker spends about 8-15 s more inside generation, loading the safetensors into VRAM. The cold load is billed (it is part of `executionTime`): about **$0.20 per cold job** on top of about 150 s of user wait.

## Warm policy (recommendation; needs approval)

Cost basis: H100 at $4.80/h, so $0.00133 per second of idle.

| Policy | Idle cost | Effect |
|---|---|---|
| keep `idleTimeout` 5 (today) | ~$0 | every isolated request is cold |
| idle 60 s | up to $0.08 per burst | August replay: 0/79 requests would have hit a warm worker |
| idle 120 s | up to $0.16 per burst | August replay: 5/79 warm, +$12.6 over 79 jobs (~$0.16/job) |
| idle 300 s | up to $0.40 per burst | August replay: 19/79 warm (24%), +$30 (~$1.30 per saved cold start, minus $0.20 load saved) |
| `workersMin` 1 at peak (4 h/day) | $19/day ≈ $576/mo | always warm at peak; not justified at current volume |
| `workersMin` 1, 24/7 | $115/day ≈ $3,456/mo | no |

Recommendation:
1. **Fix the load first, not the idle window.** Attach the H3 weights to the normal endpoint, either as a RunPod model cache (`h3-cog` already resolves `/runpod-volume/huggingface-cache/hub`) or as a network volume in a datacenter with H100 stock (`weights_root()` switches to `/runpod-volume/models` automatically; ~60 GB at $0.07/GB-month ≈ $4/month). Then ship the worker patch below. Expected cold load: ~150 s → 30-60 s (volume read plus ComfyUI boot, overlapped). A volume pins the lane to one datacenter, so check H100 throttling there first. Do not bake 40 GB of weights into the image: host image pulls are just as slow on new hosts.
2. **Keep `idleTimeout` 5 for normal H3 while fal serves plain requests.** The RunPod lane only sees keyframe/loop/audio/upscale requests, which arrive at ~0/week. If that volume grows (e.g. people iterating on keyframe videos), set `H3_NORMAL_RUNPOD_IDLE_SECONDS=120` (the branch makes this a per-lane env: the reaper's grace and the `idleTimeout` written on every scale-up both follow it). Cost: up to $0.16 per burst.
3. No `workersMin` schedule.

## Changes on this branch

### 1. Worker (h3-cog) patch: `workers/h3-cog-patches/0001-h3-cold-overlap-boot-eager-init.patch`

`h3-cog` has 4.5K lines of uncommitted live code (r7 was built from that working tree), so the change ships as a patch against it rather than as a commit there. It passes `git apply --check` in `/vfast/data/code/h3-cog`.

- `H3Runtime.__init__` starts the R2/HF weight fetch in a thread and boots ComfyUI at the same time, so the cold path costs max(boot, fetch) instead of boot + fetch. ComfyUI re-scans model folders when a prompt is validated, the same assumption the h3-swap overlap (manifoldgen-site-opt 3de1ef2) makes. A fetch error terminates the booted ComfyUI and re-raises. `H3_OVERLAP_BOOT=0` restores the serial order.
- `rp_handler.py`, behind `H3_EAGER_INIT=1` (off by default):
  - builds the default runtime at container start and preloads the moderation classifiers (CPU) in parallel;
  - the first job's input downloads overlap that work, and the job then waits on a lock until the runtime is ready;
  - `_get_runtime` and `_get_moderation` are now lock-protected.
- Tests: 5 new tests (overlap ordering, fetch failure, disable switch, a single runtime under eager init, opt-in flag). The h3-cog suite passes: 199 tests, excluding the two torch-only files.
- Parity: same weights, same ComfyUI graph, same seed handling, so frames are identical warm and cold by construction. Before rollout, run one cold and one warm canary with a fixed seed and compare `metrics.output_sha256` (about $0.50 of H100 time).

### 2. Webhook instead of the 2 s RunPod `/status` poll (server, opt-in)

- `H3_RUNPOD_WEBHOOK_BASE_URL=https://manifoldgen.com` plus `H3_RUNPOD_WEBHOOK_SECRET` (at least 16 chars) adds a signed `webhook` to every H3 `/run` (`submitScaledH3RunpodJob`: video, music video, trailer, retries, H3 image).
- RunPod POSTs to `/api/runpod/h3-webhook?ep=…&sig=HMAC`, which wakes that job's watcher. The watcher still reads `/status` before settling, so the webhook body is never trusted.
- With the webhook on, the fallback poll is 15 s (`H3_RUNPOD_WEBHOOK_FALLBACK_POLL`). Without the env vars, the poll is the same 2 s as today.

### 3. Long-poll instead of the browser's 2-2.5 s poll (server + frontend, opt-in)

- `VIDEO_JOB_LONG_POLL=1`: `GET /api/video-jobs/{id}?wait=25&status=<last>` is held until the job leaves `status` or finishes, at most 25 s. It is woken by `notifyVideoJobChanged`, which runs on every `video_jobs` status write in db.go, with a 1 s DB re-read as a fallback. The reply is unchanged apart from an added `"long_poll": true`, which is set only while the job is still pending, so a client never spins on a terminal status it does not recognise.
- The home page `pollJob` and the generator workspace send `wait`/`status` and skip their sleep only when the reply is marked, so they behave exactly as today against a server with the flag off.
- The studio list refresh and `lib/studio-motion` still poll; they can adopt `lib/job-long-poll.ts` later.
- The app.nz `/api/cogs/predictions` layer is only used when no `H3_*_RUNPOD_ENDPOINT` is set, and prod sets them, so it is not on the prod H3 path.

Expected gain: about 1 s on average at the server layer and 1-1.25 s at the browser layer per request (the stack plan's -2 to -4 s), plus fewer status calls (one held request per 25 s instead of 10-12 polls). The final video is identical: the same R2 artifact and settlement path.

### 4. Per-lane warm window

- `h3EndpointIdleSeconds` now reads `H3_NORMAL|H3_PINKCHERRY|H3_LTX` `_RUNPOD_IDLE_SECONDS` (5-600, default 5).
- Behaviour is unchanged unless one of these is set; PinkCherry keeps its existing env.

## To enable (after approval)

1. Server env: `VIDEO_JOB_LONG_POLL=1`, `H3_RUNPOD_WEBHOOK_BASE_URL=https://manifoldgen.com`, `H3_RUNPOD_WEBHOOK_SECRET=<random 32+ chars>`. Then deploy the server and frontend.
2. Worker: `git apply` the patch in h3-cog, build an overlay image (Dockerfile.face-judge-overlay pattern), set `H3_EAGER_INIT=1` on the template, and run the cold/warm sha canary.
3. Endpoint: attach a model cache or network volume (step 1 of the policy).
