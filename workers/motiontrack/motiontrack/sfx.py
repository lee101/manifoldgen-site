from __future__ import annotations

import numpy as np

SR = 44100


def _env(n: int, tau: float) -> np.ndarray:
    return np.exp(-np.arange(n) / (SR * tau))


def _noise(rng: np.random.Generator, n: int) -> np.ndarray:
    return rng.standard_normal(n).astype(np.float32)


def _fast_lp(x: np.ndarray, hz: float) -> np.ndarray:
    from scipy.signal import butter, lfilter

    b, a = butter(2, min(hz / (SR / 2), 0.99), "low")
    return lfilter(b, a, x).astype(np.float32)


def _band(x: np.ndarray, lo: float, hi: float) -> np.ndarray:
    from scipy.signal import butter, lfilter

    b, a = butter(2, [lo / (SR / 2), min(hi / (SR / 2), 0.99)], "band")
    return lfilter(b, a, x).astype(np.float32)


def impact(power: float, seed: int = 1) -> np.ndarray:
    rng = np.random.default_rng(seed)
    n = int(SR * 0.55)
    t = np.arange(n) / SR
    f = 42 + 70 * np.exp(-t / 0.04)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * _env(n, 0.13)
    slap = _band(_noise(rng, n), 900, 5500) * _env(n, 0.035)
    crack = _noise(rng, n) * _env(n, 0.004)
    tail = _fast_lp(_noise(rng, n), 380) * _env(n, 0.22) * 0.5
    x = body * 0.95 + slap * 0.9 + crack * 0.5 + tail * 0.4
    return (x * (0.55 + 0.45 * min(power, 1.4))).astype(np.float32)


def whoosh(power: float, seed: int = 2, length: float = 0.32) -> np.ndarray:
    rng = np.random.default_rng(seed)
    n = int(SR * length)
    t = np.linspace(0, 1, n)
    x = _noise(rng, n)
    lo = _band(x, 250, 1800) * np.sin(np.pi * t) ** 2
    hi = _band(x, 1800, 9000) * np.sin(np.pi * np.clip(t * 1.1, 0, 1)) ** 4 * 0.5
    return ((lo + hi) * (0.22 + 0.28 * min(power, 1.4))).astype(np.float32)


def riser(length: float = 0.6, seed: int = 3) -> np.ndarray:
    rng = np.random.default_rng(seed)
    n = int(SR * length)
    t = np.linspace(0, 1, n)
    x = _band(_noise(rng, n), 300, 7000) * t ** 2.5
    return (x * 0.3).astype(np.float32)


def kick(seed: int = 4) -> np.ndarray:
    n = int(SR * 0.28)
    t = np.arange(n) / SR
    f = 48 + 120 * np.exp(-t / 0.025)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * _env(n, 0.09)).astype(np.float32)


def hat(seed: int = 5) -> np.ndarray:
    rng = np.random.default_rng(seed)
    n = int(SR * 0.06)
    return (_band(_noise(rng, n), 6000, 15000) * _env(n, 0.012) * 0.25).astype(np.float32)


def place(buf: np.ndarray, snd: np.ndarray, t: float, gain: float = 1.0, pan: float = 0.0) -> None:
    i = int(t * SR)
    if i >= buf.shape[0] or i + len(snd) < 0:
        return
    lo = max(0, -i)
    hi = min(len(snd), buf.shape[0] - i)
    seg = snd[lo:hi] * gain
    buf[i + lo:i + hi, 0] += seg * (1 - max(pan, 0))
    buf[i + lo:i + hi, 1] += seg * (1 + min(pan, 0))


def mix_events(duration: float, items: list[tuple[str, float, float, float]]) -> np.ndarray:
    """items: (kind, out_time_s, power, pan). Returns stereo float32 in [-1, 1]."""
    buf = np.zeros((int(SR * (duration + 0.8)), 2), np.float32)
    for k, (kind, t, power, pan) in enumerate(items):
        if kind == "impact":
            place(buf, whoosh(power, seed=k, length=0.22), t - 0.17, 0.9, pan)
            place(buf, impact(power, seed=k), t, 1.0, pan)
        elif kind == "strike":
            place(buf, whoosh(power, seed=k), t - 0.2, 0.8, pan)
        elif kind == "slowmo":
            place(buf, riser(0.45, seed=k), t - 0.45, 0.8, 0)
        elif kind == "kick":
            place(buf, kick(), t, 0.75 * power, 0)
        elif kind == "hat":
            place(buf, hat(k), t, power, pan)
    peak = float(np.abs(buf).max())
    if peak > 0.95:
        buf *= 0.95 / peak
    return buf[: int(SR * duration)]


def write_wav(path: str, stereo: np.ndarray) -> None:
    import wave

    pcm = (np.clip(stereo, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
