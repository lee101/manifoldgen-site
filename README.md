# ManifoldGen

## API key administration

User API keys use the recognizable `sk-mg-` prefix. Run `gitleaks detect --config .gitleaks.toml` locally or add that command to CI to catch committed keys. GitHub Secret Scanning does not automatically recognize private formats; the `sk-` prefix helps generic detectors, while the included Gitleaks rule is the enforceable project check.

Set `MANIFOLD_ADMIN_API_KEY` only in the server environment. It is a separate `sk-mg-admin-...` credential and is never returned by the API. An administrator can mint an email-backed account key or invalidate its previous key:

```bash
curl -X POST https://manifoldgen.com/api/admin/api-keys \
  -H "Authorization: Bearer $MANIFOLD_ADMIN_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"email":"leepenkman@gmail.com"}'

curl -X POST https://manifoldgen.com/api/admin/api-keys/rotate \
  -H "Authorization: Bearer $MANIFOLD_ADMIN_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"email":"leepenkman@gmail.com"}'
```

The rotate endpoint returns the replacement once and immediately invalidates the old user key.

Dark-mode AI video studio at [manifoldgen.com](https://manifoldgen.com).

## MCP and Codex skill

The hosted Streamable HTTP MCP endpoint is `https://manifoldgen.com/api/mcp`.
It exposes pricing, semantic media search, credit-backed generation, and durable
job retrieval using the same `MANIFOLDGEN_API_KEY` as the REST API. This
repository includes a project MCP configuration, and Codex Infinity bundles a
`manifoldgen-platform` system skill with repository and spend-safety guidance.
See [the MCP and skill guide](docs/manifoldgen-mcp-and-skill.md).

## Local checks

Install the tracked Git hooks once with `make hooks`. Commits run fast Go
format/tests and frontend type checks. Pushes that touch frontend or browser-gate
files additionally run the fast mocked Studio browser suite; server-only and
docs-only pushes skip Chromium. The GPU/WebGL export benchmarks remain in the
full browser suite run by CI. Use `make check-fast` or `make verify` to run
those fast gates manually; `make test-studio-full` runs the complete browser
suite.

Built on the same Go fasthttp + Postgres + Stripe stack as CuteDSL / app.nz,
focused on H3 video (app.nz cogs) with optional omniserve-native LTX.

## Stack

| layer | tech |
| --- | --- |
| API | Go + fasthttp (`server/`) |
| DB | Postgres (`users`, `video_jobs`, Stripe cols) |
| Billing | Stripe checkout + webhook, prepaid credits + monthly/annual |
| Video | `h3_video` via `APPNZ_*` (estimated up front, settled from actual compute) |
| UI | Next.js dark full-bleed studio, settings cog, prompt box |

## Quick start

```bash
cp .env.example .env
# create postgres role/db manifoldgen
make install
make server      # :8116
make frontend    # :3006, proxies /api → :8116

# HTTPS frontend for browser/auth testing
make dev-https   # https://manifoldgen.local:3006, proxies API calls to production
# To exercise the local API over HTTPS instead:
MANIFOLDGEN_API_ORIGIN=http://localhost:8116 make dev-https
```

Production-backed HTTPS dev keeps its browser login separate from the local API login.

For the friendly local hostname, add this once to `/etc/hosts`:

```text
127.0.0.1 manifoldgen.local
```

The HTTPS command creates a short-lived self-signed certificate in `.local-certs/`.
Accept the browser warning locally, or replace the generated files with a trusted
certificate from `mkcert`.

## Pricing

H3 settles from app.nz `costMicros` with `h3DownstreamMarkupPercent = 50`,
giving a 33% gross margin before fixed costs. The minimum video charge is $0.10.
The customer-facing estimate uses a measured 5-second native baseline and scales
with output duration, steps, and size; the final job response reports actual cost.

Override with `H3_VIDEO_PRICE_USD_PER_GPU_HOUR`.

## Email drip + SES

Onboarding drip lives in `emails/` (same pattern as Netwrck). From address defaults
to `lee.penkman@netwrck.com` via shared AWS SES SMTP env:

```bash
AWS_REGION=us-east-1
AWS_SMTP_USERNAME=...
AWS_SMTP_PASSWORD=...
SES_FROM_EMAIL=lee.penkman@netwrck.com
SES_FROM_NAME=ManifoldGen
```

Password reset: `POST /api/auth/forgot-password` → email link → `/account?reset_token=...`
→ `POST /api/auth/reset-password`. Set `EMAIL_DEBUG_RESET_TOKEN=true` in DEV to return
the token in the API response for local testing.

## Gallery seed

```bash
# Publish existing demos + remux LTX onto manifoldgenstatic, then gobed reindex
python scripts/publish_gallery_videos.py

# Local accelerated H3 on the host 5090 (bypasses RunPod quota)
# Temporarily frees VRAM if needed, then:
python scripts/gen_gallery_local.py --count 3
python scripts/gen_gallery_local.py \
  --prompts scripts/prompts/manifold-gallery-100k.jsonl \
  --count 5000 --shuffle-seed 20260810 --stop-when-done
python scripts/gen_gallery_local.py --stop

# Queue via API (app.nz, or H3_LOCAL_COG_URL when set)
python scripts/backfill_seed.py --images 0 --videos 8
```

## Gallery art farm

The public image catalog is generated from a deterministic, family-safe prompt
set and is safe to resume on any machine sharing the database and R2 bucket.
The renderer stops before its local spool falls below the configured free-space
floor. Publish before indexing so every searchable image is immediately CDN
loadable; run moderation continuously in a second process.

```bash
# Optional licensed prompt augmentation. This downloads prompt text only and
# drops explicit, child-related, branded, watermark, and URL-heavy rows before
# they reach an image worker.
python3 scripts/import_prompt_sources.py \
  --out scripts/prompts/manifold-gallery-augmented.jsonl

python3 scripts/build_gallery_catalog.py --kind image --count 100000 --seed 20260810 \
  --out scripts/prompts/manifold-gallery-100k.jsonl
nice -n 19 python3 scripts/generate_gallery_art.py \
  --prompts scripts/prompts/manifold-gallery-100k.jsonl --limit 500 \
  --images-dir /sdb-disk/manifoldgen-images \
  --low-priority --upload-r2 --min-free-gib 80 \
  --moderate-before-index --reindex-after

# Motion-specific catalog for bounded, resumable API video batches
python3 scripts/build_gallery_catalog.py --kind video --count 10000 --seed 20260810 \
  --out scripts/prompts/manifold-gallery-videos-10k.jsonl
python3 scripts/backfill_seed.py --images 0 --videos 8 \
  --video-prompts scripts/prompts/manifold-gallery-videos-10k.jsonl
```

The scripts are deliberately bounded by `--limit`; schedule repeated batches
after confirming the first set looks good. Unclassified files are held out of
semantic search and the public gallery, and NSFW/child content is excluded from
the public gallery. Multiple local workers can safely share the same database:
each prompt is protected by a PostgreSQL advisory claim, so DAISY, Leetop, and
the production GPU can consume different slices without duplicate renders.
Catalog rows are deterministically shuffled across subject, style, light,
palette, motion, camera, and sound axes, so small batches remain visually
varied. Video queueing skips prompts that are already queued, running, or
completed.

Gallery CDN: `https://manifoldgenstatic.manifoldgen.com/gallery/videos/…`

When RunPod `workersMax` quota is hit, set `H3_LOCAL_COG_URL=http://127.0.0.1:18089`
after `gen_gallery_local.py` has started the cog.

The two direct H3 endpoints follow `config/runpod-h3.json`: zero minimum
workers, five-second idle shutdown, FlashBoot, a bounded one-hour execution
window, and `/src/rp_handler.py` as the native queue handler. Do not run the Cog
HTTP command on a queue endpoint; provider cancellation can mark that wrapper
canceled while its inner prediction continues consuming a GPU.

`gen_gallery_local.py --prompts` accepts JSONL rows with `prompt`, optional
`slug`, and optional `seed`, or one plain prompt per line. Catalog IDs are
deterministic, completed rows are skipped on resume, temporary WebMs are removed
after R2 upload, and `--stop-when-done` releases the local GPU worker. Keep large
batches on the local generator unless their RunPod budget has been explicitly
approved; at the current measured H3 runtime, 5,000 serverless clips would cost
roughly thousands of US dollars before storage and egress.

## Video restyle

`video_restyle` supports Wan 2.2 video-to-video controls and ordered H3-style
image/video/audio references. Requests prefer the private app.nz/RunPod template
from `VIDEO_RESTYLE_APPNZ_MODEL_ID` (or `VIDEO_RESTYLE_APPNZ_TEMPLATE`); failed submissions or worker executions move
to the standby queue without changing the public job ID. Standby costs are settled
with a 20% multiplier. Configure the private endpoint from
`config/runpod-video-restyle.json`: zero minimum workers, 30-second idle scale-down,
FlashBoot, and shared cached weights keep idle spend at zero without mixing the Wan
weights into the warm 32 GB H3 process.

## Character animation

`/tools/character-animator` sends a character image and a one-person driving
video to Wan-Animate-2 through the shared OmniServe endpoint. The default is the
official 10-step distilled checkpoint; OmniServe chooses NF4/offload or the
larger compiled BF16 lane from current global GPU headroom.

Set `WAN_ANIMATE_RUNPOD_ENDPOINT_ID` to the OmniServe endpoint (falling back to
`OMNISERVE_RUNPOD_ENDPOINT_ID` and then the video-background endpoint).
`WAN_ANIMATE_GPU_HOURLY_USD` controls measured-time settlement and
`WAN_ANIMATE_ESTIMATE_USD` controls the public five-second estimate. Results
upload directly to a per-job presigned R2 target.

## Video background removal

`video_background_removal` accepts a public source URL up to 30 seconds and
returns a durable transparent VP9 WebM job. When
`VIDEO_BACKGROUND_NATIVE_BASE_URL` is configured, the API submits to the local
OmniServe video queue first, spills a full local queue to RunPod without opening
the health circuit, and finally uses FAL BRIA as the general-matting standby.
Without a native worker it starts at `VIDEO_BACKGROUND_RUNPOD_ENDPOINT_ID`.
Two genuine submission/status failures open a 90-second circuit.

The GPU worker and endpoint definition live in the sibling `omniserve-native`
repository. Manifold submits its explicit `video-matting` workload and retains
only durable product-job identity, billing, presigned uploads, circuit breaking,
and FAL standby. OmniServe keeps source RGB pixels and infers only the recurrent
alpha field; it also provides content-addressed cache locking and a generic
native queue shared with other workload kinds. The compatibility command
`scripts/deploy-video-background-runpod.sh` delegates to OmniServe; set
`OMNISERVE_NATIVE_ROOT` when the repositories are not adjacent. Netwrck can
retain its existing $0.10/second customer price by setting
`VIDEO_BACKGROUND_REMOVAL_RATE_USD_PER_SECOND=0.10` on the ManifoldGen service
account used by that route.

The serverless endpoint uses request-count scaling with one worker per queued or
active job, a three-worker ceiling, and zero minimum workers. This avoids
queue-delay overscaling during a long cold start while preserving bounded
parallel throughput.

RVM is GPL-3.0 research software; replace it with an appropriately licensed
matting engine or complete the licensing review before commercial deployment.

## Deploy

See `deploy/manifoldgen.service` and `deploy/nginx-manifoldgen.conf`.
`./deploy.sh` installs the server binary, syncs `frontend/out`, and rsyncs `emails/`.
Set `DIST_DIR` to `frontend/out` after `NEXT_OUTPUT=export bun run build`.

## Monitoring

`monitoring/` runs confirmed-error-gated frontend and backend checks plus a real
H3 video canary every 12 hours. Repair agents use `gpt-5.6-sol` at high reasoning
and start only for deduplicated, confirmed failures. See
[`monitoring/README.md`](monitoring/README.md) for schedules, safeguards, and
manual check-only commands.

## Visualbench

Desktop + mobile screenshots live in `visualbench/`.

```bash
cd frontend && bun run dev -- --port 3219
# other terminal
VISUALBENCH_BASE_URL=http://127.0.0.1:3219 node visualbench/capture-studio.cjs

# Capture only the gallery-to-Studio handoff at desktop and mobile sizes.
VISUALBENCH_BASE_URL=http://127.0.0.1:3219 VISUALBENCH_GALLERY_ONLY=1 \
  node visualbench/capture-studio.cjs
```

## CI

Every pull request and push to `main` runs secret scanning, Go module/format/vet/race/build checks, a production frontend build (including TypeScript validation), and mocked Playwright coverage for the Studio and API docs. Browser traces and reports are retained for seven days on failure.

Run the closest checks locally with:

```bash
(cd server && go vet ./... && go test -race ./... && go build ./...)
(cd frontend && bun run build && bunx playwright test tests/e2e/studio-media.spec.js tests/e2e/api-pricing.spec.js)
```
