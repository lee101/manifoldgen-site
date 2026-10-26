# fightswap

Fight-scene character swap kit (Python, uv): `cd tools/fightswap && uv sync`. Built on `workers/h3-swap` (MiniMax H3 Ref2VA + Akatz swap LoRA v1.5).

```
uv run fightswap shots video.mp4 --start 215 --end 385 --out work      # shot cuts, subtitle flags, contact sheets
uv run fightswap detect project.json                                    # Gemini: who stands where per shot, framing wide/medium/close
uv run fightswap cards project.json                                     # costume-matched character cards (real | ghibli) from face photos
uv run fightswap run project.json --down                                # ONE pod, warm daemon, every shot queued, fetch, delete pod
uv run fightswap voice interview.wav --speaker "Name" --name elon       # Gemini picks solo-speech spans -> reference -> MiniMax clone
uv run fightswap assemble project.json                                  # hard cuts + original foley bed ducked under cloned-voice lines
```

`testvid/fight/project.json` is the worked example (Jackie Chan vs Brad Allan, "Gorgeous" 1999 -> Elon and Sam, Ghibli, 36.7 s).

## What the audit found (RTX PRO 6000 Blackwell 96 GB pod, 1248x544)

- Order matters: the LoRA replaces people left to right in the reference image, so the board is rebuilt per shot from detected order (`cast.board_for`).
- Costume-matched cards (white pullover + white trousers, black top + trousers) fix costume drift; portrait photos in suits made the swap change clothes. Gemini prints labels on cards unless told "no text".
- **Ghibli is the strong path.** Ghibli cards + the style prompt + 20 steps (EasyCache 0.12/0.15/0.9, ~200 s per 5 s clip) repaint characters and background plates; both faces swap.
  Close-ups need a head-and-shoulders board (`face=True`; the framing detector picks it).
- Photoreal identity swaps are weak in fast fight shots (Jackie's face survived at 6 steps and at 20 steps). Wide shots work; do not promise likeness on motion-blurred close-ups.
- Rejected: chained one-person-per-pass swaps (pass 2 recoloured the white top black, faces unchanged); LoRA strength 0.6 (barely anime); fal Wan 2.2 video-to-video restyle (mangled people); 6-step turbo for Ghibli close-ups (one face unchanged).
- Seed matters per shot: re-roll bad shots (`reroll` in project.json); seed 11 fixed the two weakest shots (painted sky, clean faces).
- The pushed image lags the repo (no `sampler` kwarg): `pod.sync_src` overlays `workers/h3-swap/*.py` and restarts the daemon.
- Voices: Gemini-chosen solo spans (4 x 12 s) -> MiniMax clone; speaker similarity (resemblyzer) own 0.64-0.90 vs other <= 0.63.

## Cost / capacity notes

H100 pods and serverless H100 workers had no capacity during the session; `pod.up` walks H100 -> H200 -> RTX PRO 6000 -> A100, SECURE then COMMUNITY (got RTX PRO 6000 at $1.69/hr). The serverless endpoint is kept at `workersMax=0`; `cloud.scale(n)` raises it, and `/run` answers ENDPOINT_PAUSED for ~10 s after a change. Everything for a session runs on one pod: the daemon keeps the model loaded (runtime start is ~7 min cold, weights are fetched on first start), so batch all shots, then `fightswap pod down`.

## Round 2 (photoreal, Alexander Wang / Tibo, original audio) - what changed and what it found

**Process upgrades** (from `../openkernels/rp.py` and the H3 notes): pod TTL + detached watchdog (`fightswap/watchdog.py`) and a per-day pod-minute cap
(`.budget.json`, `FIGHTSWAP_DAILY_MINUTES`); a warm daemon with a queue so a whole edit runs on one pod; per-shot cast detection with splitting where the cast
changes mid-shot (`pipeline.plan_edit`); single-person shots get a single-person board; an identity audit after every result (`verify.identity_score`, Gemini vs the reference
photos) with one automatic re-roll; fight-sounding voice FX (`fx.py`, `fightswap speak`: exertion tags + band-limit/room/breath chain; Gemini rated clean TTS 1/10, tagged
TTS 3/10, with the chain 6.5/10 for "mid-fight").

**Root cause of the weak photoreal swaps in round 1:** the worker sent the source only as a loose reference video. The LoRA is trained for a *masked edit* (SAM 3.1 finds and
tracks the selected person, the mask is expanded, only that region is regenerated). `workers/h3-swap/swap_relay.py` now builds the author's graph (h3-relay toolkit, pinned
commit, fetched at runtime because the node pack is GPL-3.0) and `generate_relay` runs it. It needs ComfyUI >= 0.37 (native Start/End loop nodes); the pushed image has 0.31, so the
pod upgrades it (`git checkout 79be670e...` + `pip install -r requirements.txt`). Before this fix NO photoreal face changed, even on the clean two-person wide shot.

**Measured (RTX PRO 6000 Blackwell, relay graph, 8 steps):** resolution 480 = ~32 s per source second per person pass (87 s for 2.7 s); 768 = ~58 s/s. Sol attention gave 3%
(212 vs 219 s); 12 steps 154 s vs 219 s for the old 20-step graph. Spectrum / FirstBlockCache nodes exist in the image (`swap_graph.build_swap_graph(spectrum=True)`) but were not benchmarked.

**What works:** Brad Allan -> Tibo in every Brad shot (identity audit 6.0-7.0, expression and motion follow the source); Alexander -> Brad's shot also works (cross test), so the
reference card is not the problem.
**What does not:** Jackie Chan -> anyone in 13 of 14 Jackie/duo shots (audit 3.0-5.7; only one clear bright facing close-up swapped). Tried: raw photo / bust card / full card, SAM subject
"person" vs costume text, Gemini-swapped first-frame anchor (anchor frames look excellent but H3 drifts back), 20-step vs turbo, pixelating the masked person in the video the model sees,
4 seeds. Working theory: the base model holds on to a very famous face it recognises in the source video, so a famous source performer is the hard case, not the target.

Next things worth trying: a larger sample of Jackie shots through the anchor path at 768 with more steps, extra anchors (every ~1 s via Gemini) instead of only frame 0, or generating the
Jackie shots with the Ghibli lane (which does work) and keeping photoreal for Brad's shots.
