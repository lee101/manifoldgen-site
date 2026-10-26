# ManifoldGen CLI, MCP and agent skills

Agent setup in three commands:

```bash
npm i -g manifoldgen-cli        # source: cli/
mg auth login
npx skills add manifoldgen/skills   # source: skills/
```

## CLI

`cli/` builds a single-file Node CLI (`manifoldgen`, alias `mg`) with `bun build --target=node`. No runtime dependencies.

- `mg auth login` starts a listener on a random 127.0.0.1 port and opens `https://manifoldgen.com/cli-auth?port=PORT&state=STATE`. The signed-in user confirms; the page redirects to `http://127.0.0.1:PORT/callback?state=..&key=..`. The CLI checks `state` (constant time), verifies the key with `GET /api/auth/session`, then stores it in `~/.config/manifoldgen/config.json` (0600). `--no-browser` adds `paste=1`; the page then shows the key to paste. The page only ever redirects to 127.0.0.1 and validates port 1024-65535.
- `MANIFOLDGEN_API_KEY` overrides the stored key; `MANIFOLDGEN_BASE_URL` changes the host.
- `mg generate <service>` maps flags to the `POST /api/service` body: `--image/--video/--audio/--mask/--model` -> `*_url`, repeated `--model` -> `model_urls`, `--ref-image` -> `reference_image_urls`, `--param k=v` / `--params '{json}'` -> `params`, other `--kebab-case` -> `snake_case`. Local paths are uploaded with `POST /api/studio/assets/presign` + PUT. Jobs are polled at the returned `status_url` (default `/api/video-jobs/:id`) with backoff; `--out` downloads every media URL in the result.
- `mg pricing`, `mg services`, `mg job`, `mg jobs`, `mg search`, `mg mcp config`; `--json` on all.

Develop: `cd cli && bun install && bun test && bun run build`.

## Agent skills

`skills/<name>/SKILL.md` follows the skills CLI layout (`npx skills add <owner>/<repo>`; publish this folder as its own repo root `skills/`, or install from this repo). `manifoldgen` is the core skill (setup, spend rules, generate, jobs, MCP) and holds the single production-tool table; workflow skills defer to it: `destruction-studio`, `exploded-view`, `scene-builder`, `toon-shader`, `vectorize`, `shot-cleanup`, `image-fixer`, `shot-composer`, `motion-fx`, `beat-drop`, `motion-track`, `motion-score`, `color-grade`, `shader-fx`, `footage-sorter` (coming soon). The motion tools run a CPU Python worker (`workers/motiontrack`); see `docs/motion-tools.md`.

## Configure Claude Code and Cursor

```bash
claude mcp add --transport http manifoldgen https://manifoldgen.com/api/mcp --header "Authorization: Bearer $MANIFOLDGEN_API_KEY"
```

Cursor `~/.cursor/mcp.json`: `{"mcpServers":{"manifoldgen":{"url":"https://manifoldgen.com/api/mcp","headers":{"Authorization":"Bearer ${env:MANIFOLDGEN_API_KEY}"}}}}`. `mg mcp config` prints all snippets.

## MCP server

ManifoldGen exposes a stateless Streamable HTTP MCP server at:

```text
https://manifoldgen.com/api/mcp
```

It uses the same account API key and credit balance as the REST API. Public pricing and media search do not require a key; generation and account jobs use `Authorization: Bearer $MANIFOLDGEN_API_KEY`.

## Configure Codex

The repository includes `.codex/config.toml`. Export the key before starting Codex:

```bash
export MANIFOLDGEN_API_KEY=sk-mg-...
codex
```

Codex loads MCP configuration at session startup. Start a new session after changing the URL or environment variable. Do not put the key itself in `config.toml`.

For a user-level configuration, add:

```toml
[mcp_servers.manifoldgen]
url = "https://manifoldgen.com/api/mcp"
bearer_token_env_var = "MANIFOLDGEN_API_KEY"
tool_timeout_sec = 600
default_tools_approval_mode = "prompt"
```

## Tools

| Tool | What it does | Auth |
| --- | --- | --- |
| `get_pricing` | Returns current public price and credit data. | No |
| `search_media` | Semantically searches images, videos, or audio. | Optional |
| `generate_media` | Generates supported image, video, audio, and transformation jobs. | Yes; spends credits |
| `generate_media` (music) | `service: "music"` with `prompt`, optional `lyrics`, and `duration` 30–180 renders a full song. Keep `[Verse]`/`[Chorus]` tags on their own lines. | Yes; spends credits |
| `get_job` | Polls a durable video or audio job. | Yes |
| `list_jobs` | Recovers recent video or audio jobs. | Yes |

Production tools (`list_services`, `create_upload`, `wait_for_job`, `blender_destruction`, `blender_exploded_view`, `blender_toon_shader`, `blender_render_scene`, `image_to_3d`, `vectorize_image`, `remove_video_objects`) and workflow prompts are listed in `skills/manifoldgen/SKILL.md`.

The MCP tool response keeps the underlying REST response in `structuredContent.response` and its HTTP status in `structuredContent.status`. A REST 4xx/5xx response becomes an MCP tool result with `isError: true`; it is not a JSON-RPC transport failure.

Call `get_pricing` before generation when the current cost is unknown. Preserve the first returned job ID and poll it rather than resubmitting an expensive asynchronous request.

## Bundled skill

Codex Infinity packages the `manifoldgen-platform` system skill. It activates for ManifoldGen repository work and for live MCP media requests, documents credential/spend safeguards, and maps MCP tools back to the owning REST paths.

After rebuilding or installing Codex Infinity, the skill is installed under `$CODEX_HOME/skills/.system/manifoldgen-platform`. Use it explicitly with:

```text
Use $manifoldgen-platform to search for glass architecture references, check the current image price, and generate one approved image.
```

## Protocol surface

`POST /api/mcp` accepts JSON-RPC 2.0 and implements `initialize`, `ping`, `tools/list`, `tools/call`, and notifications. The endpoint is stateless and does not require a session ID. Requests are limited to 1 MiB. `GET /api/mcp` returns `405 Method Not Allowed` because this server does not offer an SSE stream.
