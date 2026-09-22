# lofiloop

Renders seamless looping "lofi environment" videos: a generated cover still is
given periodic parallax motion, an audio visualizer is composited over it, and
the soundtrack is crossfaded onto its own head so the muxed file wraps without a
click.

Three callers share this package, and they must not drift apart:

- `server/lofi_loop.go` — the `lofi_loop` service on `POST /api/service`
  (`manifoldgen.com/tools/lofi-loop`, `GET /api/lofi-loop/spec`).
- `cmd/makevideo` — the offline command line renderer.
- `lowfi-cli` — the batch CLI in `../lowfi-cli`, which drives `makevideo`.

## Loop contract

Frame `N-1` of the art layer is byte-identical to frame zero. Three rules make
that true, and all three are load-bearing:

1. **Frame count.** `-frames:v N` with `N = round(L * fps)`; `L` is then
   *defined* as `N/fps`, so the audio trim, the motion period, and the encode
   agree exactly.
2. **Periodic motion.** Every animated term is `sin(2*pi*n/Cycle)` where `Cycle`
   divides `N-1` (`BuildPlan` picks the largest such divisor), and frame offsets
   are wrapped in `floor()` so the half-pixel tie at `n = Cycle` resolves the
   same way as at `n = 0`.
3. **Reproducible filters only.** ffmpeg 4.4's `vignette`, `eq` with a per-frame
   expression, `colorbalance`, `curves`, and `colorchannelmixer` all return
   different pixels for identical input frames, which silently breaks the loop.
   The vignette and palette grade are therefore *baked into the still* once
   (`bakeArt`), and the per-frame chain is limited to `scale`, `crop`, `hue`,
   `zoompan`, `noise` (static pattern), and `blend`.

The audio wraps because the last `seam_seconds` of the loop window is
crossfaded into its first `seam_seconds`, so the tail already equals the head by
the time the player reaches it.

## Visualizer

The visualizer is fed the loop's own tail before the loop starts
(`vizWarmupSeconds`), then trimmed back: frame zero then sees a full analysis
window instead of the silent warm-up ramp, and its content lines up with the
loop's first sample. `blend` composites in RGB — blending in YUV applies screen
mode to the chroma planes too and washes the picture magenta.

Because a sliding analysis window can never be exactly periodic, a visualizer
render is *not* bit-identical at the seam the way the cover-only path is.
`Render` measures it instead of pretending: `Result.Loop` carries the decoded
first/last frame difference. With `VisualizerNone` the measurement is exact
zero.

## Looks

`spec.json` is the canonical catalogue (visualizers, blend modes, palettes,
motion presets, art-direction strings). It is embedded here, served verbatim at
`GET /api/lofi-loop/spec`, and vendored by `lowfi-cli` so the web tool, the CLI,
and the API describe the same product. Adding a visualizer means adding a graph
and, if it introduces a new look, a palette — no Go changes.

## Verification

```
cd server
FFMPEG_BIN=/usr/bin/ffmpeg go test ./lofiloop/          # unit + real 4s render
go build -o cmd/makevideo/makevideo ./cmd/makevideo
./cmd/makevideo --audio song.mp3 --out out --id song \
  --character "a lantern keeper in a moss cloak" \
  --scene "ashen grove at midnight, paper lanterns in fog" \
  --preset vigil --visualizer freqs --verify
```

The render test asserts byte-identical first/last frames for every motion chain,
so a filter that is not reproducible fails CI rather than shipping a seam.
