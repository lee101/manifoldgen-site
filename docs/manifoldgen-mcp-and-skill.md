# ManifoldGen MCP and Codex skill

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
