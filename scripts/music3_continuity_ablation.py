#!/usr/bin/env python3
"""Test continuity-safe prompt and lyric variants on the production Music3 worker."""

import argparse
import json
import os
import pathlib
import time
import urllib.request

import music3_bench as bench
from music3_audio_quality import analyze_wav
from music3_prompt_ablation import prepare_endpoint


ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / "experimentresults/music3-prompt-expansion-2026-08-28-164005/manifest.json"
SAFETY = (
    "Mix Continuity: Maintain an audible rhythmic and harmonic bed through every transition with stable full-range "
    "tonality, controlled low mids, clear transients, centered intelligible lead vocals, and conservative stereo width. "
    "Use smooth automation only: no silence, dropout, mute, hard gate, abrupt level jump, full-band filter closure, "
    "underwater filtering, pitch instability, phase cancellation, glitch cut, or masking reverb/delay."
)
CLEAN = (
    "Basic Attributes: bpm is 112. key is F#, and scale is minor. Modern nocturnal synth-pop with restrained 1980s color. "
    "Global Emotional Progression: intimate and questioning in the verse, steadily lifting through the pre-chorus, then open and bittersweet in the chorus. "
    "Application Scenarios & Imagery: a clear night drive, city lights reflected in dry glass, and the moment self-awareness changes a relationship. "
    "Sonics & Production Profile: polished full-range mix, firm mono-compatible bass, clean low mids, crisp drums, stable dynamics, and natural stereo depth.\n"
    "Vocal Gender & Timbre: Singer A (Female), clear warm mezzo-soprano in a comfortable register. "
    "Vocal Style: close and intimate in the verse, more projected in the pre-chorus, confident and open in the chorus without shouting. "
    "Harmony/Backing Vocals: subtle doubles in the pre-chorus and controlled thirds in the chorus, always behind the lead. "
    "Vocal FX: short clean plate reverb, very quiet tempo delay, gentle compression, no modulation or filtering; preserve a centered, intelligible, full-bandwidth lead."
)
LIFECYCLE = (
    "Instrument Lifecycle Description (Primary/Secondary Layering): Primary: a steady analog bass pulse, warm poly-synth chords, and a clean kick-snare foundation remain audible throughout. "
    "Secondary: a light arpeggio enters in the pre-chorus; live drum layers and a bright counter-melody enter smoothly for the chorus; all layers taper gradually in the outro without disappearing early. "
    "Groove & Foundation Progression: keep the pulse continuous, add subdivision and drum weight gradually, and preserve bass and chord support across every section boundary. "
    "Embellishments, Textures & Spatial FX: use short fills and gentle risers only, with restrained reverb, conservative stereo width, smooth automation, and no mutes, gates, filter closures, glitches, pitch wobble, phase effects, or abrupt volume changes."
)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--duration", type=int, default=45)
    parser.add_argument("--seed", type=int, default=20260828)
    parser.add_argument("--output-dir", type=pathlib.Path)
    parser.add_argument("--only", help="comma-separated variant names")
    args = parser.parse_args()
    bench.load_env(ROOT / ".env")
    bench.load_env(pathlib.Path("/vfast/data/code/omniserve-native/.runpod-music3.env"))
    endpoint = os.environ["MUSIC3_RUNPOD_ENDPOINT_ID"]
    # Keep the worker alive for the complete sequence so wall time is comparable.
    os.environ["MUSIC3_ABLATION_IDLE_TIMEOUT"] = "300"
    prepare_endpoint(endpoint, idle_timeout=300)
    source = json.loads(SOURCE.read_text())
    original_lyrics = source["controlled"]["lyrics"]
    structured_lyrics = "[intro]\n\n" + original_lyrics + "\n\n[outro]\nThe shape remains, but now I see it through\nI change the view, the view changes me too"
    base = source["variants"]["b-metadata-vocals"]
    variants = [
        ("d-base-plus-safety", base + "\n" + SAFETY, original_lyrics),
        ("e-clean-metadata-vocals", CLEAN + "\n" + SAFETY, original_lyrics),
        ("f-clean-lifecycle", CLEAN + "\n" + LIFECYCLE + "\n" + SAFETY, original_lyrics),
        ("g-clean-lifecycle-structured", CLEAN + "\n" + LIFECYCLE + "\n" + SAFETY, structured_lyrics),
    ]
    if args.only:
        selected = {item.strip() for item in args.only.split(",") if item.strip()}
        variants = [variant for variant in variants if variant[0] in selected]
        if not variants: raise ValueError("--only did not match a variant")
    stamp = time.strftime("%Y-%m-%d-%H%M%S")
    out = args.output_dir or ROOT / "experimentresults" / f"music3-continuity-{stamp}"
    out.mkdir(parents=True, exist_ok=True)
    manifest = {"source": str(SOURCE.relative_to(ROOT)), "controlled": {"endpoint": endpoint, "duration": args.duration, "seed": args.seed},
                "variants": [{"name": n, "caption": c, "lyrics": l} for n, c, l in variants]}
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2))
    old_out = bench.OUT
    bench.OUT = out
    summary = []
    try:
        for name, caption, lyrics in variants:
            upload, public, fetch = bench.presign(f"createdmusic/continuity-{name}-{int(time.time())}.wav")
            body = {"workload": "minimax-music3", "prompt": caption, "lyrics": lyrics, "duration_seconds": args.duration,
                    "seed": args.seed, "output_upload_url": upload, "output_public_url": public}
            state = bench.run(name, endpoint, body, poll=5)
            if state.get("status") != "COMPLETED": raise RuntimeError(f"{name} failed: {json.dumps(state)[:1000]}")
            bench.save(name, state, fetch)
            metrics = (state.get("output") or {}).get("metrics") or {}
            quality = analyze_wav(out / f"{name}.wav")
            summary.append({"variant": name, "caption_chars": len(caption), "lyrics_chars": len(lyrics),
                            "generation_seconds": metrics.get("generation_seconds"), "realtime_factor": metrics.get("realtime_factor"),
                            "rms_dbfs": metrics.get("rms_dbfs"), **{k: v for k, v in quality.items() if k != "rms_windows_db"}})
    finally:
        bench.OUT = old_out
    (out / "summary.json").write_text(json.dumps(summary, indent=2))
    rows = "\n".join(f"| [{x['variant']}](./{x['variant']}.opus) | {x['generation_seconds']} | {x['continuity_score']} | {x['worst_local_drop_db']} | {x['longest_severe_drop_seconds']} | |" for x in summary)
    (out / "README.md").write_text("# Music3 continuity ablation\n\nSame model, seed and 45-second cap.\n\n| Variant | GPU seconds | Continuity score | Worst local drop dB | Longest severe drop s | Listening notes |\n|---|---:|---:|---:|---:|---|\n" + rows + "\n")
    print(out)


if __name__ == "__main__": main()
