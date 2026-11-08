import cv2, numpy as np, subprocess, os, sys

os.makedirs("out/sheets", exist_ok=True)


def frames(path, idxs):
    cap = cv2.VideoCapture(path)
    out = {}
    i = 0
    while True:
        ok, f = cap.read()
        if not ok:
            break
        if i in idxs:
            out[i] = f
        i += 1
    return out


def label(img, t):
    cv2.rectangle(img, (0, 0), (img.shape[1], 34), (0, 0, 0), -1)
    cv2.putText(img, t, (8, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2, cv2.LINE_AA)
    return img


def sheet(name, variants, box, idx=24):
    x, y, w, h = box
    panels = []
    for lab, path in variants:
        f = frames(path, {idx})[idx]
        panels.append(label(f[y:y + h, x:x + w].copy(), lab))
    cv2.imwrite(f"out/sheets/{name}.png", np.hstack(panels))


for n in ("dancer", "fox", "tram", "potter"):
    p = f"out/real_relay2/{n}.mp4"
    cap = cv2.VideoCapture(p)
    W, H = int(cap.get(3)), int(cap.get(4))
    cw, ch = (640, 720) if W > H else (540, 720)
    box = ((W - cw) // 2, int(H * 0.30), cw, ch)
    sheet(f"real_{n}", [("lanczos", f"out/real_lanczos/{n}.mp4"), ("RealESRGAN", f"out/real_esrgan/{n}.mp4"), ("RelayVSR x2", p)], box)
for n, rel in (("dancer", "dancer_warm"), ("tram", "tram")):
    sheet(f"fr4_{n}", [("lanczos x4", f"out/lanczos4/{n}.mp4"), ("RealESRGAN x4", f"out/esrgan4/{n}.mp4"), ("RelayVSR x4", f"out/relay4/{rel}.mp4"), ("ground truth", f"clips/gt/{n}.mp4")], (650, 300, 420, 540))
    sheet(f"fr2_{n}", [("lanczos x2", f"out/lanczos2/{n}.mp4"), ("RealESRGAN x2", f"out/esrgan2/{n}.mp4"), ("RelayVSR x2", f"out/relay2/{n}.mp4"), ("ground truth", f"clips/gt/{n}.mp4")], (650, 300, 420, 540))
print(sorted(os.listdir("out/sheets")))
