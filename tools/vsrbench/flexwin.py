import torch
from torch.nn.attention.flex_attention import flex_attention, create_block_mask

_flex = torch.compile(flex_attention, dynamic=False)
_cache = {}


def _mask(h, w, tk, wh, ww, pmin, device):
    key = (h, w, tk, tuple(wh), tuple(ww), pmin, str(device))
    if key in _cache:
        return _cache[key]
    n = h * w
    WH = torch.tensor(wh, device=device)
    WW = torch.tensor(ww, device=device)

    def mod(b, hd, qi, ki):
        p = ki // n
        r = ki % n
        qy, qx = qi // w, qi % w
        ky, kx = r // w, r % w
        wh_ = WH[p]
        ww_ = WW[p]
        dy = ky - qy
        dx = kx - qx
        return (p >= pmin) & (dy >= -(wh_ // 2)) & (dy < wh_ - wh_ // 2) & (dx >= -(ww_ // 2)) & (dx < ww_ - ww_ // 2)

    bm = create_block_mask(mod, None, None, n, tk * n, device=device, BLOCK_SIZE=128)
    _cache[key] = bm
    return bm


def window_attention_flex(q, k, v, kh, kw, temporal_window, clamp, scale=None):
    b, tq, h, w, nh, hd = q.shape
    tk, kvh = k.shape[1], k.shape[4]
    if tq != 1 or clamp or b != 1:
        return None
    wh = list(kh) if len(kh) > 1 else [kh[0]] * tk
    ww = list(kw) if len(kw) > 1 else [kw[0]] * tk
    pmin = max(0, tk - temporal_window)
    n = h * w
    bm = _mask(h, w, tk, wh, ww, pmin, q.device)
    qq = q.reshape(1, n, nh, hd).transpose(1, 2)
    kk = k.reshape(1, tk * n, kvh, hd).transpose(1, 2)
    vv = v.reshape(1, tk * n, kvh, hd).transpose(1, 2)
    o = _flex(qq, kk, vv, block_mask=bm, scale=scale, enable_gqa=(nh != kvh))
    return o.transpose(1, 2).reshape(1, 1, h, w, nh, hd)
