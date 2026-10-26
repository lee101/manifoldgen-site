"""SFX layering: a cue sheet (JSON) of anime / comic / foley sounds mixed over a picture's audio.

Cue: {"t": 12.4, "sfx": "servo_whir", "gain_db": -14, "pan": 0.0, "dur": 1.2}
`sfx` is either a built-in synth name (instant, free, deterministic) or `gen:<prompt>` which is
generated once with Stable Audio and cached by prompt hash. Anything else is treated as a file path.
Beds (rain, room tone) are cues with "loop": true and a "dur".
"""
from __future__ import annotations

import json
import math
import subprocess
import wave
from pathlib import Path

import numpy as np

SR = 48000
RNG = np.random.default_rng(1234)


def _t(d: float) -> np.ndarray:
    return np.arange(int(d * SR)) / SR


def _env(n: int, a: float, r: float) -> np.ndarray:
    e = np.ones(n)
    ai, ri = max(1, int(a * SR)), max(1, int(r * SR))
    e[:ai] = np.linspace(0, 1, ai)
    e[-ri:] *= np.linspace(1, 0, min(ri, n))
    return e


def _lp(x: np.ndarray, hz: float) -> np.ndarray:
    a = math.exp(-2 * math.pi * hz / SR)
    out = np.empty_like(x)
    y = 0.0
    for i, v in enumerate(x):  # n is small for one-shots
        y = (1 - a) * v + a * y
        out[i] = y
    return out


def _fft_filter(x: np.ndarray, lo: float, hi: float) -> np.ndarray:
    f = np.fft.rfft(x)
    fr = np.fft.rfftfreq(len(x), 1 / SR)
    f[(fr < lo) | (fr > hi)] = 0
    return np.fft.irfft(f, len(x))


def synth_servo_whir(d=1.1):
    t = _t(d)
    sweep = 380 + 520 * np.sin(np.pi * t / d) ** 2
    ph = 2 * np.pi * np.cumsum(sweep) / SR
    x = np.sin(ph) * 0.5 + np.sin(2.01 * ph) * 0.25 + 0.12 * np.sin(5.02 * ph)
    x += _fft_filter(RNG.standard_normal(len(t)), 1500, 4200) * 0.05
    return x * _env(len(t), 0.08, 0.25) * 0.5


def synth_metal_click(d=0.18):
    t = _t(d)
    x = (np.sin(2 * np.pi * 2300 * t) + 0.6 * np.sin(2 * np.pi * 3710 * t)) * np.exp(-t * 55)
    x += _fft_filter(RNG.standard_normal(len(t)), 2000, 9000) * np.exp(-t * 90) * 0.5
    return x * 0.6


def synth_servo_tick(d=0.35):
    t = _t(d)
    return np.sin(2 * np.pi * (900 + 400 * t / d) * t) * np.exp(-t * 14) * 0.35 + synth_metal_click(d) * 0.4


def synth_whoosh(d=0.6):
    t = _t(d)
    n = RNG.standard_normal(len(t))
    sw = np.sin(np.pi * t / d)
    return _fft_filter(n, 400, 6000) * sw ** 2 * 0.5


def synth_impact_thud(d=0.9):
    t = _t(d)
    f = 150 * np.exp(-t * 7) + 42
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6)
    x += _fft_filter(RNG.standard_normal(len(t)), 80, 2500) * np.exp(-t * 28) * 0.5
    return x * 0.9


def synth_anime_hit(d=0.5):
    return synth_impact_thud(d) + synth_metal_click(d) * 0.5


def synth_sparkle_chime(d=1.4):
    t = _t(d)
    x = np.zeros(len(t))
    for i, hz in enumerate([2093, 2637, 3136, 3951]):
        s = int(i * 0.06 * SR)
        x[s:] += np.sin(2 * np.pi * hz * t[: len(t) - s]) * np.exp(-t[: len(t) - s] * 4)
    return x * 0.18


def synth_heartbeat(d=1.6):
    t = _t(d)
    x = np.zeros(len(t))
    for start, amp in ((0.0, 1.0), (0.24, 0.7), (0.8, 1.0), (1.04, 0.7)):
        s = int(start * SR)
        n = len(t) - s
        if n > 0:
            x[s:] += amp * np.sin(2 * np.pi * 52 * t[:n]) * np.exp(-t[:n] * 22)
    return x * 0.7


def synth_surprise_sting(d=0.9):
    t = _t(d)
    rise = np.sin(2 * np.pi * np.cumsum(300 + 1800 * (t / d) ** 2) / SR) * (t / d) * 0.25
    return (rise * np.exp(-np.clip(t - 0.35, 0, None) * 6) + synth_impact_thud(d) * 0.55) * _env(len(t), 0.005, 0.2)


def synth_rain_bed(d=10.0):
    n = RNG.standard_normal(int(d * SR))
    x = _fft_filter(n, 1800, 9000) * 0.18 + _fft_filter(RNG.standard_normal(len(n)), 120, 700) * 0.06
    drops = np.zeros(len(n))
    for _ in range(int(d * 40)):
        i = RNG.integers(0, len(n) - 400)
        drops[i:i + 400] += RNG.standard_normal(400) * np.exp(-np.arange(400) / 60) * RNG.uniform(0.02, 0.12)
    return x + drops


def synth_room_tone(d=10.0):
    n = RNG.standard_normal(int(d * SR))
    return _fft_filter(n, 40, 260) * 0.12 + 0.01 * np.sin(2 * np.pi * 50 * _t(d))


def synth_chair_creak(d=0.9):
    t = _t(d)
    f = 240 + 90 * np.sin(2 * np.pi * 3.2 * t) + 160 * t
    x = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.2
    return _fft_filter(x, 150, 1800) * np.sin(np.pi * t / d) ** 1.5


SYNTH = {k[6:]: v for k, v in globals().items() if k.startswith("synth_")}


def load_audio(path: Path) -> np.ndarray:
    out = subprocess.check_output(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"])
    return np.frombuffer(out, np.float32).astype(np.float64)


def render_cue(cue: dict, cache: Path) -> np.ndarray:
    name = cue["sfx"]
    if name in SYNTH:
        x = SYNTH[name](cue["dur"]) if "dur" in cue and not cue.get("loop") else SYNTH[name]()
    elif name.startswith("gen:"):
        from .media import sfx_cached
        x = load_audio(sfx_cached(name[4:], cache, int(math.ceil(cue.get("dur", 5)))))
    else:
        x = load_audio(Path(name))
    if cue.get("loop") and "dur" in cue:
        reps = int(math.ceil(cue["dur"] * SR / len(x)))
        x = np.tile(x, reps)[: int(cue["dur"] * SR)]
        fade = int(0.5 * SR)
        x[:fade] *= np.linspace(0, 1, fade)
        x[-fade:] *= np.linspace(1, 0, fade)
    elif "dur" in cue and len(x) > cue["dur"] * SR:
        x = x[: int(cue["dur"] * SR)] * _env(int(cue["dur"] * SR), 0.005, 0.05)
    peak = np.max(np.abs(x)) or 1.0
    return x / peak * 10 ** (cue.get("gain_db", -12) / 20)


def mix_cues(cues: list[dict], total: float, cache: Path, *, base_wav: Path | None = None) -> np.ndarray:
    """Return a stereo float array [n, 2] with every cue placed (optionally over a base track)."""
    n = int(total * SR)
    stereo = np.zeros((n, 2))
    if base_wav:
        base = load_audio(base_wav)[:n]
        stereo[: len(base)] += base[:, None]
    for cue in cues:
        x = render_cue(cue, cache)
        s = int(cue["t"] * SR)
        if s >= n:
            continue
        x = x[: n - s]
        pan = float(cue.get("pan", 0.0))
        l, r = math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)
        stereo[s:s + len(x), 0] += x * l * 1.414
        stereo[s:s + len(x), 1] += x * r * 1.414
    return stereo


def write_wav(path: Path, stereo: np.ndarray) -> Path:
    peak = np.max(np.abs(stereo))
    if peak > 0.97:
        stereo = stereo / peak * 0.97
    pcm = (stereo * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    return path


def build_sfx_track(cue_file: Path, total: float, out: Path, cache: Path) -> Path:
    cues = json.loads(Path(cue_file).read_text())
    cues = cues["cues"] if isinstance(cues, dict) else cues
    return write_wav(out, mix_cues(cues, total, cache))


def list_sfx() -> list[dict]:
    return [{"sfx": k, "kind": "synth"} for k in SYNTH] + [{"sfx": "gen:<prompt>", "kind": "generated (Stable Audio, cached)"}]
