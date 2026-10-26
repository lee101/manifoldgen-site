from __future__ import annotations

import cv2
import numpy as np

from .signals import Signals

LEVELS = (1.0, 0.7, 0.5, 0.35, 0.25)


def _smooth(x: float) -> float:
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def pick_slowmo(sig: Signals, min_power: float = 0.85, spacing: float = 1.6) -> list[float]:
    out: list[float] = []
    for e in sig.events:
        if e.power >= min_power and (not out or e.t - out[-1] >= spacing):
            out.append(e.t)
    return out


def speed_at(t: float, hits: list[float], floor: float = 0.22) -> float:
    s = 1.0
    for te in hits:
        d = t - te
        if d < -0.28 or d > 0.65:
            continue
        w = _smooth((d + 0.28) / 0.22) if d < -0.06 else (1.0 if d <= 0.35 else 1.0 - _smooth((d - 0.35) / 0.3))
        s = min(s, 1.0 - (1.0 - floor) * w)
    return s


def plan(frames: int, fps: float, hits: list[float], floor: float = 0.22, max_ratio: float = 3.0) -> tuple[np.ndarray, np.ndarray]:
    """Source-frame position and playback speed for each output frame."""
    if not hits:
        pos = np.arange(frames, dtype=np.float64)
        return pos, np.ones(frames)
    pos, spd = [], []
    p = 0.0
    cap = int(frames * max_ratio)
    while p <= frames - 1 and len(pos) < cap:
        s = speed_at(p / fps, hits, floor)
        pos.append(p)
        spd.append(s)
        p += s
    return np.asarray(pos), np.asarray(spd)


def quantize(spd: np.ndarray) -> np.ndarray:
    lv = np.asarray(LEVELS)
    return lv[np.abs(spd[:, None] - lv[None, :]).argmin(axis=1)]


def segments(pos: np.ndarray, spd: np.ndarray, fps: float) -> list[tuple[float, float, float]]:
    """(source_start_s, source_end_s, level) runs for audio time-stretching."""
    q = quantize(spd)
    runs = []
    i = 0
    while i < len(q):
        j = i
        while j + 1 < len(q) and q[j + 1] == q[i]:
            j += 1
        a = pos[i] / fps
        b = (pos[j] + q[j]) / fps
        runs.append((a, b, float(q[i])))
        i = j + 1
    return runs


def atempo_chain(v: float) -> str:
    parts = []
    while v < 0.5:
        parts.append("atempo=0.5")
        v /= 0.5
    parts.append(f"atempo={v:.4f}")
    return ",".join(parts)


class Interpolator:
    def __init__(self) -> None:
        self.dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_FAST)
        self.key: int | None = None
        self.f01 = self.f10 = None

    def at(self, a: np.ndarray, b: np.ndarray, key: int, alpha: float) -> np.ndarray:
        if alpha < 0.02:
            return a
        if alpha > 0.98:
            return b
        h, w = a.shape[:2]
        if self.key != key:
            ga = cv2.cvtColor(a, cv2.COLOR_BGR2GRAY)
            gb = cv2.cvtColor(b, cv2.COLOR_BGR2GRAY)
            self.f01 = self.dis.calc(ga, gb, None)
            self.f10 = self.dis.calc(gb, ga, None)
            self.key = key
        gx, gy = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
        wa = cv2.remap(a, gx + self.f10[..., 0] * alpha, gy + self.f10[..., 1] * alpha, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        wb = cv2.remap(b, gx + self.f01[..., 0] * (1 - alpha), gy + self.f01[..., 1] * (1 - alpha), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        return cv2.addWeighted(wa, 1 - alpha, wb, alpha, 0)
