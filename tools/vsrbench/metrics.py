import sys, json, argparse
import numpy as np, cv2, torch

p = argparse.ArgumentParser()
p.add_argument("--out", required=True)
p.add_argument("--gt")
p.add_argument("--nr", action="store_true")
p.add_argument("--max_frames", type=int, default=72)
p.add_argument("vids", nargs="+")
a = p.parse_args()


def read(path, size=None, n=None):
    cap = cv2.VideoCapture(path)
    fr = []
    while True:
        ok, f = cap.read()
        if not ok or (n and len(fr) >= n):
            break
        if size and (f.shape[1], f.shape[0]) != size:
            f = cv2.resize(f, size, interpolation=cv2.INTER_LANCZOS4)
        fr.append(f)
    return np.stack(fr)


def tt(x):
    return torch.from_numpy(x[..., ::-1].copy()).permute(0, 3, 1, 2).float().div(255)


def psnr(x, y):
    mse = ((x.astype(np.float64) - y.astype(np.float64)) ** 2).mean(axis=(1, 2, 3))
    return float(np.mean(10 * np.log10(255 ** 2 / np.maximum(mse, 1e-9))))


def ssim_f(x, y):
    from skimage.metrics import structural_similarity as s
    return float(np.mean([s(i, j, channel_axis=2, data_range=255) for i, j in zip(x[::4], y[::4])]))


def lap_var(x):
    return float(np.mean([cv2.Laplacian(cv2.cvtColor(f, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var() for f in x[::4]]))


def flicker(x):
    g = x.astype(np.float32).mean(axis=3)
    d = np.abs(np.diff(g, axis=0))
    return float(d.mean())


def tdiff(x, y):
    a_ = np.diff(x.astype(np.float32), axis=0)
    b_ = np.diff(y.astype(np.float32), axis=0)
    return float(np.abs(a_ - b_).mean())


dev = "cuda" if torch.cuda.is_available() else "cpu"
lp = None
res = {}
gt = None
for v in a.vids:
    r = {}
    if a.gt:
        g0 = read(a.gt, n=a.max_frames)
        sz = (g0.shape[2], g0.shape[1])
        o = read(v, size=sz, n=a.max_frames)
        n = min(len(o), len(g0))
        o, g0 = o[:n], g0[:n]
        r["psnr"] = psnr(o, g0)
        r["ssim"] = ssim_f(o, g0)
        import lpips
        if lp is None:
            lp = lpips.LPIPS(net="alex").to(dev)
        vals = []
        with torch.no_grad():
            for i in range(0, n, 8):
                x = tt(o[i:i + 8]).to(dev) * 2 - 1
                y = tt(g0[i:i + 8]).to(dev) * 2 - 1
                vals.append(lp(x, y).flatten().cpu())
        r["lpips"] = float(torch.cat(vals).mean())
        r["tdiff_vs_gt"] = tdiff(o, g0)
        r["lapvar_gt"] = lap_var(g0)
    else:
        o = read(v, n=a.max_frames)
    r["lapvar"] = lap_var(o)
    r["flicker"] = flicker(o)
    r["frames"] = len(o)
    r["res"] = f"{o.shape[2]}x{o.shape[1]}"
    if a.nr:
        import pyiqa
        for m in ("musiq", "clipiqa"):
            try:
                mm = pyiqa.create_metric(m, device=dev)
                sc = []
                with torch.no_grad():
                    for i in range(0, len(o), 6):
                        sc.append(float(mm(tt(o[i:i + 1]).to(dev))))
                r[m] = float(np.mean(sc))
            except Exception as e:
                r[m] = f"err {str(e)[:80]}"
    res[v] = r
json.dump(res, open(a.out, "w"), indent=1)
print(json.dumps(res))
