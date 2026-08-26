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

for easy tasks: ok use op harness subagent as in ~/code/dotfiles/subagents/op-deepseek.sh 'prompt' and test /check its work

Local HTTPS development:

    # Restart the HTTPS frontend, killing anything currently listening on :3006.
    fuser -k 3006/tcp 2>/dev/null || true; make dev-https

The HTTPS service on `https://manifoldgen.local:3006` is the Next.js frontend;
the Go API listens on `http://localhost:8116`. To restart both and use the local
Go API from the HTTPS frontend:

    fuser -k 3006/tcp 2>/dev/null || true; fuser -k 8116/tcp 2>/dev/null || true; (cd server && go build -o manifoldgen-server . && PORT=8116 DIST_DIR=../frontend/out ./manifoldgen-server) & MANIFOLDGEN_API_ORIGIN=http://localhost:8116 make dev-https

With `DEV=true` (set in `.env`, which the server loads itself) the local API
runs in light dev mode: the drip email scheduler and the gobed semantic search
indexes stay off, so no real SES emails are sent from dev and search endpoints
return 503. Set `DEV_FULL=true` in the environment to restore full parity.