#!/usr/bin/env python3
"""Music restyle: an instrumental recording re-performed by YuE2 in a new style.

YuE2 takes no audio reference, so the source is carried over as a score:
  1. transcribe  SheetSage2 melody-full ABC (vocal + instrumental leads), or the
                 permissive fallback: basic-pitch notes on a beat_this grid,
                 reduced to one lead line plus chord symbols.
  2. condition   every Vocal note moves to Ins (yue2_instrumental.convert_score);
                 chords are dropped for "melody" (YuE2 re-harmonises in the new
                 style) and kept for "full" (same harmony, new arrangement).
  3. render      YuE2 with cot=melody/full, section tags as lyrics, style text
                 that pins key, tempo and "no vocals".
  4. master      best candidate by audiobox CE+PQ, mastered to -11 LUFS.
The source waveform is never reused: this is a new performance of the tune.
"""
from __future__ import annotations

import argparse
from fractions import Fraction
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time

import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE / "yue2_instrumental"))
from abc_tools import KEYS, parse_abc, report  # noqa: E402
from compile_score import compile_events  # noqa: E402
from instrumentalize import convert_score  # noqa: E402

SR = 48000
SHEETSAGE2_PYTHON = os.getenv("SHEETSAGE2_PYTHON", "/opt/sheetsage2/.venv/bin/python")
SHEETSAGE2_MODEL = os.getenv("SHEETSAGE2_MODEL", "m-a-p/SheetSage2")
SHEETSAGE2_BASE = os.getenv("SHEETSAGE2_BASE_MODEL", "")
TOKENS_PER_SECOND = 25
MAX_TOKENS = 9000
TARGET_LUFS = -11.0
NO_VOICE = ("no vocals", "no singing", "no choir", "no spoken words")

KK_MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
KK_MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
NAMES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
NAMES_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
CHORD_SHAPES = {"": (0, 4, 7), "m": (0, 3, 7), "7": (0, 4, 7, 10), "maj7": (0, 4, 7, 11),
                "m7": (0, 3, 7, 10), "dim": (0, 3, 6), "sus4": (0, 5, 7)}


def log(*args):
    print(f"[{time.strftime('%H:%M:%S')}] restyle", *args, file=sys.stderr, flush=True)


def style_text(prompt: str, key: str, bpm: int) -> str:
    """The target style, pinned to the score's key and tempo, with every no-voice condition."""
    style = re.sub(r"\s+", " ", prompt).strip().rstrip(".,")
    if not re.match(r"^instrumental\b", style, re.I):
        style = "Instrumental, " + style
    mode = "minor" if key.endswith("m") else "major"
    style += f", {key.rstrip('m')} {mode}, {bpm} BPM"
    for condition in NO_VOICE:
        if condition not in style.lower():
            style += ", " + condition
    return style + "."


def lyric_tags(abc: str) -> str:
    labels = [line[2:] for line in abc.splitlines() if line.startswith("% ")]
    return "\n\n".join("[" + x.title() + "]" for x in labels) + ("\n" if labels else "")


def score_facts(abc: str) -> dict:
    score = parse_abc(abc)
    facts = report(score)
    return {"bpm": score.bpm, "key": score.voices["Ins"].keys[0][1] if score.voices["Ins"].keys else "C",
            "nominal_seconds": float(facts["nominal_duration_seconds"]),
            "bars": len(score.voices["Ins"].bars), "ins_notes": len(score.voices["Ins"].notes),
            "chords": len(score.voices["Vocal"].chords)}


def retempo(abc: str, bpm: int) -> str:
    if not 40 <= bpm <= 200:
        raise ValueError("bpm must be between 40 and 200")
    return re.sub(r"^Q:1/4=\d+$", f"Q:1/4={bpm}", abc, count=1, flags=re.M)


def transcribe_sheetsage(audio: Path, out: Path, keep_harmony: bool, device: str) -> str:
    """SheetSage2 in its own interpreter (it pins numpy 1.24 / transformers 4.45)."""
    cmd = [SHEETSAGE2_PYTHON, str(HERE / "yue2_instrumental" / "transcribe_cover.py"), str(audio),
           "--output", str(out), "--task", "full" if keep_harmony else "melody-full", "--device", device]
    if SHEETSAGE2_MODEL != "m-a-p/SheetSage2":
        cmd += ["--model", SHEETSAGE2_MODEL]
    if SHEETSAGE2_BASE:
        cmd += ["--base-model", SHEETSAGE2_BASE]
    if os.getenv("HF_HUB_OFFLINE") == "1":
        cmd += ["--offline"]
    env = {k: v for k, v in os.environ.items() if k != "PYTHONPATH"} | {"PYTHONNOUSERSITE": "1"}
    subprocess.run(cmd, check=True, env=env, timeout=900)
    return (out / "score.abc").read_text(encoding="utf-8")


def detect_key(chroma: np.ndarray) -> str:
    best, name = -2.0, "C"
    for root in range(12):
        for profile, suffix in ((KK_MAJOR, ""), (KK_MINOR, "m")):
            r = float(np.corrcoef(np.roll(profile, root), chroma)[0, 1])
            if r > best:
                best = r
                sharp, flat = NAMES_SHARP[root] + suffix, NAMES_FLAT[root] + suffix
                name = flat if flat in KEYS and (sharp not in KEYS or KEYS[flat] > -6) else sharp
    return name if name in KEYS else "C"


def chord_name(chroma: np.ndarray, bass: int | None, key: str) -> str | None:
    if chroma.sum() <= 1e-6:
        return None
    unit = chroma / np.linalg.norm(chroma)
    flats = KEYS[key] < 0
    best, label = -1.0, None
    for root in range(12):
        for quality, shape in CHORD_SHAPES.items():
            template = np.zeros(12)
            template[[(root + i) % 12 for i in shape]] = 1
            score = float(unit @ (template / np.linalg.norm(template)))
            score += 0.08 if bass == root else 0
            score -= 0.03 * (len(shape) - 3) + (0.02 if quality == "sus4" else 0)
            if score > best:
                best, label = score, (NAMES_FLAT if flats else NAMES_SHARP)[root] + quality
    return label


def quarter_grid(beats: np.ndarray, downbeats: np.ndarray, per_bar: int, duration: float) -> np.ndarray:
    """Time of every quarter note, starting on a bar line at or before t=0 and following rubato."""
    period = float(np.median(np.diff(beats)))
    first = int(np.argmin(np.abs(beats - downbeats[0]))) if len(downbeats) else 0
    grid = list(beats)
    pickup = first
    while grid[0] > 0 or pickup % per_bar:
        grid.insert(0, grid[0] - period)
        pickup += 1
    while grid[-1] < duration + period:
        grid.append(grid[-1] + period)
    return np.asarray(grid)


def transcribe_notes(audio: np.ndarray, sr: int, keep_harmony: bool, work: Path, device: str) -> str:
    """basic-pitch + beat_this fallback: one skyline lead and (optionally) chords per half bar."""
    import grid as beatgrid
    from basic_pitch import ICASSP_2022_MODEL_PATH
    from basic_pitch.inference import predict

    mono = audio.mean(1) if audio.ndim == 2 else audio
    beats, downbeats = beatgrid.track_beats(audio, sr, device=device)
    if len(beats) < 8:
        raise ValueError("no steady beat found in this recording")
    counts = [int(np.sum((beats >= a - 1e-3) & (beats < b - 1e-3))) for a, b in zip(downbeats, downbeats[1:])]
    per_bar = 3 if counts and np.median(counts) == 3 else 4
    quarters = quarter_grid(beats, downbeats, per_bar, len(mono) / sr)
    bpm = int(round(60 / float(np.median(np.diff(beats)))))
    wav = work / "transcribe.wav"
    sf.write(wav, mono, sr, subtype="FLOAT")
    model = Path(str(ICASSP_2022_MODEL_PATH)).with_suffix(".onnx")
    _, _, raw = predict(str(wav), model, onset_threshold=0.5, frame_threshold=0.3)
    position = lambda t: float(np.interp(t, quarters, np.arange(len(quarters))))  # noqa: E731
    snap = lambda q: Fraction(round(q * 4), 4)  # noqa: E731
    notes = [(snap(position(s)), max(snap(position(e)), snap(position(s)) + Fraction(1, 4)), int(p), float(a))
             for s, e, p, a, *_ in raw]
    if not notes:
        raise ValueError("no notes found in this recording")

    pcs = np.zeros(12)
    for on, off, pitch, amp in notes:
        pcs[pitch % 12] += float(off - on) * amp
    key = detect_key(pcs)

    # Skyline lead: highest onset per 16th, except a much lower note under a
    # fresh sustained one (accompaniment, not a melody step).
    lead, by_onset = [], {}
    for on, off, pitch, amp in notes:
        if 55 <= pitch <= 100 and amp >= 0.25 and (on not in by_onset or pitch > by_onset[on][1]):
            by_onset[on] = (off, pitch)
    for on in sorted(by_onset):
        off, pitch = by_onset[on]
        if lead and lead[-1][0] + lead[-1][1] > on:
            prev_on, prev_dur, prev_pitch = lead[-1]
            if pitch < prev_pitch - 5 and on - prev_on < 1:
                continue
            lead[-1] = (prev_on, on - prev_on, prev_pitch)
        lead.append((on, off - on, pitch))

    bar_q = per_bar
    first_bar = int(lead[0][0] // bar_q)
    last_end = max(on + d for on, d, _ in lead)
    total_bars = int(-(-(last_end - first_bar * bar_q) // bar_q))
    shift = first_bar * bar_q
    lead = [(on - shift, d, p) for on, d, p in lead]
    span = total_bars * bar_q

    chords = []
    if keep_harmony:
        window = 2 if per_bar == 4 else 3
        for start in range(0, span, window):
            chroma, bass = np.zeros(12), None
            low = 128
            for on, off, pitch, amp in notes:
                a, b = max(on - shift, start), min(off - shift, start + window)
                if b > a:
                    chroma[pitch % 12] += float(b - a) * amp
                    if pitch < low:
                        low, bass = pitch, pitch % 12
            label = chord_name(chroma, bass, key)
            if label and (not chords or chords[-1][1] != label):
                chords.append([str(Fraction(start)), label])

    bars = [{"meter": f"{per_bar}/4"} if i == 0 else {} for i in range(total_bars)]
    for i, label in enumerate(sections(lead, total_bars, bar_q)):
        bars[i]["section"] = label
    events = {"bpm": bpm, "key": key, "bars": bars,
              "notes": [[str(on), str(d), p] for on, d, p in lead if d > 0], "chords": chords}
    (work / "events.json").write_text(json.dumps(events))
    abc, _ = compile_events(events)
    return abc


def sections(lead: list, total_bars: int, bar_q: int) -> list[str]:
    """4-bar phrases: intro/outro at the ends, the most repeated phrase shape is the chorus."""
    phrases = max(1, -(-total_bars // 4))
    shapes = np.zeros((phrases, 12))
    for on, d, p in lead:
        shapes[min(int(on // (4 * bar_q)), phrases - 1), p % 12] += float(d)
    unit = shapes / (np.linalg.norm(shapes, axis=1, keepdims=True) + 1e-9)
    repeats = (unit @ unit.T > 0.92).sum(1) - 1
    labels = []
    for i in range(phrases):
        if phrases >= 4 and i == 0:
            labels.append("intro")
        elif phrases >= 4 and i == phrases - 1:
            labels.append("outro")
        else:
            labels.append("chorus" if repeats[i] >= max(2, repeats.max() * 0.75) else "verse")
    return [labels[min(b // 4, phrases - 1)] for b in range(total_bars)]


def transcribe(source: Path, audio: np.ndarray, work: Path, transcriber: str, keep_harmony: bool,
               device: str) -> tuple[str, str]:
    if transcriber == "sheetsage2":
        try:
            return transcribe_sheetsage(source, work / "transcription", keep_harmony, device), "sheetsage2"
        except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired) as error:
            log("sheetsage2 failed, falling back to basic-pitch:", error)
    return transcribe_notes(audio, SR, keep_harmony, work, device), "basic-pitch"


def condition(abc: str, keep_harmony: bool, bpm: int = 0) -> tuple[str, dict]:
    converted, transfer = convert_score(abc, keep_chords=keep_harmony)
    if bpm:
        converted = retempo(converted, bpm)
    return converted, transfer


def run(source: Path, work: Path, prompt: str, *, harmony: str = "melody", bpm: int = 0, seeds: list[int],
        transcriber: str = "sheetsage2", max_seconds: float = 360, device: str = "cuda", abc: str = "") -> dict:
    import enhance
    import mix
    import quality

    timing = {}
    started = time.time()
    keep_harmony = harmony == "full"
    audio = enhance.load(str(source), None)
    if len(audio) > max_seconds * SR:
        audio = audio[:int(max_seconds * SR)]
        sf.write(work / "source.wav", audio, SR, subtype="FLOAT")
        source = work / "source.wav"
    origin = "provided"
    if not abc:
        abc, origin = transcribe(source, audio, work, transcriber, keep_harmony, device)
    timing["transcribe_s"] = round(time.time() - started, 1)
    (work / "transcribed.abc").write_text(abc)
    score, transfer = condition(abc, keep_harmony, bpm)
    facts = score_facts(score)
    if facts["ins_notes"] < 8:
        raise ValueError("the recording has too little melody to restyle")
    tokens = min(MAX_TOKENS, int(facts["nominal_seconds"] * TOKENS_PER_SECOND) + 250)
    style = style_text(prompt, facts["key"], facts["bpm"])
    cot = "full" if keep_harmony and facts["chords"] else "melody"
    log(f"{origin} score {facts['bars']} bars {facts['bpm']} BPM {facts['key']} "
        f"{facts['nominal_seconds']:.0f}s cot={cot} tokens={tokens}")
    t = time.time()
    renders = enhance.yue(lyric_tags(score), style, work / "yue", seeds, tokens, abc=score, cot=cot)
    timing["render_s"] = round(time.time() - t, 1)
    t = time.time()
    candidates = []
    for seed, path in zip(seeds, renders):
        y, sr = sf.read(path, dtype="float32", always_2d=True)
        scores = quality.aesthetics(y, sr)
        candidates.append({"seed": seed, "path": str(path), "seconds": round(len(y) / sr, 2), **scores})
    best = max(candidates, key=lambda c: c.get("CE", 0) + c.get("PQ", 0))
    y, sr = sf.read(best["path"], dtype="float32", always_2d=True)
    out = work / "restyled.wav"
    mastered = mix.master(y, sr, target_lufs=TARGET_LUFS)
    sf.write(out, mastered, sr, subtype="FLOAT")
    timing["score_s"] = round(time.time() - t, 1)
    timing["total_s"] = round(time.time() - started, 1)
    return {"path": str(out), "seconds": round(len(mastered) / sr, 2), "lufs": quality.loudness(mastered, sr)["lufs"],
            "abc": score, "source_abc": abc, "transcriber": origin, "cot": cot, "style": style,
            "bpm": facts["bpm"], "key": facts["key"], "bars": facts["bars"], "seed": best["seed"],
            "candidates": candidates, "transfer": {k: transfer[k] for k in ("vocal_notes_before", "output_ins_notes")},
            "timing": timing}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input")
    ap.add_argument("--prompt", required=True)
    ap.add_argument("--work", required=True)
    ap.add_argument("--harmony", choices=("melody", "full"), default="melody")
    ap.add_argument("--bpm", type=int, default=0)
    ap.add_argument("--seeds", default="831001")
    ap.add_argument("--transcriber", choices=("sheetsage2", "basic-pitch"), default="sheetsage2")
    ap.add_argument("--abc", help="skip transcription and restyle this score")
    ap.add_argument("--score-only", action="store_true", help="stop after writing the conditioned score")
    ap.add_argument("--device", default="cuda")
    a = ap.parse_args()
    work = Path(a.work)
    work.mkdir(parents=True, exist_ok=True)
    if a.score_only:
        audio = __import__("enhance").load(a.input, None)
        abc, origin = (Path(a.abc).read_text(), "provided") if a.abc else transcribe(
            Path(a.input), audio, work, a.transcriber, a.harmony == "full", a.device)
        score, _ = condition(abc, a.harmony == "full", a.bpm)
        (work / "transcribed.abc").write_text(abc)
        (work / "score.abc").write_text(score)
        print(json.dumps({"transcriber": origin, **score_facts(score),
                          "style": style_text(a.prompt, score_facts(score)["key"], score_facts(score)["bpm"])}))
        return
    report_ = run(Path(a.input), work, a.prompt, harmony=a.harmony, bpm=a.bpm,
                  seeds=[int(s) for s in a.seeds.split(",")], transcriber=a.transcriber, device=a.device,
                  abc=Path(a.abc).read_text() if a.abc else "")
    print(json.dumps({k: v for k, v in report_.items() if k not in ("abc", "source_abc")}, indent=1))


if __name__ == "__main__":
    main()
