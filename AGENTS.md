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

Character Swap H3 lane (default kind, server/character_swap*.go): per-shot keyframes are the default when the video has >=3 shots (`max_quality:true` forces them on for 2 shots, `max_quality:false` keeps the single swapped frame). Each shot after the first takes a real source frame from mid-shot and swaps identities with OpenPaths gemini-nano-banana-2.1 (/v1/images/edits multipart, image[]=frame then the swapped frame, or up to 4 `reference_image_urls` character photos left to right; prompt pins positions, pose, crop, back views, no hats/chains/tattoos; $0.0336/image). Keyframes are checked by `charswap_exact.py shotcheck` (YOLO person count, left-to-right IoU, scale, face vs back view) plus the luna vision model, retried twice, best kept, failures fall back to the global frame; shots run 3 in parallel; fee $0.12 per extra shot (character_swap_shots.go). Every clip is then scored against its source segment with tools/swapscore (env CHARACTER_SWAP_SCORE_PYTHON + CHARACTER_SWAP_SCORE_SCRIPT, default `uv run tools/swapscore/swapscore.py` next to the binary or cwd, CHARACTER_SWAP_SCORE=false disables, CHARACTER_SWAP_SCORE_ARGS e.g. `--device cpu`, CHARACTER_SWAP_SCORE_MIN default 50): combined with the vision leak verdict, clips under the gate are regenerated up to twice and the best of <=3 attempts by score is kept (reason in the clip `qa_reason`); clips whose pose error stays above CHARACTER_SWAP_POSE_FLAG (0.5) are marked `flagged` (the Wan Animate exact lane is whole-video only, so there is no per-shot fallback); the final video is scored once more and the result carries `metrics` (overall, pose, framing, identity, lipsync, per_shot, verdict) plus `flagged_clips`. Missing script/interpreter or three straight failures log once and skip metrics. Optional lip-sync post pass (`params:{"lipsync":true}`): clips under CHARACTER_SWAP_LIPSYNC_MIN (45) lipsync score that show a large face get fal-ai/sync-lipsync/v2 ($3/min, commercial use, 'lipsync-2') against the clip's soundtrack and are kept only if the metric gains >=3 points without losing overall score; charged $0.10/s of kept clips, estimate carries the all-clips maximum. Background: each shot's wall colour is measured from its real frame (YOLO person boxes dilated, median Lab outside them; `charswap_exact.py shotinfo`) and written as a positive clause in the nano banana and H3 prompts (never phrase it as a negation: 'never a dark studio wall' made H3 go dark in 4 of 4 clips); `shotcheck` rejects keyframes with background dE > 18, and clips with swapscore background drift > CHARACTER_SWAP_BG_DRIFT (25) fail the gate and carry a score penalty. Job result `metrics` is always present: `{available:false,reason}` when scoring is skipped or fails, and every skip logs a `[character-swap]` line. H3 reference audio (`include_audio`) stays opt-in because it loosens motion. A clip with a keyframe gets only that keyframe (plus the previous clip's last frame inside the shot) as image references: adding the global swapped frame or identity crops pulls every shot back to the medium two-shot, and the prompt tells H3 that Video 1 is motion-only (otherwise 4 of 10 clips leaked the source performers). Measured on the 30 s rap video (swapscore overall / pose err / bbox IoU / repeated compositions): single frame 54.5 / 0.31 / 0.57 / 0.30, per-shot keyframes 63.3 / 0.17 / 0.79 / 0.16; lip-sync pass on 4 clips changed the syncnet lipsync metric 41->100, 38->100, 44->45, 44->23, so it stays opt-in and metric-gated.

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

Crazy Captions (/tools/crazy-captions): browser-side caption studio. POST /api/captions/transcribe (server/captions.go) takes one 16 kHz mono WAV chunk (<= 90 s, fits fasthttp's 4 MB body limit), calls Gemini (CAPTIONS_GEMINI_MODEL, default gemini-2.5-flash then gemini-3-flash-preview; 2.5 gives much tighter word times than 3 at minimal thinking) and returns word timings; 1 credit per chunk, refunded on failure. The browser cuts chunks at quiet points, then snaps phrases onto the real speech with the energy-based aligner in frontend/lib/captions/dsp.ts (model timestamps run 0.2-0.7 s late). Rendering is Canvas2D (lib/captions/render.ts, deterministic per timestamp so preview == export) and export is mediabunny H.264 + AAC (aac-encoder wasm fallback) to MP4, all local. A second subtitle track is supported: the browser groups caption pages and POSTs /api/captions/translate (Gemini) for one translated line per page, the renderer draws both tracks (English above French or any pair), and the caption files include a bilingual SRT.
