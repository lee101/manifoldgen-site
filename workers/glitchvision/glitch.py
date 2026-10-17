#!/usr/bin/env python3
"""Deep Glitch: edge / normal / depth / object-detector sci-fi CRT mashup.

Per frame: Depth Anything V2 -> depth, surface normals (from depth), edges
(luma + depth), foreground "detections" (depth blobs). Looks cycle through
raw HUD, neon edges, normal map, depth heat, a layered mashup and a heavy CRT
pass, joined by glitch transitions (depth sweep, scan tear, block mosh, scan
wipe, edge flash). Everything but the HUD runs on the GPU.

  python glitch.py in.mp4 out.mp4 --start 10 --seconds 12
"""
import argparse
import math
import subprocess
import sys

import cv2
import numpy as np
import torch
import torch.nn.functional as F

DEV = "cuda" if torch.cuda.is_available() else "cpu"
MODEL = "depth-anything/Depth-Anything-V2-Small-hf"
GREEN = (60, 255, 140)  # BGR for cv2 HUD

# (mode, seconds) -- transitions overlap the last TRANS seconds of each shot
TIMELINE = [("raw", 1.6), ("edge", 1.6), ("normal", 1.4), ("depth", 1.6), ("mash", 2.0), ("edge", 1.2), ("depth", 1.2), ("mash", 1.6), ("crt", 1.6)]
TRANSITIONS = ["depthwipe", "tear", "blocks", "scanwipe", "edgeflash", "depthwipe", "tear", "blocks"]
TRANS = 0.45


# ---------------------------------------------------------------- helpers
def luma(x):
    return (0.2126 * x[0] + 0.7152 * x[1] + 0.0722 * x[2])[None]


def sobel(g):
    k = torch.tensor([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], dtype=g.dtype, device=g.device)
    kx, ky = k[None, None], k.t()[None, None]
    g = F.pad(g[None], (1, 1, 1, 1), mode="replicate")
    return F.conv2d(g, kx)[0], F.conv2d(g, ky)[0]


def blur(x, k):
    return F.avg_pool2d(F.pad(x[None], (k // 2,) * 4, mode="replicate"), k, 1)[0]


def palette(v):
    """dark navy -> blue -> cyan -> mint -> white-yellow, v in 0..1, returns 3xHxW."""
    stops = torch.tensor([[0.01, 0.0, 0.08], [0.05, 0.1, 0.7], [0.0, 0.8, 1.0], [0.3, 1.0, 0.6], [1.0, 1.0, 0.75]], device=v.device)
    p = v.clamp(0, 1)[0] * (len(stops) - 1)
    i = p.floor().long().clamp(0, len(stops) - 2)
    f = (p - i)[..., None]
    return (stops[i] * (1 - f) + stops[i + 1] * f).permute(2, 0, 1)


def warp(x, dx, dy):
    """Sample x (CxHxW) at uv + (dx, dy); dx/dy are 1xHxW or scalars in uv (0..1) units."""
    _, h, w = x.shape
    ys, xs = torch.meshgrid(torch.linspace(-1, 1, h, device=x.device), torch.linspace(-1, 1, w, device=x.device), indexing="ij")
    gx = xs + (dx[0] if torch.is_tensor(dx) else dx) * 2
    gy = ys + (dy[0] if torch.is_tensor(dy) else dy) * 2
    return F.grid_sample(x[None], torch.stack([gx, gy], -1)[None], mode="bilinear", padding_mode="reflection", align_corners=True)[0]


def rgb_split(x, amount, angle=0.0):
    if amount <= 1e-5:
        return x
    c, s = math.cos(angle), math.sin(angle)
    ch = [warp(x[i : i + 1], amount * c * k, amount * s * k)[0] for i, k in enumerate((-1.0, 0.0, 1.0))]
    return torch.stack(ch)


def bands(h, gen, n_lo, n_hi, strength, device):
    """Per-row horizontal offsets from random-height bands (the VHS/tear look)."""
    out = torch.zeros(h, device=device)
    y = 0
    while y < h:
        size = int(torch.randint(max(2, h // n_hi), max(3, h // n_lo), (1,), generator=gen, device="cpu"))
        if torch.rand(1, generator=gen).item() < 0.55:
            out[y : y + size] = (torch.rand(1, generator=gen).item() - 0.5) * 2 * strength
        y += size
    return out


def hash_cells(h, w, cell, gen, device):
    gh, gw = math.ceil(h / cell), math.ceil(w / cell)
    r = torch.rand(gh, gw, generator=gen).to(device)
    return F.interpolate(r[None, None], size=(gh * cell, gw * cell), mode="nearest")[0, :, :h, :w]


# ---------------------------------------------------------------- analysis
class Analyzer:
    def __init__(self):
        from transformers import AutoImageProcessor, AutoModelForDepthEstimation

        self.proc = AutoImageProcessor.from_pretrained(MODEL)
        self.model = AutoModelForDepthEstimation.from_pretrained(MODEL).to(DEV).half().eval()
        self.lo = self.hi = None
        self.prev_depth = None
        self.tracks = []
        self.mean = torch.tensor([0.485, 0.456, 0.406], device=DEV).view(1, 3, 1, 1)
        self.std = torch.tensor([0.229, 0.224, 0.225], device=DEV).view(1, 3, 1, 1)

    @torch.no_grad()
    def depth(self, frame):
        _, h, w = frame.shape
        side = 518
        x = F.interpolate(frame[None], size=(side * 9 // 16 // 14 * 14, side * 16 // 9 // 14 * 14), mode="bilinear", align_corners=False)
        x = ((x - self.mean) / self.std).half()
        d = self.model(pixel_values=x).predicted_depth[None].float()
        d = F.interpolate(d, size=(h, w), mode="bilinear", align_corners=False)[0]
        lo, hi = torch.quantile(d.flatten()[::97], torch.tensor([0.02, 0.98], device=DEV))
        self.lo = lo if self.lo is None else self.lo * 0.9 + lo * 0.1
        self.hi = hi if self.hi is None else self.hi * 0.9 + hi * 0.1
        d = ((d - self.lo) / (self.hi - self.lo + 1e-6)).clamp(0, 1)
        hist = torch.histc(d, 256, 0, 1)
        cdf = hist.cumsum(0) / hist.sum()
        d = 0.45 * d + 0.55 * cdf[(d * 255).long().clamp(0, 255)]  # equalise: spread flat scenes across the palette
        d = d if self.prev_depth is None else 0.55 * d + 0.45 * self.prev_depth
        self.prev_depth = d
        return d  # 1 = near

    @staticmethod
    def normals(d, frame):
        gx, gy = sobel(blur(d, 5))
        bx, by = sobel(blur(luma(frame), 3))  # fine surface detail the depth model smooths away
        n = torch.cat([-(gx * 22.0 + bx * 1.6), -(gy * 22.0 + by * 1.6), torch.ones_like(gx)])
        return n / n.norm(dim=0, keepdim=True)

    @staticmethod
    def edges(frame, d):
        gx, gy = sobel(blur(luma(frame), 3))
        dx, dy = sobel(blur(d, 3))
        e = (gx.abs() + gy.abs()) * 1.6 + (dx.abs() + dy.abs()) * 5.0
        return (e * 2.2).clamp(0, 1), (dx.abs() + dy.abs()).mul(8.0).clamp(0, 1)

    def hotspots(self, e, w, h, count=5):
        """Edge-density cells as secondary 'feature' targets."""
        gh, gw = 6, 10
        cells = F.adaptive_avg_pool2d(e[None], (gh, gw))[0, 0].cpu().numpy()
        order = np.dstack(np.unravel_index(np.argsort(-cells.ravel()), cells.shape))[0][:count]
        cw, ch = w / gw, h / gh
        return [[c * cw + cw * 0.12, r * ch + ch * 0.12, (c + 1) * cw - cw * 0.12, (r + 1) * ch - ch * 0.12, float(cells[r, c])] for r, c in order]

    def detect(self, d, w, h):
        """Depth blobs -> boxes, smoothed and kept ids across frames."""
        small = F.interpolate(d[None], size=(h // 4, w // 4), mode="bilinear")[0, 0].cpu().numpy()
        found = []
        for thr in (0.62, 0.8):
            mask = (small > thr).astype(np.uint8)
            mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
            mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
            n, _, stats, _ = cv2.connectedComponentsWithStats(mask)
            for i in range(1, n):
                x, y, bw, bh, area = stats[i]
                if area > 0.012 * small.size and not (bw > 0.95 * small.shape[1] and bh > 0.95 * small.shape[0]):
                    found.append([x * 4, y * 4, (x + bw) * 4, (y + bh) * 4, float(small[y : y + bh, x : x + bw].mean())])
        found.sort(key=lambda b: -(b[2] - b[0]) * (b[3] - b[1]))
        new = []
        for box in found[:4]:
            best = None
            for t in self.tracks:
                if abs(t["box"][0] - box[0]) + abs(t["box"][1] - box[1]) < 0.25 * w and (best is None or t["age"] > best["age"]):
                    best = t
            if best and best not in [n_["t"] for n_ in new]:
                best["box"] = [a * 0.7 + b * 0.3 for a, b in zip(best["box"], box[:4])]
                best["depth"], best["age"] = box[4], best["age"] + 1
                new.append({"t": best})
            else:
                new.append({"t": {"box": box[:4], "depth": box[4], "age": 0, "id": len(self.tracks) + len(new) + 1}})
        self.tracks = [n_["t"] for n_ in new]
        return self.tracks


# ---------------------------------------------------------------- looks
def look_edge(frame, ctx):
    e, de = ctx["edges"]
    n = ctx["normal"]
    neon = (n * 0.5 + 0.5)
    neon = neon / neon.max(0, keepdim=True)[0].clamp(min=1e-3)
    glow = blur(e, 9) * 1.4
    base = frame * 0.07
    object_edge = torch.cat([de * 0.2, de * 1.0, de * 0.9])
    return (base + neon * e * 1.15 + neon * glow * 0.5 + object_edge).clamp(0, 1)


def look_normal(frame, ctx):
    nn = ctx["normal"]
    nn = torch.cat([nn[:2] * 3.2, nn[2:]])  # exaggerate tilt so flat walls still show colour
    n = nn / nn.norm(dim=0, keepdim=True) * 0.5 + 0.5
    shade = 0.55 + 0.7 * luma(frame)
    return (n * shade * 0.95 + ctx["edges"][0] * 0.15).clamp(0, 1)


def look_depth(frame, ctx, t):
    d = ctx["depth"]
    heat = palette(d)
    contour = ((d * 14 + t * 0.6) % 1.0 < 0.06).float()
    scan = ((d * 1.0 - (t * 0.5) % 1.0).abs() < 0.015).float() * 1.5
    return (heat * (0.55 + 0.7 * luma(frame)) + contour * heat * 0.8 + scan * torch.tensor([0.5, 1.0, 0.9], device=DEV).view(3, 1, 1) * 0.6).clamp(0, 1)


def look_mash(frame, ctx, t, gen):
    d = ctx["depth"]
    levels = 7
    q = torch.floor(d * levels) / levels
    shift = (q - 0.45) * (0.045 * math.sin(t * 3.1) + 0.02)
    layered = rgb_split(warp(frame, shift, 0.0), 0.006 + 0.004 * math.sin(t * 7), t)
    e, de = ctx["edges"]
    n = ctx["normal"] * 0.5 + 0.5
    tint = layered * 0.55 + n * luma(layered) * 0.9
    heat = palette(d)
    # depth slabs alternate between tinted live video and heat map
    slab = ((torch.floor(d * levels) + torch.floor(torch.tensor(t * 4.0))) % 3 == 0).float()
    out = tint * (1 - slab * 0.55) + heat * slab * 0.65
    neon = n / n.max(0, keepdim=True)[0].clamp(min=1e-3)
    return (out + neon * e * 0.95 + de * torch.tensor([0.1, 1.0, 0.7], device=DEV).view(3, 1, 1)).clamp(0, 1)


def render_look(mode, frame, ctx, t, gen):
    if mode in ("raw", "crt"):
        return frame
    if mode == "edge":
        return look_edge(frame, ctx)
    if mode == "normal":
        return look_normal(frame, ctx)
    if mode == "depth":
        return look_depth(frame, ctx, t)
    return look_mash(frame, ctx, t, gen)


# ---------------------------------------------------------------- transitions
def transition(kind, a, b, p, ctx, gen, t):
    """a -> b at progress p in 0..1; returns the blended frame."""
    _, h, w = a.shape
    peak = math.sin(math.pi * p)
    if kind == "depthwipe":
        thr = 1.15 - p * 1.3  # near objects flip first
        d = ctx["depth"]
        band = ((d - thr).abs() < 0.07).float()
        mask = (d > thr).float()
        out = a * (1 - mask) + b * mask
        shifted = warp(out, (torch.rand(1, generator=gen).item() - 0.5) * 0.05, 0.0)
        inv = 1 - shifted
        out = out * (1 - band) + (inv * 0.6 + palette(d) * 0.5) * band
        return rgb_split(out, 0.012 * peak, t * 2)
    if kind == "tear":
        offs = bands(h, gen, 10, 80, 0.07 * (0.3 + peak), a.device)[None, :, None].expand(1, h, w)
        pick = (torch.rand(h, generator=gen).to(a.device) < p)[None, :, None].float()
        out = a * (1 - pick) + b * pick
        out = warp(out, offs, 0.0)
        return rgb_split(out, 0.02 * peak, 0.0)
    if kind == "blocks":
        cell = int(torch.randint(24, 110, (1,), generator=gen))
        r = hash_cells(h, w, cell, gen, a.device)
        pick = (r < p).float()
        out = a * (1 - pick) + b * pick
        jitter = (hash_cells(h, w, cell, gen, a.device) - 0.5) * 0.08 * peak
        out = warp(out, jitter, 0.0)
        return rgb_split(out, 0.01 * peak, 1.0)
    if kind == "scanwipe":
        y = torch.linspace(0, 1, h, device=a.device)[None, :, None].expand(1, h, w)
        line = p * 1.1 - 0.05
        mask = (y < line).float()
        out = a * (1 - mask) + b * mask
        glow = torch.exp(-((y - line).abs() * 38)) * 1.4
        out = out + glow * torch.tensor([0.4, 1.0, 0.8], device=a.device).view(3, 1, 1)
        return warp(out, torch.exp(-((y - line).abs() * 22)) * 0.03 * math.sin(t * 90), 0.0)
    # edgeflash: zoom punch to the edge map at midpoint
    e = ctx["edges"][0]
    flash = (e.expand(3, -1, -1) * torch.tensor([0.6, 1.0, 0.9], device=a.device).view(3, 1, 1) * 1.6).clamp(0, 1)
    mix = a if p < 0.5 else b
    f = math.exp(-abs(p - 0.5) * 9)
    zoom = 1.0 - 0.06 * f
    out = warp(mix, (torch.linspace(-0.5, 0.5, w, device=a.device)[None, None, :] * (zoom - 1)).expand(1, h, w), (torch.linspace(-0.5, 0.5, h, device=a.device)[None, :, None] * (zoom - 1)).expand(1, h, w))
    out = out * (1 - f * 0.85) + flash * f
    return rgb_split(out, 0.015 * peak, 0.5)


# ---------------------------------------------------------------- HUD + CRT
def draw_hud(w, h, tracks, spots, t, frame_no, mode, intensity):
    img = np.zeros((h, w, 3), np.uint8)
    if intensity <= 0.02:
        return img
    font = cv2.FONT_HERSHEY_DUPLEX
    for tr in tracks:
        x1, y1, x2, y2 = [int(v) for v in tr["box"]]
        dist = 0.6 + (1 - tr["depth"]) * 7.5
        cl = 22
        for (cx, cy, sx, sy) in ((x1, y1, 1, 1), (x2, y1, -1, 1), (x1, y2, 1, -1), (x2, y2, -1, -1)):
            cv2.line(img, (cx, cy), (cx + sx * cl, cy), GREEN, 4)
            cv2.line(img, (cx, cy), (cx, cy + sy * cl), GREEN, 4)
        cv2.rectangle(img, (x1, y1), (x2, y2), GREEN, 2)
        label = f"OBJ_{tr['id']:02d} {0.82 + 0.15 * math.sin(tr['id'] + t * 1.7):.2f}"
        (tw, th), _ = cv2.getTextSize(label, font, 0.55, 1)
        cv2.rectangle(img, (x1, y1 - th - 14), (x1 + tw + 12, y1 - 2), GREEN, -1)
        cv2.putText(img, label, (x1 + 6, y1 - 8), font, 0.55, (0, 20, 0), 1, cv2.LINE_AA)
        cv2.putText(img, f"DIST {dist:4.1f}M", (x1 + 6, y2 + 22), font, 0.5, GREEN, 1, cv2.LINE_AA)
        cv2.putText(img, f"NRM {tr['depth']:.2f}", (x1 + 6, y2 + 42), font, 0.45, GREEN, 1, cv2.LINE_AA)
        cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
        cv2.circle(img, (cx, cy), 18, GREEN, 1)
        cv2.line(img, (cx - 30, cy), (cx - 10, cy), GREEN, 1)
        cv2.line(img, (cx + 10, cy), (cx + 30, cy), GREEN, 1)
    for i, (x1, y1, x2, y2, score) in enumerate(spots):
        x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
        if (int(t * 6) + i) % 7 == 0:
            continue  # targets blink in and out
        cv2.rectangle(img, (x1, y1), (x2, y2), (255, 230, 60), 1)
        cv2.putText(img, f"FT{i:02d} {score:.2f}", (x1, y1 - 5), font, 0.4, (255, 230, 60), 1, cv2.LINE_AA)
        cv2.line(img, ((x1 + x2) // 2 - 6, (y1 + y2) // 2), ((x1 + x2) // 2 + 6, (y1 + y2) // 2), (255, 230, 60), 1)
    # frame, readouts
    cv2.putText(img, f"DEEP.GLITCH // {mode.upper():6s} // F{frame_no:05d}", (28, 44), font, 0.7, GREEN, 1, cv2.LINE_AA)
    cv2.putText(img, f"T+{t:06.2f}s  DEPTH-ANYTHING-V2  NRM/EDG/OBJ", (28, 70), font, 0.5, GREEN, 1, cv2.LINE_AA)
    cv2.rectangle(img, (w - 54, 40), (w - 34, h - 40), tuple(int(c * 0.5) for c in GREEN), 1)
    for k in range(0, 100, 5):
        yy = int(h - 40 - k / 100 * (h - 80))
        cv2.line(img, (w - 54, yy), (w - 54 + (14 if k % 25 == 0 else 7), yy), GREEN, 1)
    sweep = int(h - 40 - ((t * 0.37) % 1.0) * (h - 80))
    cv2.line(img, (w - 64, sweep), (w - 24, sweep), (255, 255, 255), 2)
    img = (img * intensity).astype(np.uint8)
    return img


def crt(x, t, strength, gen):
    if strength <= 0.01:
        return x
    _, h, w = x.shape
    ys, xs = torch.meshgrid(torch.linspace(-1, 1, h, device=x.device), torch.linspace(-1, 1, w, device=x.device), indexing="ij")
    r2 = xs**2 * 0.6 + ys**2
    k = 0.07 * strength
    gx, gy = xs * (1 + k * r2), ys * (1 + k * r2 * 1.2)
    out = F.grid_sample(x[None], torch.stack([gx, gy], -1)[None], mode="bilinear", padding_mode="zeros", align_corners=True)[0]
    out = rgb_split(out, 0.0016 * strength + 0.003 * strength * abs(math.sin(t * 2.3)), 0.0)
    # phosphor triad + scanlines
    xi = torch.arange(w, device=x.device)
    mask = torch.stack([(xi % 3 == i).float() * 0.55 + 0.6 for i in range(3)])[:, None, :]
    yi = torch.arange(h, device=x.device).float()
    scan = (0.78 + 0.22 * torch.cos(yi * math.pi * 2 / 3.0))[None, :, None]
    roll = torch.exp(-(((yi / h) - ((t * 0.18) % 1.4 - 0.2)).abs() * 14))[None, :, None] * 0.22
    out = out * (1 - strength * 0.55 * (1 - mask)) * (1 - strength * (1 - scan)) + roll * strength
    glow = F.interpolate(F.avg_pool2d(out[None], 8)[0][None], size=(h, w), mode="bilinear")[0]
    out = out + glow * 0.45 * strength
    vig = (1 - 0.55 * strength * (xs**2 * 0.5 + ys**2 * 0.7).clamp(0, 1))[None]
    flick = 1 - 0.04 * strength * torch.rand(1, generator=gen).item()
    noise = (torch.rand(1, h, w, generator=gen).to(x.device) - 0.5) * 0.05 * strength
    return ((out + noise) * vig * flick).clamp(0, 1)


# ---------------------------------------------------------------- main
def shot_at(t):
    """Return (index_a, index_b, p) where p>0 only inside a transition window."""
    acc = 0.0
    for i, (_, dur) in enumerate(TIMELINE):
        end = acc + dur
        if t < end:
            if i + 1 < len(TIMELINE) and t > end - TRANS:
                return i, i + 1, (t - (end - TRANS)) / TRANS
            return i, i, 0.0
        acc = end
    return len(TIMELINE) - 1, len(TIMELINE) - 1, 0.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--start", type=float, default=0)
    ap.add_argument("--seconds", type=float, default=sum(d for _, d in TIMELINE))
    ap.add_argument("--width", type=int, default=1280)
    ap.add_argument("--height", type=int, default=720)
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--stills", default="", help="comma separated seconds to dump as PNG next to dst")
    a = ap.parse_args()
    w, h, fps = a.width, a.height, a.fps
    reader = subprocess.Popen(["ffmpeg", "-v", "error", "-ss", str(a.start), "-t", str(a.seconds), "-i", a.src, "-vf", f"scale={w}:{h},fps={fps}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    writer = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}", "-r", str(fps), "-i", "-", "-ss", str(a.start), "-t", str(a.seconds), "-i", a.src, "-map", "0:v", "-map", "1:a?", "-c:v", "libx264", "-preset", "fast", "-crf", "17", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", a.dst],
        stdin=subprocess.PIPE,
    )
    stills = {int(float(s) * fps) for s in a.stills.split(",") if s}
    analyzer = Analyzer()
    size = w * h * 3
    n = 0
    while True:
        buf = reader.stdout.read(size)
        if len(buf) < size:
            break
        t = n / fps
        gen = torch.Generator().manual_seed(n // 2 * 7919 + 13)  # glitches update at half rate: chunkier
        frame = torch.from_numpy(np.frombuffer(buf, np.uint8).reshape(h, w, 3).copy()).to(DEV).permute(2, 0, 1).float() / 255
        depth = analyzer.depth(frame)
        ctx = {"depth": depth, "normal": analyzer.normals(depth, frame)}
        ctx["edges"] = analyzer.edges(frame, depth)
        tracks = analyzer.detect(depth, w, h)
        spots = analyzer.hotspots(ctx['edges'][0], w, h)
        ia, ib, p = shot_at(t)
        ma, mb = TIMELINE[ia][0], TIMELINE[ib][0]
        la = render_look(ma, frame, ctx, t, gen)
        out = la
        if ia != ib:
            out = transition(TRANSITIONS[ia % len(TRANSITIONS)], la, render_look(mb, frame, ctx, t, gen), p, ctx, gen, t)
        mode = mb if p > 0.5 else ma
        hud_amt = {"raw": 1.0, "crt": 0.9, "edge": 0.55, "normal": 0.5, "depth": 0.7, "mash": 0.85}[mode]
        hud = torch.from_numpy(draw_hud(w, h, tracks, spots, t, n, mode, hud_amt)).to(DEV).permute(2, 0, 1).float() / 255
        hud = hud[[2, 1, 0]]  # cv2 BGR -> RGB
        out = (out + hud * (hud.max(0, keepdim=True)[0] > 0).float()).clamp(0, 1)
        strength = {"raw": 0.35, "crt": 1.0, "edge": 0.6, "normal": 0.5, "depth": 0.55, "mash": 0.8}[mode]
        if ia != ib:
            strength = max(strength, 0.9)
        out = crt(out, t, strength, gen)
        rgb = (out.permute(1, 2, 0) * 255).byte().cpu().numpy()
        if n in stills:
            cv2.imwrite(a.dst.rsplit(".", 1)[0] + f"_{t:05.2f}.png", rgb[:, :, ::-1])
        writer.stdin.write(rgb.tobytes())
        n += 1
        if n % 30 == 0:
            print(f"{n} frames  {t:5.1f}s  {mode}", file=sys.stderr, flush=True)
    writer.stdin.close()
    writer.wait()
    reader.wait()
    print(f"done: {n} frames -> {a.dst}")


if __name__ == "__main__":
    main()
