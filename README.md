# ManifoldGen

Dark-mode AI video studio at [manifoldgen.com](https://manifoldgen.com).

Built on the same Go fasthttp + Postgres + Stripe stack as CuteDSL / app.nz,
focused on H3 video (app.nz cogs) with optional omniserve-native LTX.

## Stack

| layer | tech |
| --- | --- |
| API | Go + fasthttp (`server/`) |
| DB | Postgres (`users`, `video_jobs`, Stripe cols) |
| Billing | Stripe checkout + webhook, prepaid credits + monthly/annual |
| Video | `h3_video` via `APPNZ_*` (app.nz + **20%** markup ≈ **$2.688/GPU-hr**) |
| UI | Next.js dark full-bleed studio, settings cog, prompt box |

## Quick start

```bash
cp .env.example .env
# create postgres role/db manifoldgen
make install
make server      # :8116
make frontend    # :3006, proxies /api → :8116
```

## Pricing

H3 settles from app.nz `costMicros` with `h3DownstreamMarkupPercent = 20`
(same reseller math as CuteDSL). Display rate:

`0.89 × 1.80 × 1.4 × 1.20 ≈ $2.688 / GPU-hour`

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
python scripts/backfill_seed.py --images 24 --videos 0
```

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
