from dataclasses import dataclass

import numpy as np

from .specs import GPUS

SPATIAL = 16
STEPS = 6


@dataclass(frozen=True)
class Clip:
    w: int
    h: int
    frames: int
    tc: int = 4

    @property
    def lat_h(self):
        return self.h // SPATIAL

    @property
    def lat_w(self):
        return self.w // SPATIAL

    @property
    def lat_f(self):
        return max(1, round(self.frames / self.tc))

    @property
    def tokens(self):
        return self.lat_f * self.lat_h * self.lat_w


CLIPS = {
    "5s-768p": (1344, 768, 124),
    "5s-1080p": (1920, 1088, 124),
    "5s-1440p": (2528, 1440, 124),
    "15s-768p": (1344, 768, 362),
}


def clip(name, tc=4):
    w, h, f = CLIPS[name]
    return Clip(w, h, f, tc)


MEASURED = {
    ("h100", "5s-768p"): ("denoise", 42.0),
    ("h100", "15s-768p"): ("denoise", 262.0),
    ("pro6000", "5s-768p"): ("denoise", 36.0),
    ("pro6000", "5s-1080p"): ("total", 143.0),
    ("pro6000", "5s-1440p"): ("total", 367.0),
}

PRO6000_OVERHEAD_S = 19.0


def fit_h100(tc=4):
    n5 = clip("5s-768p", tc).tokens
    n15 = clip("15s-768p", tc).tokens
    t5 = MEASURED[("h100", "5s-768p")][1] / STEPS
    t15 = MEASURED[("h100", "15s-768p")][1] / STEPS
    m = np.array([[n5, n5 ** 2], [n15, n15 ** 2]], dtype=float)
    a, b = np.linalg.solve(m, np.array([t5, t15]))
    return float(a), float(b)


def fit_pro6000(tc=4):
    n0 = clip("5s-768p", tc).tokens
    rows, rhs = [], []
    for name in ("5s-1080p", "5s-1440p"):
        n = clip(name, tc).tokens
        rows.append([STEPS * n, STEPS * n * n])
        rhs.append(MEASURED[("pro6000", name)][1] - PRO6000_OVERHEAD_S * n / n0)
    a, b = np.linalg.solve(np.array(rows, dtype=float), np.array(rhs))
    return float(a), float(b)


def attn_fraction(a, b, n):
    return b * n * n / (a * n + b * n * n)


def coeffs(gpu_key, tc=4):
    ha, hb = fit_h100(tc)
    pa, pb = fit_pro6000(tc)
    g = GPUS[gpu_key]
    if gpu_key == "h100":
        return ha, hb
    if gpu_key == "pro6000":
        return pa, pb
    if g.arch == "sm_90":
        return ha * GPUS["h100"].lin / g.lin, hb * GPUS["h100"].bf16 / g.bf16
    return pa * GPUS["pro6000"].lin / g.lin, pb * GPUS["pro6000"].bf16 / g.bf16


def step_seconds(gpu_key, c, rho=1.0, tc=4):
    a, b = coeffs(gpu_key, tc)
    n = c.tokens
    return a * n + b * n * n * rho


def clip_seconds(gpu_key, c, rho=1.0, sparse_frac=1.0, tc=4):
    a, b = coeffs(gpu_key, tc)
    n = c.tokens
    dense = a * n + b * n * n
    sparse = a * n + b * n * n * rho
    return STEPS * ((1 - sparse_frac) * dense + sparse_frac * sparse)


def vram_gb(c, d_model=5120, layers=64, wbytes=21.0):
    kv = 2 * c.tokens * d_model * 2 / 1e9
    act = 4 * c.tokens * d_model * 2 / 1e9
    return wbytes + kv + act
