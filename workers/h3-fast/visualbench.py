# usage: uv run --with opencv-python-headless --with numpy --with pillow python visualbench.py <dir with mp4 + results.json> [baseline-variant]
import sys, os, json, subprocess, re, html
import cv2, numpy as np
from PIL import Image, ImageDraw

D = os.path.abspath(sys.argv[1])
BASE = sys.argv[2] if len(sys.argv) > 2 else "base"
INP = os.path.join(D, "in")
SHEETS = os.path.join(D, "sheets"); os.makedirs(SHEETS, exist_ok=True)
res = json.load(open(os.path.join(D, "results.json")))
timing = {}
for r in res["runs"]:
    if r.get("ok") and not r["name"].startswith("warmup"):
        timing.setdefault((r["scene"], r["name"], r["seed"]), r)
SCENES = json.load(open(os.path.join(D, "scenes.json")))


def frames(path):
    cap = cv2.VideoCapture(path); out = []
    while True:
        ok, f = cap.read()
        if not ok: break
        out.append(f)
    fps = cap.get(cv2.CAP_PROP_FPS); cap.release()
    return out, fps


def audio(path):
    p = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True)
    a = np.frombuffer(p.stdout, dtype=np.float32)
    if a.size < 1600: return None
    rms = 20 * np.log10(np.sqrt((a ** 2).mean()) + 1e-9)
    S = np.abs(np.fft.rfft(a[: len(a) // 1024 * 1024].reshape(-1, 1024) * np.hanning(1024), axis=1))
    fr = np.fft.rfftfreq(1024, 1 / 16000)
    cen = float(((S * fr).sum(1) / (S.sum(1) + 1e-9)).mean())
    hf = float(S[:, fr > 4000].sum() / (S.sum() + 1e-9))
    return {"rms_db": round(float(rms), 1), "centroid_hz": round(cen), "hf_ratio": round(hf, 3)}


def psnr(a, b):
    if a.shape != b.shape: b = cv2.resize(b, (a.shape[1], a.shape[0]), interpolation=cv2.INTER_AREA)
    m = ((a.astype(np.float32) - b.astype(np.float32)) ** 2).mean()
    return 99.0 if m == 0 else round(10 * np.log10(255 ** 2 / m), 2)


def norm(f, w=1280):
    h = round(f.shape[0] * w / f.shape[1])
    return cv2.resize(f, (w, h), interpolation=cv2.INTER_AREA if f.shape[1] > w else cv2.INTER_CUBIC)


def metrics(path, scene):
    fr, fps = frames(path)
    g = [cv2.cvtColor(norm(f, 960), cv2.COLOR_BGR2GRAY) for f in fr]
    sharp = float(np.mean([cv2.Laplacian(x, cv2.CV_32F).var() for x in g[:: max(1, len(g) // 12)]]))
    d = np.array([np.abs(g[i].astype(np.float32) - g[i - 1].astype(np.float32)).mean() for i in range(1, len(g))])
    med = float(np.median(d)) + 1e-6
    m = {"frames": len(fr), "fps": round(fps, 2), "res": f"{fr[0].shape[1]}x{fr[0].shape[0]}", "sharp": round(sharp, 1),
         "motion": round(float(d.mean()), 2), "jumps": int((d > 4 * med + 2).sum()),
         "bright": round(float(np.mean([x.mean() for x in g[:: max(1, len(g) // 8)]])), 1),
         "sat": round(float(np.mean([cv2.cvtColor(norm(fr[i], 480), cv2.COLOR_BGR2HSV)[..., 1].mean() for i in range(0, len(fr), max(1, len(fr) // 8))])), 1)}
    s = SCENES[scene]
    if s.get("first"):
        im = cv2.imread(os.path.join(INP, s["first"])); m["first_psnr"] = psnr(fr[0], im)
    if s.get("last"):
        im = cv2.imread(os.path.join(INP, s["last"])); m["last_psnr"] = psnr(fr[-1], im)
    m["audio"] = audio(path)
    return m, fr


files = sorted(f for f in os.listdir(D) if f.endswith(".mp4"))
rows = {}
for f in files:
    mm = re.match(r"(\w+?)__(.+?)__s(\d+)", f)
    if not mm: continue
    scene, name, seed = mm.group(1), mm.group(2), int(mm.group(3))
    rows.setdefault(scene, {}).setdefault(seed, []).append((name, f))

html_out = ["<meta charset=utf-8><title>H3 fast bench</title><style>body{font:13px system-ui;background:#111;color:#ddd;margin:16px}table{border-collapse:collapse}td,th{border:1px solid #333;padding:4px 8px;vertical-align:top}video{width:420px}img{max-width:100%}h2{margin-top:32px}.b{color:#7f7}.w{color:#f77}</style>"]
summary = []
for scene, seeds in rows.items():
    for seed, items in seeds.items():
        html_out.append(f"<h2>{scene} seed {seed}</h2><p>{html.escape(SCENES[scene]['prompt'][:300])}</p>")
        base_fr = None
        data = []
        for name, f in sorted(items, key=lambda x: (x[0] != BASE, x[0])):
            m, fr = metrics(os.path.join(D, f), scene)
            t = timing.get((scene, name, seed), {}).get("exec_s")
            m["exec_s"] = round(t, 1) if t else None
            if name == BASE: base_fr = fr
            data.append((name, f, m, fr))
        base_t = next((m["exec_s"] for n, _, m, _ in data if n == BASE), None)
        base_sharp = next((m["sharp"] for n, _, m, _ in data if n == BASE), None)
        cols = 5
        W = 320
        sheet = []
        for name, f, m, fr in data:
            idx = [0, len(fr) // 4, len(fr) // 2, 3 * len(fr) // 4, len(fr) - 1]
            tiles = [cv2.resize(fr[i], (W, round(fr[i].shape[0] * W / fr[i].shape[1])), interpolation=cv2.INTER_AREA) for i in idx]
            hh = max(t.shape[0] for t in tiles)
            row = np.zeros((hh + 18, W * cols, 3), np.uint8)
            for j, t in enumerate(tiles): row[18:18 + t.shape[0], j * W:(j + 1) * W] = t
            im = Image.fromarray(cv2.cvtColor(row, cv2.COLOR_BGR2RGB)); ImageDraw.Draw(im).text((4, 3), f"{name}  {m['exec_s']}s  {m['res']}", fill=(255, 255, 0))
            sheet.append(np.array(im))
            if base_fr is not None and name != BASE:
                m["psnr_vs_base"] = psnr(norm(base_fr[0], 640)[:0] if False else cv2.resize(fr[len(fr) // 2], (base_fr[0].shape[1], base_fr[0].shape[0]), interpolation=cv2.INTER_AREA), base_fr[len(base_fr) // 2])
        sp = f"{scene}_s{seed}.jpg"
        Image.fromarray(np.vstack([np.pad(s, ((0, 0), (0, 0), (0, 0))) for s in sheet])).save(os.path.join(SHEETS, sp), quality=88)
        html_out.append(f"<img src=sheets/{sp}>")
        html_out.append("<table><tr><th>variant<th>exec s<th>speedup<th>res<th>sharp<th>motion<th>jumps<th>bright<th>sat<th>first/last PSNR<th>vs base<th>audio<th>video</tr>")
        for name, f, m, fr in data:
            sp_up = f"{base_t / m['exec_s']:.2f}x" if base_t and m["exec_s"] else ""
            a = m["audio"] or {}
            html_out.append(f"<tr><td>{name}<td>{m['exec_s']}<td class=b>{sp_up}<td>{m['res']}<td>{m['sharp']}<td>{m['motion']}<td>{m['jumps']}<td>{m['bright']}<td>{m['sat']}<td>{m.get('first_psnr','')} / {m.get('last_psnr','')}<td>{m.get('psnr_vs_base','')}<td>{a.get('rms_db','')} dB c{a.get('centroid_hz','')} hf{a.get('hf_ratio','')}<td><video src='{f}' controls loop muted preload=none></video></tr>")
            summary.append({"scene": scene, "seed": seed, "name": name, **{k: v for k, v in m.items()}})
        html_out.append("</table>")
open(os.path.join(D, "index.html"), "w").write("\n".join(html_out))
json.dump(summary, open(os.path.join(D, "metrics.json"), "w"), indent=1)
print("wrote", os.path.join(D, "index.html"))
