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
python scripts/gen_gallery_local.py --stop

# Queue via API (app.nz, or H3_LOCAL_COG_URL when set)
python scripts/backfill_seed.py --images 0 --videos 8
```

Gallery CDN: `https://manifoldgenstatic.manifoldgen.com/gallery/videos/…`

When RunPod `workersMax` quota is hit, set `H3_LOCAL_COG_URL=http://127.0.0.1:18089`
after `gen_gallery_local.py` has started the cog.

## Deploy

See `deploy/manifoldgen.service` and `deploy/nginx-manifoldgen.conf`.
`./deploy.sh` installs the server binary, syncs `frontend/out`, and rsyncs `emails/`.
Set `DIST_DIR` to `frontend/out` after `NEXT_OUTPUT=export bun run build`.

## Visualbench

Desktop + mobile screenshots live in `visualbench/`.

```bash
cd frontend && bun run dev -- --port 3219
# other terminal
VISUALBENCH_BASE_URL=http://127.0.0.1:3219 node visualbench/capture.cjs
```
