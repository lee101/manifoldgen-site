from __future__ import annotations

import json
import os
import subprocess
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
from scipy.ndimage import gaussian_filter1d

from . import beats as beatmod
from .fx import FONT, PALETTES, _glow_blur

TOOLS = ("track-blur", "sticky-overlay", "flow-fx", "reactive-fx", "mask-propagate")
FLOW_EFFECTS = ("motion-blur", "jelly", "trails", "flow-color")
REACTIVE_EFFECTS = ("glow", "trails", "sparks", "warp", "flash")
BLUR_STYLES = ("blur", "pixelate", "solid")


class BadInput(Exception):
    pass


def num(p: dict, k: str, d: float, lo: float, hi: float) -> float:
    v = p.get(k, d)
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        return d
    return float(min(hi, max(lo, v)))


@dataclass
class Clip:
    path: str
    fps: float
    first: int
    n: int
    W: int
    H: int
    tw: int
    th: int

    @property
    def seconds(self) -> float:
        return self.n / self.fps

    @property
    def sx(self) -> float:
        return self.W / self.tw

    @property
    def sy(self) -> float:
        return self.H / self.th


def _even(v: float) -> int:
    return max(16, int(round(v / 2)) * 2)


def open_clip(video: str, p: dict) -> Clip:
    cap = cv2.VideoCapture(video)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
    w0, h0 = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    cap.release()
    if w0 <= 0 or h0 <= 0 or total <= 0:
        raise BadInput("video is not readable")
    first = int(num(p, "start", 0.0, 0.0, 3600.0) * fps)
    n = min(total - first, int(num(p, "max_seconds", 20.0, 0.5, 120.0) * fps))
    if n < 2:
        raise BadInput("video is too short")
    s = min(1.0, num(p, "max_side", 1280, 320, 1920) / max(w0, h0))
    W, H = _even(w0 * s), _even(h0 * s)
    ts = min(1.0, num(p, "track_side", 640, 256, 1024) / max(W, H))
    return Clip(video, fps, first, n, W, H, _even(W * ts), _even(H * ts))


def _frames(c: Clip, w: int, h: int):
    cap = cv2.VideoCapture(c.path)
    if c.first:
        cap.set(cv2.CAP_PROP_POS_FRAMES, c.first)
    for _ in range(c.n):
        ok, fr = cap.read()
        if not ok:
            break
        if fr.shape[1] != w or fr.shape[0] != h:
            fr = cv2.resize(fr, (w, h), interpolation=cv2.INTER_AREA)
        yield fr
    cap.release()


def track_frames(c: Clip) -> np.ndarray:
    fr = [cv2.cvtColor(f, cv2.COLOR_BGR2RGB) for f in _frames(c, c.tw, c.th)]
    if len(fr) < 2:
        raise BadInput("video is not readable")
    c.n = len(fr)
    return np.stack(fr)


def out_frames(c: Clip):
    return _frames(c, c.W, c.H)


class Sink:
    def __init__(self, path: str, c: Clip, crf: int = 18):
        self.p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{c.W}x{c.H}", "-r", f"{c.fps:.5f}",
                                   "-i", "-", "-c:v", "libx264", "-preset", "veryfast", "-crf", str(crf), "-pix_fmt", "yuv420p", "-movflags", "+faststart", path],
                                  stdin=subprocess.PIPE)

    def write(self, f: np.ndarray) -> None:
        self.p.stdin.write(np.ascontiguousarray(np.clip(f, 0, 255).astype(np.uint8)).tobytes())

    def close(self) -> None:
        self.p.stdin.close()
        if self.p.wait():
            raise RuntimeError("ffmpeg encode failed")


def has_audio(path: str) -> bool:
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", path], capture_output=True, text=True)
    return bool(r.stdout.strip())


def mux(silent: str, out: str, c: Clip, audio: str | None = None, audio_start: float | None = None) -> bool:
    src = audio or c.path
    off = audio_start if audio is not None else c.first / c.fps
    if not has_audio(src):
        Path(silent).replace(out)
        return False
    cmd = ["ffmpeg", "-v", "error", "-y", "-i", silent, "-ss", f"{off or 0:.3f}", "-i", src, "-map", "0:v", "-map", "1:a:0", "-c:v", "copy",
           "-c:a", "aac", "-b:a", "192k", "-t", f"{c.seconds:.3f}", "-shortest", "-movflags", "+faststart", out]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr.strip()[-400:])
    return True


def poster(video: str, out: str, frac: float = 0.5) -> None:
    cap = cv2.VideoCapture(video)
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.set(cv2.CAP_PROP_POS_FRAMES, int(max(0, n * frac)))
    ok, fr = cap.read()
    cap.release()
    if ok:
        cv2.imwrite(out, fr, [cv2.IMWRITE_JPEG_QUALITY, 90])


def parse_rect(p: dict, W: int, H: int, key: str = "region", default=(0.4, 0.3, 0.2, 0.2)) -> tuple[float, float, float, float]:
    r = p.get(key)
    pt = p.get("point")
    if isinstance(r, dict):
        x, y, w, h = (num(r, "x", default[0], 0, 1), num(r, "y", default[1], 0, 1), num(r, "w", default[2], 0.01, 1), num(r, "h", default[3], 0.01, 1))
    elif isinstance(pt, dict):
        rad = num(pt, "radius", 0.08, 0.01, 0.5)
        cx, cy = num(pt, "x", 0.5, 0, 1), num(pt, "y", 0.5, 0, 1)
        w, h = rad * 2, rad * 2 * W / H
        x, y = cx - w / 2, cy - h / 2
    else:
        raise BadInput(f"{key} (x, y, w, h fractions) or point (x, y, radius) is required")
    x0, y0 = max(0.0, x) * W, max(0.0, y) * H
    x1, y1 = min(1.0, x + w) * W, min(1.0, y + h) * H
    if x1 - x0 < 4 or y1 - y0 < 4:
        raise BadInput("region is outside the frame")
    return x0, y0, x1, y1


def rect_corners(r: tuple[float, float, float, float]) -> np.ndarray:
    x0, y0, x1, y1 = r
    return np.array([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], np.float32)


def grid_queries(r: tuple[float, float, float, float], pad: float, W: int, H: int, k: int = 5) -> np.ndarray:
    cx, cy = (r[0] + r[2]) / 2, (r[1] + r[3]) / 2
    hw, hh = (r[2] - r[0]) / 2 * pad, (r[3] - r[1]) / 2 * pad
    xs = np.clip(np.linspace(cx - hw, cx + hw, k), 1, W - 2)
    ys = np.clip(np.linspace(cy - hh, cy + hh, k), 1, H - 2)
    gx, gy = np.meshgrid(xs, ys)
    return np.stack([gx.ravel(), gy.ravel()], 1).astype(np.float32)


def smooth_t(x: np.ndarray, sigma: float) -> np.ndarray:
    if sigma <= 0 or len(x) < 3:
        return x
    pad = min(int(4 * sigma) + 1, len(x) - 1)
    pw = [(pad, pad)] + [(0, 0)] * (x.ndim - 1)
    return gaussian_filter1d(np.pad(x, pw, mode="reflect", reflect_type="odd"), sigma, axis=0, mode="nearest")[pad:-pad]


def fill_smooth(pos: np.ndarray, vis: np.ndarray, sigma: float = 1.5) -> np.ndarray:
    T, N, _ = pos.shape
    out = pos.astype(np.float32).copy()
    t = np.arange(T)
    for j in range(N):
        v = vis[:, j]
        if v.sum() == 0:
            continue
        if v.sum() < T:
            for d in range(2):
                out[:, j, d] = np.interp(t, t[v], pos[v, j, d])
    return smooth_t(out, sigma)


def fit_quads(q0: np.ndarray, pos: np.ndarray, vis: np.ndarray, corners: np.ndarray, persp: float = 0.5, sigma: float = 1.2) -> tuple[np.ndarray, np.ndarray]:
    T = len(pos)
    quads = np.zeros((T, 4, 2), np.float32)
    ident = np.eye(3, dtype=np.float64)
    prev_h, prev_s = ident, ident
    c = np.concatenate([corners, np.ones((4, 1), np.float32)], 1).astype(np.float64)
    for t in range(T):
        v = vis[t]
        h_m, s_m = prev_h, prev_s
        if v.sum() >= 6:
            m, _ = cv2.findHomography(q0[v], pos[t][v], cv2.RANSAC, 3.0)
            if m is not None and np.isfinite(m).all() and 0.15 < np.sqrt(abs(np.linalg.det(m[:2, :2]))) < 6:
                h_m = m
        if v.sum() >= 2:
            a, _ = cv2.estimateAffinePartial2D(q0[v], pos[t][v], method=cv2.RANSAC, ransacReprojThreshold=3.0)
            if a is not None and np.isfinite(a).all():
                s_m = np.vstack([a, [0, 0, 1]])
        prev_h, prev_s = h_m, s_m
        qh = (c @ h_m.T)
        qh = qh[:, :2] / np.maximum(qh[:, 2:3], 1e-6)
        qs = (c @ s_m.T)[:, :2]
        quads[t] = persp * qh + (1 - persp) * qs
    quads = smooth_t(quads, sigma)
    frac = vis.mean(axis=1).astype(np.float32)
    return quads, frac


def region_quads(sparse, frames: np.ndarray, rect: tuple, pad: float, c: Clip, persp: float) -> tuple[np.ndarray, np.ndarray]:
    sr = (rect[0] / c.sx, rect[1] / c.sy, rect[2] / c.sx, rect[3] / c.sy)
    q = grid_queries(sr, pad, c.tw, c.th)
    pos, vis = sparse.tracks(frames, q)
    pos = fill_smooth(pos, vis)
    cx, cy = (sr[0] + sr[2]) / 2, (sr[1] + sr[3]) / 2
    corners = np.array([[cx + (x - cx) * pad, cy + (y - cy) * pad] for x, y in rect_corners(sr)], np.float32)
    quads, frac = fit_quads(q, pos, vis, corners, persp)
    quads[..., 0] *= c.sx
    quads[..., 1] *= c.sy
    return quads, frac


def quad_mask(quad: np.ndarray, W: int, H: int, shrink: float = 1.0, feather: float = 0.0) -> np.ndarray:
    m = np.zeros((H, W), np.float32)
    ctr = quad.mean(axis=0)
    q = (ctr + (quad - ctr) * shrink)
    cv2.fillConvexPoly(m, np.round(q * 16).astype(np.int32), 1.0, lineType=cv2.LINE_AA, shift=4)
    if feather > 0.5:
        k = int(feather * 3) | 1
        m = cv2.GaussianBlur(m, (k, k), feather)
    return m


def soften(m: np.ndarray, grow: float, feather: float) -> np.ndarray:
    if grow > 0.5:
        k = int(grow) * 2 + 1
        m = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    if feather > 0.5:
        k = int(feather * 3) | 1
        m = cv2.GaussianBlur(m, (k, k), feather)
    return m


def apply_blur(frame: np.ndarray, m: np.ndarray, style: str, strength: float, color=(0, 0, 0)) -> np.ndarray:
    ys, xs = np.where(m > 0.01)
    if len(xs) == 0:
        return frame
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    size = max(x1 - x0, y1 - y0)
    if style == "solid":
        eff = np.empty_like(frame[y0:y1, x0:x1])
        eff[:] = color
    elif style == "pixelate":
        b = max(6, int(strength * size / 12))
        roi = frame[y0:y1, x0:x1]
        small = cv2.resize(roi, (max(1, roi.shape[1] // b), max(1, roi.shape[0] // b)), interpolation=cv2.INTER_AREA)
        eff = cv2.resize(small, (roi.shape[1], roi.shape[0]), interpolation=cv2.INTER_NEAREST)
    else:
        sigma = max(6.0, 0.05 * size) * strength
        pad = int(sigma * 2)
        ya, yb, xa, xb = max(0, y0 - pad), min(frame.shape[0], y1 + pad), max(0, x0 - pad), min(frame.shape[1], x1 + pad)
        roi = frame[ya:yb, xa:xb]
        s = max(1, int(sigma / 6))
        small = cv2.resize(roi, (max(1, roi.shape[1] // s), max(1, roi.shape[0] // s)), interpolation=cv2.INTER_AREA)
        small = cv2.GaussianBlur(small, (0, 0), sigma / s)
        eff = cv2.resize(small, (roi.shape[1], roi.shape[0]), interpolation=cv2.INTER_LINEAR)[y0 - ya:y1 - ya, x0 - xa:x1 - xa]
    out = frame.copy()
    mm = m[y0:y1, x0:x1, None]
    out[y0:y1, x0:x1] = (frame[y0:y1, x0:x1].astype(np.float32) * (1 - mm) + eff.astype(np.float32) * mm).astype(np.uint8)
    return out


def load_mask(path: str, W: int, H: int) -> np.ndarray:
    img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if img is None:
        raise BadInput("mask image is not readable")
    if img.ndim == 3 and img.shape[2] == 4:
        img = img[..., 3] if img[..., 3].min() < 250 else cv2.cvtColor(img[..., :3], cv2.COLOR_BGR2GRAY)
    elif img.ndim == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    img = cv2.resize(img, (W, H), interpolation=cv2.INTER_LINEAR)
    return (img > 127).astype(np.float32)


def seed_mask(p: dict, c: Clip, w: int, h: int) -> np.ndarray:
    path = p.get("mask_path")
    if path:
        return load_mask(path, w, h)
    r = parse_rect(p, w, h)
    m = np.zeros((h, w), np.float32)
    if p.get("shape") == "ellipse":
        cv2.ellipse(m, (int((r[0] + r[2]) / 2), int((r[1] + r[3]) / 2)), (int((r[2] - r[0]) / 2), int((r[3] - r[1]) / 2)), 0, 0, 360, 1.0, -1, cv2.LINE_AA)
    else:
        m[int(r[1]):int(r[3]), int(r[0]):int(r[2])] = 1.0
    return m


def splat(mask: np.ndarray, flow: np.ndarray, conf: np.ndarray | None = None, dev: str | None = None) -> np.ndarray:
    h, w = mask.shape
    if dev and dev.startswith("cuda"):
        from . import ptgpu

        return _splat_post(*ptgpu.splat(mask, flow, conf, dev))
    gy, gx = np.mgrid[0:h, 0:w].astype(np.float32)
    xs, ys = gx + flow[..., 0].astype(np.float32), gy + flow[..., 1].astype(np.float32)
    x0, y0 = np.floor(xs).astype(np.int32), np.floor(ys).astype(np.int32)
    fx, fy = xs - x0, ys - y0
    ok = np.ones((h, w), bool) if conf is None else conf > 0.1
    num_, den = np.zeros(h * w, np.float64), np.zeros(h * w, np.float64)
    for dx, dy, wt in ((0, 0, (1 - fx) * (1 - fy)), (1, 0, fx * (1 - fy)), (0, 1, (1 - fx) * fy), (1, 1, fx * fy)):
        xi, yi = x0 + dx, y0 + dy
        v = ok & (xi >= 0) & (xi < w) & (yi >= 0) & (yi < h)
        idx = (yi * w + xi)[v]
        ww = wt[v]
        num_ += np.bincount(idx, ww * mask[v], minlength=h * w)
        den += np.bincount(idx, ww, minlength=h * w)
    return _splat_post(num_.reshape(h, w).astype(np.float32), den.reshape(h, w).astype(np.float32))


def _splat_post(num_: np.ndarray, den: np.ndarray) -> np.ndarray:
    valid = den >= 0.3
    est = cv2.GaussianBlur(num_ * valid, (0, 0), 3) / np.maximum(cv2.GaussianBlur(den * valid, (0, 0), 3), 1e-3)
    out = np.where(valid, num_ / np.maximum(den, 1e-3), est)
    out = cv2.medianBlur((out * 255).clip(0, 255).astype(np.uint8), 5).astype(np.float32) / 255
    return out


def propagate_masks(dense, frames: np.ndarray, mask0: np.ndarray, seg: int = 40) -> np.ndarray:
    T = len(frames)
    out = np.zeros((T,) + mask0.shape, np.float32)
    cur, s = (mask0 > 0.5).astype(np.float32), 0
    dev = getattr(dense, "device", None)
    out[0] = cur
    while s < T - 1:
        e = min(T, s + seg)
        flows, conf = dense.flow_from_first(frames[s:e])
        for t in range(1, e - s):
            out[s + t] = splat(cur, flows[t], conf[t], dev)
        cur = (out[e - 1] > 0.5).astype(np.float32)
        s = e - 1
    return out


def up_flow(f: np.ndarray, c: Clip) -> np.ndarray:
    u = cv2.resize(f.astype(np.float32), (c.W, c.H), interpolation=cv2.INTER_LINEAR)
    u[..., 0] *= c.sx
    u[..., 1] *= c.sy
    return u


def _grid(c: Clip) -> tuple[np.ndarray, np.ndarray]:
    gy, gx = np.mgrid[0:c.H, 0:c.W].astype(np.float32)
    return gx, gy


def motion_blur(frame: np.ndarray, flow: np.ndarray, gx: np.ndarray, gy: np.ndarray, shutter: float) -> np.ndarray:
    mag = float(np.percentile(np.hypot(flow[..., 0], flow[..., 1]), 99)) * shutter
    n = int(np.clip(mag, 3, 25))
    acc = np.zeros(frame.shape, np.float32)
    for k in np.linspace(-0.5, 0.5, n).tolist():
        acc += cv2.remap(frame, gx + k * shutter * flow[..., 0], gy + k * shutter * flow[..., 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    return acc / n


class Jelly:
    def __init__(self, c: Clip, strength: float):
        self.E = np.zeros((c.H, c.W, 2), np.float32)
        self.V = np.zeros_like(self.E)
        self.g = 0.32 * strength

    def step(self, frame: np.ndarray, flow: np.ndarray, gx, gy) -> np.ndarray:
        self.V += self.g * flow
        self.V -= 0.2 * self.E
        self.V *= 0.8
        self.E = cv2.GaussianBlur(self.E + self.V, (0, 0), 5)
        np.clip(self.E, -30, 30, out=self.E)
        return cv2.remap(frame, gx - self.E[..., 0], gy - self.E[..., 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)


class FlowTrails:
    def __init__(self, c: Clip, color, decay: float):
        self.T = np.zeros((c.H, c.W, 3), np.float32)
        self.color = np.array(color, np.float32)
        self.decay = decay

    def step(self, frame: np.ndarray, prev_flow: np.ndarray, flow: np.ndarray, gx, gy, strength: float) -> np.ndarray:
        self.T = cv2.remap(self.T, gx - prev_flow[..., 0], gy - prev_flow[..., 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT) * self.decay
        mag = cv2.GaussianBlur(np.hypot(flow[..., 0], flow[..., 1]), (0, 0), 2)
        a = np.clip(mag / 5.0, 0, 1)[..., None]
        f = frame.astype(np.float32)
        tint = f * (0.45 + 0.55 * self.color[None, None, :] * 1.1)
        self.T = np.maximum(self.T, tint * a)
        return np.maximum(f, self.T * strength)


def flow_color(frame: np.ndarray, flow: np.ndarray, amount: float) -> np.ndarray:
    ang = np.arctan2(flow[..., 1], flow[..., 0])
    mag = np.clip(np.hypot(flow[..., 0], flow[..., 1]) / 12.0, 0, 1)
    hsv = np.stack([((ang + np.pi) / (2 * np.pi) * 179).astype(np.uint8), np.full(mag.shape, 255, np.uint8), (mag * 255).astype(np.uint8)], -1)
    col = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR).astype(np.float32)
    return frame.astype(np.float32) * (1 - amount * mag[..., None]) + col * amount * mag[..., None]


def render_text(text: str, width_px: int, color=(255, 255, 255)) -> np.ndarray:
    from PIL import Image, ImageDraw, ImageFont

    size = 200
    font = ImageFont.truetype(str(FONT), size)
    box = ImageDraw.Draw(Image.new("L", (8, 8))).textbbox((0, 0), text, font=font, stroke_width=size // 14)
    tw_, th_ = box[2] - box[0], box[3] - box[1]
    s = width_px / max(tw_, 1)
    font = ImageFont.truetype(str(FONT), max(8, int(size * s)))
    sw = max(2, int(size * s / 14))
    box = ImageDraw.Draw(Image.new("L", (8, 8))).textbbox((0, 0), text, font=font, stroke_width=sw)
    img = Image.new("RGBA", (box[2] - box[0] + 8, box[3] - box[1] + 8), (0, 0, 0, 0))
    ImageDraw.Draw(img).text((4 - box[0], 4 - box[1]), text, font=font, fill=tuple(color) + (255,), stroke_width=sw, stroke_fill=(0, 0, 0, 255))
    a = np.array(img)
    return cv2.cvtColor(a, cv2.COLOR_RGBA2BGRA)


def load_sticker(path: str, width_px: int) -> np.ndarray:
    img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if img is None:
        raise BadInput("sticker image is not readable")
    if img.ndim == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGRA)
    elif img.shape[2] == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    s = width_px / img.shape[1]
    return cv2.resize(img, (width_px, max(2, int(img.shape[0] * s))), interpolation=cv2.INTER_AREA)


def hex_bgr(s: str | None, d=(255, 255, 255)) -> tuple[int, int, int]:
    if isinstance(s, str) and len(s.lstrip("#")) == 6:
        try:
            v = int(s.lstrip("#"), 16)
            return (v & 255, (v >> 8) & 255, v >> 16)
        except ValueError:
            pass
    return d


def make_layer(p: dict, c: Clip) -> tuple[np.ndarray, tuple[float, float, float, float]]:
    wf = num(p, "width", 0.25, 0.03, 0.9)
    cx, cy = num(p, "x", 0.5, 0, 1) * c.W, num(p, "y", 0.5, 0, 1) * c.H
    wpx = int(wf * c.W)
    if p.get("image_path"):
        spr = load_sticker(str(p["image_path"]), wpx)
    elif p.get("text"):
        spr = render_text(str(p["text"])[:40], wpx, hex_bgr(p.get("color")))
    else:
        raise BadInput("text or an image is required")
    rot = num(p, "rotation", 0.0, -180, 180)
    if abs(rot) > 0.1:
        h0, w0 = spr.shape[:2]
        diag = int(np.hypot(h0, w0)) + 4
        pad = np.zeros((diag, diag, 4), np.uint8)
        oy, ox = (diag - h0) // 2, (diag - w0) // 2
        pad[oy:oy + h0, ox:ox + w0] = spr
        spr = cv2.warpAffine(pad, cv2.getRotationMatrix2D((diag / 2, diag / 2), rot, 1.0), (diag, diag), flags=cv2.INTER_LINEAR)
    sh, sw_ = spr.shape[:2]
    layer = np.zeros((c.H, c.W, 4), np.float32)
    x0, y0 = int(cx - sw_ / 2), int(cy - sh / 2)
    xa, ya, xb, yb = max(0, x0), max(0, y0), min(c.W, x0 + sw_), min(c.H, y0 + sh)
    if xb <= xa or yb <= ya:
        raise BadInput("overlay is outside the frame")
    layer[ya:yb, xa:xb] = spr[ya - y0:yb - y0, xa - x0:xb - x0].astype(np.float32)
    a = layer[..., 3:4] / 255.0
    layer[..., :3] *= a
    layer[..., 3:4] = a
    return layer, (float(x0), float(y0), float(x0 + sw_), float(y0 + sh))


def smooth_alpha(frac: np.ndarray, fps: float) -> np.ndarray:
    a = np.clip((frac - 0.25) / 0.3, 0, 1)
    return gaussian_filter1d(a, max(1.0, fps * 0.08), mode="nearest").astype(np.float32)


WARM: dict = {}
KEEP_WARM = False


def _cache_on(p: dict) -> bool:
    return p.get("cache", os.environ.get("MOTIONTRACK_CACHE", "1")) not in (False, "0", 0)


def _backend(backends: dict | None, kind: str, p: dict):
    from . import ptbackend as B
    from .ptcache import CachedBackend

    if backends is None:
        backends = WARM if KEEP_WARM else {}
    hq = 512 if p.get("hq") else 256
    name = kind if kind in backends else f"{kind}{hq if kind == 'sparse' else ''}"
    if name not in backends:
        dev = p.get("device")
        amp = "fp16" if KEEP_WARM and not os.environ.get("MOTIONTRACK_AMP") else None
        raw = B.load_sparse(hq, dev) if kind == "sparse" else B.load_dense(dev, amp)
        backends[name] = CachedBackend(raw, tag=raw.tag)
    got = backends[name]
    if isinstance(got, CachedBackend):
        got.enabled = _cache_on(p)
    return got


def _prog(progress, stage: str, f: float) -> None:
    if progress:
        progress(stage, f)


def run_blur(c: Clip, p: dict, out_dir: Path, backends, progress) -> dict:
    style = p.get("style") if p.get("style") in BLUR_STYLES else "blur"
    strength = num(p, "strength", 1.0, 0.3, 3.0)
    feather = num(p, "feather", 0.012, 0, 0.05) * c.W
    grow = num(p, "grow", 0.0, 0, 0.05) * c.W
    invert = bool(p.get("invert"))
    color = hex_bgr(p.get("color"), (0, 0, 0))
    frames = track_frames(c)
    _prog(progress, "tracking", 0.1)
    mode = "mask" if p.get("mask_path") or p.get("mode") == "mask" else "region"
    masks = quads = None
    if mode == "mask":
        m0 = seed_mask(p, c, c.tw, c.th)
        masks = propagate_masks(_backend(backends, "dense", p), frames, m0)
        frac = np.ones(c.n, np.float32)
    else:
        rect = parse_rect(p, c.W, c.H)
        quads, frac = region_quads(_backend(backends, "sparse", p), frames, rect, num(p, "track_pad", 1.4, 1.0, 3.0), c, num(p, "persp", 0.5, 0, 1))
    _prog(progress, "rendering", 0.6)
    tmp = tempfile.mkdtemp(dir=out_dir)
    silent = str(Path(tmp) / "s.mp4")
    sink = Sink(silent, c)
    first = None
    for i, fr in enumerate(out_frames(c)):
        if i >= c.n:
            break
        if mode == "mask":
            m = cv2.resize(masks[i], (c.W, c.H), interpolation=cv2.INTER_LINEAR)
        else:
            m = quad_mask(quads[i], c.W, c.H, 1.0)
        m = soften(m, grow, feather)
        if invert:
            m = 1 - m
        res = apply_blur(fr, m, style, strength, color)
        if first is None:
            first = res
        sink.write(res)
    sink.close()
    mux(silent, str(out_dir / "result.mp4"), c)
    return {"mode": mode, "style": style, "tracked_visible": round(float(frac.mean()), 3)}


def run_sticky(c: Clip, p: dict, out_dir: Path, backends, progress) -> dict:
    layer, rect = make_layer(p, c)
    pad = num(p, "track_pad", 1.8, 1.0, 4.0)
    frames = track_frames(c)
    _prog(progress, "tracking", 0.1)
    quads, frac = region_quads(_backend(backends, "sparse", p), frames, rect, pad, c, num(p, "persp", 0.5, 0, 1))
    cx, cy = (rect[0] + rect[2]) / 2, (rect[1] + rect[3]) / 2
    support = np.array([[cx + (x - cx) * pad, cy + (y - cy) * pad] for x, y in rect_corners(rect)], np.float32)
    alpha_t = smooth_alpha(frac, c.fps)
    sprite_box = rect_corners(rect).reshape(1, 4, 2).astype(np.float64)
    fade = int(num(p, "fade", 0.25, 0, 2) * c.fps)
    pop = bool(p.get("pop", True))
    _prog(progress, "rendering", 0.6)
    tmp = tempfile.mkdtemp(dir=out_dir)
    silent = str(Path(tmp) / "s.mp4")
    sink = Sink(silent, c)
    for i, fr in enumerate(out_frames(c)):
        if i >= c.n:
            break
        h_m = cv2.getPerspectiveTransform(support, quads[i].astype(np.float32))
        if pop and i < c.fps * 0.3:
            k = i / (c.fps * 0.3)
            s = 0.4 + 0.6 * k + 0.25 * np.sin(k * np.pi)
            pre = np.array([[s, 0, cx * (1 - s)], [0, s, cy * (1 - s)], [0, 0, 1]], np.float64)
            h_m = h_m @ pre
        a = alpha_t[i] * (min(1.0, (i + 1) / fade) if fade else 1.0) * (min(1.0, (c.n - i) / fade) if fade else 1.0)
        corners = cv2.perspectiveTransform(sprite_box, h_m)[0]
        bx0, by0 = max(0, int(np.floor(corners[:, 0].min())) - 2), max(0, int(np.floor(corners[:, 1].min())) - 2)
        bx1, by1 = min(c.W, int(np.ceil(corners[:, 0].max())) + 3), min(c.H, int(np.ceil(corners[:, 1].max())) + 3)
        if bx1 <= bx0 or by1 <= by0 or a <= 0.003:
            sink.write(fr)
            continue
        shift = np.array([[1, 0, -bx0], [0, 1, -by0], [0, 0, 1]], np.float64)
        w4 = cv2.warpPerspective(layer, shift @ h_m, (bx1 - bx0, by1 - by0), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0, 0))
        al = w4[..., 3:4] * a
        out = fr.copy()
        out[by0:by1, bx0:bx1] = np.clip(fr[by0:by1, bx0:bx1].astype(np.float32) * (1 - al) + w4[..., :3] * a, 0, 255).astype(np.uint8)
        sink.write(out)
    sink.close()
    mux(silent, str(out_dir / "result.mp4"), c)
    return {"tracked_visible": round(float(frac.mean()), 3)}


def _gpu_fx(dense, p: dict) -> bool:
    if p.get("cpu_fx") or os.environ.get("MOTIONTRACK_CPU_FX") == "1":
        return False
    inner = getattr(dense, "inner", dense)
    return str(getattr(inner, "device", "")).startswith("cuda")


def _run_flow_gpu(c: Clip, flows: np.ndarray, effects: list, strength: float, pal, sink, mags: list, n_f: int) -> float:
    from . import ptgpu

    cv = ptgpu.Canvas(c.W, c.H, c.sx, c.sy)
    jelly = ptgpu.Jelly(cv, strength) if "jelly" in effects else None
    trails = ptgpu.Trails(cv, pal[0], 0.9 if strength <= 1 else 0.94) if "trails" in effects else None
    acc = []
    for i, fr in enumerate(out_frames(c)):
        if i >= c.n:
            break
        fw = cv.flow(flows[min(i, n_f - 1)])
        bw = cv.flow(flows[min(max(i - 1, 0), n_f - 1)])
        mot = 0.5 * (fw + bw)
        acc.append(ptgpu.torch.hypot(mot[0, 0], mot[0, 1]).mean())
        cur = cv.image(fr)
        if "motion-blur" in effects:
            cur = cv.motion_blur(cur, mot, 0.6 * strength * 1.6)
        if jelly is not None:
            cur = jelly.step(cur, fw)
        if trails is not None:
            cur = trails.step(cur, bw, mot, min(1.0, 0.8 * strength))
        if "flow-color" in effects:
            cur = cv.flow_color(cur, mot, min(0.9, 0.6 * strength))
        sink.write(cv.out(cur))
    return float(ptgpu.torch.stack(acc).mean()) if acc else 0.0


def run_flow(c: Clip, p: dict, out_dir: Path, backends, progress) -> dict:
    effects = [e for e in (p.get("effects") or ["motion-blur"]) if e in FLOW_EFFECTS] or ["motion-blur"]
    strength = num(p, "strength", 1.0, 0.3, 2.5)
    pal = PALETTES.get(p.get("palette"), PALETTES["gold-blue"])
    frames = track_frames(c)
    _prog(progress, "tracking", 0.1)
    dense = _backend(backends, "dense", p)
    flows, conf = dense.consecutive_flow(frames)
    gx, gy = _grid(c)
    jelly = Jelly(c, strength) if "jelly" in effects else None
    trails = FlowTrails(c, pal[0], 0.9 if strength <= 1 else 0.94) if "trails" in effects else None
    _prog(progress, "rendering", 0.6)
    tmp = tempfile.mkdtemp(dir=out_dir)
    silent = str(Path(tmp) / "s.mp4")
    sink = Sink(silent, c)
    n_f = len(flows)
    mags = []
    if _gpu_fx(dense, p):
        mean_mot = _run_flow_gpu(c, flows, effects, strength, pal, sink, mags, n_f)
        sink.close()
        mux(silent, str(out_dir / "result.mp4"), c)
        return {"effects": effects, "mean_motion_px": round(mean_mot, 2)}
    for i, fr in enumerate(out_frames(c)):
        if i >= c.n:
            break
        fw = up_flow(flows[min(i, n_f - 1)], c)
        bw = up_flow(flows[min(max(i - 1, 0), n_f - 1)], c)
        mot = 0.5 * (fw + bw)
        mags.append(float(np.hypot(mot[..., 0], mot[..., 1]).mean()))
        cur = fr
        if "motion-blur" in effects:
            cur = motion_blur(cur, mot, gx, gy, 0.6 * strength * 1.6).astype(np.uint8)
        if jelly is not None:
            cur = jelly.step(cur, fw, gx, gy)
        if trails is not None:
            cur = trails.step(cur, bw, mot, gx, gy, min(1.0, 0.8 * strength))
        if "flow-color" in effects:
            cur = flow_color(cur, mot, min(0.9, 0.6 * strength))
        sink.write(cur)
    sink.close()
    mux(silent, str(out_dir / "result.mp4"), c)
    return {"effects": effects, "mean_motion_px": round(float(np.mean(mags)), 2)}


def run_mask(c: Clip, p: dict, out_dir: Path, backends, progress) -> dict:
    frames = track_frames(c)
    m0 = seed_mask(p, c, c.tw, c.th)
    _prog(progress, "tracking", 0.1)
    masks = propagate_masks(_backend(backends, "dense", p), frames, m0, int(num(p, "segment", 40, 8, 96)))
    _prog(progress, "rendering", 0.7)
    tmp = tempfile.mkdtemp(dir=out_dir)
    sm, sp = Sink(str(out_dir / "mask.mp4"), c, crf=8), Sink(str(Path(tmp) / "p.mp4"), c)
    area = []
    for i, fr in enumerate(out_frames(c)):
        if i >= c.n:
            break
        m = cv2.resize(masks[i], (c.W, c.H), interpolation=cv2.INTER_LINEAR)
        area.append(round(float(m.mean()), 4))
        g = (m * 255).astype(np.uint8)
        sm.write(cv2.cvtColor(g, cv2.COLOR_GRAY2BGR))
        tint = np.array([40, 60, 255], np.float32)
        sp.write(fr.astype(np.float32) * (1 - 0.5 * m[..., None]) + tint * 0.5 * m[..., None])
    sm.close()
    sp.close()
    mux(str(Path(tmp) / "p.mp4"), str(out_dir / "result.mp4"), c)
    np.savez_compressed(out_dir / "masks.npz", masks=np.packbits(masks > 0.5, axis=-1), shape=np.array(masks.shape))
    return {"mask": "mask.mp4", "masks_npz": "masks.npz", "area": area[::max(1, len(area) // 24)], "area_first": area[0], "area_last": area[-1]}


def _audio_feats(c: Clip, p: dict, audio: str | None):
    src = audio or c.path
    if not has_audio(src):
        raise BadInput("reactive-fx needs audio (audio_url or a video with sound)")
    off = num(p, "audio_start", 0.0, 0, 3600) if audio else c.first / c.fps
    x = beatmod.decode(src, c.seconds + 0.2, off)
    if len(x) < beatmod.SR:
        raise BadInput("audio is too short")
    return beatmod.analyze_audio(x), off


def run_reactive(c: Clip, p: dict, out_dir: Path, backends, progress, audio: str | None = None) -> dict:
    effects = [e for e in (p.get("effects") or list(REACTIVE_EFFECTS)) if e in REACTIVE_EFFECTS] or list(REACTIVE_EFFECTS)
    inten = num(p, "intensity", 1.0, 0.3, 1.6)
    pal = [np.array(col, np.float32) * 255 for col in PALETTES.get(p.get("palette"), PALETTES["neon"])]
    feats, off = _audio_feats(c, p, audio)
    frames = track_frames(c)
    gw, gh = 28, max(6, int(round(28 * c.th / c.tw)))
    xs, ys = np.linspace(c.tw * 0.03, c.tw * 0.97, gw), np.linspace(c.th * 0.03, c.th * 0.97, gh)
    q = np.stack(np.meshgrid(xs, ys), -1).reshape(-1, 2).astype(np.float32)
    _prog(progress, "tracking", 0.1)
    pos, vis = _backend(backends, "sparse", p).tracks(frames, q)
    pos = fill_smooth(pos, vis, 1.2)
    vel = np.zeros_like(pos)
    vel[1:] = pos[1:] - pos[:-1]
    vel = gaussian_filter1d(vel, 1.0, axis=0)
    speed = np.hypot(vel[..., 0], vel[..., 1])
    rng = np.random.default_rng(int(num(p, "seed", 7, 0, 1 << 30)))
    gx, gy = _grid(c)
    parts: list[list] = []
    hist: list[np.ndarray] = []
    K = 10
    kicks = np.array([k[0] for k in feats.kicks]) if feats.kicks else np.array([])
    kpow = np.array([k[1] for k in feats.kicks]) if feats.kicks else np.array([])
    snares = np.array([s[0] for s in feats.snares]) if feats.snares else np.array([])
    _prog(progress, "rendering", 0.6)
    tmp = tempfile.mkdtemp(dir=out_dir)
    silent = str(Path(tmp) / "s.mp4")
    sink = Sink(silent, c)
    dt = 1.0 / c.fps
    for i, fr in enumerate(out_frames(c)):
        if i >= c.n:
            break
        tt = i * dt
        bass, high, onset = feats.at(feats.bass, tt), feats.at(feats.high, tt), feats.at(feats.onset, tt)
        sp = speed[min(i, len(speed) - 1)]
        pp = pos[min(i, len(pos) - 1)] * [c.sx, c.sy]
        vv = vel[min(i, len(vel) - 1)] * [c.sx, c.sy]
        thr = max(float(np.percentile(sp, 88)), 0.35)
        inside = (pp[:, 0] > c.W * 0.1) & (pp[:, 0] < c.W * 0.9) & (pp[:, 1] > c.H * 0.08) & (pp[:, 1] < c.H * 0.92)
        act = np.where((sp >= thr) & vis[min(i, len(vis) - 1)] & inside)[0]
        hist.append(pp.copy())
        hist = hist[-K:]
        base = fr
        if "warp" in effects:
            qw, qh = max(8, c.W // 4), max(8, c.H // 4)
            vf = cv2.resize(vv.reshape(gh, gw, 2).astype(np.float32), (qw, qh), interpolation=cv2.INTER_CUBIC)
            vf = cv2.resize(cv2.GaussianBlur(vf, (0, 0), c.W * 0.01 / 4), (c.W, c.H), interpolation=cv2.INTER_LINEAR)
            amp = inten * (0.6 + 2.6 * bass)
            base = cv2.remap(fr, gx - amp * vf[..., 0], gy - amp * vf[..., 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
            snare_hit = snares.size and np.any(np.abs(snares - tt) < 0.07)
            if snare_hit:
                d = int(round(c.W * 0.006 * inten * (0.5 + high)))
                if d:
                    base = base.copy()
                    base[..., 2] = np.roll(base[..., 2], d, axis=1)
                    base[..., 0] = np.roll(base[..., 0], -d, axis=1)
        sharp = np.zeros((c.H, c.W, 3), np.float32)
        soft = np.zeros((c.H, c.W, 3), np.float32)
        if "glow" in effects:
            r0 = c.W * (0.003 + 0.009 * bass * inten)
            for j in act[np.argsort(sp[act])[::-1][:90]]:
                col = pal[j % len(pal)]
                k = float(np.clip(sp[j] / (thr * 3.0), 0.25, 1.0))
                rj = max(1, int(r0 * (0.5 + k)))
                cv2.circle(soft, (int(pp[j, 0]), int(pp[j, 1])), rj * 2, tuple(float(x) * k for x in col), -1, cv2.LINE_AA)
                cv2.circle(sharp, (int(pp[j, 0]), int(pp[j, 1])), max(1, rj // 2), (255, 255, 255), -1, cv2.LINE_AA)
        if "trails" in effects and len(hist) > 1:
            for j in act[np.argsort(sp[act])[::-1][:90]]:
                col = pal[j % len(pal)]
                for k in range(1, len(hist)):
                    f = k / len(hist)
                    a, b = hist[k - 1][j], hist[k][j]
                    cv2.line(sharp, (int(a[0]), int(a[1])), (int(b[0]), int(b[1])), tuple(float(x) * f for x in col), max(1, int(c.W * 0.0025 * f * (1 + bass))), cv2.LINE_AA)
        if "sparks" in effects:
            if kicks.size and act.size:
                hit = np.where((kicks >= tt - dt) & (kicks < tt))[0]
                for h in hit:
                    top = act[np.argsort(sp[act])[-24:]]
                    for j in top:
                        for _ in range(int(2 + 3 * min(1.0, kpow[h]) * inten)):
                            ang = rng.uniform(0, 2 * np.pi)
                            spd = rng.uniform(80, 360) * c.W / 1280
                            parts.append([pp[j, 0], pp[j, 1], vv[j, 0] * c.fps * 0.15 + np.cos(ang) * spd, vv[j, 1] * c.fps * 0.15 + np.sin(ang) * spd - 60, 0.7, int(rng.integers(len(pal)))])
            alive = []
            for pt in parts:
                x, y, vx, vy, life, ci = pt
                nx, ny = x + vx * dt, y + vy * dt
                vy += 420 * dt * c.W / 1280
                life -= dt
                if life > 0:
                    f = life / 0.7
                    cv2.line(sharp, (int(x), int(y)), (int(nx), int(ny)), tuple(float(v) * f for v in pal[ci]), max(1, int(c.W * 0.0022)), cv2.LINE_AA)
                    alive.append([nx, ny, vx * 0.985, vy, life, ci])
            parts = alive[:1500]
        bloom = _glow_blur(soft + sharp, c.W * 0.012)
        lay = np.clip((sharp + soft * 0.8 + bloom * 1.4) / 255.0, 0, 1)
        f01 = base.astype(np.float32) / 255.0
        if "flash" in effects:
            f01 = f01 * (1 + 0.28 * inten * onset ** 1.5)
        out = (1 - (1 - np.clip(f01, 0, 1)) * (1 - lay)) * 255
        sink.write(out)
    sink.close()
    mux(silent, str(out_dir / "result.mp4"), c, audio, off)
    return {"effects": effects, "audio_bpm": round(feats.bpm, 1), "kicks": len(feats.kicks), "snares": len(feats.snares)}


def run(tool: str, video: str, out_dir: str | Path, p: dict | None = None, audio: str | None = None, backends: dict | None = None, progress=None) -> dict:
    t0 = time.time()
    p = p or {}
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    c = open_clip(video, p)
    fn = {"track-blur": run_blur, "sticky-overlay": run_sticky, "flow-fx": run_flow, "mask-propagate": run_mask}.get(tool)
    if tool == "reactive-fx":
        info = run_reactive(c, p, out, backends, progress, audio)
    elif fn:
        info = fn(c, p, out, backends, progress)
    else:
        raise BadInput(f"unknown tool {tool}")
    poster(str(out / "result.mp4"), str(out / "poster.jpg"))
    for d in out.glob("tmp*"):
        for f in d.glob("*"):
            f.unlink()
        d.rmdir()
    return {"ok": True, "tool": tool, "video": "result.mp4", "poster": "poster.jpg", "seconds": round(c.seconds, 2), "width": c.W, "height": c.H,
            "elapsed": round(time.time() - t0, 1), **info}
