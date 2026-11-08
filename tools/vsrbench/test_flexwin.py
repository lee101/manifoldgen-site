import sys, time
sys.path.insert(0, "/vfast/data/code/vsrbench")
import torch
from comfy_kitchen.backends.eager.na import window_attention as eager
from flexwin import window_attention_flex

torch.manual_seed(0)
dev = "cuda"
for (H, W, tk) in ((96, 168, 4), (96, 168, 2), (96, 168, 3), (24, 40, 4)):
    q = torch.randn(1, 1, H, W, 8, 64, device=dev, dtype=torch.float16)
    k = torch.randn(1, tk, H, W, 2, 64, device=dev, dtype=torch.float16)
    v = torch.randn(1, tk, H, W, 2, 64, device=dev, dtype=torch.float16)
    kh = [48, 48, 24, 24][:tk]
    kw = list(kh)
    if tk == 2:
        kh = kw = [48]
    r = eager(q, k, v, kh, kw, tk, False, None)
    f = window_attention_flex(q, k, v, kh, kw, tk, False, None)
    torch.cuda.synchronize()
    err = (r.float() - f.float()).abs().max().item()
    t0 = time.time()
    for _ in range(3):
        eager(q, k, v, kh, kw, tk, False, None)
    torch.cuda.synchronize()
    te = (time.time() - t0) / 3
    t0 = time.time()
    for _ in range(3):
        window_attention_flex(q, k, v, kh, kw, tk, False, None)
    torch.cuda.synchronize()
    tf = (time.time() - t0) / 3
    print(f"{H}x{W} tk={tk} maxerr {err:.4f} eager {te*1000:.1f}ms flex {tf*1000:.1f}ms speedup {te/tf:.1f}x")
