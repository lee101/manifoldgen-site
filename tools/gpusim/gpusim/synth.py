import math

import torch


def positions(lat_f, lat_h, lat_w, device):
    f = torch.arange(lat_f, device=device)
    y = torch.arange(lat_h, device=device)
    x = torch.arange(lat_w, device=device)
    g = torch.stack(torch.meshgrid(f, y, x, indexing="ij"), -1).reshape(-1, 3).float()
    return g


def qkv(lat_f, lat_h, lat_w, heads, d=128, tau=10.0, seed=0, device="cuda", dtype=torch.float16):
    g = torch.Generator(device=device).manual_seed(seed)
    p = positions(lat_f, lat_h, lat_w, device)
    n = p.shape[0]
    q = torch.empty(1, heads, n, d, device=device, dtype=dtype)
    v = torch.randn(1, heads, n, d, device=device, dtype=dtype, generator=g) * 0.5
    scales = [(2.0, 6.0, 6.0), (4.0, 10.0, 10.0), (1.0, 4.0, 4.0), (8.0, 40.0, 40.0)]
    for h in range(heads):
        lf, ly, lx = scales[h % len(scales)]
        w = torch.randn(3, d, device=device, generator=g) / torch.tensor([lf, ly, lx], device=device)[:, None]
        b = torch.rand(d, device=device, generator=g) * 2 * math.pi
        z = math.sqrt(2.0 / d) * torch.cos(p @ w + b)
        z = z * math.sqrt(tau * math.sqrt(d))
        z = z + 0.05 * torch.randn(n, d, device=device, generator=g)
        q[0, h] = z.to(dtype)
    return q, q.clone(), v
