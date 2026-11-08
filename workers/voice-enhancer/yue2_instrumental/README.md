# Vendored YuE2 instrumental helpers

From the upstream `yue2-music` skill, `skills/yue2-music/instrumental/` at
multimodal-art-projection/YuE commit `1647252d68b70cbead046ffd3f7caf036dde47ee`
(MIT, see `LICENSE`). Standard-library score tools used by `restyle.py`:

| file | use |
| --- | --- |
| `abc_tools.py` | parse/validate the two-voice (Vocal/Ins) YuE2 ABC dialect |
| `compile_score.py` | beat-domain note events to native ABC (basic-pitch fallback) |
| `instrumentalize.py` | move every Vocal note to Ins, optionally drop chords |
| `transcribe_cover.py` | SheetSage2 transcription, run in its own interpreter |
| `assets/cover-release.json` | pinned SheetSage2 / MERT-v2-FullSong revisions |

Local change: `transcribe_cover.py` reads `assets/` beside itself instead of the
skill root. SheetSage2 and MERT2 weights are CC BY-NC 4.0, separate from these
helpers and from the YuE2 permission recorded in omniserve-native.
