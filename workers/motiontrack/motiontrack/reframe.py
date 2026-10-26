from __future__ import annotations

import numpy as np
from scipy.ndimage import gaussian_filter1d

from .signals import Signals
from .track import TrackSet

ASPECTS = {"9:16": (9, 16), "4:5": (4, 5), "1:1": (1, 1), "16:9": (16, 9)}
MAX_OUT_SIDE = 1280


def crop_size(w: int, h: int, aspect: str) -> tuple[int, int]:
    """Largest crop of w x h with the requested aspect ratio (even sizes)."""
    aw, ah = ASPECTS[aspect]
    if w * ah >= h * aw:
        ch, cw = h, h * aw / ah
    else:
        cw, ch = w, w * ah / aw
    return int(cw) // 2 * 2, int(ch) // 2 * 2


def output_size(cw: int, ch: int) -> tuple[int, int]:
    """Scale the crop so its long side is 1280 (at most 2x upscale)."""
    s = min(MAX_OUT_SIDE / max(cw, ch), 2.0)
    return int(cw * s) // 2 * 2, int(ch * s) // 2 * 2


def camera_path(ts: TrackSet, sig: Signals, frames: int, cw: int, ch: int, sigma_s: float = 0.4) -> np.ndarray:
    """Per-frame crop centre (x, y): energy-weighted centroid of the people, smoothed, kept inside the frame."""
    w, h = ts.width, ts.height
    raw = np.full((frames, 2), np.nan, np.float32)
    for f in range(frames):
        pts, wts = [], []
        for t in ts.active(f):
            b = t.box_at(f)
            e = sig.track_energy.get(t.id)
            gain = 1.0 + (3.0 * min(float(e[f]) / max(float(e.max()), 1e-6), 1.0) if e is not None and f < len(e) else 0.0)
            pts.append(((b[0] + b[2]) / 2, (b[1] + b[3]) / 2))
            wts.append(gain)
        if pts:
            raw[f] = np.average(np.asarray(pts), axis=0, weights=np.asarray(wts))
    idx = np.flatnonzero(~np.isnan(raw[:, 0]))
    if len(idx) == 0:
        return np.tile(np.array([[w / 2, h / 2]], np.float32), (frames, 1))
    for k in (0, 1):
        raw[:, k] = np.interp(np.arange(frames), idx, raw[idx, k])
    path = gaussian_filter1d(raw, max(sigma_s * ts.fps, 1.0), axis=0, mode="nearest")
    path[:, 0] = np.clip(path[:, 0], cw / 2, w - cw / 2)
    path[:, 1] = np.clip(path[:, 1], ch / 2, h - ch / 2)
    return path.astype(np.float32)


def crop_frame(img: np.ndarray, center: np.ndarray, cw: int, ch: int) -> np.ndarray:
    h, w = img.shape[:2]
    x0 = int(round(min(max(center[0] - cw / 2, 0), w - cw)))
    y0 = int(round(min(max(center[1] - ch / 2, 0), h - ch)))
    return img[y0:y0 + ch, x0:x0 + cw]
