# captionburn

Headless burn-in of the **ManifoldGen caption engine** (`frontend/lib/captions`) onto a
video, so the same renderer that powers `/tools/crazy-captions` can be used from
scripts and agents with no browser.

```bash
cd tools/captionburn
bun install                     # once; @napi-rs/canvas
bun run src/cli.ts in.mp4 words.json --style viral-pop --out out.captions.mp4
```

`words.json` is `[{ "text": "muse", "start": 24.3, "end": 25.1 }, …]`
(or `{ "words": [...] }`; `energy` optional, 0–1, drives emphasis).

Useful flags: `--style <preset>` (any id in `frontend/lib/captions/styles.ts` —
`viral-pop`, `hifi-glitch`, `neon-karaoke`, `riot-scatter`, `brutal-block`,
`vhs-tape`, `chrome-y2k`, `soft-clean`, …), `--y` (0–1 anchor), `--size`
(percent of frame height), `--maxwidth` (0–1), `--font` (any `FontKey`),
`--crf`.

## How it works

| Piece | Detail |
| --- | --- |
| Engine | `CaptionEngine.render(ctx, w, h, t, source)` from `frontend/lib/captions/render.ts` — layouts, grouping, glitch/emphasis, punch/shake/vignette all come from the studio code path |
| DOM shim | `src/shim.ts` answers `document.createElement('canvas')` with `@napi-rs/canvas`; bunfig `preload` installs it before the engine module initialises (the engine builds its measure surfaces at import time) |
| Frames | decoded and re-encoded as raw RGBA over pipes to two ffmpeg processes, so nothing hits disk; audio is copied from the input |
| Fonts | `src/fonts.ts` fetches the OFL families the presets reference (Montserrat, Anton, Bebas Neue, Archivo Black, Bangers, Bungee, Russo One) into `fonts/` on first run |

Speed: ~21 fps at 1080×1920 on this box.

## Notes

- Whole-video only; to re-caption a section, cut it first and burn on the cut.
- The engine's punch/shake/vignette are part of the preset — they modify the
  *picture* too, not just the type. Pick a calmer preset (`soft-clean`,
  `brutal-block`) if the footage must stay untouched.
- Words are regrouped by the engine (default: 3 words / 28 chars per page,
  0.65 s pause break), so pass real word timings, not phrase timings.
