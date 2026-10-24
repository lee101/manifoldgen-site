#!/usr/bin/env python3
"""Neural voice enhancer: rough sung/rapped take + style prompt -> produced track.

Modes
  produce  keep the singer's own performance: neural restoration, elastic
           beat-locking onto a generated instrumental, rap vocal chain, master.
  regen    YuE2 re-performs the transcribed lyrics in the prompted style; seeds
           are ranked by lyric fidelity (WER of the render's STT against the
           input's) then production quality.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import time

import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import grid  # noqa: E402
import lyrics  # noqa: E402
import mix  # noqa: E402
import quality  # noqa: E402
import vocal  # noqa: E402

SR = 48000
YUE_PYTHON = os.getenv("YUE_PYTHON", "/vfast/data/code/yue-cog/.venv/bin/python")


_WARM = None


def warm_yue_cache():
    """Hash the YuE checkpoints in the background (cached on disk) while STT/separation run on the critical path."""
    global _WARM
    if _WARM is not None or not os.path.exists(YUE_PYTHON):
        return
    try:
        _WARM = subprocess.Popen([YUE_PYTHON, str(HERE / "yue_render.py"), "--warm-hashes"],
                                 stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, preexec_fn=lambda: os.nice(10))
    except OSError:
        _WARM = False


def _join_warm():
    if _WARM:
        try:
            _WARM.wait(timeout=300)
        except subprocess.TimeoutExpired:
            _WARM.kill()


def log(*args):
    print(f"[{time.strftime('%H:%M:%S')}]", *args, file=sys.stderr, flush=True)


def load(path: str, track: int | None) -> np.ndarray:
    """Decode any media to 48 kHz stereo float; ``track`` picks an audio stream."""
    cmd = ["ffmpeg", "-nostdin", "-v", "error", "-i", path]
    if track is not None:
        cmd += ["-map", f"0:a:{track}"]
    cmd += ["-ac", "2", "-ar", str(SR), "-f", "f32le", "-"]
    raw = subprocess.run(cmd, check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()


def cached(work: Path, name: str, build):
    path = work / name
    if path.suffix == ".wav":
        if path.exists():
            return sf.read(path, dtype="float32", always_2d=True)[0]
        value = build()
        sf.write(path, value, SR, subtype="FLOAT")
        return value
    if path.exists():
        return json.loads(path.read_text())
    value = build()
    path.write_text(json.dumps(value))
    return value


def analyse(args, work: Path) -> dict:
    raw = cached(work, "input.wav", lambda: load(args.input, args.track))
    stages = {}

    def clean():
        stages.update(vocal.restore(raw, SR, dereverb=args.dereverb, denoise=True))
        return stages["clean"]
    clean_vocal = cached(work, "vocal_clean.wav", clean)
    segments = cached(work, "stt.json", lambda: lyrics.transcribe(clean_vocal.mean(1), SR))
    words = lyrics.words(segments)
    starts = np.array([w["s"] for w in words])
    onsets = grid.refine_onsets(clean_vocal.mean(1), SR, starts)
    gaps = np.concatenate([[True], starts[1:] - np.array([w["e"] for w in words[:-1]]) > 0.2])
    reference = Path(args.lyrics).read_text() if args.lyrics else lyrics.text_of(segments)
    return {"raw": raw, "clean": clean_vocal, "segments": segments, "words": words, "reference": reference,
            "onsets": onsets, "pauses": gaps, "bpm": grid.vocal_bpm(onsets)}


def yue(lyric_text: str, style: str, out: Path, seeds: list[int], tokens: int, abc: str | None = None,
        vocal_seconds: float = 0) -> list[Path]:
    out.mkdir(parents=True, exist_ok=True)
    (out / "lyrics.txt").write_text(lyric_text)
    cmd = [YUE_PYTHON, str(HERE / "yue_render.py"), "--lyrics", str(out / "lyrics.txt"), "--style", style,
           "--out", str(out), "--seeds", ",".join(map(str, seeds)), "--tokens", str(tokens)]
    if abc:
        (out / "plan.abc").write_text(abc)
        cmd += ["--abc", str(out / "plan.abc")]
    if vocal_seconds:
        cmd += ["--vocal-seconds", f"{vocal_seconds:.1f}"]
    todo = [s for s in seeds if not (out / f"seed{s}" / "audio.flac").exists()]
    if todo:
        cmd[cmd.index("--seeds") + 1] = ",".join(map(str, todo))
        _join_warm()
        log("yue", "seeds", todo, f"vocal {vocal_seconds:.0f}s" if vocal_seconds else "")
        subprocess.run(cmd, check=True)
    return [out / f"seed{s}" / "audio.flac" for s in seeds]


def score_render(path: Path, reference: str) -> dict:
    """STT the render's vocal, find where the lyrics really end, trim there, and score it."""
    report_path = path.with_suffix(".score.json")
    if report_path.exists():
        return json.loads(report_path.read_text())
    y, sr = sf.read(path, dtype="float32", always_2d=True)
    v = vocal._separate(y, sr, vocal.ISOLATE, "vocals")
    segs = lyrics.transcribe(v.mean(1), sr, reference=reference)
    span = lyrics.lyric_span(segs, reference)
    trimmed = y
    if span["end"] is not None:
        _, downbeats = grid.track_beats(y, sr)
        trimmed = mix.end_after(y, sr, float(span["end"]), downbeats)
    trimmed_path = path.with_name("trimmed.wav")
    sf.write(trimmed_path, trimmed, sr, subtype="FLOAT")
    sf.write(path.with_name("vocal.wav"), v[:len(trimmed)], sr, subtype="FLOAT")
    report = {"path": str(trimmed_path), "seconds": round(len(trimmed) / sr, 2), "raw_seconds": round(len(y) / sr, 2),
              "wer": round(lyrics.wer(reference, lyrics.text_of(segs)), 3), "coverage": span["coverage"],
              "lyrics_end": span["end"], "tail_unmatched": span["tail_unmatched"],
              **quality.aesthetics(trimmed, sr), **quality.loudness(trimmed, sr)}
    report_path.write_text(json.dumps(report))
    return report


def style_for(prompt: str, bpm: float, instrumental: bool = False) -> str:
    base = prompt.strip().rstrip(".")
    if instrumental:
        return f"Instrumental, {base} beat, no vocals, heavy 808 bass, hard-hitting drums, crisp hi-hats, {round(bpm)} BPM"
    return f"English, {base}, aggressive male rap vocal, confident flow, heavy 808 bass, hard-hitting drums, {round(bpm)} BPM"


def produce(args, work: Path, a: dict) -> dict:
    if args.beat:
        beat = load(args.beat, None)
    else:
        sheet = "[Intro]\n[Instrumental]\n[Verse]\n[Instrumental]\n[Verse]\n[Instrumental]\n[Outro]\n[Instrumental]\n"
        tokens = int((len(a["raw"]) / SR + 30) * 25)
        renders = yue(sheet, style_for(args.prompt, a["bpm"], instrumental=True), work / "beat", [args.seed], tokens)
        beat = sf.read(renders[0], dtype="float32", always_2d=True)[0]
        beat = vocal._separate(beat, SR, vocal.ISOLATE, "other")  # drop any vocal chops the model added
    beats, downbeats = grid.track_beats(beat, SR)
    log(f"beat {60 / np.median(np.diff(beats)):.2f} BPM, {len(downbeats)} bars; vocal ~{a['bpm']:.1f} BPM")
    # Output t=0 is the first tracked downbeat; the vocal enters after the intro bars.
    start = float(downbeats[0])
    rel_beats, rel_down = beats - start, downbeats - start
    sixteenth = grid.sixteenths(rel_beats[rel_beats >= -1e-3], rel_down[rel_down >= -1e-3], until=len(a["raw"]) / SR * 1.4)
    first_slot = args.intro_bars * 4 * grid.SUBDIV
    anchors = grid.align(a["onsets"], a["pauses"], sixteenth, first_slot)
    t, T = grid.time_map(anchors)
    log(f"aligned {len(anchors)}/{len(a['onsets'])} word onsets")
    phrases = grid.phrases_from_words(a["words"])
    out_seconds = float(T[-1] + 4)
    lead_dry = grid.render(a["clean"], SR, anchors, phrases, out_seconds)
    sf.write(work / "vocal_locked.wav", lead_dry, SR, subtype="FLOAT")

    line_ends = [ln["words"][-1] for ln in lyrics.lines(a["segments"])]
    emphasis = [(float(np.interp(w["s"], t, T)), float(np.interp(w["e"], t, T))) for w in line_ends]
    bpm = 60 / float(np.median(np.diff(beats)))
    stems = vocal.rap_chain(lead_dry, SR, bpm, emphasis, intensity=args.intensity)
    fitted = mix.fit_beat(beat, SR, downbeats, start, out_seconds - 4)
    song, mix_info = mix.mix_song(fitted, stems, SR, vocal_over_beat_db=args.vocal_db, target_lufs=args.lufs)
    out = Path(args.out)
    sf.write(out, song, SR, subtype="PCM_24")
    for name, stem in stems.items():
        sf.write(work / f"stem_{name}.wav", stem, SR, subtype="FLOAT")
    sf.write(work / "stem_beat.wav", fitted, SR, subtype="FLOAT")

    # Report: pocket before (best steady grid at the vocal's own tempo) and after.
    best_phase = min(np.linspace(0, 60 / a["bpm"], 64, endpoint=False),
                     key=lambda p: -grid.pocket(a["onsets"], p + np.arange(0, len(a["raw"]) / SR, 15 / a["bpm"]))["within_30ms"])
    before = grid.pocket(a["onsets"], best_phase + np.arange(0, len(a["raw"]) / SR, 15 / a["bpm"]))
    measured = grid.refine_onsets(lead_dry.mean(1), SR, np.interp(a["onsets"], t, T), before=0.05, after=0.05)
    after = grid.pocket(measured, sixteenth)
    return {"mode": "produce", "beat_bpm": round(bpm, 2), "vocal_bpm": round(a["bpm"], 2),
            "anchored_words": len(anchors), "words": len(a["onsets"]),
            "pocket_before": before, "pocket_after": after, **mix_info, "out": str(out), "song": song}


# YuE raps these lyrics at 4.1-4.2 words/s (three seeds, 93-96 BPM); planning at
# 3.6 leaves headroom so a slower take is never cut, and the trim removes the rest.
YUE_WORDS_PER_SECOND = 3.6


def regen(args, work: Path, a: dict) -> dict:
    reference = a["reference"]
    sheet = lyrics.sheet_from_text(reference) if args.lyrics else lyrics.lyric_sheet(a["segments"])
    vocal_seconds = len(lyrics.normalize(reference).split()) / YUE_WORDS_PER_SECOND
    tokens = int((vocal_seconds + 40) * 25)
    seeds = [args.seed + 1000 * i for i in range(args.candidates)]
    renders = yue(sheet, style_for(args.prompt, a["bpm"]), Path(args.yue_dir) if args.yue_dir else work / "regen",
                  seeds, tokens, vocal_seconds=vocal_seconds)
    scores = [score_render(p, reference) for p in renders]
    for s in scores:
        log(f"candidate {Path(s['path']).parent.name}: WER {s['wer']:.3f} cover {s['coverage']} "
            f"PQ {s['PQ']} CE {s['CE']} {s['raw_seconds']}s -> {s['seconds']}s")
    best = min(scores, key=lambda s: s["wer"] - 0.03 * s["PQ"] - 0.03 * s["CE"])
    y = sf.read(best["path"], dtype="float32", always_2d=True)[0]
    report = {"mode": "regen", "candidates": scores, "chosen": best["path"], "out": args.out}
    if args.voice == "user":
        import svc
        model_vocal = sf.read(Path(best["path"]).with_name("vocal.wav"), dtype="float32", always_2d=True)[0]
        reference_audio = svc.reference_clip(a["clean"].mean(1), SR, a["words"])
        log("converting the vocal to the singer's voice")
        converted = svc.convert(model_vocal, reference_audio, SR)
        y = svc.swap_vocal(y, model_vocal, converted, SR)
        report["voice"] = "user"
    song = mix.master(y, SR, args.lufs)
    sf.write(args.out, song, SR, subtype="PCM_24")
    return {**report, "song": song}


GOOD_WER = 0.35  # vs written lyrics; names like "gibidy" keep even clean takes near 0.3


def run_job(args, work: Path, tracks: tuple[str, ...] = ("voice", "studio", "produce")) -> dict:
    """Everything one hosted job delivers, sharing the expensive work between tracks.

    voice    YuE's re-performance converted to the input singer's timbre
    studio   YuE's own vocalist, untouched
    produce  the input take itself, beat-locked over the chosen render's instrumental
    Seeds render ``args.candidates`` at a time; a second batch runs only when no
    render of the first sings the lyrics well enough (WER > GOOD_WER).
    """
    timing, started = {}, time.time()
    a = analyse(args, work)
    timing["analyse_s"] = round(time.time() - started, 1)
    reference = a["reference"]
    sheet = lyrics.sheet_from_text(reference) if args.lyrics else lyrics.lyric_sheet(a["segments"])
    vocal_seconds = len(lyrics.normalize(reference).split()) / YUE_WORDS_PER_SECOND
    tokens = int((vocal_seconds + 40) * 25)
    style = style_for(args.prompt, a["bpm"])
    scores, batches = [], 0
    while batches < 2 and (not scores or min(s["wer"] for s in scores) > GOOD_WER):
        seeds = [args.seed + 1000 * (batches * args.candidates + i) for i in range(args.candidates)]
        t = time.time()
        renders = yue(sheet, style, Path(args.yue_dir) if args.yue_dir else work / "regen", seeds, tokens,
                      vocal_seconds=vocal_seconds)
        timing[f"render_batch{batches}_s"] = round(time.time() - t, 1)
        t = time.time()
        scores += [score_render(p, reference) for p in renders]
        timing[f"score_batch{batches}_s"] = round(time.time() - t, 1)
        batches += 1
    best = min(scores, key=lambda s: s["wer"] - 0.03 * s["PQ"] - 0.03 * s["CE"])
    song = sf.read(best["path"], dtype="float32", always_2d=True)[0]
    model_vocal = sf.read(Path(best["path"]).with_name("vocal.wav"), dtype="float32", always_2d=True)[0]
    out_dir = work / "out"
    out_dir.mkdir(exist_ok=True)
    results = {}
    if "studio" in tracks:
        results["studio"] = mix.master(song, SR, args.lufs)
    if "voice" in tracks:
        import svc
        t = time.time()
        reference_audio = svc.reference_clip(a["clean"].mean(1), SR, a["words"])
        converted = svc.convert(model_vocal, reference_audio, SR)
        results["voice"] = mix.master(svc.swap_vocal(song, model_vocal, converted, SR), SR, args.lufs)
        timing["convert_s"] = round(time.time() - t, 1)
    produce_info = {}
    if "produce" in tracks:
        t = time.time()
        beat_path = work / "beat_from_render.wav"
        sf.write(beat_path, song - model_vocal, SR, subtype="FLOAT")
        produce_args = argparse.Namespace(**{**vars(args), "beat": str(beat_path), "out": str(out_dir / "produce.wav")})
        produced = produce(produce_args, work, a)
        results["produce"] = produced.pop("song")
        produce_info = {k: produced[k] for k in ("beat_bpm", "vocal_bpm", "pocket_before", "pocket_after")}
        timing["produce_s"] = round(time.time() - t, 1)
    report = {"lyrics": reference, "words": len(lyrics.normalize(reference).split()),
              "candidates": [{k: s[k] for k in ("seconds", "wer", "coverage", "PQ", "CE")} for s in scores],
              "chosen_wer": best["wer"], "produce": produce_info, "tracks": {}}
    for name, audio in results.items():
        path = out_dir / f"{name}.wav"
        sf.write(path, audio, SR, subtype="PCM_24")
        report["tracks"][name] = {"path": str(path), "seconds": round(len(audio) / SR, 2), **quality.loudness(audio, SR)}
    timing["total_s"] = round(time.time() - started, 1)
    report["timing"] = timing
    return report


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input")
    ap.add_argument("--prompt", default="hard hip-hop diss track")
    ap.add_argument("--mode", choices=["produce", "regen"], default="produce")
    ap.add_argument("--out", required=True)
    ap.add_argument("--work", help="stage cache directory (default: <out>.work)")
    ap.add_argument("--track", type=int, help="audio stream index for multi-track recordings")
    ap.add_argument("--beat", help="use this instrumental instead of generating one")
    ap.add_argument("--lyrics", help="lyrics text file; overrides STT as the lyric reference and sheet")
    ap.add_argument("--yue-dir", help="shared YuE render directory (same lyrics+prompt reuse renders)")
    ap.add_argument("--intro-bars", type=int, default=2)
    ap.add_argument("--intensity", type=float, default=1.0, help="vocal chain drive, 0-2")
    ap.add_argument("--lufs", type=float, default=-9.0)
    ap.add_argument("--vocal-db", type=float, default=2.0, help="vocal bus loudness over the beat")
    ap.add_argument("--seed", type=int, default=831001)
    ap.add_argument("--candidates", type=int, default=3, help="regen seeds to rank")
    ap.add_argument("--voice", choices=["user", "model"], default="user", help="regen: sing in the input's voice")
    ap.add_argument("--dereverb", action=argparse.BooleanOptionalAction, default=False)
    args = ap.parse_args()
    work = Path(args.work or args.out + ".work")
    work.mkdir(parents=True, exist_ok=True)
    started = time.time()
    a = analyse(args, work)
    log(f"{len(a['words'])} words, vocal tempo ~{a['bpm']:.1f} BPM")
    report = produce(args, work, a) if args.mode == "produce" else regen(args, work, a)
    song = report.pop("song")
    reference = a["reference"]
    final_vocal = vocal._separate(song, SR, vocal.ISOLATE, "vocals")
    report["final_wer"] = round(lyrics.wer(reference, lyrics.text_of(lyrics.transcribe(final_vocal.mean(1), SR, reference=reference))), 3)
    report.update(quality.aesthetics(song, SR), **quality.loudness(song, SR), seconds=round(len(song) / SR, 1),
                  wall_s=round(time.time() - started, 1))
    Path(args.out).with_suffix(".json").write_text(json.dumps(report, indent=1))
    print(json.dumps(report, indent=1))


if __name__ == "__main__":
    main()
