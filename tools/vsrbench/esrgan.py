import argparse, time, json, subprocess
import numpy as np, cv2, torch
from spandrel import ModelLoader

p = argparse.ArgumentParser()
p.add_argument("--inp", required=True)
p.add_argument("--out", required=True)
p.add_argument("--scale", type=int, default=2)
p.add_argument("--weights", default="/vfast/data/code/vsrbench/weights/RealESRGAN_x4plus.pth")
p.add_argument("--fp16", action="store_true")
p.add_argument("--batch", type=int, default=4)
p.add_argument("--tile", type=int, default=0)
a = p.parse_args()

m = ModelLoader().load_from_file(a.weights).model.eval().cuda()
dt = torch.float16 if a.fp16 else torch.float32
m = m.to(dt)
cap = cv2.VideoCapture(a.inp)
fps = cap.get(cv2.CAP_PROP_FPS)
frames = []
while True:
    ok, f = cap.read()
    if not ok:
        break
    frames.append(f)
h, w = frames[0].shape[:2]
oh, ow = h * a.scale, w * a.scale
torch.cuda.reset_peak_memory_stats()
torch.cuda.synchronize()
t0 = time.time()
outs = []


def run(x):
    if not a.tile:
        return m(x)
    _, _, H, W = x.shape
    o = torch.zeros(x.shape[0], 3, H * 4, W * 4, device=x.device, dtype=x.dtype)
    t, pad = a.tile, 16
    for y0 in range(0, H, t):
        for x0 in range(0, W, t):
            ya, yb = max(y0 - pad, 0), min(y0 + t + pad, H)
            xa, xb = max(x0 - pad, 0), min(x0 + t + pad, W)
            r = m(x[:, :, ya:yb, xa:xb])
            ys, xs = (y0 - ya) * 4, (x0 - xa) * 4
            hh, ww = min(t, H - y0) * 4, min(t, W - x0) * 4
            o[:, :, y0 * 4:y0 * 4 + hh, x0 * 4:x0 * 4 + ww] = r[:, :, ys:ys + hh, xs:xs + ww]
    return o


with torch.no_grad():
    for i in range(0, len(frames), a.batch):
        b = np.stack(frames[i:i + a.batch])[..., ::-1].copy()
        x = torch.from_numpy(b).permute(0, 3, 1, 2).to("cuda", dt).div(255)
        y = run(x)
        if a.scale != 4:
            y = torch.nn.functional.interpolate(y.float(), size=(oh, ow), mode="bicubic", antialias=True)
        y = y.float().clamp(0, 1).mul(255).round().byte().permute(0, 2, 3, 1).cpu().numpy()[..., ::-1]
        outs.extend(list(y))
torch.cuda.synchronize()
el = time.time() - t0
pr = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{ow}x{oh}", "-r", str(fps), "-i", "-", "-c:v", "libx264", "-crf", "10", "-pix_fmt", "yuv420p", a.out], stdin=subprocess.PIPE)
for f in outs:
    pr.stdin.write(np.ascontiguousarray(f).tobytes())
pr.stdin.close()
pr.wait()
print(json.dumps({"out": a.out, "frames": len(frames), "sec": round(el, 2), "fps": round(len(frames) / el, 2), "peak_gb": round(torch.cuda.max_memory_allocated() / 2**30, 2)}))
