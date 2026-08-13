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
make dev-https   # https://manifestgen.local:3006
```

For the friendly local hostname, add this once to `/etc/hosts`:

```text
127.0.0.1 manifestgen.local
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
  --mixed-aspect --webp-quality 85 --low-priority --upload-r2 --min-free-gib 80 \
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
Catalog rows carry a deterministic mix of square, portrait, and landscape
dimensions; older prompt files can opt into the same mix with
`--mixed-aspect`. Catalog rows are deterministically shuffled across subject, style, light,
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
```
