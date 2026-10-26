from __future__ import annotations

import subprocess
from dataclasses import dataclass

import numpy as np
from scipy.ndimage import gaussian_filter1d
from scipy.signal import find_peaks

SR = 22050
HOP = 512
NFFT = 2048


@dataclass
class AudioFeatures:
    fps: float
    bpm: float
    beats: list[float]
    kicks: list[tuple[float, float]]
    snares: list[tuple[float, float]]
    bass: np.ndarray
    mid: np.ndarray
    high: np.ndarray
    onset: np.ndarray
    duration: float

    def at(self, arr: np.ndarray, t: float) -> float:
        x = min(max(t * self.fps, 0.0), len(arr) - 1.0)
        i = int(x)
        j = min(i + 1, len(arr) - 1)
        return float(arr[i] * (1 - (x - i)) + arr[j] * (x - i))

    def to_json(self) -> dict:
        return {"bpm": round(self.bpm, 1), "duration": round(self.duration, 3), "beats": [round(b, 3) for b in self.beats],
                "kicks": [[round(t, 3), round(s, 2)] for t, s in self.kicks], "snares": [[round(t, 3), round(s, 2)] for t, s in self.snares]}


def decode(path: str, max_seconds: float | None = None, start: float = 0.0) -> np.ndarray:
    cmd = ["ffmpeg", "-v", "error"] + (["-ss", f"{start:.2f}"] if start > 0 else []) + ["-i", path, "-vn", "-ac", "1", "-ar", str(SR)]
    if max_seconds:
        cmd += ["-t", f"{max_seconds:.2f}"]
    cmd += ["-f", "f32le", "-"]
    p = subprocess.run(cmd, capture_output=True)
    return np.frombuffer(p.stdout, np.float32)


def _stft_mag(x: np.ndarray) -> np.ndarray:
    if len(x) < NFFT:
        x = np.pad(x, (0, NFFT - len(x)))
    n = 1 + (len(x) - NFFT) // HOP
    win = np.hanning(NFFT).astype(np.float32)
    idx = np.arange(NFFT)[None, :] + HOP * np.arange(n)[:, None]
    return np.abs(np.fft.rfft(x[idx] * win, axis=1))


def _norm(a: np.ndarray) -> np.ndarray:
    hi = float(np.percentile(a, 98)) if len(a) else 1.0
    return np.clip(a / max(hi, 1e-9), 0, 1.5).astype(np.float32)


def analyze_audio(x: np.ndarray, out_fps: float = 0.0) -> AudioFeatures:
    mag = _stft_mag(x)
    frames = len(mag)
    fps = SR / HOP
    freqs = np.fft.rfftfreq(NFFT, 1 / SR)
    band = lambda lo, hi: mag[:, (freqs >= lo) & (freqs < hi)].sum(axis=1)
    bass, mid, high = band(30, 150), band(150, 2000), band(2000, 10000)
    logm = np.log1p(mag * 8)
    flux = np.maximum(np.diff(logm, axis=0, prepend=logm[:1]), 0).sum(axis=1)
    onset = gaussian_filter1d(flux, 1.0)
    onset = _norm(onset)
    bflux = gaussian_filter1d(np.maximum(np.diff(np.log1p(bass * 4), prepend=0), 0), 1.0)
    hflux = gaussian_filter1d(np.maximum(np.diff(np.log1p(high * 4), prepend=0), 0), 1.0)
    kp, _ = find_peaks(_norm(bflux), height=0.35, distance=int(fps * 0.18))
    sp, _ = find_peaks(_norm(hflux), height=0.4, distance=int(fps * 0.18))
    bpm, beats = _tempo(onset, fps)
    return AudioFeatures(fps, bpm, beats, [(float(p / fps), float(_norm(bflux)[p])) for p in kp],
                         [(float(p / fps), float(_norm(hflux)[p])) for p in sp], _norm(gaussian_filter1d(bass, 1.5)),
                         _norm(gaussian_filter1d(mid, 1.5)), _norm(gaussian_filter1d(high, 1.5)), onset, len(x) / SR)


def _tempo(onset: np.ndarray, fps: float) -> tuple[float, list[float]]:
    if len(onset) < fps * 3:
        return 0.0, []
    o = onset - onset.mean()
    ac = np.correlate(o, o, "full")[len(o) - 1:]
    lo, hi = int(fps * 60 / 190), int(fps * 60 / 65)
    if hi >= len(ac):
        return 0.0, []
    lag = lo + int(np.argmax(ac[lo:hi]))
    bpm = 60 * fps / lag
    while bpm < 80:
        bpm *= 2
    while bpm > 175:
        bpm /= 2
    period = 60.0 / bpm
    best, ph = -1.0, 0.0
    for p in np.linspace(0, period, 48, endpoint=False):
        grid = np.arange(p, len(o) / fps, period)
        s = float(onset[np.clip((grid * fps).astype(int), 0, len(o) - 1)].sum())
        if s > best:
            best, ph = s, float(p)
    return float(bpm), [float(b) for b in np.arange(ph, len(o) / fps, period)]


def onset_envelope(x: np.ndarray, fps: float) -> np.ndarray:
    f = analyze_audio(x)
    n = int(f.duration * fps)
    return np.interp(np.arange(n) / fps, np.arange(len(f.onset)) / f.fps, f.onset).astype(np.float32)
