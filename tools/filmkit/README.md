# filmkit

Anime / comic film production kit used for `testvids/physical`. Python (uv): `cd tools/filmkit && uv sync`.

| Module | What |
| --- | --- |
| `filmkit.images` | Qwen Image generate / Qwen Edit via omniserve-native, reference boards, Gemini + fal Nano Banana restyle |
| `filmkit.review` | DeepSeek (direct API, `reasoning_effort=max`) vision review of <=800px webp, `art_director` re-roll loop, `locate`, `review_audio` |
| `filmkit.art` | `generate_art`: Qwen loop then Google fallback, writes master + 800px webp |
| `filmkit.media` | FLUX 3 Max video (fal), TTS, generated SFX (cached) |
| `filmkit.animefx` | 28 anime/comic/GenAI effect layers, recipe engine, CLI |
| `filmkit.sfx` | synth anime/comic SFX + cue-sheet mixer |
| `filmkit.tools`, `filmkit mcp` | the agent tool table, served as MCP over stdio |

Env: `FAL_KEY`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY` (and `OPENROUTER_API_KEY` for bare model ids); `RA2_URL` for the local Qwen lane.

```
uv run animefx list --json
uv run animefx sheet frame.png sheet.jpg --fx 'surprise:at=0.1,dur=0.8,ease=decay' --fx 'onomatopoeia:text=ドキ'
uv run animefx video in.mp4 out.mp4 --recipe recipe.json
uv run filmkit tools --json
```

MCP client config: `{"command": "uv", "args": ["run", "--project", "tools/filmkit", "filmkit", "mcp"]}`.
