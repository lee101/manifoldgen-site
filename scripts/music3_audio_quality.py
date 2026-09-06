#!/usr/bin/env python3
"""Cheap waveform continuity metrics for Music3 quality gates and ablations."""

from __future__ import annotations

import io
import math
import pathlib
import wave

import numpy as np


def analyze_wav_bytes(audio: bytes, window_seconds: float = 0.25) -> dict:
    with wave.open(io.BytesIO(audio), "rb") as source:
        channels = source.getnchannels()
        rate = source.getframerate()
        width = source.getsampwidth()
        values = np.frombuffer(source.readframes(source.getnframes()), dtype="<i2")
    if width != 2 or channels < 1 or not values.size:
        raise ValueError("quality analysis requires a non-empty 16-bit PCM WAV")
    mono = values.astype(np.float32).reshape(-1, channels).mean(axis=1) / 32768.0
    size = max(1, round(rate * window_seconds))
    count = math.ceil(len(mono) / size)
    padded = np.pad(mono, (0, count * size - len(mono)))
    frames = padded.reshape(count, size)
    rms = np.sqrt(np.mean(np.square(frames), axis=1, dtype=np.float64))
    db = 20 * np.log10(np.maximum(rms, 1e-9))
    # Do not punish a deliberate fade-in/out. Compare each window to nearby
    # musical context and inspect only the internal body of the song.
    radius = max(2, round(2.0 / window_seconds))
    local = np.array([np.percentile(db[max(0, i-radius):min(len(db), i+radius+1)], 75) for i in range(len(db))])
    drop = local - db
    internal = np.ones(len(db), dtype=bool)
    edge = max(1, round(1.5 / window_seconds))
    internal[:edge] = False
    internal[-edge:] = False
    severe = internal & (drop >= 12.0) & (db <= -34.0)
    longest = run = 0
    for flagged in severe:
        run = run + 1 if flagged else 0
        longest = max(longest, run)
    adjacent_jump = float(np.max(np.abs(np.diff(db)))) if len(db) > 1 else 0.0
    worst_drop = float(np.max(drop[internal])) if np.any(internal) else 0.0
    severe_seconds = float(np.count_nonzero(severe) * window_seconds)
    score = max(0.0, 100.0 - max(0.0, worst_drop - 8.0) * 2.0 - severe_seconds * 8.0 - max(0.0, adjacent_jump - 14.0))
    return {
        "window_seconds": window_seconds,
        "continuity_score": round(score, 2),
        "worst_local_drop_db": round(worst_drop, 2),
        "largest_adjacent_jump_db": round(adjacent_jump, 2),
        "severe_drop_seconds": round(severe_seconds, 3),
        "longest_severe_drop_seconds": round(longest * window_seconds, 3),
        "rms_windows_db": [round(float(value), 2) for value in db],
    }


def analyze_wav(path: pathlib.Path) -> dict:
    return analyze_wav_bytes(path.read_bytes())


if __name__ == "__main__":
    import argparse, json
    parser = argparse.ArgumentParser()
    parser.add_argument("wav", nargs="+", type=pathlib.Path)
    args = parser.parse_args()
    print(json.dumps({str(path): analyze_wav(path) for path in args.wav}, indent=2))
