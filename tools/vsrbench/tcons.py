import cv2, numpy as np, json, sys


def read(path, size=None):
    cap = cv2.VideoCapture(path)
    fr = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        if size and (f.shape[1], f.shape[0]) != size:
            f = cv2.resize(f, size, interpolation=cv2.INTER_AREA)
        fr.append(f)
    return fr


def warp(img, flow):
    h, w = flow.shape[:2]
    gx, gy = np.meshgrid(np.arange(w), np.arange(h))
    return cv2.remap(img, (gx + flow[..., 0]).astype(np.float32), (gy + flow[..., 1]).astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)


def werr(frames, flows, masks):
    es = []
    for t in range(1, len(frames)):
        w = warp(frames[t - 1].astype(np.float32), flows[t - 1])
        e = np.abs(frames[t].astype(np.float32) - w).mean(axis=2)
        m = masks[t - 1]
        es.append(e[m].mean())
    return float(np.mean(es))


def run(inp, outs):
    src = read(inp)
    size = (src[0].shape[1], src[0].shape[0])
    g = [cv2.cvtColor(f, cv2.COLOR_BGR2GRAY) for f in src]
    flows, masks = [], []
    for t in range(1, len(g)):
        bw = cv2.calcOpticalFlowFarneback(g[t], g[t - 1], None, 0.5, 4, 21, 3, 7, 1.5, 0)
        fw = cv2.calcOpticalFlowFarneback(g[t - 1], g[t], None, 0.5, 4, 21, 3, 7, 1.5, 0)
        fwb = warp(fw, bw)
        masks.append(np.linalg.norm(bw + fwb, axis=2) < 1.0)
        flows.append(bw)
    res = {"input": werr(src, flows, masks)}
    for k, p in outs.items():
        res[k] = werr(read(p, size), flows, masks)
    return res


if __name__ == "__main__":
    allr = {}
    for n in ("dancer", "fox", "tram", "potter"):
        allr[n] = run(f"clips/real48/{n}.mp4", {"lanczos": f"out/real_lanczos/{n}.mp4", "esrgan": f"out/real_esrgan/{n}.mp4", "relay2": f"out/real_relay2/{n}.mp4"})
        print(n, {k: round(v, 3) for k, v in allr[n].items()}, flush=True)
    json.dump(allr, open("res/tcons_real.json", "w"), indent=1)
