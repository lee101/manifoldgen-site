import argparse
import json
import time

import torch

from gpusim import bsa, dit, patterns, synth


def timeit(fn, reps):
    fn()
    torch.cuda.synchronize()
    ts = []
    for _ in range(reps):
        a, b = torch.cuda.Event(enable_timing=True), torch.cuda.Event(enable_timing=True)
        a.record()
        out = fn()
        b.record()
        torch.cuda.synchronize()
        ts.append(a.elapsed_time(b))
    return min(ts), out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--clip", default="5s-768p")
    ap.add_argument("--tc", type=int, default=4)
    ap.add_argument("--heads", type=int, default=4)
    ap.add_argument("--reps", type=int, default=3)
    ap.add_argument("--bm", type=int, default=128)
    ap.add_argument("--bn", type=int, default=64)
    ap.add_argument("--out", default="out/bench.json")
    a = ap.parse_args()
    c = dit.clip(a.clip, a.tc)
    q, k, v = synth.qkv(c.lat_f, c.lat_h, c.lat_w, a.heads)
    n = q.shape[2]
    bm, bn = a.bm, a.bn
    nqb, nkb = -(-n // bm), -(-n // bn)
    res = {"gpu": torch.cuda.get_device_name(), "clip": a.clip, "tc": a.tc, "tokens": n, "heads": a.heads, "bm": bm, "bn": bn, "rows": []}
    t_sdpa, ref = timeit(lambda: torch.nn.functional.scaled_dot_product_attention(q, k, v), a.reps)
    ref_f = ref.float()
    full = torch.ones(a.heads, nqb, nkb, dtype=torch.bool, device="cuda")
    idx, cnt = bsa.to_csr(full)
    t_full, _ = timeit(lambda: bsa.block_sparse_attention(q, k, v, idx, cnt, bm, bn), a.reps)
    res["sdpa_ms"] = t_sdpa
    res["triton_dense_ms"] = t_full
    print(f"N={n} sdpa={t_sdpa:.1f}ms triton_full={t_full:.1f}ms", flush=True)
    del idx, cnt, full
    cfgs = []
    for wf, wy in [(1, 8), (2, 12), (3, 16), (4, 24)]:
        m = patterns.sliding(c.lat_f, c.lat_h, c.lat_w, bm, bn, wf, wy).unsqueeze(0).repeat(a.heads, 1, 1)
        cfgs.append((f"sliding wf{wf} wy{wy}", m.cuda(), 0.0))
    for base in (0.5, 0.25, 0.125):
        m = patterns.radial(c.lat_f, c.lat_h, c.lat_w, bm, bn, base=base).unsqueeze(0).repeat(a.heads, 1, 1)
        cfgs.append((f"radial base{base}", m.cuda(), 0.0))
    for keep_frac in (0.5, 0.25, 0.125, 0.0625):
        keep = max(2, int(nkb * keep_frac))
        t0, m = timeit(lambda: patterns.topk(q, k, bm, bn, keep, sink_blocks=0), 1)
        cfgs.append((f"topk keep{keep_frac}", m, t0))
    for name, m, sel_ms in cfgs:
        idx, cnt = bsa.to_csr(m)
        t, out = timeit(lambda: bsa.block_sparse_attention(q, k, v, idx, cnt, bm, bn), a.reps)
        o = out.float()
        d = patterns.density(m)
        rel = float((o - ref_f).norm() / ref_f.norm())
        cos = float(torch.nn.functional.cosine_similarity(o.flatten(), ref_f.flatten(), dim=0))
        row = {"pattern": name, "density": d, "ms": t, "select_ms": sel_ms, "total_ms": t + sel_ms,
               "vs_sdpa": t_sdpa / (t + sel_ms), "vs_triton_dense": t_full / t, "rho": (t + sel_ms) / t_sdpa,
               "ideal": 1.0 / d, "rel_l2": rel, "cos": cos}
        res["rows"].append(row)
        print(f"{name:20s} dens={d:.3f} ms={t:7.1f}+{sel_ms:5.1f} vs_sdpa={row['vs_sdpa']:.2f}x vs_tdense={row['vs_triton_dense']:.2f}x ideal={row['ideal']:.2f}x relL2={rel:.4f} cos={cos:.5f}", flush=True)
        del idx, cnt, out
    json.dump(res, open(a.out, "w"), indent=1)


main()
