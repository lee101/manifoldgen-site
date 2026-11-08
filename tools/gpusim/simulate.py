import argparse
import json
from pathlib import Path

from gpusim import dit, specs

SCEN = ["5s-768p", "5s-1080p", "5s-1440p", "15s-768p"]


def load_rho(path, pick):
    d = json.load(open(path))
    rows = {r["pattern"]: r for r in d["rows"]}
    return {k: rows[k] for k in pick if k in rows}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bench", nargs="+", default=["out/bench_5s_tc4.json"])
    ap.add_argument("--tc", type=int, default=4)
    ap.add_argument("--sparse-steps", type=float, default=4 / 6)
    ap.add_argument("--out", default="out/sim.md")
    ap.add_argument("--plans", nargs="*", default=None)
    ap.add_argument("--rho", choices=["struct", "sdpa"], default="struct")
    a = ap.parse_args()
    lines = []
    w = lines.append
    for g in ("h100", "pro6000"):
        for tc in (4, 8):
            ca, cb = dit.coeffs(g, tc)
            n = dit.clip("5s-768p", tc).tokens
            w(f"fit {g} tc={tc}: a={ca:.3e} s/token b={cb:.3e} s/token^2 attention share of 5s-768p step {dit.attn_fraction(ca, cb, n):.2f}")
    w("")
    w("validation (tc=%d): predicted vs measured" % a.tc)
    for (g, name), (kind, val) in dit.MEASURED.items():
        c = dit.clip(name, a.tc)
        pred = dit.clip_seconds(g, c, tc=a.tc)
        if kind == "total":
            pred += dit.PRO6000_OVERHEAD_S * c.tokens / dit.clip("5s-768p", a.tc).tokens
        w(f"  {g:8s} {name:9s} {kind:8s} measured {val:6.1f} s  model {pred:6.1f} s  tokens {c.tokens}")
    w("")
    benches = []
    for b in a.bench:
        d = json.load(open(b))
        rows = {}
        for r in d["rows"]:
            r = dict(r)
            if a.rho == "struct":
                r["rho"] = r["total_ms"] / d["triton_dense_ms"]
            rows[r["pattern"]] = r
        benches.append((d["tokens"], rows, d["gpu"]))
    names = a.plans or list(benches[0][1])
    w(f"sparse-attention plans, rho mode {a.rho} (struct: / own dense Triton kernel, sdpa: / torch flash SDPA), measured on {benches[0][2]}")
    for tokens, rows, _ in benches:
        for nme in names:
            if nme in rows:
                r = rows[nme]
                w(f"  N={tokens:7d} {nme:22s} density {r['density']:.3f} rho {r['rho']:.3f} relL2(synthetic) {r['rel_l2']:.3f}")
    w("")
    def plan_for(nme, n):
        return min(benches, key=lambda x: abs(x[0] - n))[1][nme]
    for frac_label, frac in (("sparse in all 6 steps", 1.0), ("sparse in 4 of 6 steps (Sol-Attn style window)", a.sparse_steps)):
        w(f"## {frac_label}: predicted denoise speedup (dense / sparse), tc={a.tc}")
        w("| gpu | clip | dense denoise s | " + " | ".join(names) + " |")
        w("|---|---|---|" + "---|" * len(names))
        for g in ("h100", "h200", "b200", "pro6000", "5090", "4090", "l40s", "a100", "3090"):
            for sc in SCEN:
                c = dit.clip(sc, a.tc)
                dn = dit.clip_seconds(g, c, tc=a.tc)
                cells = []
                for nme in names:
                    s = dit.clip_seconds(g, c, rho=plan_for(nme, c.tokens)["rho"], sparse_frac=frac, tc=a.tc)
                    cells.append(f"{dn / s:.2f}x")
                w(f"| {g} | {sc} | {dn:.0f} | " + " | ".join(cells) + " |")
        w("")
    Path(a.out).write_text("\n".join(lines))
    print("\n".join(lines))


main()
