#!/usr/bin/env python3
"""Deep Glitch v2: depth / normal / edge / detector CRT glitch, directed by intensity.

Per frame: Depth Anything V2 -> depth, normals, edges, depth-blob "detections".
A seeded Director pre-plans the whole edit: shots (looks + glitch transitions),
patches (a detected bounding box / silhouette / strip / depth slice that looks
through to a different look), global glitch bursts and subject-analysis insets.
Timing is perlin noise + sine "energy" waves, snapped to audio onsets, so cuts
land on the beat. --intensity 0..10 scales everything (0 = untouched video,
~5 = stylish, 9 = high-energy rap-video chaos, 10 = max).

  python glitch.py in.mp4 out.mp4 --start 4 --seconds 16 --intensity 9
"""
import argparse
import math
import random
import subprocess
import sys
from collections import deque
from types import SimpleNamespace as NS

import cv2
import numpy as np
import torch
import torch.nn.functional as F

DEV = "cuda" if torch.cuda.is_available() else "cpu"
MODEL = "depth-anything/Depth-Anything-V2-Small-hf"
GREEN = (60, 255, 140)  # BGR
AMBER = (60, 220, 255)
FONT = cv2.FONT_HERSHEY_DUPLEX

LABELS = {"depth": "DEPTH MAP", "topo": "TOPO ISO", "edge": "EDGE/NRM", "normal": "NORMAL MAP", "thermal": "THERMAL", "xray": "X-RAY", "toon": "TOON BAND", "pixel": "MOSAIC", "mash": "FUSION", "raw": "RAW"}
BORDERS = [(0.3, 1.0, 0.7), (1.0, 0.25, 0.75), (1.0, 0.85, 0.25), (0.35, 0.8, 1.0)]


# ---------------------------------------------------------------- noise / time
def _h(i, seed):
    x = math.sin(i * 127.1 + seed * 311.7) * 43758.5453
    return x - math.floor(x)


def pn(x, seed=0):
    """1D value noise 0..1."""
    i = math.floor(x)
    f = x - i
    u = f * f * (3 - 2 * f)
    return _h(i, seed) * (1 - u) + _h(i + 1, seed) * u


def fbm(x, seed=0):
    return 0.6 * pn(x, seed) + 0.3 * pn(x * 2.1 + 7, seed + 1) + 0.1 * pn(x * 4.3 + 13, seed + 2)


def energy(t, seed):
    """Slow build/drop envelope: perlin plus a ~6.5s sine, 0.1..1.4."""
    return min(1.4, max(0.1, 0.35 + 0.9 * fbm(t * 0.18, seed) + 0.25 * math.sin(2 * math.pi * t / 6.5 + seed)))


# ---------------------------------------------------------------- audio
class Audio:
    """Loudness + onset envelope per video frame; falls back to a jittered tempo when silent."""

    def __init__(self, src, start, seconds, fps, seed):
        sr = 22050
        raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(start), "-t", str(seconds), "-i", src, "-vn", "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"], capture_output=True).stdout
        sig = np.frombuffer(raw, np.float32)
        hop = sr / fps
        n = int(len(sig) / hop)
        self.fps, self.onsets, self.strength = fps, [], []
        if n < 10 or float(np.abs(sig).max()) < 2e-3:
            rng = random.Random(seed)
            t = rng.uniform(0.2, 0.5)
            while t < seconds:
                self.onsets.append(t)
                self.strength.append(rng.uniform(0.4, 1.0))
                t += rng.uniform(0.28, 0.62)
            self.lvl = np.full(int(seconds * fps) + 2, 0.5)
            self.synthetic = True
            return
        self.synthetic = False
        win = np.hanning(1024)
        mags = []
        for i in range(n):
            c = int(i * hop + hop / 2)
            seg = sig[max(0, c - 512) : c + 512]
            seg = np.pad(seg, (0, 1024 - len(seg)))
            mags.append(np.abs(np.fft.rfft(seg * win)))
        mags = np.log1p(np.array(mags) * 8)
        flux = np.maximum(0, np.diff(mags, axis=0, prepend=mags[:1])).sum(1)
        rms = np.sqrt(np.array([np.mean(sig[int(i * hop) : int((i + 1) * hop)] ** 2) for i in range(n)]))
        self.lvl = np.clip(np.convolve(rms / (np.percentile(rms, 95) + 1e-6), np.ones(4) / 4, "same"), 0, 1.3)
        k = int(fps)
        last = -1.0
        for i in range(1, n - 1):
            lo, hi = max(0, i - k), min(n, i + k)
            thr = flux[lo:hi].mean() + 0.9 * flux[lo:hi].std()
            if flux[i] > thr and flux[i] >= flux[i - 1] and flux[i] >= flux[i + 1] and i / fps - last > 0.16:
                self.onsets.append(i / fps)
                self.strength.append(float(min(1.0, (flux[i] - thr) / (flux[lo:hi].std() + 1e-6) / 2 + 0.4)))
                last = i / fps

    def level(self, t):
        i = int(t * self.fps)
        return float(self.lvl[min(max(i, 0), len(self.lvl) - 1)])

    def beat(self, t):
        best = None
        for o in self.onsets:
            if o <= t:
                best = o
            else:
                break
        return 0.0 if best is None else math.exp(-(t - best) / 0.13)

    def nearest(self, t, window):
        near = [o for o in self.onsets if abs(o - t) <= window]
        return min(near, key=lambda o: abs(o - t)) if near else None


# ---------------------------------------------------------------- tensor helpers
def luma(x):
    return (0.2126 * x[0] + 0.7152 * x[1] + 0.0722 * x[2])[None]


def sobel(g):
    k = torch.tensor([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], dtype=g.dtype, device=g.device)
    g = F.pad(g[None], (1, 1, 1, 1), mode="replicate")
    return F.conv2d(g, k[None, None])[0], F.conv2d(g, k.t()[None, None])[0]


def blur(x, k):
    return F.avg_pool2d(F.pad(x[None], (k // 2,) * 4, mode="replicate"), k, 1)[0]


PAL = {
    "ice": [[0.01, 0.0, 0.08], [0.05, 0.1, 0.7], [0.0, 0.8, 1.0], [0.3, 1.0, 0.6], [1.0, 1.0, 0.75]],
    "fire": [[0.0, 0.0, 0.04], [0.35, 0.0, 0.45], [0.9, 0.1, 0.2], [1.0, 0.6, 0.0], [1.0, 1.0, 0.7]],
}


def palette(v, name="ice"):
    stops = torch.tensor(PAL[name], device=v.device)
    p = v.clamp(0, 1)[0] * (len(stops) - 1)
    i = p.floor().long().clamp(0, len(stops) - 2)
    f = (p - i)[..., None]
    return (stops[i] * (1 - f) + stops[i + 1] * f).permute(2, 0, 1)


def warp(x, dx, dy):
    """Sample x (CxHxW) at uv + (dx, dy) (uv units); dx/dy are 1xHxW or scalars."""
    _, h, w = x.shape
    ys, xs = torch.meshgrid(torch.linspace(-1, 1, h, device=x.device), torch.linspace(-1, 1, w, device=x.device), indexing="ij")
    gx = xs + (dx[0] if torch.is_tensor(dx) else dx) * 2
    gy = ys + (dy[0] if torch.is_tensor(dy) else dy) * 2
    return F.grid_sample(x[None], torch.stack([gx, gy], -1)[None], mode="bilinear", padding_mode="reflection", align_corners=True)[0]


def rgb_split(x, amount, angle=0.0):
    if amount <= 1e-5:
        return x
    c, s = math.cos(angle), math.sin(angle)
    return torch.stack([warp(x[i : i + 1], amount * c * k, amount * s * k)[0] for i, k in enumerate((-1.0, 0.0, 1.0))])


def bands(h, gen, n_lo, n_hi, strength, device):
    out = torch.zeros(h, device=device)
    y = 0
    while y < h:
        size = int(torch.randint(max(2, h // n_hi), max(3, h // n_lo), (1,), generator=gen))
        if torch.rand(1, generator=gen).item() < 0.55:
            out[y : y + size] = (torch.rand(1, generator=gen).item() - 0.5) * 2 * strength
        y += size
    return out


def hash_cells(h, w, cell, gen, device):
    gh, gw = math.ceil(h / cell), math.ceil(w / cell)
    r = torch.rand(gh, gw, generator=gen).to(device)
    return F.interpolate(r[None, None], size=(gh * cell, gw * cell), mode="nearest")[0, :, :h, :w]


def strips(coord, count, gen):
    """Random value per strip along a 1xHxW coordinate grid in 0..1."""
    r = torch.rand(count, generator=gen).to(coord.device)
    return r[(coord * (count - 0.001)).long().clamp(0, count - 1)[0]][None]


# ---------------------------------------------------------------- analysis
class Analyzer:
    def __init__(self):
        from transformers import AutoModelForDepthEstimation

        self.model = AutoModelForDepthEstimation.from_pretrained(MODEL).to(DEV).half().eval()
        self.lo = self.hi = self.prev_depth = None
        self.tracks = []
        self._next = 0
        self.mean = torch.tensor([0.485, 0.456, 0.406], device=DEV).view(1, 3, 1, 1)
        self.std = torch.tensor([0.229, 0.224, 0.225], device=DEV).view(1, 3, 1, 1)

    @torch.no_grad()
    def depth(self, frame):
        _, h, w = frame.shape
        x = F.interpolate(frame[None], size=(518 * 9 // 16 // 14 * 14, 518 * 16 // 9 // 14 * 14), mode="bilinear", align_corners=False)
        d = self.model(pixel_values=((x - self.mean) / self.std).half()).predicted_depth[None].float()
        d = F.interpolate(d, size=(h, w), mode="bilinear", align_corners=False)[0]
        lo, hi = torch.quantile(d.flatten()[::97], torch.tensor([0.02, 0.98], device=DEV))
        self.lo = lo if self.lo is None else self.lo * 0.9 + lo * 0.1
        self.hi = hi if self.hi is None else self.hi * 0.9 + hi * 0.1
        d = ((d - self.lo) / (self.hi - self.lo + 1e-6)).clamp(0, 1)
        hist = torch.histc(d, 256, 0, 1)
        cdf = hist.cumsum(0) / hist.sum()
        d = 0.45 * d + 0.55 * cdf[(d * 255).long().clamp(0, 255)]  # equalise: flat scenes still span the palette
        d = d if self.prev_depth is None else 0.55 * d + 0.45 * self.prev_depth
        self.prev_depth = d
        return d  # 1 = near

    @staticmethod
    def normals(d, frame):
        gx, gy = sobel(blur(d, 5))
        bx, by = sobel(blur(luma(frame), 3))
        n = torch.cat([-(gx * 22.0 + bx * 1.6), -(gy * 22.0 + by * 1.6), torch.ones_like(gx)])
        return n / n.norm(dim=0, keepdim=True)

    @staticmethod
    def edges(frame, d):
        gx, gy = sobel(blur(luma(frame), 3))
        dx, dy = sobel(blur(d, 3))
        e = (gx.abs() + gy.abs()) * 1.6 + (dx.abs() + dy.abs()) * 5.0
        return (e * 2.2).clamp(0, 1), (dx.abs() + dy.abs()).mul(8.0).clamp(0, 1)

    def hotspots(self, e, w, h, count=6):
        gh, gw = 6, 10
        cells = F.adaptive_avg_pool2d(e[None], (gh, gw))[0, 0].cpu().numpy()
        order = np.dstack(np.unravel_index(np.argsort(-cells.ravel()), cells.shape))[0][:count]
        cw, ch = w / gw, h / gh
        return [[c * cw + cw * 0.12, r * ch + ch * 0.12, (c + 1) * cw - cw * 0.12, (r + 1) * ch - ch * 0.12, float(cells[r, c])] for r, c in order]

    def detect(self, d, w, h):
        """Depth blobs -> boxes with stable ids; tracks[0] is the main subject."""
        small = F.interpolate(d[None], size=(h // 4, w // 4), mode="bilinear")[0, 0].cpu().numpy()
        found = []
        for thr in (0.6, 0.76, 0.9):
            mask = (small > thr).astype(np.uint8)
            mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
            mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
            n, _, stats, _ = cv2.connectedComponentsWithStats(mask)
            for i in range(1, n):
                x, y, bw, bh, area = stats[i]
                if area > 0.01 * small.size and not (bw > 0.9 * small.shape[1] and bh > 0.9 * small.shape[0]):
                    cx = (x + bw / 2) / small.shape[1]
                    depth = float(small[y : y + bh, x : x + bw].mean())
                    found.append([x * 4, y * 4, (x + bw) * 4, (y + bh) * 4, depth, area * (1 - 0.6 * abs(cx - 0.5)) * (0.5 + depth)])
        found.sort(key=lambda b: -b[5])
        picked = []
        for b in found:
            if all(not (abs(b[0] - o[0]) < 0.08 * w and abs(b[2] - o[2]) < 0.08 * w) for o in picked):
                picked.append(b)
        new, used = [], set()
        for box in picked[:5]:
            best = None
            for t in self.tracks:
                if id(t) in used:
                    continue
                if abs(t["box"][0] - box[0]) + abs(t["box"][1] - box[1]) < 0.25 * w and (best is None or t["age"] > best["age"]):
                    best = t
            if best:
                used.add(id(best))
                best["box"] = [a * 0.7 + b * 0.3 for a, b in zip(best["box"], box[:4])]
                best["depth"], best["age"] = box[4], best["age"] + 1
                new.append(best)
            else:
                self._next += 1
                new.append({"box": box[:4], "depth": box[4], "age": 0, "id": self._next})
        self.tracks = new
        return new


# ---------------------------------------------------------------- director (pre-planned edit)
def look_pool(k):
    pool = ["raw", "edge", "depth"]
    if k > 0.2:
        pool += ["toon", "topo", "normal"]
    if k > 0.45:
        pool += ["mash", "xray", "thermal"]
    if k > 0.7:
        pool += ["pixel"]
    return pool


def plan(intensity, seconds, fps, audio, seed):
    rng = random.Random(seed)
    k = intensity / 10.0
    nframes = int(seconds * fps)
    pool = look_pool(k)

    shots, t, last = [], 0.0, None
    while t < seconds - 1e-6:
        mean = (4.2 - 3.7 * k**0.85) / (0.6 + 0.8 * energy(t, seed))
        end = min(seconds, t + max(0.3, mean * rng.uniform(0.55, 1.45)))
        if k > 0.3:
            snap = audio.nearest(end, 0.18)
            if snap and snap - t > 0.25:
                end = min(seconds, snap)
        look = rng.choice([x for x in pool if x != last] or pool)
        if not shots and k < 0.9:
            look = "raw"
        cut = rng.random() < 0.15 + 0.45 * k
        kind = "cut" if cut else rng.choice(["depthwipe", "tear", "blocks", "scanwipe", "edgeflash", "iris", "slices", "vnoise"])
        td = 0.0 if cut else min((end - t) * 0.8, rng.uniform(0.1, 0.5) * (1.25 - 0.6 * k))
        shots.append(NS(start=t, end=end, look=look, kind=kind, td=td))
        last, t = look, end

    patch_looks = ["depth", "topo", "edge"] + (["normal", "toon", "thermal", "xray"] if k > 0.25 else []) + (["pixel", "mash"] if k > 0.6 else [])
    patches, maxc, rate0 = [], 1 + round(7 * k), 0.12 + 3.4 * k**1.3
    shapes = ["bbox"] * 3 + ["slab"] * 3 + ["strip"] * 2 + ["vstrip", "subject", "subject", "depthslice", "depthslice", "circle"] + (["cells"] * 2 if k > 0.4 else [])
    if k > 0.02:
        for f in range(nframes):
            t = f / fps
            active = sum(1 for p in patches if p.t0 <= t < p.t1)
            prob = rate0 * energy(t, seed + 5) / fps * (1 + 3 * audio.beat(t))
            if active < maxc and rng.random() < prob:
                shape = rng.choice(shapes)
                life = rng.uniform(0.4, 1.5) if shape == "bbox" else rng.uniform(0.12, 0.9) * (1.3 - 0.6 * k)
                w_, h_ = rng.uniform(0.1, 0.5), rng.uniform(0.08, 0.4)
                x0, y0 = rng.uniform(0, 1 - w_), rng.uniform(0, 1 - h_)
                if shape == "strip":
                    x0, w_, h_ = 0.0, 1.0, rng.uniform(0.03, 0.16)
                    y0 = rng.uniform(0, 1 - h_)
                if shape == "vstrip":
                    y0, h_, w_ = 0.0, 1.0, rng.uniform(0.03, 0.14)
                    x0 = rng.uniform(0, 1 - w_)
                patches.append(NS(t0=t, t1=t + life, shape=shape, look=rng.choice(patch_looks), rect=(x0, y0, x0 + w_, y0 + h_), zoom=rng.choice([1.0, 1.0, 1.25, 1.6]), glitchy=rng.random() < 0.3, freq=rng.uniform(4, 14), seed=rng.randint(0, 999), color=rng.choice(BORDERS), rank=rng.choice([0, 0, 1, 2]), invert=rng.random() < 0.3))

    bursts = []
    kinds = ["tear", "blocks", "wave", "noisewarp", "punch", "invert", "hold", "pixel", "echo", "rgbblast", "vroll", "slices"]
    heavy = {"hold", "pixel", "invert", "vroll", "slices", "blocks"}
    rate1 = 0.1 + 2.6 * k**1.5

    def add_burst(t, amp=None, kind=None):
        kind = kind or rng.choice(kinds if k > 0.75 else [x for x in kinds if x not in heavy])
        bursts.append(NS(t0=t, dur=rng.uniform(0.08, 0.4) * (1.3 - 0.5 * k), kind=kind, amp=amp if amp is not None else rng.uniform(0.5, 1.0), seed=rng.randint(0, 9999)))

    if k > 0.02:
        for f in range(nframes):
            t = f / fps
            if rng.random() < rate1 * energy(t, seed + 9) / fps:
                add_burst(t)
        for o, s in zip(audio.onsets, audio.strength):
            if o < seconds and rng.random() < 0.25 + 0.5 * k:
                add_burst(o, amp=0.4 + 0.6 * s, kind=rng.choice(["punch", "rgbblast", "tear", "echo"] + (["blocks", "invert"] if k > 0.75 else [])))
        for s in shots[:-1]:
            if s.kind == "cut":
                add_burst(s.end, amp=0.9, kind=rng.choice(["punch", "rgbblast", "tear"]))

    analyses, t = [], rng.uniform(0.4, 1.6)
    if k > 0.12:
        while t < seconds - 0.8:
            dur = rng.uniform(0.9, 2.2)
            analyses.append(NS(t0=t, t1=min(seconds, t + dur), looks=rng.sample(["depth", "topo", "edge", "normal", "thermal", "xray", "toon"], 4), target=None))
            t += dur + rng.uniform(1.0, 4.5) / (0.3 + (0.04 + 0.4 * k) * 6 * energy(t, seed + 3))
    return NS(shots=shots, patches=patches, bursts=bursts, analyses=analyses)


# ---------------------------------------------------------------- looks
def look_edge(f, ctx):
    e, de = ctx["edges"]
    neon = ctx["normal"] * 0.5 + 0.5
    neon = neon / neon.max(0)[0].clamp(min=1e-3)
    obj = torch.cat([de * 0.2, de * 1.0, de * 0.9])
    return (f * 0.07 + neon * e * 1.15 + neon * blur(e, 9) * 0.7 + obj).clamp(0, 1)


def look_normal(f, ctx):
    nn = ctx["normal"]
    nn = torch.cat([nn[:2] * 3.2, nn[2:]])
    n = nn / nn.norm(dim=0, keepdim=True) * 0.5 + 0.5
    return (n * (0.55 + 0.7 * luma(f)) * 0.95 + ctx["edges"][0] * 0.15).clamp(0, 1)


def look_depth(f, ctx, t):
    d = ctx["depth"]
    heat = palette(d)
    contour = ((d * 14 + t * 0.6) % 1.0 < 0.06).float()
    scan = ((d - (t * 0.5) % 1.0).abs() < 0.015).float() * 1.5
    return (heat * (0.55 + 0.7 * luma(f)) + contour * heat * 0.8 + scan * torch.tensor([0.5, 1.0, 0.9], device=DEV).view(3, 1, 1) * 0.6).clamp(0, 1)


def look_topo(f, ctx, t):
    """Topographic banding of the depth map: iso-lines + per-band colour, major lines every 4th band."""
    bands_n = 18
    db = ctx["depth"] * bands_n
    idx = torch.floor(db)
    fr = db - idx
    gx, gy = sobel(blur(db, 3))
    wpx = ((gx.abs() + gy.abs()) * 0.5).clamp(0.03, 1.5)
    line = (1.5 - torch.minimum(fr, 1 - fr) / wpx).clamp(0, 1)
    major = (idx % 4 == 0).float()
    fill = palette((idx / bands_n) % 1.0) * 0.4 + f * 0.22
    ink = torch.tensor([0.75, 1.0, 0.85], device=DEV).view(3, 1, 1)
    return (fill * (1 - line * 0.75) + line * ink * (0.55 + 0.45 * major)).clamp(0, 1)


def look_toon(f, ctx, t):
    sm = blur(f, 5)
    lm = luma(sm)
    sat = (lm + (sm - lm) * 1.55).clamp(0, 1)
    q = torch.floor(sat * 4 + 0.5) / 4  # cartoon colour banding
    shade = 0.78 + 0.3 * torch.floor(ctx["depth"] * 5) / 5
    ink = (ctx["edges"][0] > 0.32).float()
    return (q * shade * (1 - ink * 0.92)).clamp(0, 1)


def look_thermal(f, ctx):
    return palette(0.6 * luma(blur(f, 3)) + 0.4 * ctx["depth"], "fire")


def look_xray(f, ctx):
    v = (1 - luma(blur(f, 3))).clamp(0, 1) ** 1.6
    tint = torch.tensor([0.15, 0.85, 1.0], device=DEV).view(3, 1, 1)
    return (tint * v * 0.9 + ctx["edges"][0] * torch.tensor([0.7, 1.0, 1.0], device=DEV).view(3, 1, 1) * 0.8 + 0.02).clamp(0, 1)


def look_pixel(f, ctx):
    cell = 14
    h, w = f.shape[1:]
    q = torch.floor(F.avg_pool2d(f[None], cell, ceil_mode=True) * 6 + 0.5) / 6
    return F.interpolate(q, scale_factor=cell, mode="nearest")[0, :, :h, :w]


def look_mash(f, ctx, t):
    d = ctx["depth"]
    q = torch.floor(d * 7) / 7
    layered = rgb_split(warp(f, (q - 0.45) * (0.045 * math.sin(t * 3.1) + 0.02), 0.0), 0.006 + 0.004 * math.sin(t * 7), t)
    e, de = ctx["edges"]
    n = ctx["normal"] * 0.5 + 0.5
    tint = layered * 0.55 + n * luma(layered) * 0.9
    slab = ((torch.floor(d * 7) + math.floor(t * 4.0)) % 3 == 0).float()
    out = tint * (1 - slab * 0.55) + palette(d) * slab * 0.65
    neon = n / n.max(0)[0].clamp(min=1e-3)
    return (out + neon * e * 0.95 + de * torch.tensor([0.1, 1.0, 0.7], device=DEV).view(3, 1, 1)).clamp(0, 1)


# ---------------------------------------------------------------- the deck
class Deck:
    def __init__(self, w, h, fps, intensity, director, audio, seed):
        self.w, self.h, self.fps, self.I, self.k, self.dir, self.audio, self.seed = w, h, fps, intensity, intensity / 10.0, director, audio, seed
        self.amp = self.k * 1.15
        self.analyzer = Analyzer()
        ys, xs = torch.meshgrid(torch.linspace(0, 1, h, device=DEV), torch.linspace(0, 1, w, device=DEV), indexing="ij")
        self.X, self.Y = xs[None], ys[None]
        self.ring = deque(maxlen=12)

    def L(self, name):
        if name not in self.cache:
            f, c, t = self.frame, self.ctx, self.t
            self.cache[name] = {"raw": lambda: f, "edge": lambda: look_edge(f, c), "normal": lambda: look_normal(f, c), "depth": lambda: look_depth(f, c, t), "topo": lambda: look_topo(f, c, t), "toon": lambda: look_toon(f, c, t), "thermal": lambda: look_thermal(f, c), "xray": lambda: look_xray(f, c), "pixel": lambda: look_pixel(f, c), "mash": lambda: look_mash(f, c, t)}[name]()
        return self.cache[name]

    def shot_at(self, t):
        shots = self.dir.shots
        for i, s in enumerate(shots):
            if t < s.end:
                if i + 1 < len(shots) and s.td > 0 and t > s.end - s.td:
                    return i, i + 1, (t - (s.end - s.td)) / s.td
                return i, i, 0.0
        return len(shots) - 1, len(shots) - 1, 0.0

    # ---- shot transitions
    def transition(self, kind, a, b, p, gen):
        t, h, w, X, Y = self.t, self.h, self.w, self.X, self.Y
        peak = math.sin(math.pi * p)
        d = self.ctx["depth"]
        glow_col = lambda *c: torch.tensor(c, device=DEV).view(3, 1, 1)
        if kind == "depthwipe":
            thr = 1.15 - p * 1.3
            band = ((d - thr).abs() < 0.07).float()
            mask = (d > thr).float()
            out = a * (1 - mask) + b * mask
            inv = 1 - warp(out, (torch.rand(1, generator=gen).item() - 0.5) * 0.05, 0.0)
            return rgb_split(out * (1 - band) + (inv * 0.6 + palette(d) * 0.5) * band, 0.012 * peak, t * 2)
        if kind == "tear":
            offs = bands(h, gen, 10, 80, 0.07 * (0.3 + peak), DEV)[None, :, None].expand(1, h, w)
            pick = (torch.rand(h, generator=gen).to(DEV) < p)[None, :, None].float()
            return rgb_split(warp(a * (1 - pick) + b * pick, offs, 0.0), 0.02 * peak, 0.0)
        if kind == "blocks":
            cell = int(torch.randint(24, 110, (1,), generator=gen))
            pick = (hash_cells(h, w, cell, gen, DEV) < p).float()
            jit = (hash_cells(h, w, cell, gen, DEV) - 0.5) * 0.08 * peak
            return rgb_split(warp(a * (1 - pick) + b * pick, jit, 0.0), 0.01 * peak, 1.0)
        if kind == "scanwipe":
            line = p * 1.1 - 0.05
            mask = (Y < line).float()
            out = a * (1 - mask) + b * mask + torch.exp(-((Y - line).abs() * 38)) * 1.4 * glow_col(0.4, 1.0, 0.8)
            return warp(out, torch.exp(-((Y - line).abs() * 22)) * 0.03 * math.sin(t * 90), 0.0)
        if kind == "iris":
            cx, cy = 0.5, 0.5
            if self.analyzer.tracks:
                x1, y1, x2, y2 = self.analyzer.tracks[0]["box"]
                cx, cy = (x1 + x2) / 2 / w, (y1 + y2) / 2 / h
            dist = torch.hypot((X - cx) * w / h, Y - cy)
            r = p * 1.4
            mask = (dist < r).float()
            return rgb_split(a * (1 - mask) + b * mask + torch.exp(-((dist - r).abs() * 30)) * 1.3 * glow_col(1.0, 0.3, 0.8), 0.01 * peak, 0.7)
        if kind == "slices":
            horizontal = pn(t, self.seed) > 0.5
            coord = Y if horizontal else X
            pick = (strips(coord, 40, gen) < p).float()
            out = a * (1 - pick) + b * pick
            shift = (strips(coord, 40, gen) - 0.5) * 0.08 * peak
            return rgb_split(warp(out, shift if horizontal else 0.0, 0.0 if horizontal else shift), 0.012 * peak, 0.0)
        if kind == "vnoise":
            edge = 0.09 * torch.sin(Y * 22 + t * 11) + 0.08 * torch.sin(Y * 90 - t * 30)
            front = p * 1.35 - 0.15 + edge
            mask = (X < front).float()
            return rgb_split(a * (1 - mask) + b * mask + torch.exp(-((X - front).abs() * 40)) * 0.9 * glow_col(0.3, 0.9, 1.0), 0.012 * peak, 0.0)
        e = self.ctx["edges"][0]  # edgeflash: zoom punch through the edge map at the midpoint
        flash = (e.expand(3, -1, -1) * glow_col(0.6, 1.0, 0.9) * 1.6).clamp(0, 1)
        f = math.exp(-abs(p - 0.5) * 9)
        out = warp(a if p < 0.5 else b, (X - 0.5) * -0.06 * f, (Y - 0.5) * -0.06 * f)
        return rgb_split(out * (1 - f * 0.85) + flash * f, 0.015 * peak, 0.5)

    # ---- patches: a region showing a different look
    def border(self, m, color):
        eroded = -F.max_pool2d(-m[None], 5, 1, 2)[0]
        return (m - eroded).clamp(0, 1) * torch.tensor(color, device=DEV).view(3, 1, 1)

    def patch_mask(self, p, t, tracks):
        """(mask 1xHxW, px_rect or None), or None while the patch is flickered off."""
        if not (pn(t * p.freq, p.seed) > 0.3 and math.sin(2 * math.pi * t * p.freq * 0.37 + p.seed) > -0.7):
            return None
        grow = min(1.0, (t - p.t0) / 0.07)
        w, h = self.w, self.h
        drift = lambda s: (pn(t * 1.3 + s, p.seed) - 0.5) * 0.08
        shape = p.shape
        if shape == "bbox" and len(tracks) <= p.rank:
            shape = "slab"
        if shape in ("bbox", "slab", "strip", "vstrip"):
            x0, y0, x1, y1 = p.rect
            if shape == "bbox":
                bx = tracks[p.rank]["box"]
                x0, y0, x1, y1 = bx[0] / w - 0.02, bx[1] / h - 0.02, bx[2] / w + 0.02, bx[3] / h + 0.02
            x0, x1, y0, y1 = x0 + drift(1), x1 + drift(1), y0 + drift(2), y1 + drift(2)
            cy = (y0 + y1) / 2
            y0, y1 = cy - (cy - y0) * grow, cy + (y1 - cy) * grow
            Xw = self.X + 0.006 * torch.sin(self.Y * 70 + t * 25)  # ragged edges
            m = ((Xw > x0) & (Xw < x1) & (self.Y > y0) & (self.Y < y1)).float()
            return m, (int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h))
        d = self.ctx["depth"]
        if shape == "subject":
            m = ((d - (0.55 + 0.15 * math.sin(t * 3 + p.seed)) + 0.04) / 0.08).clamp(0, 1)
            return (1 - m if p.invert else m), None
        if shape == "depthslice":
            return ((d - (0.5 + 0.42 * math.sin(2 * math.pi * t * 0.5 + p.seed))).abs() < 0.11).float(), None
        if shape == "circle":
            cx, cy = 0.5 + 0.7 * (pn(t * 0.9, p.seed) - 0.5), 0.5 + 0.6 * (pn(t * 0.9, p.seed + 3) - 0.5)
            r = (0.08 + 0.2 * abs(math.sin(t * 4 + p.seed))) * grow
            return (torch.hypot((self.X - cx) * w / h, self.Y - cy) < r).float(), None
        gen = torch.Generator().manual_seed(p.seed * 131 + int(t * 8))
        return (hash_cells(h, w, 24 + p.seed % 50, gen, DEV) < 0.22 + 0.2 * math.sin(t * 5)).float(), None

    def apply_patches(self, out, t, tracks):
        rects = []
        for p in self.dir.patches:
            if not (p.t0 <= t < p.t1):
                continue
            r = self.patch_mask(p, t, tracks)
            if r is None:
                continue
            m, rect = r
            content = self.L(p.look)
            if p.zoom != 1.0:
                cx, cy = ((rect[0] + rect[2]) / 2 / self.w, (rect[1] + rect[3]) / 2 / self.h) if rect else (0.5, 0.5)
                s = 1 / p.zoom - 1
                content = warp(content, (self.X - cx) * s, (self.Y - cy) * s)
            if p.glitchy:
                gen = torch.Generator().manual_seed(p.seed * 17 + int(t * 10))
                content = rgb_split(warp(content, bands(self.h, gen, 8, 60, 0.04, DEV)[None, :, None].expand(1, self.h, self.w), 0.0), 0.012, t)
            out = out * (1 - m) + content * m + self.border(m, p.color) * 0.9
            if rect:
                rects.append((rect, p.look, (t - p.t0) / max(1e-3, p.t1 - p.t0), p.color))
        return out, rects

    # ---- global glitch bursts
    def apply_burst(self, b, out, t):
        u = (t - b.t0) / max(1e-3, b.dur)
        e = (math.sin(math.pi * u) ** 0.7) * b.amp * (0.5 + 0.6 * self.amp)
        gen = torch.Generator().manual_seed(b.seed + int(t * 15))
        h, w, X, Y = self.h, self.w, self.X, self.Y
        kind = b.kind
        if kind == "tear":
            return rgb_split(warp(out, bands(h, gen, 10, 90, 0.04 * e, DEV)[None, :, None].expand(1, h, w), 0.0), 0.014 * e, 0.0)
        if kind == "blocks":
            pick = (hash_cells(h, w, int(torch.randint(20, 90, (1,), generator=gen)), gen, DEV) < 0.35 * e).float()
            alts = [self.ring[-5] if len(self.ring) > 5 else out, self.L("depth"), self.L("edge"), self.L("topo")]
            return rgb_split(out * (1 - pick) + alts[b.seed % len(alts)] * pick, 0.008 * e, 1.0)
        if kind == "wave":
            f, s = 2 + b.seed % 8, 4 + b.seed % 9
            return warp(out, 0.03 * e * torch.sin(2 * math.pi * (Y * f + t * s)), 0.006 * e * torch.sin(2 * math.pi * (X * f * 0.6 - t * s)))
        if kind == "noisewarp":
            field = F.interpolate(torch.rand(1, 2, 9, 16, generator=gen).to(DEV), size=(h, w), mode="bicubic", align_corners=False)[0] - 0.5
            return warp(out, field[0:1] * 0.09 * e, field[1:2] * 0.09 * e)
        if kind == "punch":
            return rgb_split(warp(out, (X - 0.5) * -0.1 * e, (Y - 0.5) * -0.1 * e), 0.01 * e, 0.0)
        if kind == "invert":
            rows = (strips(Y, 40, gen) < 0.35).float() * min(1.0, e * 1.4)
            return out * (1 - rows) + (1 - out) * rows
        if kind == "hold":
            n = 3 + b.seed % 5
            return self.ring[-n] if len(self.ring) >= n else out
        if kind == "pixel":
            cell = max(6, int(8 + 16 * e))
            return F.interpolate(F.avg_pool2d(out[None], cell, ceil_mode=True), scale_factor=cell, mode="nearest")[0, :, :h, :w]
        if kind == "echo":
            old = self.ring[-3] if len(self.ring) >= 3 else out
            return torch.maximum(out, warp(old, 0.012 * e, 0.0) * 0.7)
        if kind == "rgbblast":
            return rgb_split(out, 0.035 * e, (b.seed % 628) / 100)
        if kind == "vroll":
            return warp(out, 0.0, torch.full_like(X, (u * 0.6 + 0.1) * e))
        return warp(out, 0.0, (strips(X, 16, gen) - 0.5) * 0.25 * e)  # slices: vertical strips with different y shifts

    # ---- subject analysis inset
    def apply_analysis(self, out, an, t, tracks):
        if not tracks:
            return out, None
        if an.target not in [tr["id"] for tr in tracks]:
            an.target = tracks[0]["id"]
        tr = next(x for x in tracks if x["id"] == an.target)
        x1, y1, x2, y2 = max(0, int(tr["box"][0])), max(0, int(tr["box"][1])), min(self.w, int(tr["box"][2])), min(self.h, int(tr["box"][3]))
        if x2 - x1 < 40 or y2 - y1 < 40:
            return out, None
        look = an.looks[int((t - an.t0) / 0.28) % len(an.looks)]
        pw = int(self.w * 0.25)
        ph = int(min(max(pw * (y2 - y1) / (x2 - x1), pw * 0.6), pw * 1.3))
        pan = F.interpolate(self.L(look)[:, y1:y2, x1:x2][None], size=(ph, pw), mode="bilinear", align_corners=False)[0]
        pan = pan * (0.82 + 0.18 * torch.cos(torch.arange(ph, device=DEV).float() * math.pi * 2 / 3))[None, :, None]
        right = (x2 + 34 + pw) < self.w - 20
        px = x2 + 34 if right else max(20, x1 - 34 - pw)
        py = int(min(max(y1, 90), self.h - ph - 40))
        out = out.clone()
        out[:, py : py + ph, px : px + pw] = pan
        return out, {"box": (x1, y1, x2, y2), "panel": (px, py, px + pw, py + ph), "u": (t - an.t0) / (an.t1 - an.t0), "look": look}

    # ---- HUD (CPU layer, added before the CRT so scanlines hit it)
    def draw_hud(self, tracks, spots, rects, analysis, t, n, mode):
        w, h = self.w, self.h
        img = np.zeros((h, w, 3), np.uint8)
        for i, tr in enumerate(tracks[: 1 + int(4 * self.k)]):
            x1, y1, x2, y2 = [int(v) for v in tr["box"]]
            cl, th = 22, 4 if i == 0 else 3
            for cx, cy, sx, sy in ((x1, y1, 1, 1), (x2, y1, -1, 1), (x1, y2, 1, -1), (x2, y2, -1, -1)):
                cv2.line(img, (cx, cy), (cx + sx * cl, cy), GREEN, th)
                cv2.line(img, (cx, cy), (cx, cy + sy * cl), GREEN, th)
            cv2.rectangle(img, (x1, y1), (x2, y2), GREEN, 1)
            label = ("SUBJECT" if i == 0 else "OBJ") + f"_{tr['id']:02d} {0.82 + 0.15 * math.sin(tr['id'] + t * 1.7):.2f}"
            (tw, tht), _ = cv2.getTextSize(label, FONT, 0.55, 1)
            cv2.rectangle(img, (x1, y1 - tht - 14), (x1 + tw + 12, y1 - 2), GREEN, -1)
            cv2.putText(img, label, (x1 + 6, y1 - 8), FONT, 0.55, (0, 20, 0), 1, cv2.LINE_AA)
            cv2.putText(img, f"DIST {0.6 + (1 - tr['depth']) * 7.5:4.1f}M  NRM {tr['depth']:.2f}", (x1 + 6, y2 + 22), FONT, 0.45, GREEN, 1, cv2.LINE_AA)
        for i, (x1, y1, x2, y2, score) in enumerate(spots[: 2 + int(5 * self.k)]):
            if (int(t * 6) + i) % 7 == 0:
                continue
            cv2.rectangle(img, (int(x1), int(y1)), (int(x2), int(y2)), AMBER, 1)
            cv2.putText(img, f"FT{i:02d} {score:.2f}", (int(x1), int(y1) - 5), FONT, 0.4, AMBER, 1, cv2.LINE_AA)
        for (x0, y0, x1, y1), look, u, col in rects:
            c = tuple(int(v * 255) for v in col[::-1])
            if x1 - x0 > 60:
                cv2.putText(img, f"{LABELS[look]} {int(u * 100):02d}%", (x0 + 4, max(14, y0 - 6)), FONT, 0.42, c, 1, cv2.LINE_AA)
                for k_ in range(0, x1 - x0, 24):
                    cv2.line(img, (x0 + k_, y1), (x0 + k_, y1 + 5), c, 1)
        if analysis:
            bx1, by1, bx2, by2 = analysis["box"]
            px0, py0, px1, py1 = analysis["panel"]
            u = analysis["u"]
            cv2.rectangle(img, (px0, py0), (px1, py1), AMBER, 2)
            cv2.line(img, (bx2 if px0 > bx2 else bx1, by1), (px0 if px0 > bx2 else px1, py0), AMBER, 1)
            cv2.rectangle(img, (px0, py0 - 30), (px1, py0), AMBER, -1)
            title = "SUBJECT LOCKED" if u > 0.92 else "ANALYZING" + "." * (1 + int(t * 6) % 3)
            cv2.putText(img, f"{title} {LABELS[analysis['look']]}", (px0 + 6, py0 - 10), FONT, 0.45, (20, 20, 0), 1, cv2.LINE_AA)
            cv2.rectangle(img, (px0, py1 + 8), (px1, py1 + 18), AMBER, 1)
            cv2.rectangle(img, (px0, py1 + 8), (px0 + int((px1 - px0) * min(1, u)), py1 + 18), AMBER, -1)
            steps = ["SEGMENT OK", "DEPTH EST OK", "NORMALS OK", f"MESH {int(u * 14200):,} PTS", f"CONF {min(99.9, u * 100 + 0.9):.1f}%"]
            for i, s in enumerate(steps):
                if u > i / len(steps):
                    cv2.putText(img, s, (px0, py1 + 38 + i * 18), FONT, 0.42, AMBER, 1, cv2.LINE_AA)
            sx = int(bx1 + (bx2 - bx1) * ((u * 3) % 1.0))
            cv2.line(img, (sx, by1), (sx, by2), (255, 255, 255), 2)  # scan sweep across the subject
        cv2.putText(img, f"DEEP.GLITCH // INT {self.I:04.1f} // {mode.upper():6s} // F{n:05d}", (28, 44), FONT, 0.7, GREEN, 1, cv2.LINE_AA)
        cv2.putText(img, f"T+{t:06.2f}s  DEPTH-ANYTHING-V2  NRM/EDG/OBJ", (28, 70), FONT, 0.5, GREEN, 1, cv2.LINE_AA)
        if int(t * 2) % 2 == 0:
            cv2.circle(img, (w - 120, 38), 7, (60, 60, 255), -1)
            cv2.putText(img, "REC", (w - 105, 44), FONT, 0.55, (60, 60, 255), 1, cv2.LINE_AA)
        return (img * (0.45 + 0.55 * self.k)).astype(np.uint8)

    # ---- CRT
    def crt(self, x, t, strength, gen):
        if strength <= 0.01:
            return x
        h, w = self.h, self.w
        ys, xs = torch.meshgrid(torch.linspace(-1, 1, h, device=DEV), torch.linspace(-1, 1, w, device=DEV), indexing="ij")
        r2 = xs**2 * 0.6 + ys**2
        k = 0.07 * strength
        out = F.grid_sample(x[None], torch.stack([xs * (1 + k * r2), ys * (1 + k * r2 * 1.2)], -1)[None], mode="bilinear", padding_mode="zeros", align_corners=True)[0]
        out = rgb_split(out, 0.0016 * strength + 0.003 * strength * abs(math.sin(t * 2.3)), 0.0)
        xi = torch.arange(w, device=DEV)
        mask = torch.stack([(xi % 3 == i).float() * 0.55 + 0.6 for i in range(3)])[:, None, :]
        yi = torch.arange(h, device=DEV).float()
        scan = (0.78 + 0.22 * torch.cos(yi * math.pi * 2 / 3.0))[None, :, None]
        roll = torch.exp(-(((yi / h) - ((t * 0.18) % 1.4 - 0.2)).abs() * 14))[None, :, None] * 0.22
        out = out * (1 - strength * 0.55 * (1 - mask)) * (1 - strength * (1 - scan)) + roll * strength
        out = out + F.interpolate(F.avg_pool2d(out[None], 8), size=(h, w), mode="bilinear")[0] * 0.45 * strength
        vig = (1 - 0.55 * strength * (xs**2 * 0.5 + ys**2 * 0.7).clamp(0, 1))[None]
        noise = (torch.rand(1, h, w, generator=gen).to(DEV) - 0.5) * 0.05 * strength
        return ((out + noise) * vig * (1 - 0.04 * strength * torch.rand(1, generator=gen).item())).clamp(0, 1)

    # ---- one frame
    def render(self, n, frame):
        t = n / self.fps
        self.t, self.frame, self.cache = t, frame, {}
        if self.I <= 0:
            return frame
        depth = self.analyzer.depth(frame)
        self.ctx = {"depth": depth, "normal": self.analyzer.normals(depth, frame)}
        self.ctx["edges"] = self.analyzer.edges(frame, depth)
        tracks = self.analyzer.detect(depth, self.w, self.h)
        spots = self.analyzer.hotspots(self.ctx["edges"][0], self.w, self.h)
        gen = torch.Generator().manual_seed(n // 2 * 7919 + 13 + self.seed)
        beat, lvl, amp = self.audio.beat(t), self.audio.level(t), self.amp

        ia, ib, p = self.shot_at(t)
        sa, sb = self.dir.shots[ia], self.dir.shots[ib]
        out = self.L(sa.look)
        if ia != ib:
            out = self.transition(sa.kind, out, self.L(sb.look), p, gen)
        mode = sb.look if p > 0.5 else sa.look

        out, rects = self.apply_patches(out, t, tracks)
        active = sorted((b for b in self.dir.bursts if b.t0 <= t < b.t0 + b.dur), key=lambda b: -b.amp)[:2]  # stacking more reads as noise
        for b in active:
            out = self.apply_burst(b, out, t)
        analysis = None
        for an in self.dir.analyses:
            if an.t0 <= t < an.t1:
                out, analysis = self.apply_analysis(out, an, t, tracks)
        self.ring.append(out)

        # always-on perlin / sine / beat modulation: punch zoom, shake, breathing wave, rgb split, flash
        z = -(0.045 * beat + 0.012 * (fbm(t * 1.7, 3) - 0.5)) * amp
        shake = amp * 0.004 * (0.3 + 1.7 * beat)
        dx = shake * (fbm(t * 9, 5) - 0.5) * 2 + amp * 0.003 * math.sin(2 * math.pi * t * 0.9) * lvl
        dy = shake * (fbm(t * 9, 8) - 0.5) * 2
        wave = amp * 0.0035 * (0.3 + lvl)
        out = warp(out, (self.X - 0.5) * z + dx + wave * torch.sin(2 * math.pi * (self.Y * 3 + t * 0.7)), (self.Y - 0.5) * z + dy)
        out = rgb_split(out, amp * (0.001 + 0.011 * beat + 0.004 * fbm(t * 3, 9)), t * 1.3 + fbm(t, 2) * 6)
        out = (out * (1 + 0.14 * beat * amp)).clamp(0, 1)

        hud = torch.from_numpy(self.draw_hud(tracks, spots, rects, analysis, t, n, mode)).to(DEV).permute(2, 0, 1).float()[[2, 1, 0]] / 255
        out = (out + hud * (hud.max(0, keepdim=True)[0] > 0).float()).clamp(0, 1)
        strength = min(1.0, (0.15 + 0.85 * self.k) * (0.85 + 0.3 * fbm(t * 0.6, 4)) + (0.25 if ia != ib else 0.0))
        return self.crt(out, t, strength, gen)


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--start", type=float, default=0)
    ap.add_argument("--seconds", type=float, default=15)
    ap.add_argument("--intensity", type=float, default=7, help="0 (untouched) .. 10 (max chaos); 9 = high-energy rap video")
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--width", type=int, default=1280)
    ap.add_argument("--height", type=int, default=720)
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--stills", default="", help="comma separated seconds to dump as PNG next to dst")
    a = ap.parse_args()
    a.intensity = max(0.0, min(10.0, a.intensity))
    w, h, fps = a.width, a.height, a.fps
    audio = Audio(a.src, a.start, a.seconds, fps, a.seed)
    print(f"audio: {len(audio.onsets)} onsets{' (synthetic)' if audio.synthetic else ''}", file=sys.stderr)
    director = plan(a.intensity, a.seconds, fps, audio, a.seed)
    print(f"plan: {len(director.shots)} shots, {len(director.patches)} patches, {len(director.bursts)} bursts, {len(director.analyses)} analyses", file=sys.stderr)
    reader = subprocess.Popen(["ffmpeg", "-v", "error", "-ss", str(a.start), "-t", str(a.seconds), "-i", a.src, "-vf", f"scale={w}:{h},fps={fps}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    writer = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}", "-r", str(fps), "-i", "-", "-ss", str(a.start), "-t", str(a.seconds), "-i", a.src, "-map", "0:v", "-map", "1:a?", "-c:v", "libx264", "-preset", "fast", "-crf", "17", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", a.dst],
        stdin=subprocess.PIPE,
    )
    stills = {int(float(s) * fps) for s in a.stills.split(",") if s}
    deck = Deck(w, h, fps, a.intensity, director, audio, a.seed)
    size, n = w * h * 3, 0
    while True:
        buf = reader.stdout.read(size)
        if len(buf) < size:
            break
        frame = torch.from_numpy(np.frombuffer(buf, np.uint8).reshape(h, w, 3).copy()).to(DEV).permute(2, 0, 1).float() / 255
        out = deck.render(n, frame)
        rgb = (out.permute(1, 2, 0) * 255).byte().cpu().numpy()
        if n in stills:
            cv2.imwrite(a.dst.rsplit(".", 1)[0] + f"_{n / fps:05.2f}.png", rgb[:, :, ::-1])
        writer.stdin.write(rgb.tobytes())
        n += 1
        if n % 60 == 0:
            print(f"{n} frames  {n / fps:5.1f}s", file=sys.stderr, flush=True)
    writer.stdin.close()
    writer.wait()
    reader.wait()
    print(f"done: {n} frames -> {a.dst}")


if __name__ == "__main__":
    main()
