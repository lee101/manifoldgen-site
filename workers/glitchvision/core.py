"""Shared noise + tensor helpers for Deep Glitch."""
import math

import torch
import torch.nn.functional as F

DEV = "cuda" if torch.cuda.is_available() else "cpu"


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
