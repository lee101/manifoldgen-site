from __future__ import annotations

import math

import numpy as np
import torch
import torch.nn.functional as F


def available() -> bool:
    return torch.cuda.is_available()


def blur(x: torch.Tensor, sigma: float) -> torch.Tensor:
    if sigma <= 0:
        return x
    r = min(max(1, int(3 * sigma + 0.5)), x.shape[2] - 1, x.shape[3] - 1)
    if r < 1:
        return x
    t = torch.arange(-r, r + 1, device=x.device, dtype=torch.float32)
    k = torch.exp(-t * t / (2 * sigma * sigma))
    k = k / k.sum()
    c = x.shape[1]
    kx = k.view(1, 1, 1, -1).repeat(c, 1, 1, 1)
    ky = k.view(1, 1, -1, 1).repeat(c, 1, 1, 1)
    x = F.conv2d(F.pad(x, (r, r, 0, 0), mode="reflect"), kx, groups=c)
    return F.conv2d(F.pad(x, (0, 0, r, r), mode="reflect"), ky, groups=c)


class Canvas:
    def __init__(self, W: int, H: int, sx: float, sy: float, device: str = "cuda"):
        self.W, self.H, self.sx, self.sy = W, H, sx, sy
        self.dev = torch.device(device)
        ys, xs = torch.meshgrid(torch.arange(H, device=self.dev, dtype=torch.float32), torch.arange(W, device=self.dev, dtype=torch.float32), indexing="ij")
        self.gx, self.gy = xs, ys

    def image(self, frame: np.ndarray) -> torch.Tensor:
        return torch.from_numpy(np.ascontiguousarray(frame)).to(self.dev, non_blocking=True).permute(2, 0, 1)[None].float()

    def flow(self, f: np.ndarray) -> torch.Tensor:
        t = torch.from_numpy(np.ascontiguousarray(f)).to(self.dev).permute(2, 0, 1)[None].float()
        t = F.interpolate(t, size=(self.H, self.W), mode="bilinear", align_corners=False)
        return t * torch.tensor([self.sx, self.sy], device=self.dev).view(1, 2, 1, 1)

    def sample(self, img: torch.Tensor, dx: torch.Tensor, dy: torch.Tensor, pad: str = "border") -> torch.Tensor:
        gx = (self.gx + dx.reshape(self.H, self.W)) * (2.0 / (self.W - 1)) - 1.0
        gy = (self.gy + dy.reshape(self.H, self.W)) * (2.0 / (self.H - 1)) - 1.0
        return F.grid_sample(img, torch.stack([gx, gy], -1)[None], mode="bilinear", padding_mode=pad, align_corners=True)

    def out(self, img: torch.Tensor) -> np.ndarray:
        return img.clamp(0, 255).round().to(torch.uint8)[0].permute(1, 2, 0).contiguous().cpu().numpy()

    def motion_blur(self, img: torch.Tensor, flow: torch.Tensor, shutter: float) -> torch.Tensor:
        mag = torch.hypot(flow[0, 0, ::4, ::4], flow[0, 1, ::4, ::4]).flatten()
        q = float(torch.quantile(mag, 0.99)) * shutter
        n = int(np.clip(q, 3, 25))
        acc = torch.zeros_like(img)
        for k in np.linspace(-0.5, 0.5, n).tolist():
            acc += self.sample(img, k * shutter * flow[0, 0], k * shutter * flow[0, 1])
        return acc / n

    def flow_color(self, img: torch.Tensor, flow: torch.Tensor, amount: float) -> torch.Tensor:
        fx, fy = flow[0, 0], flow[0, 1]
        ang = torch.atan2(fy, fx)
        mag = (torch.hypot(fx, fy) / 12.0).clamp(0, 1)
        h6 = torch.floor((ang + math.pi) / (2 * math.pi) * 179) * 2.0 / 60.0

        def chan(n: float) -> torch.Tensor:
            k = torch.remainder(n + h6, 6.0)
            return mag * (1 - torch.clamp(torch.minimum(k, 4 - k), 0, 1))

        col = torch.stack([chan(1.0), chan(3.0), chan(5.0)])[None] * 255.0
        m = mag[None, None]
        return img * (1 - amount * m) + col * amount * m


class Jelly:
    def __init__(self, cv: Canvas, strength: float):
        self.cv = cv
        self.E = torch.zeros(1, 2, cv.H, cv.W, device=cv.dev)
        self.V = torch.zeros_like(self.E)
        self.g = 0.32 * strength

    def step(self, img: torch.Tensor, flow: torch.Tensor) -> torch.Tensor:
        self.V += self.g * flow
        self.V -= 0.2 * self.E
        self.V *= 0.8
        self.E = blur(self.E + self.V, 5).clamp_(-30, 30)
        return self.cv.sample(img, -self.E[0, 0], -self.E[0, 1])


class Trails:
    def __init__(self, cv: Canvas, color, decay: float):
        self.cv = cv
        self.T = torch.zeros(1, 3, cv.H, cv.W, device=cv.dev)
        self.color = torch.tensor(np.array(color, np.float32), device=cv.dev).view(1, 3, 1, 1)
        self.decay = decay

    def step(self, img: torch.Tensor, prev_flow: torch.Tensor, flow: torch.Tensor, strength: float) -> torch.Tensor:
        self.T = self.cv.sample(self.T, -prev_flow[0, 0], -prev_flow[0, 1], "zeros") * self.decay
        mag = blur(torch.hypot(flow[:, :1], flow[:, 1:]), 2)
        a = (mag / 5.0).clamp(0, 1)
        tint = img * (0.45 + 0.55 * self.color * 1.1)
        self.T = torch.maximum(self.T, tint * a)
        return torch.maximum(img, self.T * strength)


def splat(mask: np.ndarray, flow: np.ndarray, conf: np.ndarray | None, dev: str = "cuda") -> tuple[np.ndarray, np.ndarray]:
    h, w = mask.shape
    d = torch.device(dev)
    m = torch.from_numpy(np.ascontiguousarray(mask)).to(d).float()
    fl = torch.from_numpy(np.ascontiguousarray(flow)).to(d).float()
    gy, gx = torch.meshgrid(torch.arange(h, device=d, dtype=torch.float32), torch.arange(w, device=d, dtype=torch.float32), indexing="ij")
    xs, ys = gx + fl[..., 0], gy + fl[..., 1]
    x0, y0 = torch.floor(xs), torch.floor(ys)
    fx, fy = xs - x0, ys - y0
    x0, y0 = x0.long(), y0.long()
    ok = torch.ones((h, w), dtype=torch.bool, device=d) if conf is None else torch.from_numpy(np.ascontiguousarray(conf)).to(d).float() > 0.1
    num = torch.zeros(h * w, device=d)
    den = torch.zeros(h * w, device=d)
    for dx, dy, wt in ((0, 0, (1 - fx) * (1 - fy)), (1, 0, fx * (1 - fy)), (0, 1, (1 - fx) * fy), (1, 1, fx * fy)):
        xi, yi = x0 + dx, y0 + dy
        v = ok & (xi >= 0) & (xi < w) & (yi >= 0) & (yi < h)
        idx = (yi * w + xi)[v]
        ww = wt[v]
        num.index_add_(0, idx, ww * m[v])
        den.index_add_(0, idx, ww)
    return num.view(h, w).cpu().numpy(), den.view(h, w).cpu().numpy()
