"""Virtual fleet estimator: predict seconds and $ per 5 s clip on a GPU without renting it.

Hopper/Ampere family model (same kernels, int8 weights):  t = t_ref * (w * F_ref/F + (1-w) * B_ref/B)
F = dense bf16 TFLOPS, B = HBM GB/s (public specs), w = compute-bound share, fitted on measured pods.
Blackwell is a different kernel family (native nvfp4, new attention path), so it is calibrated, not predicted.
Measured (this directory): H100 SXM 66 s (bench README, int8 TE), PCIe 91.4, A100 173, RTX PRO 6000 53-55.
"""
SPEC = {"H100 SXM": (989, 3350, 3.99), "H100 PCIe": (756, 2000, 2.89), "A100 80GB": (312, 1935, 1.79),
        "H200": (989, 4800, 5.29), "H100 NVL": (835, 3900, 3.19), "A100 SXM": (312, 2039, 1.79)}
MEAS = {"H100 SXM": 66.0, "H100 PCIe": 91.4, "A100 80GB": 173.0}
REF = "H100 SXM"


def predict(name, w):
    F, B, _ = SPEC[name]; F0, B0, _ = SPEC[REF]
    return MEAS[REF] * (w * F0 / F + (1 - w) * B0 / B)


def fit_w(points):
    best = min((sum((predict(n, w / 100) - MEAS[n]) ** 2 for n in points), w / 100) for w in range(0, 101))
    return best[1]


if __name__ == "__main__":
    for hold in ("H100 PCIe", "A100 80GB"):  # leave-one-out
        train = [n for n in ("H100 PCIe", "A100 80GB") if n != hold]
        w = fit_w(train)
        p = predict(hold, w)
        print(f"fit on {train[0]} (w={w:.2f}) -> predict {hold}: {p:.0f} s vs measured {MEAS[hold]:.0f} s ({(p / MEAS[hold] - 1) * 100:+.0f}%)")
    w = fit_w(["H100 PCIe", "A100 80GB"])
    print(f"\nfinal w={w:.2f}; est $/5 s clip (native 768p, warm):")
    rows = [(n, predict(n, w) if n != REF else MEAS[n], SPEC[n][2]) for n in SPEC]
    rows += [("RTX PRO 6000 Server (measured)", 55.0, 2.49), ("RTX PRO 6000 Workstation (measured)", 52.9, 2.59)]
    for n, t, rate in sorted(rows, key=lambda r: r[1] * r[2]):
        print(f"  {n:38} {t:6.0f} s  ${t * rate / 3600:.3f}  (${rate}/h)")
    print("\ncold start (bytes / throughput), 39.6 GB of weights; measured R2 throughput 220-500 MB/s:")
    for label, gb, mbps in (("R2 per boot, good day", 39.6, 500), ("R2 per boot, bad day", 39.6, 220),
                            ("lossless zstd-3 (-7.4% bytes)", 36.7, 500), ("w4 UNET (-27% bytes, lossy, needs quality bench)", 28.9, 500),
                            ("local NVMe page cache / image layer, warm host", 39.6, 3000)):
        print(f"  {label:50} {gb * 1000 / mbps:5.0f} s")
