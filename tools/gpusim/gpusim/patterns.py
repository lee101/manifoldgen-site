import numpy as np
import torch


def _block_geom(lat_f, lat_h, lat_w, blk):
    hw = lat_h * lat_w
    n = lat_f * hw
    nb = -(-n // blk)
    t0 = np.arange(nb) * blk
    t1 = np.minimum(t0 + blk, n) - 1
    f0, f1 = t0 // hw, t1 // hw
    y0 = (t0 % hw) // lat_w
    y1 = (t1 % hw) // lat_w
    span = f0 != f1
    y0 = np.where(span, 0, y0)
    y1 = np.where(span, lat_h - 1, y1)
    return f0, f1, y0, y1


def _gap(a0, a1, b0, b1):
    return np.maximum(0, np.maximum(a0[:, None] - b1[None, :], b0[None, :] - a1[:, None]))


def _geom_pair(lat_f, lat_h, lat_w, bm, bn):
    qf0, qf1, qy0, qy1 = _block_geom(lat_f, lat_h, lat_w, bm)
    kf0, kf1, ky0, ky1 = _block_geom(lat_f, lat_h, lat_w, bn)
    return _gap(qf0, qf1, kf0, kf1), _gap(qy0, qy1, ky0, ky1), kf0


def sliding(lat_f, lat_h, lat_w, bm, bn, wf, wy, sink=1):
    df, dy, kf0 = _geom_pair(lat_f, lat_h, lat_w, bm, bn)
    m = (df <= wf) & (dy <= wy)
    m |= (kf0 < sink)[None, :]
    return torch.from_numpy(m)


def radial(lat_f, lat_h, lat_w, bm, bn, base=0.5, sink=1):
    df, dy, kf0 = _geom_pair(lat_f, lat_h, lat_w, bm, bn)
    band = np.where(df == 0, 0, np.ceil(np.log2(np.maximum(df, 1))).astype(int) + 0)
    win = np.where(df == 0, lat_h, np.maximum(1, lat_h * base / (2.0 ** band)))
    m = dy <= win
    m |= (kf0 < sink)[None, :]
    return torch.from_numpy(m)


def topk(q, k, bm, bn, keep, sink_blocks=0):
    b, h, n, d = q.shape
    nqb, nkb = -(-n // bm), -(-n // bn)
    def pool(x, blk, nb):
        pad = nb * blk - n
        xp = torch.nn.functional.pad(x[0], (0, 0, 0, pad)).view(h, nb, blk, d).float()
        cnt = torch.full((nb,), float(blk), device=x.device)
        if pad:
            cnt[-1] = blk - pad
        return xp.sum(2) / cnt[None, :, None]
    qp, kp = pool(q, bm, nqb), pool(k, bn, nkb)
    sc = torch.einsum("hqd,hkd->hqk", qp, kp)
    keep = min(keep, nkb)
    idx = sc.topk(keep, dim=-1).indices
    m = torch.zeros(h, nqb, nkb, dtype=torch.bool, device=q.device)
    m.scatter_(2, idx, True)
    if sink_blocks:
        m[:, :, :sink_blocks] = True
    return m


def density(mask):
    return float(mask.float().mean().item())
