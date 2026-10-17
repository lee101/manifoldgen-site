"""Extra Deep Glitch effects: threshold split, pixel stretch, pixel sort, solarize / colour stretch,
per-channel RGB glitch, zoom + whip blur, strobe, and instance (SAM2) looks.

Every function takes and returns a 3xHxW float tensor in 0..1, so they work both as a full
"look" and as a burst applied on top of whatever is already on screen.
"""
import colorsys
import math

import torch
import torch.nn.functional as F

from core import DEV, bands, blur, fbm, hash_cells, luma, palette, pn, rgb_split, strips, warp


def _col(h, s=0.9, v=1.0):
    return torch.tensor(colorsys.hsv_to_rgb(h % 1.0, s, v), device=DEV).view(3, 1, 1)


def hue_rotate(x, turns):
    """Rotate chroma in YIQ; `turns` is a scalar or 1xHxW map (e.g. depth)."""
    r, g, b = x
    y = 0.299 * r + 0.587 * g + 0.114 * b
    i = 0.596 * r - 0.274 * g - 0.322 * b
    q = 0.211 * r - 0.523 * g + 0.312 * b
    a = turns * 2 * math.pi
    c, s = (torch.cos(a), torch.sin(a)) if torch.is_tensor(a) else (math.cos(a), math.sin(a))
    i2, q2 = i * c - q * s, i * s + q * c
    return torch.stack([y + 0.956 * i2 + 0.621 * q2, y - 0.272 * i2 - 0.647 * q2, y - 1.106 * i2 + 1.703 * q2]).reshape(x.shape).clamp(0, 1)


# ---------------------------------------------------------------- threshold split
def split_threshold(f, ctx, t, seed):
    """Two-colour split at a moving threshold (luma or depth), with a bright seam on the threshold."""
    v = ctx["depth"] if seed % 2 else luma(blur(f, 3))
    thr = 0.42 + 0.2 * math.sin(t * 2.1 + seed) + 0.25 * (fbm(t * 1.3, seed) - 0.5)
    hi = ((v - thr) / 0.03).clamp(0, 1)
    hue = (seed * 0.137 + t * 0.08) % 1.0
    lum = luma(f)
    out = _col(hue + 0.5, 0.85) * (0.12 + 0.95 * lum) * (1 - hi) + _col(hue, 0.9) * (0.35 + 0.8 * lum) * hi
    seam = 1 - ((v - thr).abs() / 0.018).clamp(0, 1)
    return (out + seam).clamp(0, 1)


# ---------------------------------------------------------------- pixel stretch
def stretch(f, thr, length, vertical=False, dark=False, tint=None):
    """Smear each pixel past `thr` along its row (or column) for up to `length` px."""
    x = f.transpose(1, 2) if vertical else f
    l = luma(x)
    hit = (l < thr) if dark else (l > thr)
    ix = torch.arange(x.shape[2], device=x.device).view(1, 1, -1).expand_as(l)
    idx = torch.cummax(torch.where(hit, ix, torch.full_like(ix, -1)), dim=2)[0]
    valid = (idx >= 0) & ((ix - idx) < length) & ~hit
    col = x.gather(2, idx.clamp(min=0).expand(3, -1, -1))
    if tint is not None:
        col = col * tint
    out = torch.where(valid.expand(3, -1, -1), col, x)
    return out.transpose(1, 2) if vertical else out


def look_stretch(f, ctx, t, seed):
    w = f.shape[2]
    thr = 0.5 + 0.18 * math.sin(t * 2.7 + seed)
    length = int(w * (0.08 + 0.3 * fbm(t * 1.1, seed)))
    out = stretch(f, thr, length, vertical=(seed % 3 == 0), dark=(seed % 5 == 0), tint=_col(seed * 0.21, 0.5) * 1.15 + 0.2)
    return (out * 1.08).clamp(0, 1)


# ---------------------------------------------------------------- pixel sort
def pixel_sort(f, chunk, row_mask, descending=True):
    """Sort pixels by luma inside fixed-length chunks of each row, only on rows where row_mask is 1."""
    c, h, w = f.shape
    pad = (-w) % chunk
    x = F.pad(f, (0, pad), mode="replicate")
    l = luma(x)
    idx = l.view(1, h, -1, chunk).argsort(dim=-1, descending=descending)
    srt = x.view(3, h, -1, chunk).gather(3, idx.expand(3, -1, -1, -1)).view(3, h, -1)[:, :, :w]
    return srt * row_mask + f * (1 - row_mask)


def look_sort(f, ctx, t, seed):
    gen = torch.Generator().manual_seed(seed * 53 + int(t * 6))
    rows = (strips(torch.linspace(0, 1, f.shape[1], device=DEV).view(1, -1, 1).expand(1, -1, f.shape[2]), 48, gen) < 0.5 + 0.3 * math.sin(t * 2 + seed)).float()
    return pixel_sort(f, chunk=int(40 + 200 * pn(t * 0.8, seed)), row_mask=rows, descending=bool(seed % 2))


# ---------------------------------------------------------------- colour: solarize / stretch
def look_solar(f, ctx, t, seed):
    thr = 0.5 + 0.2 * math.sin(t * 3 + seed)
    off = torch.tensor([0.0, 0.08, -0.08], device=DEV).view(3, 1, 1)
    sol = torch.where(f > thr + off, 1 - f, f)
    sol = hue_rotate(sol, ctx["depth"] * 0.8 + t * 0.1 + seed * 0.07)
    lum = luma(sol)
    return (lum + (sol - lum) * 1.6).clamp(0, 1)


def look_cstretch(f, ctx, t, seed):
    """Aggressive per-channel levels + gamma: psychedelic colour stretch that re-rolls ~3x a second."""
    import random

    r = random.Random(seed * 977 + int(t * 3))
    lo = torch.tensor([r.uniform(0.0, 0.35) for _ in range(3)], device=DEV).view(3, 1, 1)
    hi = torch.tensor([r.uniform(0.6, 1.0) for _ in range(3)], device=DEV).view(3, 1, 1)
    gam = torch.tensor([r.uniform(0.5, 2.2) for _ in range(3)], device=DEV).view(3, 1, 1)
    return (((f - lo) / (hi - lo)).clamp(0, 1) ** gam).clamp(0, 1)


# ---------------------------------------------------------------- per-channel RGB glitch
def chan_glitch(f, gen, e, t):
    """Each colour channel gets its own band tear and block jitter, plus channel dropout."""
    c, h, w = f.shape
    chans = []
    for i in range(3):
        dx = bands(h, gen, 8, 90, 0.05 * e, DEV)[None, :, None].expand(1, h, w)
        dy = (hash_cells(h, w, int(torch.randint(30, 120, (1,), generator=gen)), gen, DEV) - 0.5) * 0.04 * e
        ch = warp(f[i : i + 1], dx, dy)
        drop = (torch.rand(h, generator=gen).to(DEV) < 0.05 * e)[None, :, None].float()
        chans.append(ch * (1 - drop * 0.9))
    return torch.cat(chans)


def channel_swap(f, mask, order):
    swapped = f[list(order)]
    return f * (1 - mask) + swapped * mask


# ---------------------------------------------------------------- blurs: zoom + whip
def zoom_blur(f, cx, cy, amount, taps=8):
    h, w = f.shape[1:]
    ys, xs = torch.meshgrid(torch.linspace(0, 1, h, device=DEV), torch.linspace(0, 1, w, device=DEV), indexing="ij")
    acc = torch.zeros_like(f)
    for k in range(taps):
        s = amount * k / (taps - 1)
        acc += warp(f, (xs[None] - cx) * s, (ys[None] - cy) * s)
    return acc / taps


def whip_blur(f, angle, amount, taps=9):
    acc = torch.zeros_like(f)
    c, s = math.cos(angle), math.sin(angle)
    for k in range(taps):
        d = amount * (k / (taps - 1) - 0.5)
        acc += warp(f, d * c, d * s)
    return acc / taps


# ---------------------------------------------------------------- instance (SAM2) looks
def mask_border(m, color, width=7):
    eroded = -F.max_pool2d(-m[None], width, 1, width // 2)[0]
    return (m - eroded).clamp(0, 1) * torch.tensor(color, device=DEV).view(3, 1, 1)


def look_seg(f, ctx, t, tracks):
    """Segmentation view: dimmed desaturated frame, every instance filled with its own colour + outline."""
    lum = luma(f)
    out = lum.expand(3, -1, -1) * 0.32
    for tr in tracks:
        col = _col(tr["id"] * 0.173 + 0.05, 0.85)
        m = tr["mask"]
        out = out * (1 - m * 0.75) + col * m * (0.3 + 0.8 * lum) * 0.75 + mask_border(m, (1.0, 1.0, 1.0)) * 0.9
    return out.clamp(0, 1)


def look_cutout(f, ctx, t, tracks, topo):
    """Main subject stays in colour (glowing outline), everything else becomes the topo map."""
    if not tracks:
        return topo
    m = tracks[0]["mask"]
    return (f * m + topo * 0.85 * (1 - m) + mask_border(m, (0.3, 1.0, 0.75), 9) * 1.2).clamp(0, 1)


# ---------------------------------------------------------------- strobe
def strobe(f, frame_no, e):
    """Beat flash: alternate negative / overexposed frames while the burst is strong."""
    if e < 0.25:
        return f
    return (1 - f) if frame_no % 2 == 0 else (f * 1.8 + 0.25 * e).clamp(0, 1)
