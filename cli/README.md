# manifoldgen-cli

ManifoldGen from the terminal and from AI agents. Zero runtime dependencies, Node 18+.

```bash
npm i -g manifoldgen-cli        # or: bunx manifoldgen-cli <command>
mg auth login                   # approve this computer in the browser
mg services
mg generate image --prompt "neon koi, ink wash" --out .
mg generate video --prompt "rain on a glass roof" --duration 5 --wait --out clips
mg generate destruction-studio --model vase.glb --param impact=ball --param quality=draft --wait --out fx
```

## Commands

| Command | |
| --- | --- |
| `auth login [--no-browser]` | Browser approval on a 127.0.0.1 callback; `--no-browser` prints a URL and accepts a pasted key |
| `auth status \| logout \| token` | Account and balance; remove stored key; print key |
| `pricing [service]`, `services` | Live prices |
| `generate <service> [flags]` | `--prompt`, `--image/--video/--audio/--mask/--model` (file or URL), `--ref-image` (repeatable), `--param k=v`, `--params '{json}'`, any `--key value`; `--wait`, `--out dir`, `--dry-run` |
| `job <id> [--wait] [--out dir]`, `jobs [--kind audio]` | Poll, download, list |
| `search <query> --kind images\|videos\|audio` | Semantic media search |
| `mcp config [--client claude\|codex\|cursor] [--show-key]` | MCP setup snippets |

Every command accepts `--json`. Local files are uploaded through presigned storage; async jobs are polled with backoff and outputs (MP4, PNG, SVG, .blend, .glb) downloaded to `--out`.

## Config

Key stored at `~/.config/manifoldgen/config.json` (mode 0600). `MANIFOLDGEN_API_KEY` overrides it; `MANIFOLDGEN_BASE_URL` targets another deployment.

## Agents

```bash
npx skills add manifoldgen/skills    # Claude Code, Codex, Cursor, ...
mg mcp config                         # or connect MCP directly
```

## Develop

```bash
bun install && bun test && bun run build   # dist/cli.js
```
