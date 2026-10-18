# Voice enhancer / lyric music worker

RunPod serverless worker behind `/tools/voice-enhancer` (`service: voice_enhancer`)
and `/tools/lyric-music` (`service: lyric_music`). A rough sung or rapped take, or
a TTS read of pasted lyrics, comes back as up to three mastered tracks:

| track | what it is |
| --- | --- |
| `voice` | the Manifold Music Generator (YuE2) re-performs the lyrics in the prompted style, then Seed-VC converts its vocal to the input singer's timbre and swaps it back into the mix |
| `studio` | the same render with the generator's own vocalist |
| `produce` | the input take itself: isolated, beat-locked onto the render's instrumental, rap vocal chain, mastered |

## Pipeline (`enhance.run_job`)

1. **Restore**: MelBand RoFormer vocal isolation + RoFormer denoise (de-reverb is
   optional; on the reference take it changed the vocal by 0.01 dB).
2. **Transcribe**: faster-whisper large-v3 with VAD and word timestamps. Conditioned
   decoding follows fast rap best but can loop ("Yeah." x 20); unconditioned never
   loops but drops chunks. Input STT falls back to unconditioned only on a detected
   loop; render scoring runs both and keeps the transcript closer to the lyrics.
   Pasted lyrics override STT as the reference and the lyric sheet.
3. **Plan-fitted render** (`yue_render.py`, run in the yue-cog interpreter): rap
   lyrics give the YuE planner no length cue, and its ABC came out at 176-380 s for
   about 140 s of lyrics; the surplus was filled with invented words (seed 7, seed 42
   past 2:29) or 30 s of empty vamp (seed 831001 after 2:22). The plan is generated
   with a 1,100-token cap, trimmed to the bars the lyrics need at 3.6 words/s (YuE
   raps these at 4.1-4.2) and closed with a 4-bar outro, so semantic generation stops
   early.
4. **Score and trim**: each render's vocal is transcribed and aligned to the lyrics in
   order (`lyrics.lyric_span`); the song is cut two bars after the last real lyric
   with a one-bar fade on a bar line. Seeds render two at a time (one for the lite
   lyric tier); a second batch runs only when no render reaches WER <= 0.35.
5. **Voice**: Seed-VC v1 singing model (44.1 kHz, f0-conditioned, 40 steps, cfg 0.7)
   with the densest 24 s of the singer's clean vocal as reference; the converted vocal
   follows the original's 80 ms loudness envelope inside the generator's own master.
6. **Produce**: word onsets snapped to acoustic onsets, assigned to 16th-note slots of
   the instrumental's beat_this grid by dynamic programming (cheap stretch in pauses,
   expensive inside phrases), rendered per phrase with Rubber Band, then the rap chain
   (gain riding, EQ, de-ess, two-stage compression, parallel grit, chorus doubles with
   louder line-end punch-ins, tempo-synced slap and plate) and a -9 LUFS master.

## Measured (reference: 3 x OBS clips of an a cappella diss rap, 177 s)

| | WER vs input STT | CE | PQ | speaker sim (resemblyzer / wavlm-sv) |
| --- | --- | --- | --- | --- |
| raw take | - | 2.5 | 3.5 | 0.97 / 0.96 (self) |
| studio (YuE vocalist) | 0.15-0.19 | 6.9-7.1 | 8.3 | 0.70 / 0.78 |
| voice (Seed-VC to singer) | 0.37 | 5.9-6.4 | 7.5-7.9 | 0.89 / 0.90 |
| produce (beat-locked take) | 0.15 dry, 0.26-0.30 in mix | 5.6-5.7 | 7.2-7.3 | the singer |

CE/PQ are Meta audiobox-aesthetics (1-10). Lyric-tool renders converted to clean TTS
voices scored CE 6.8-7.0 / PQ 8.2-8.3. On-beat onsets (within 30 ms of the 16th grid)
went from 42-45% to 70-71%. Rejected: Resemble Enhance raised CE to 6.6 but garbled
fast rap (WER 0.68); Seed-VC v2 lost intelligibility (WER 0.36, 0.71 with style
conversion); more SVC steps or the speech VC model were less intelligible.

Full 177 s job in the worker image on a shared RTX 3090 Ti: 393 s (analyse 59, two
renders 159, scoring 55, conversion 90, produce 21). The server prices from these
stage times (`voiceEnhancerGPUSeconds`) at 2x the expected GPU + TTS cost.

## Build and run

```bash
scripts/stage_image.sh /tmp/ve-image          # code, Seed-VC, every model weight (17 GB)
docker build --network host -t ghcr.io/lee101/voice-enhancer:<tag> /tmp/ve-image
docker run --rm --gpus all -e VE_DRY_UPLOAD_DIR=/work/out -v $PWD/t:/work \
  ghcr.io/lee101/voice-enhancer:<tag> python -u /src/ve/handler.py /work/job.json
```

`VE_DRY_UPLOAD_DIR` (tests only) accepts `file://` inputs and writes outputs locally
instead of to the presigned R2 URLs. The lyric task needs `TG_API_KEY` (lite/standard
TTS) and `OPENPATHS_API_KEY` (studio). Locally, `enhance.py` runs any stage from the
worker venv (`uv venv`; `requirements.txt`), with Seed-VC in `tools/seed-vc/.venv`.
