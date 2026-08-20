#!/usr/bin/env python3
"""Audio keypoints: onset/transient boundaries with a bounded maximum gap.

Spectral-flux onset detection over an ffmpeg-decoded mono mix, adaptive peak
picking, then gap filling so no two consecutive keypoints are further apart
than --max-gap (default 2.0s). Also emits a centre-channel vocal score per
frame so the shot planner can tell singing sections from instrumental ones.
"""
from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

import numpy as np

from common import FPS

SR = 22050
N_FFT = 1024
HOP = 256


def decode(path: Path, channels: int) -> np.ndarray:
    proc = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-acodec", "pcm_f32le",
         "-ac", str(channels), "-ar", str(SR), "-"],
        capture_output=True, check=True)
    data = np.frombuffer(proc.stdout, dtype=np.float32)
    return data.reshape(-1, channels) if channels > 1 else data


def stft_mag(signal: np.ndarray) -> np.ndarray:
    window = np.hanning(N_FFT).astype(np.float32)
    count = 1 + max(0, (len(signal) - N_FFT) // HOP)
    frames = np.lib.stride_tricks.as_strided(
        signal, shape=(count, N_FFT), strides=(signal.strides[0] * HOP, signal.strides[0]))
    return np.abs(np.fft.rfft(frames * window, axis=1)).astype(np.float32)


def onset_envelope(mag: np.ndarray) -> np.ndarray:
    logmag = np.log1p(mag * 10.0)
    flux = np.diff(logmag, axis=0, prepend=logmag[:1])
    envelope = np.maximum(flux, 0.0).sum(axis=1)
    envelope -= envelope.min()
    peak = envelope.max()
    return envelope / peak if peak > 0 else envelope


def pick_peaks(envelope: np.ndarray, min_gap_s: float, delta: float) -> list[int]:
    window = max(1, int(round(0.5 * SR / HOP)))
    kernel = np.ones(window * 2 + 1, dtype=np.float32) / (window * 2 + 1)
    local = np.convolve(envelope, kernel, mode="same")
    threshold = local + delta * envelope.std()
    min_gap = max(1, int(round(min_gap_s * SR / HOP)))
    picked: list[int] = []
    for index in range(1, len(envelope) - 1):
        value = envelope[index]
        if value < threshold[index] or value < envelope[index - 1] or value < envelope[index + 1]:
            continue
        if picked and index - picked[-1] < min_gap:
            if value > envelope[picked[-1]]:
                picked[-1] = index
            continue
        picked.append(index)
    return picked


def vocal_score(stereo: np.ndarray) -> np.ndarray:
    """Centre-channel energy in the vocal band, per onset frame.

    Lead vocals sit centred and mostly between 200 Hz and 4 kHz; the side
    channel carries the wide instrumentation. Centre-minus-side band energy is
    a cheap, dependency-free stand-in for a separated vocal stem.
    """
    mid = (stereo[:, 0] + stereo[:, 1]) * 0.5
    side = (stereo[:, 0] - stereo[:, 1]) * 0.5
    freqs = np.fft.rfftfreq(N_FFT, 1.0 / SR)
    band = (freqs >= 200.0) & (freqs <= 4000.0)
    mid_band = stft_mag(np.ascontiguousarray(mid))[:, band].sum(axis=1)
    side_band = stft_mag(np.ascontiguousarray(side))[:, band].sum(axis=1)
    score = np.maximum(mid_band - side_band, 0.0)
    smooth = np.convolve(score, np.ones(64, dtype=np.float32) / 64.0, mode="same")
    peak = np.percentile(smooth, 98) or 1.0
    return np.clip(smooth / peak, 0.0, 1.0)


def stem_vocal_score(path: Path, frames: int) -> np.ndarray:
    """Vocal presence from a separated vocal stem (demucs), RMS per onset frame."""
    mono = decode(path, 1)
    count = 1 + max(0, (len(mono) - N_FFT) // HOP)
    strided = np.lib.stride_tricks.as_strided(
        mono, shape=(count, N_FFT), strides=(mono.strides[0] * HOP, mono.strides[0]))
    rms = np.sqrt((strided.astype(np.float32) ** 2).mean(axis=1))
    smooth = np.convolve(rms, np.ones(48, dtype=np.float32) / 48.0, mode="same")
    peak = np.percentile(smooth, 98) or 1.0
    score = np.clip(smooth / peak, 0.0, 1.0)
    if len(score) < frames:
        score = np.pad(score, (0, frames - len(score)))
    return score[:frames]


def fill_gaps(times: list[float], duration: float, max_gap: float,
              envelope: np.ndarray, strengths: dict[float, float]) -> list[float]:
    points = sorted({0.0, *[t for t in times if 0.0 < t < duration], duration})
    filled = [points[0]]
    for point in points[1:]:
        previous = filled[-1]
        gap = point - previous
        if gap > max_gap:
            splits = int(np.ceil(gap / max_gap))
            for step in range(1, splits):
                ideal = previous + gap * step / splits
                low = int(round((ideal - 0.25) * SR / HOP))
                high = int(round((ideal + 0.25) * SR / HOP))
                low, high = max(0, low), min(len(envelope) - 1, high)
                if high > low:
                    index = low + int(np.argmax(envelope[low:high]))
                    chosen = index * HOP / SR
                else:
                    chosen = ideal
                if chosen - filled[-1] >= 0.35:
                    filled.append(round(chosen, 4))
                    strengths.setdefault(filled[-1], 0.0)
        filled.append(round(point, 4))
    return filled


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--max-gap", type=float, default=2.0)
    parser.add_argument("--min-gap", type=float, default=0.45)
    parser.add_argument("--delta", type=float, default=0.35)
    parser.add_argument("--vocal-stem", type=Path, default=None,
                        help="separated vocal stem (demucs) for reliable singing detection")
    args = parser.parse_args()

    stereo = decode(args.audio, 2)
    mono = np.ascontiguousarray(stereo.mean(axis=1))
    duration = len(mono) / SR
    mag = stft_mag(mono)
    envelope = onset_envelope(mag)
    peaks = pick_peaks(envelope, args.min_gap, args.delta)
    strengths = {round(index * HOP / SR, 4): float(envelope[index]) for index in peaks}
    keypoints = fill_gaps(sorted(strengths), duration, args.max_gap, envelope, strengths)

    if args.vocal_stem and args.vocal_stem.exists():
        vocals = stem_vocal_score(args.vocal_stem, len(envelope))
        vocal_source = str(args.vocal_stem)
    else:
        vocals = vocal_score(stereo)
        vocal_source = "centre-channel-proxy"
    frame_times = np.arange(len(vocals)) * HOP / SR

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps({
        "audio": str(args.audio),
        "duration": round(duration, 6),
        "total_frames": int(round(duration * FPS)),
        "max_gap": args.max_gap,
        "keypoints": keypoints,
        "strengths": [round(strengths.get(t, 0.0), 5) for t in keypoints],
        "vocal_source": vocal_source,
        "vocal_hop_seconds": HOP / SR,
        "vocal_score": [round(float(v), 4) for v in vocals],
    }, indent=1))
    gaps = np.diff(keypoints)
    print(f"{args.out}: {len(keypoints)} keypoints over {duration:.2f}s "
          f"(onsets {len(peaks)}, gap mean {gaps.mean():.2f}s max {gaps.max():.2f}s), "
          f"vocal frames {len(vocals)} covering {frame_times[-1]:.1f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
