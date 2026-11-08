from gpusim import real

CLIPS = {"5s-768p": (1344, 768, 124), "5s-1080p": (1920, 1088, 124), "5s-1440p": (2528, 1440, 124)}
print("clip gpu backend tokens attn_ms/layer step_s gen_s")
for cn, (w, h, f) in CLIPS.items():
    n = real.tokens(w, h, f)
    for gpu in ("h100", "pro6000"):
        for be in ("ck", "cudnn"):
            print(f"{cn} {gpu} {be} {n} {real.attn_layer_s(gpu, be, n)*1e3:.1f} {real.step_s(gpu, be, n):.2f} {real.gen_s(gpu, be, n):.1f}")
print("sparse late layers, dense first K, density d, h100 cudnn, 5s-768p / 1080p")
for k, d in ((35, 0.15), (25, 0.15), (35, 0.25), (25, 0.25)):
    for cn in ("5s-768p", "5s-1080p"):
        w, h, f = CLIPS[cn]
        n = real.tokens(w, h, f)
        base = real.step_s("h100", "cudnn", n)
        sp = real.step_s("h100", "cudnn", n, real.schedule(k, d))
        print(f"K={k} d={d} {cn}: step {base:.2f}->{sp:.2f}s speedup {base/sp:.2f}x (kernel at flash parity)")
