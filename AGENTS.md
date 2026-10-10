ManifoldGen production is the same host used by the site deploy:

    ssh -o StrictHostKeyChecking=no administrator@93.127.141.100

The application checkout on production is /nvme0n1-disk/code/manifoldgen-site.
From this checkout, ./deploy.sh builds the frontend and server, installs the
service, syncs the static site and gallery assets to the manifoldgenstatic R2
bucket, and purges the ManifoldGen Cloudflare zone. Run it after frontend,
server, gallery, or deployment-script changes. Verify both:

    curl -fsS https://manifoldgen.com/api/health
    curl -fsS 'https://manifoldgen.com/api/images?skip_total=true&varied=true&per_page=1&allow_nsfw=true'

The agent-facing GEO mirror at https://geo.manifoldgen.com is served by the
same Go binary (host-routed in server/geo.go, content in server/geo/content/).
Articles are markdown with slug/title/description/read_when frontmatter; every
page also serves `.md` and Accept: text/markdown. Its vhost lives at
deploy/nginx-geo.manifoldgen.conf; DNS is a proxied A record on the CF zone.
Verify it after content or geo.go changes:

    curl -fsS https://geo.manifoldgen.com/llms.txt

The compact provider logo is published by that deploy at
https://manifoldgenstatic.manifoldgen.com/static/brand/logo-64.webp.

Precomputed translations: `make i18n-extract` regenerates
frontend/translations/en.json from the SEO data libs (lib/seo, blog articles,
guides, tools); `make i18n-fill` completes every non-English locale via
OpenRouter; `bun frontend/scripts/i18n-check.ts --lang de` gates coverage;
`make i18n-build` post-processes frontend/out into out/<lang>/ trees with
translated copy, rewritten internal links, localized canonicals and reciprocal
hreflang. deploy.sh runs i18n-build automatically after the frontend export.
The Go server serves /<lang>/… from those files (server/i18n_static.go) and
hard-404s unknown localized URLs; sitemap-pages.xml carries the hreflang
clusters (server/sitemap.go). Adding a language = one line in
frontend/scripts/i18n-config.ts LANGS + fill + build.

Character Swap LoRA lane (/tools/character-swap-lora, `kind=lora` on service character_swap_video): MiniMax H3
Ref2VA plus the Akatz swap LoRA on the RunPod endpoint named by H3_SWAP_RUNPOD_ENDPOINT_ID (server .env on prod); it scales to zero when idle.
Worker, image build and measured speeds live in workers/h3-swap (README) and config/runpod-h3-swap.json.

Character Recast (/tools/character-recast, `kind=recast`): fal minimax/h3-max/recast, one photo per person (max 4), 5-30 s, shots <=15 s. Priced 768P $0.66/s, 1080P $0.75/s (fal+20% floor, and above lora 768p standard because a fal failure falls back to the lora lane internally; character_swap_recast_test.go enforces both). Fallback and >15 s shots need H3_SWAP_RUNPOD_ENDPOINT_ID and a non-EU/UK/KR/US requester.

for easy tasks: ok use op harness subagent as in ~/code/dotfiles/subagents/op-deepseek.sh 'prompt' and test /check its work

Local HTTPS development:

    # Restart the HTTPS frontend, killing anything currently listening on :3006.
    fuser -k 3006/tcp 2>/dev/null || true; make dev

The HTTPS service on `https://manifoldgen.local:3006` is the Next.js frontend;
the Go API listens on `http://localhost:8116`. To restart both and use the local
Go API from the HTTPS frontend:

    fuser -k 3006/tcp 2>/dev/null || true; fuser -k 8116/tcp 2>/dev/null || true; (cd server && go build -o manifoldgen-server . && PORT=8116 DIST_DIR=../frontend/out ./manifoldgen-server) & MANIFOLDGEN_API_ORIGIN=http://localhost:8116 make dev

With `DEV=true` (set in `.env`, which the server loads itself) the local API
runs in light dev mode: the drip email scheduler and the gobed semantic search
indexes stay off, so no real SES emails are sent from dev and search endpoints
return 503. Set `DEV_FULL=true` in the environment to restore full parity.

360 Orbit Video (/tools/orbit-video, service `orbit_video`): MiniMax H3 FL2VA plus pablodawson's 360 Orbit LoRA at strength 1.0, one photo as first and last frame, 768 px, 73 frames, fixed $0.50. RunPod endpoint named by H3_ORBIT_RUNPOD_ENDPOINT_ID (server .env on prod); it scales to zero when idle. Worker and measured speeds live in workers/h3-orbit (README) and config/runpod-h3-orbit.json.

Image utilities: /tools/smart-resize uses fal-ai/smart-resize via service `smart-resize`, up to six unique target_sizes (WIDTHxHEIGHT, 64-2048 px per side), one PNG per size, $0.06 per request + $0.18 per size. /tools/image-background-remover uses fal-ai/birefnet via service `remove-background`, $0.03 per transparent PNG. Both use FAL_KEY, existing /api/service billing/refunds, PNG-preserving gallery storage, and the native image moderator. Unknown moderation results stay out of the safe semantic index.

RunPod cost controls: every /run submission carries policy.executionTimeout and ttl (server/runpod_policy.go; H3 scales with requested duration); metered H3, H3 image, Music3 and video-background jobs refuse to start when the balance is below the estimate (server/credit_preflight.go; metered H3 holds 60%); abandoned or timed-out jobs are cancelled on RunPod. H3 settles at provider cost x1.95 (h3DownstreamMarkupPercent=95), h3-control at x1.7. scripts/runpod_cost_guard.py also alerts on exhausted/low balance, daily direct-Pod spend, Pods over 6 h and unattached network volumes.
