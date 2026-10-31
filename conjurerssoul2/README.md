# Conjurer's Soul 2: the extended trailer (4.5 min)

Builds on `../conjurerssoul/` (world, plot, character LOCK blocks are reused verbatim, never copied).
What changes here:

| Change | Where |
|---|---|
| Father dies and is resurrected when Orin (9) and Vesper (12) are children; the Guest has been wearing him for nine years | `bible/plot2.md`, `bible/kids.md` |
| Grittier, dirtier, harder-lit look | `bible/style2.md` |
| 28-shot, ~270 s script, spoken lines, reveals the full cast and the plot | `trailer/shots.json` (human-readable: `trailer/script.md`) |
| Music first, picture cut to the music's keypoints | `tools/audiokp` (Rust), `trailer/music.md` |
| Multi-pass generation and review, paid steps gated behind `--go` | `tools/gen.py`, `review/passes.md` |

## Order of work
1. `trailer/music.md` -> generate the score (Music3 or similar), save as `out/score.opus` (any ffmpeg-readable format).
2. `tools/audiokp/target/release/audiokp kp out/score.opus` (about 0.2 s for 2.5 min of opus) and
   `uv run tools/gen.py plan` snap the 28 cuts to beats and strong onsets, 6-14 s each (H3 Max accepts 5-15 s).
3. `uv run tools/gen.py stills` / `clips --go` / `review` / `assemble` — see `review/passes.md`.

H3 Max (fal `minimax/h3-max`, 768P) is $0.40/s list: a full pass of 270 s is about $108, each full re-roll the same. `gen.py` prints the estimate and refuses to spend without `--go`.

Rating and safety: adult-rated dark fantasy. Children appear only in the prologue, in grief and peril, never in any sexual or romantic context. All romance is between the 18- and 21-year-old adults.
