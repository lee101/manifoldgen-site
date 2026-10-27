# /// script
# requires-python = ">=3.10,<3.13"
# dependencies = ["numpy<2.3", "scipy", "opencv-python-headless", "pillow", "torch==2.8.0", "torchvision==0.23.0", "ultralytics", "insightface", "onnxruntime-gpu==1.22.0", "python_speech_features", "transformers"]
# [tool.uv]
# override-dependencies = ["onnxruntime; python_version < '0'"]
# index = [{ name = "pytorch-cu128", url = "https://download.pytorch.org/whl/cu128", explicit = true }]
# [tool.uv.sources]
# torch = { index = "pytorch-cu128" }
# torchvision = { index = "pytorch-cu128" }
# ///
import argparse, json, math, os, re, subprocess, sys, time, urllib.request, warnings
from pathlib import Path

warnings.filterwarnings("ignore")
import cv2
import numpy as np
from scipy.optimize import linear_sum_assignment

HERE = Path(__file__).resolve().parent
CACHE = HERE / ".cache"
FPS = 25
TW, TH = 320, 180
SHOT_THR = 0.18
POSE_JOINTS = [0, 5, 6, 7, 8, 9, 10, 11, 12]
SWAP = {5: 6, 6: 5, 7: 8, 8: 7, 9: 10, 10: 9, 11: 12, 12: 11}
W_OVERALL = dict(pose=0.20, framing=0.28, identity=0.22, lipsync=0.08, background=0.05, repeat=0.10, jumps=0.07)
SYNC_URL = "http://www.robots.ox.ac.uk/~vgg/software/lipsync/data/syncnet_v2.model"
YOLO_URL = "https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8m-pose.pt"
T0 = time.perf_counter()
TIMES = {}


def tick(name, t):
    TIMES[name] = round(TIMES.get(name, 0) + time.perf_counter() - t, 2)


def log(*a):
    print(f"[{time.perf_counter() - T0:5.1f}s]", *a, file=sys.stderr, flush=True)


def fetch(url, dst):
    dst = Path(dst)
    if dst.exists() and dst.stat().st_size > 1e6:
        return str(dst)
    dst.parent.mkdir(parents=True, exist_ok=True)
    log("download", url)
    urllib.request.urlretrieve(url, str(dst) + ".part")
    os.replace(str(dst) + ".part", dst)
    return str(dst)


def probe(path):
    j = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", path], capture_output=True, text=True, check=True).stdout)
    v = next(s for s in j["streams"] if s["codec_type"] == "video")
    a = any(s["codec_type"] == "audio" for s in j["streams"])
    d = float(v.get("duration") or j["format"]["duration"])
    return int(v["width"]), int(v["height"]), d, a


def detect_shots(path, dur):
    p = subprocess.run(["ffmpeg", "-v", "info", "-i", path, "-an", "-vf", f"scale=320:-2,select='gt(scene,{SHOT_THR})',showinfo", "-f", "null", "-"], capture_output=True, text=True)
    cuts = [float(x) for x in re.findall(r"pts_time:([0-9.]+)", p.stderr)]
    b = [0.0]
    for c in sorted(cuts):
        if 0.4 < c < dur - 0.4 and c - b[-1] >= 0.4:
            b.append(c)
    b.append(dur)
    return [(b[i], b[i + 1]) for i in range(len(b) - 1)]


def load_audio(path, dur):
    p = subprocess.run(["ffmpeg", "-v", "error", "-t", f"{dur:.3f}", "-i", path, "-vn", "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], capture_output=True)
    a = np.frombuffer(p.stdout, np.int16)
    return a if a.size > 16000 else None


class Models:
    def __init__(self, device, lm=False):
        import onnxruntime as ort
        import torch
        from insightface.app import FaceAnalysis
        from ultralytics import YOLO

        self.torch = torch
        self.dev = "cuda" if device == "cuda" and torch.cuda.is_available() else "cpu"
        t = time.perf_counter()
        self.yolo = YOLO(fetch(YOLO_URL, CACHE / "yolov8m-pose.pt"))
        self.half = self.dev == "cuda"
        prov = ["CUDAExecutionProvider", "CPUExecutionProvider"] if self.dev == "cuda" else ["CPUExecutionProvider"]
        if self.dev == "cuda":
            try:
                ort.preload_dlls()
            except Exception:
                pass
        mods = ["detection", "recognition"] + (["landmark_2d_106"] if lm else [])
        self.fa = FaceAnalysis(name="buffalo_l", root=str(CACHE / "insightface"), allowed_modules=mods, providers=prov)
        self.fa.prepare(ctx_id=0 if self.dev == "cuda" else -1, det_size=(1280, 736), det_thresh=0.45)
        self.rec = self.fa.models["recognition"]
        self.lmk = self.fa.models.get("landmark_2d_106")
        self.sync = None
        self.dino = None
        tick("load_models", t)

    def get_sync(self):
        if self.sync is None:
            torch = self.torch
            net = build_syncnet().to(self.dev).eval()
            sd = torch.load(fetch(SYNC_URL, CACHE / "syncnet_v2.model"), map_location="cpu")
            sd = {k.replace("__S__.", ""): v for k, v in sd.items()}
            net.load_state_dict(sd)
            self.sync = net
        return self.sync

    def get_dino(self):
        if self.dino is None:
            from transformers import AutoModel

            self.dino = AutoModel.from_pretrained("facebook/dinov2-small", cache_dir=str(CACHE / "hf")).to(self.dev).eval()
            if self.dev == "cuda":
                self.dino.half()
        return self.dino


def build_syncnet():
    import torch.nn as nn

    class S(nn.Module):
        def __init__(self):
            super().__init__()
            self.netcnnaud = nn.Sequential(
                nn.Conv2d(1, 64, 3, 1, 1), nn.BatchNorm2d(64), nn.ReLU(True), nn.MaxPool2d((1, 1), (1, 1)),
                nn.Conv2d(64, 192, 3, 1, 1), nn.BatchNorm2d(192), nn.ReLU(True), nn.MaxPool2d((3, 3), (1, 2)),
                nn.Conv2d(192, 384, 3, padding=1), nn.BatchNorm2d(384), nn.ReLU(True),
                nn.Conv2d(384, 256, 3, padding=1), nn.BatchNorm2d(256), nn.ReLU(True),
                nn.Conv2d(256, 256, 3, padding=1), nn.BatchNorm2d(256), nn.ReLU(True), nn.MaxPool2d((3, 3), (2, 2)),
                nn.Conv2d(256, 512, (5, 4), padding=0), nn.BatchNorm2d(512), nn.ReLU(),
            )
            self.netfcaud = nn.Sequential(nn.Linear(512, 512), nn.BatchNorm1d(512), nn.ReLU(), nn.Linear(512, 1024))
            self.netfclip = nn.Sequential(nn.Linear(512, 512), nn.BatchNorm1d(512), nn.ReLU(), nn.Linear(512, 1024))
            self.netcnnlip = nn.Sequential(
                nn.Conv3d(3, 96, (5, 7, 7), (1, 2, 2), 0), nn.BatchNorm3d(96), nn.ReLU(True), nn.MaxPool3d((1, 3, 3), (1, 2, 2)),
                nn.Conv3d(96, 256, (1, 5, 5), (1, 2, 2), (0, 1, 1)), nn.BatchNorm3d(256), nn.ReLU(True), nn.MaxPool3d((1, 3, 3), (1, 2, 2), (0, 1, 1)),
                nn.Conv3d(256, 256, (1, 3, 3), padding=(0, 1, 1)), nn.BatchNorm3d(256), nn.ReLU(True),
                nn.Conv3d(256, 256, (1, 3, 3), padding=(0, 1, 1)), nn.BatchNorm3d(256), nn.ReLU(True),
                nn.Conv3d(256, 256, (1, 3, 3), padding=(0, 1, 1)), nn.BatchNorm3d(256), nn.ReLU(True), nn.MaxPool3d((1, 3, 3), (1, 2, 2)),
                nn.Conv3d(256, 512, (1, 6, 6), padding=0), nn.BatchNorm3d(512), nn.ReLU(True),
            )

        def forward_aud(self, x):
            return self.netfcaud(self.netcnnaud(x).flatten(1))

        def forward_lip(self, x):
            return self.netfclip(self.netcnnlip(x).flatten(1))

    return S()


def face_crop(frame, box):
    x1, y1, x2, y2 = box
    bs = max(y2 - y1, x2 - x1) / 2
    cs = 0.4
    bsi = int(bs * (1 + 2 * cs))
    p = cv2.copyMakeBorder(frame, bsi, bsi, bsi, bsi, cv2.BORDER_CONSTANT, value=(110, 110, 110))
    my, mx = (y1 + y2) / 2 + bsi, (x1 + x2) / 2 + bsi
    c = p[int(my - bs):int(my + bs * (1 + 2 * cs)), int(mx - bs * (1 + cs)):int(mx + bs * (1 + cs))]
    if c.size == 0:
        return None
    return cv2.resize(c, (224, 224))


class VA:
    pass


def analyze(path, dur, M, n_refs, emb, crops, lm):
    t = time.perf_counter()
    W, H, _, _ = probe(path)
    s = min(1.0, 1280 / W)
    w, h = int(round(W * s / 2) * 2), int(round(H * s / 2) * 2)
    proc = subprocess.Popen(["ffmpeg", "-v", "error", "-t", f"{dur:.3f}", "-i", path, "-vf", f"fps={FPS},scale={w}:{h}", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE)
    v = VA()
    v.W, v.H = w, h
    v.persons, v.faces, v.thumbs = [], [], []
    fsz = w * h * 3
    done = False
    while not done:
        batch = []
        for _ in range(16):
            buf = proc.stdout.read(fsz)
            if len(buf) < fsz:
                done = True
                break
            batch.append(np.frombuffer(buf, np.uint8).reshape(h, w, 3))
        if not batch:
            break
        t1 = time.perf_counter()
        res = M.yolo.predict(batch, imgsz=960, conf=0.3, device=M.dev, verbose=False)
        tick("yolo", t1)
        for fr, r in zip(batch, res):
            ps = []
            if r.boxes is not None and len(r.boxes):
                bx = r.boxes.xyxy.cpu().numpy()
                cf = r.boxes.conf.cpu().numpy()
                kp = r.keypoints.data.cpu().numpy()
                for b, c, k in zip(bx, cf, kp):
                    if c >= 0.4 and (b[2] - b[0]) * (b[3] - b[1]) >= 0.004 * w * h:
                        ps.append(dict(box=b, conf=float(c), kp=k))
                ps.sort(key=lambda p: -(p["box"][2] - p["box"][0]) * (p["box"][3] - p["box"][1]))
                ps = ps[:n_refs]
            v.persons.append(ps)
            t1 = time.perf_counter()
            bb, kk = M.fa.det_model.detect(fr, max_num=0, metric="default")
            tick("facedet", t1)
            fs = []
            for b, k in zip(bb, kk):
                f = dict(box=b[:4].copy(), score=float(b[4]), kps=k, emb=None, crop=None, lm=None)
                fs.append(f)
            t1 = time.perf_counter()
            if emb:
                from insightface.utils import face_align

                idx = [i for i, f in enumerate(fs) if f["box"][2] - f["box"][0] >= 28]
                if idx:
                    al = [face_align.norm_crop(fr, fs[i]["kps"], 112) for i in idx]
                    e = M.rec.get_feat(al)
                    e = e / np.linalg.norm(e, axis=1, keepdims=True)
                    for i, ee in zip(idx, e):
                        fs[i]["emb"] = ee
            if crops:
                for f in fs:
                    f["crop"] = face_crop(fr, f["box"])
            tick("rec_crop", t1)
            if lm and M.lmk is not None:
                from insightface.app.common import Face

                for f in fs:
                    fc = Face(bbox=np.append(f["box"], f["score"]), kps=f["kps"], det_score=f["score"])
                    M.lmk.get(fr, fc)
                    f["lm"] = fc.landmark_2d_106
            v.faces.append(fs)
            v.thumbs.append(cv2.resize(fr, (TW, TH), interpolation=cv2.INTER_AREA))
    proc.wait()
    v.T = len(v.thumbs)
    v.gray = np.stack([cv2.cvtColor(x, cv2.COLOR_BGR2GRAY) for x in v.thumbs]).astype(np.float32) if v.T else np.zeros((0, TH, TW), np.float32)
    tick("analyze", t)
    return v


def slot_positions(S, n):
    T = S.T
    pos = np.full((T, n), np.nan)
    for t in range(T):
        ps = S.persons[t]
        if len(ps) == n:
            pos[t] = sorted([(p["box"][0] + p["box"][2]) / 2 / S.W for p in ps])
    for k in range(n):
        c = pos[:, k]
        ok = ~np.isnan(c)
        if ok.any():
            idx = np.where(ok, np.arange(T), 0)
            np.maximum.accumulate(idx, out=idx)
            first = np.argmax(ok)
            c2 = c[idx]
            c2[:first] = c[first]
            pos[:, k] = c2
        else:
            pos[:, k] = (k + 0.5) / n
    return pos


def hung(xs, slots, thr):
    if not len(xs):
        return {}
    c = np.abs(np.array(xs)[:, None] - np.array(slots)[None, :])
    r, cc = linear_sum_assignment(c)
    return {int(j): int(i) for i, j in zip(r, cc) if c[i, j] <= thr}


def assign(V, slots, n):
    V.sp, V.sf = [], []
    for t in range(V.T):
        ps = V.persons[t]
        sp = hung([(p["box"][0] + p["box"][2]) / 2 / V.W for p in ps], slots[t], 0.5)
        fs = V.faces[t]
        sf = {}
        if fs:
            px = []
            for k in range(n):
                px.append((ps[sp[k]]["box"][0] + ps[sp[k]]["box"][2]) / 2 / V.W if k in sp else slots[t][k])
            cost = np.zeros((len(fs), n))
            for i, f in enumerate(fs):
                fx = (f["box"][0] + f["box"][2]) / 2
                for k in range(n):
                    c = abs(fx / V.W - px[k])
                    if k in sp:
                        b = ps[sp[k]]["box"]
                        if not (b[0] <= fx <= b[2] and b[1] <= (f["box"][1] + f["box"][3]) / 2 <= b[3]):
                            c += 0.25
                    cost[i, k] = c
            r, cc = linear_sum_assignment(cost)
            sf = {int(j): int(i) for i, j in zip(r, cc) if cost[i, j] <= 0.4}
        V.sp.append(sp)
        V.sf.append(sf)
    smooth_front(V, n)


def raw_front(V, t, k):
    if k not in V.sp[t]:
        return np.nan
    kp = V.persons[t][V.sp[t][k]]["kp"]
    if k in V.sf[t]:
        f = V.faces[t][V.sf[t][k]]
        return float(f["score"] >= 0.6 or kp[:3, 2].mean() > 0.4)
    return float(kp[0, 2] > 0.7 and kp[1, 2] > 0.7 and kp[2, 2] > 0.7)


def smooth_front(V, n, w=3):
    raw = np.array([[raw_front(V, t, k) for k in range(n)] for t in range(V.T)])
    out = np.full_like(raw, np.nan)
    for t in range(V.T):
        seg = raw[max(0, t - w):t + w + 1]
        for k in range(n):
            c = seg[:, k][~np.isnan(seg[:, k])]
            if c.size and not np.isnan(raw[t, k]):
                out[t, k] = float(c.mean() >= 0.5)
    V.front = out


def is_front(V, t, k):
    v = V.front[t, k]
    return None if np.isnan(v) else bool(v)


def iou(a, b):
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    i = ix * iy
    u = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - i
    return i / u if u > 0 else 0.0


def nbox(V, b):
    return np.array([b[0] / V.W, b[1] / V.H, b[2] / V.W, b[3] / V.H])


def pose_err(ks, ko, allow_swap):
    if min(ks[5, 2], ks[6, 2], ko[5, 2], ko[6, 2]) < 0.3:
        return None

    def norm(k, hips):
        o = (k[5, :2] + k[6, :2]) / 2
        if hips:
            sc = np.linalg.norm((k[11, :2] + k[12, :2]) / 2 - o)
        else:
            sc = 1.3 * np.linalg.norm(k[5, :2] - k[6, :2])
        return o, max(sc, 1e-3)

    hips = min(ks[11, 2], ks[12, 2], ko[11, 2], ko[12, 2]) > 0.3
    os_, ss = norm(ks, hips)
    oo, so = norm(ko, hips)

    def err(swap):
        ds = []
        for j in POSE_JOINTS:
            if j in (11, 12) and not hips:
                continue
            jo = SWAP.get(j, j) if swap else j
            if ks[j, 2] > 0.3 and ko[jo, 2] > 0.3:
                ds.append(np.linalg.norm((ks[j, :2] - os_) / ss - (ko[jo, :2] - oo) / so))
        return float(np.mean(ds)) if len(ds) >= 4 else None

    e = err(False)
    if allow_swap:
        e2 = err(True)
        if e is None or (e2 is not None and e2 < e):
            e = e2
    return e


def frame_metrics(S, O, n):
    T = min(S.T, O.T)
    R = {k: np.full(T, np.nan) for k in ["pose", "iou", "gi", "scale", "center", "area", "vm", "b2f", "cnt", "f", "miss"]}
    for t in range(T):
        ious, scs, cts, pe, vm, b2f = [], [], [], [], [], []
        present = 0
        for k in range(n):
            ps = S.persons[t][S.sp[t][k]] if k in S.sp[t] else None
            po = O.persons[t][O.sp[t][k]] if k in O.sp[t] else None
            if ps is None and po is None:
                continue
            present += 1
            if ps is None or po is None:
                ious.append(0.0)
                scs.append(math.log(4))
                cts.append(0.3)
                continue
            bs, bo = nbox(S, ps["box"]), nbox(O, po["box"])
            ious.append(iou(bs, bo))
            hs, ho = bs[3] - bs[1], bo[3] - bo[1]
            scs.append(abs(math.log(max(ho, 1e-3) / max(hs, 1e-3))))
            cts.append(float(np.hypot((bs[0] + bs[2] - bo[0] - bo[2]) / 2, (bs[1] + bs[3] - bo[1] - bo[3]) / 2)))
            fs, fo = is_front(S, t, k), is_front(O, t, k)
            vm.append(float(fs != fo))
            b2f.append(float((not fs) and fo))
            e = pose_err(ps["kp"], po["kp"], allow_swap=not fs or not fo)
            if e is not None:
                pe.append(e)
        if not present:
            continue
        gs = [nbox(S, p["box"]) for p in S.persons[t]]
        go = [nbox(O, p["box"]) for p in O.persons[t]]
        R["miss"][t] = float(len(S.sp[t]) != len(O.sp[t]))
        R["cnt"][t] = float(len(gs) != len(go))
        if gs and go:
            ub = lambda g: np.array([min(x[0] for x in g), min(x[1] for x in g), max(x[2] for x in g), max(x[3] for x in g)])
            us, uo = ub(gs), ub(go)
            R["gi"][t] = iou(us, uo)
            R["area"][t] = math.log(max((uo[2] - uo[0]) * (uo[3] - uo[1]), 1e-4) / max((us[2] - us[0]) * (us[3] - us[1]), 1e-4))
        else:
            R["gi"][t] = 0.0
        R["iou"][t] = np.mean(ious)
        R["scale"][t] = np.mean(scs)
        R["center"][t] = np.mean(cts)
        R["vm"][t] = np.mean(vm) if vm else 0.0
        R["b2f"][t] = np.mean(b2f) if b2f else 0.0
        if pe:
            R["pose"][t] = np.mean(pe)
        R["f"][t] = (0.45 * R["iou"][t] + 0.25 * R["gi"][t] + 0.15 * math.exp(-R["scale"][t] / 0.3) + 0.15 * math.exp(-R["center"][t] / 0.1)) * (1 - 0.5 * R["vm"][t])
    return R


def nm(a):
    a = np.asarray(a, float)
    a = a[~np.isnan(a)]
    return float(a.mean()) if a.size else None


def r3(x):
    if isinstance(x, dict):
        return {k: r3(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [r3(v) for v in x]
    if isinstance(x, (float, np.floating)):
        return None if not math.isfinite(x) else round(float(x), 3)
    if isinstance(x, (np.integer,)):
        return int(x)
    return x


def pose_score(e):
    return None if e is None else 100 * math.exp(-e / 0.4)


def id_score(c):
    return 100 * float(np.clip((c - 0.1) / 0.45, 0, 1))


def sync_dists(M, V, aud_feat, mf_n, slots_n):
    torch = M.torch
    net = M.get_sync()
    out = {}
    V_SHIFT = 15
    for k in range(slots_n):
        seg = []
        cur = []
        last = None
        for t in range(V.T):
            f = V.faces[t][V.sf[t][k]] if k in V.sf[t] else None
            c = f["crop"] if f is not None else None
            if c is None and last is not None and cur and t - cur[-1][0] <= 2:
                c = last
            if c is None:
                if len(cur) >= 5:
                    seg.append(cur)
                cur = []
                last = None
                continue
            cur.append((t, c))
            last = c
        if len(cur) >= 5:
            seg.append(cur)
        for sg in seg:
            ts = [x[0] for x in sg]
            arr = torch.from_numpy(np.stack([x[1] for x in sg])).to(M.dev)
            arr = arr.permute(3, 0, 1, 2).float()
            nwin = len(sg) - 4
            feats = []
            with torch.no_grad():
                for i in range(0, nwin, 48):
                    b = torch.stack([arr[:, j:j + 5] for j in range(i, min(nwin, i + 48))])
                    feats.append(net.forward_lip(b).float())
            vf = torch.cat(feats)
            D = torch.cdist(vf, aud_feat).cpu().numpy()
            for j in range(nwin):
                f0 = ts[j]
                d = np.full(2 * V_SHIFT + 1, np.nan)
                lo, hi = max(0, f0 - V_SHIFT), min(D.shape[1], f0 + V_SHIFT + 1)
                if hi > lo:
                    d[lo - f0 + V_SHIFT:hi - f0 + V_SHIFT] = D[j, lo:hi]
                    out.setdefault(f0, []).append(d)
    return out


def audio_feats(M, audio, T):
    import python_speech_features as psf

    torch = M.torch
    mf = psf.mfcc(audio, 16000)
    cct = torch.from_numpy(mf.T.astype(np.float32))[None, None]
    nf = min(T, (mf.shape[0] - 20) // 4 + 1)
    net = M.get_sync()
    fe = []
    with torch.no_grad():
        for i in range(0, nf, 64):
            b = torch.cat([cct[:, :, :, f * 4:f * 4 + 20] for f in range(i, min(nf, i + 64))]).to(M.dev)
            fe.append(net.forward_aud(b).float())
    return torch.cat(fe)


def lse(dlist):
    if not dlist:
        return None
    m = np.nanmean(np.stack(dlist), axis=0)
    mn = np.nanmin(m)
    return dict(lse_d=float(mn), lse_c=float(np.nanmedian(m) - mn), offset=int(np.nanargmin(m) - 15))


def syncnet_pass(M, V, audio, n):
    af = audio_feats(M, audio, V.T)
    d = sync_dists(M, V, af, af.shape[0], n)
    return d


def lse_shots(d, shots):
    res = []
    allw = [x for f in sorted(d) for x in d[f]]
    clip = lse(allw)
    for (a, b) in shots:
        f0, f1 = int(round(a * FPS)), int(round(b * FPS))
        w = [x for f in d if f0 <= f < f1 for x in d[f]]
        res.append(lse(w) if len(w) >= 25 else None)
    return clip, res


def proxy_series(V, k):
    s = np.full(V.T, np.nan)
    for t in range(V.T):
        if k in V.sf[t]:
            lm = V.faces[t][V.sf[t][k]]["lm"]
            if lm is not None:
                m = lm[52:72]
                s[t] = np.ptp(m[:, 1]) / max(np.ptp(m[:, 0]), 1e-3)
    return s


def env(audio, T):
    a = audio.astype(np.float32) / 32768
    n = len(a) // 640
    e = np.sqrt((a[:n * 640].reshape(n, 640) ** 2).mean(1))
    return np.log1p(60 * e)[:T]


def corr_lag(x, y):
    best = None
    for L in range(-4, 5):
        a, b = (x[max(0, L):], y[:len(y) - max(0, L)]) if L >= 0 else (x[:L], y[-L:])
        n = min(len(a), len(b))
        a, b = a[:n], b[:n]
        ok = ~np.isnan(a) & ~np.isnan(b)
        if ok.sum() < 20:
            continue
        a, b = a[ok], b[ok]
        if a.std() < 1e-6 or b.std() < 1e-6:
            continue
        c = float(np.corrcoef(a, b)[0, 1])
        if best is None or c > best:
            best = c
    return best


def proxy_scores(V, audio, n, shots):
    e = env(audio, V.T)
    ser = [proxy_series(V, k) for k in range(n)]

    def corr(f0, f1):
        cs = []
        for s in ser:
            seg = s[f0:f1]
            ee = e[f0:f1]
            if len(ee) < 20:
                continue
            c = corr_lag(seg, ee)
            if c is not None:
                cs.append(c)
        return float(np.mean(cs)) if cs else None

    return corr(0, V.T), [corr(int(round(a * FPS)), int(round(b * FPS))) for a, b in shots]


def dino_shot_embs(M, V, shots):
    torch = M.torch
    m = M.get_dino()
    imgs = []
    for a, b in shots:
        f0, f1 = int(round(a * FPS)), max(int(round(b * FPS)), int(round(a * FPS)) + 1)
        for q in (0.2, 0.5, 0.8):
            imgs.append(V.thumbs[min(V.T - 1, int(f0 + q * (f1 - f0)))])
    x = np.stack([cv2.resize(cv2.cvtColor(i, cv2.COLOR_BGR2RGB), (224, 224)) for i in imgs]).astype(np.float32) / 255
    x = (x - np.array([0.485, 0.456, 0.406])) / np.array([0.229, 0.224, 0.225])
    x = torch.from_numpy(x.astype(np.float32)).permute(0, 3, 1, 2).to(M.dev)
    if M.dev == "cuda":
        x = x.half()
    with torch.no_grad():
        e = m(pixel_values=x).pooler_output.float().cpu().numpy()
    e = e.reshape(len(shots), 3, -1).mean(1)
    return e


def cos_mat(e):
    e = e - e.mean(0, keepdims=True)
    e = e / (np.linalg.norm(e, axis=1, keepdims=True) + 1e-8)
    return e @ e.T


def layout_vec(V, shot, n):
    f0, f1 = int(round(shot[0] * FPS)), max(int(round(shot[1] * FPS)), int(round(shot[0] * FPS)) + 1)
    vec = np.zeros(n * 5)
    for k in range(n):
        bs = []
        for t in range(f0, min(f1, V.T)):
            if k in V.sp[t]:
                bs.append(nbox(V, V.persons[t][V.sp[t][k]]["box"]))
        if bs:
            b = np.mean(bs, 0)
            vec[k * 5:(k + 1) * 5] = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2, b[2] - b[0], b[3] - b[1], len(bs) / max(1, f1 - f0)]
    return vec


def layout_mat(V, shots, n):
    v = np.stack([layout_vec(V, s, n) for s in shots])
    d = np.linalg.norm(v[:, None] - v[None], axis=2)
    return np.exp(-d / 0.35)


def jumps_count(S, O):
    T = min(S.T, O.T)
    if T < 3:
        return 0, []
    ds = np.abs(np.diff(S.gray[:T], axis=0)).mean((1, 2))
    do = np.abs(np.diff(O.gray[:T], axis=0)).mean((1, 2))
    w = int(0.25 * FPS)
    ev = []
    for i in range(len(do)):
        if do[i] > 18 and ds[max(0, i - w):i + w + 1].max() < 9:
            if not ev or (i - ev[-1]) > w:
                ev.append(i)
    return len(ev), [round((i + 1) / FPS, 2) for i in ev]


def bg_drift(S, O):
    T = min(S.T, O.T)
    ds = []
    h, w = TH, TW

    def lab(x):
        l = cv2.cvtColor(x, cv2.COLOR_BGR2LAB).astype(np.float32)
        l[..., 0] *= 100 / 255
        l[..., 1:] -= 128
        return l

    for t in range(T):
        m = np.ones((h, w), bool)
        for V in (S, O):
            for p in V.persons[t]:
                b = p["box"]
                bw, bh = b[2] - b[0], b[3] - b[1]
                x1, x2 = int(max(0, (b[0] - 0.15 * bw) / V.W * w)), int(min(w, (b[2] + 0.15 * bw) / V.W * w + 1))
                y1, y2 = int(max(0, (b[1] - 0.15 * bh) / V.H * h)), int(min(h, (b[3] + 0.15 * bh) / V.H * h + 1))
                m[y1:y2, x1:x2] = False
        if m.mean() < 0.05:
            continue
        ds.append(float(np.linalg.norm(lab(S.thumbs[t])[m].mean(0) - lab(O.thumbs[t])[m].mean(0))))
    return nm(ds)


def segments(mask, gap=0.4, minlen=0.5):
    segs = []
    for t_ in np.where(mask)[0]:
        if segs and t_ / FPS - segs[-1][1] <= gap:
            segs[-1][1] = (t_ + 1) / FPS
        else:
            segs.append([t_ / FPS, (t_ + 1) / FPS])
    return [(a_, b_) for a_, b_ in segs if b_ - a_ >= minlen]


def frames_of(shot):
    return int(round(shot[0] * FPS)), max(int(round(shot[1] * FPS)), int(round(shot[0] * FPS)) + 1)


def fmt_t(x):
    return f"{x:.1f}"


def make_sheet(S, O, shots, shot_rows, n, path):
    from PIL import Image, ImageDraw, ImageFont

    font = ImageFont.load_default(size=13)
    cols = 6
    blocks = []
    cols_colors = [(0, 200, 0), (60, 140, 255), (255, 160, 0), (200, 0, 200)]

    def draw_frame(V, t, im):
        d = ImageDraw.Draw(im)
        for k in range(n):
            if k in V.sp[t]:
                b = V.persons[t][V.sp[t][k]]["box"]
                s = TW / V.W
                d.rectangle([b[0] * s, b[1] * s, b[2] * s, b[3] * s], outline=cols_colors[k % 4], width=2)
            if k in V.sf[t]:
                b = V.faces[t][V.sf[t][k]]["box"]
                s = TW / V.W
                d.rectangle([b[0] * s, b[1] * s, b[2] * s, b[3] * s], outline=(255, 255, 0), width=1)

    for c0 in range(0, len(shots), cols):
        idx = list(range(c0, min(len(shots), c0 + cols)))
        img = Image.new("RGB", (cols * TW, 2 * TH + 56), (20, 20, 20))
        for ci, i in enumerate(idx):
            a, b = shots[i]
            f0, f1 = frames_of((a, b))
            t = min(S.T, O.T) - 1 if f0 >= min(S.T, O.T) else min(min(S.T, O.T) - 1, (f0 + f1) // 2)
            for row, V in enumerate((S, O)):
                im = Image.fromarray(cv2.cvtColor(V.thumbs[t], cv2.COLOR_BGR2RGB))
                draw_frame(V, t, im)
                img.paste(im, (ci * TW, row * TH))
            d = ImageDraw.Draw(img)
            r = shot_rows[i]
            sc = r["score"]
            col = (0, 130, 0) if sc is not None and sc >= 70 else ((170, 120, 0) if sc is not None and sc >= 50 else (170, 0, 0))
            d.rectangle([ci * TW, 2 * TH, (ci + 1) * TW, 2 * TH + 56], fill=col)
            g = lambda x: "-" if x is None else f"{x:.0f}"
            d.text((ci * TW + 4, 2 * TH + 3), f"#{i} {fmt_t(a)}-{fmt_t(b)}s  score {g(sc)}", font=font, fill=(255, 255, 255))
            d.text((ci * TW + 4, 2 * TH + 20), f"pose {g(r['pose'])} frame {g(r['framing'])}", font=font, fill=(255, 255, 255))
            d.text((ci * TW + 4, 2 * TH + 37), f"id {g(r['identity'])} lips {g(r['lipsync'])}" + (" VIEW!" if (r.get("view_mismatch") or 0) > 0.2 else ""), font=font, fill=(255, 255, 255))
            d.text((ci * TW + 4, 3), "src", font=font, fill=(255, 255, 255))
            d.text((ci * TW + 4, TH + 3), "out", font=font, fill=(255, 255, 255))
        blocks.append(img)
    sheet = Image.new("RGB", (cols * TW, sum(b.height for b in blocks)))
    y = 0
    for b in blocks:
        sheet.paste(b, (0, y))
        y += b.height
    sheet.save(path)


def refs_embeddings(M, paths):
    from insightface.utils import face_align

    out = []
    for p in paths:
        img = cv2.imread(p)
        if img is None:
            raise SystemExit(f"cannot read ref {p}")
        h, w = img.shape[:2]
        sc = min(1.0, 1280 / max(h, w))
        if sc < 1:
            img = cv2.resize(img, (int(w * sc), int(h * sc)), interpolation=cv2.INTER_AREA)
        bb, kk = M.fa.det_model.detect(img, max_num=0, metric="default")
        if not len(bb):
            raise SystemExit(f"no face in ref {p}")
        i = int(np.argmax((bb[:, 2] - bb[:, 0]) * (bb[:, 3] - bb[:, 1])))
        e = M.rec.get_feat([face_align.norm_crop(img, kk[i], 112)])[0]
        out.append(e / np.linalg.norm(e))
    return out


def run(a):
    n = len(a.ref) if a.ref else 2
    wo, ho, do, ao = probe(a.output)
    ws, hs, ds, as_ = probe(a.source)
    dur = min(do, ds)
    shots = detect_shots(a.source, dur)
    log(f"dur {dur:.2f}s shots {len(shots)}")
    use_sync = a.lipsync != "off" and ao and as_
    proxy = a.lipsync == "proxy" and use_sync
    M = Models(a.device, lm=proxy)
    self_ref = not a.ref
    S = analyze(a.source, dur, M, n, emb=self_ref, crops=use_sync and not proxy, lm=proxy)
    O = analyze(a.output, dur, M, n, emb=True, crops=use_sync and not proxy, lm=proxy)
    T = min(S.T, O.T)
    log(f"frames S={S.T} O={O.T}")
    t = time.perf_counter()
    slots = slot_positions(S, n)
    assign(S, slots, n)
    assign(O, slots, n)
    R = frame_metrics(S, O, n)
    shots = [(x, min(y, T / FPS)) for x, y in shots if x < T / FPS - 0.1] or [(0, T / FPS)]
    if self_ref:
        refs = []
        for k in range(n):
            es = [S.faces[t_][S.sf[t_][k]]["emb"] for t_ in range(S.T) if k in S.sf[t_] and S.faces[t_][S.sf[t_][k]]["emb"] is not None]
            if not es:
                raise SystemExit("self-ref: no source faces")
            e = np.mean(es, 0)
            refs.append(e / np.linalg.norm(e))
    else:
        refs = refs_embeddings(M, a.ref)
    ch = [[] for _ in range(n)]
    idf = np.full(T, np.nan)
    idf_char = np.full((T, n), np.nan)
    idnf = np.full((T, n), np.nan)
    idcos = np.full((T, n), np.nan)
    for t_ in range(T):
        ss = []
        for k in range(n):
            of = O.faces[t_][O.sf[t_][k]] if k in O.sf[t_] else None
            sf = k in S.sf[t_]
            if of is not None and of["emb"] is not None:
                c = float(of["emb"] @ refs[k])
                idcos[t_, k] = c
                idf_char[t_, k] = id_score(c)
                idnf[t_, k] = 0
                ss.append(idf_char[t_, k])
            elif sf or of is not None:
                idf_char[t_, k] = 0
                idnf[t_, k] = 1
                ss.append(0.0)
        if ss:
            idf[t_] = np.mean(ss)
    tick("metrics", t)

    rows = []
    sync_clip = None
    sync_src = None
    lip_sh = [None] * len(shots)
    method = "none"
    t = time.perf_counter()
    if use_sync:
        aud_o = load_audio(a.output, dur)
        aud_s = load_audio(a.source, dur)
        if aud_o is not None and aud_s is not None:
            if proxy:
                method = "proxy_mouth_vs_audio_corr"
                co, cos_ = proxy_scores(O, aud_o, n, shots)
                cs, css = proxy_scores(S, aud_s, n, shots)
                sync_clip = dict(corr=co)
                sync_src = dict(corr=cs)
                ceil = max(cs if cs is not None else 0.25, 0.25)
                lip_clip = None if co is None else 100 * float(np.clip(co / ceil, 0, 1))
                lip_sh = [dict(corr=c, score=None if c is None else 100 * float(np.clip(c / ceil, 0, 1)), src_corr=cc) for c, cc in zip(cos_, css)]
            else:
                method = "syncnet_v2"
                do_ = syncnet_pass(M, O, aud_o, n)
                ds_ = syncnet_pass(M, S, aud_s, n)
                sync_clip, sh_o = lse_shots(do_, shots)
                sync_src, sh_s = lse_shots(ds_, shots)
                ceil = max(sync_src["lse_c"], 1.5) if sync_src else 4.0
                lip_clip = None if not sync_clip else 100 * float(np.clip(sync_clip["lse_c"] / ceil, 0, 1))
                lip_sh = []
                for so, ss_ in zip(sh_o, sh_s):
                    lip_sh.append(None if so is None else dict(**so, score=100 * float(np.clip(so["lse_c"] / ceil, 0, 1)), src_lse_c=None if ss_ is None else ss_["lse_c"]))
        else:
            lip_clip = None
    else:
        lip_clip = None
    tick("lipsync", t)

    pose_sh, fr_sh, id_sh = [], [], []
    for (a_, b_) in shots:
        f0, f1 = frames_of((a_, b_))
        f1 = min(f1, T)
        sl = slice(f0, f1)
        pe = nm(R["pose"][sl])
        pose_sh.append(dict(start=a_, end=b_, err=pe, score=pose_score(pe)))
        ff = nm(R["f"][sl])
        fr_sh.append(dict(start=a_, end=b_, iou=nm(R["iou"][sl]), group_iou=nm(R["gi"][sl]), scale_err=nm(R["scale"][sl]), center_off=nm(R["center"][sl]), area_log_ratio=nm(R["area"][sl]), view_mismatch=nm(R["vm"][sl]), back_to_front=nm(R["b2f"][sl]), person_count_mismatch=nm(R["cnt"][sl]), score=None if ff is None else 100 * ff))
        ic = nm(idf[sl])
        pc = []
        for k in range(n):
            pc.append(dict(cos=nm(idcos[sl, k]), no_face_frac=nm(idnf[sl, k])))
        id_sh.append(dict(start=a_, end=b_, cos=nm(idcos[sl]), no_face_frac=nm(idnf[sl]), per_character=pc, score=ic))

    def pooled(x):
        return nm(x)

    pose_e = pooled(R["pose"])
    fr_score = None if pooled(R["f"]) is None else 100 * pooled(R["f"])
    id_score_all = pooled(idf)
    id_char = []
    for k in range(n):
        id_char.append(dict(character=k, ref=a.ref[k] if a.ref else f"source_slot{k}", cos_mean=nm(idcos[:, k]), score=nm(idf_char[:, k]), no_face_frac=nm(idnf[:, k]), faces=int((~np.isnan(idcos[:, k])).sum())))
    bgd = bg_drift(S, O)
    bg_score = None if bgd is None else 100 * math.exp(-bgd / 20)
    nj, jt = jumps_count(S, O)
    j_score = max(0.0, 100 - 12 * nj)

    rep = dict(value=None, layout=None, dino=None, pairs=[])
    rep_score = None
    if len(shots) >= 3:
        sl_s, sl_o = layout_mat(S, shots, n), layout_mat(O, shots, n)
        iu = np.triu_indices(len(shots), 1)
        r_l = float(np.mean(np.maximum(0, sl_o - sl_s)[iu]))
        try:
            ds_m, do_m = cos_mat(dino_shot_embs(M, S, shots)), cos_mat(dino_shot_embs(M, O, shots))
            r_d = float(np.mean(np.maximum(0, do_m - ds_m)[iu]))
        except Exception as e:
            log("dino failed", e)
            r_d = None
            do_m = ds_m = None
        vals = [r_l] + ([r_d] if r_d is not None else [])
        rep["value"] = float(np.mean(vals))
        rep["layout"] = r_l
        rep["dino"] = r_d
        for i, j in zip(*iu):
            if sl_o[i, j] - sl_s[i, j] > 0.4 or (do_m is not None and do_m[i, j] - ds_m[i, j] > 0.5):
                rep["pairs"].append(dict(shots=[int(i), int(j)], layout_src=float(sl_s[i, j]), layout_out=float(sl_o[i, j]), dino_src=None if ds_m is None else float(ds_m[i, j]), dino_out=None if do_m is None else float(do_m[i, j])))
        rep_score = 100 * float(np.clip(1 - rep["value"] / 0.5, 0, 1))

    shot_rows = []
    for i, (a_, b_) in enumerate(shots):
        ls = lip_sh[i]["score"] if lip_sh[i] else None
        comp = [(0.25, pose_sh[i]["score"]), (0.35, fr_sh[i]["score"]), (0.28, id_sh[i]["score"]), (0.12, ls)]
        comp = [(w, v) for w, v in comp if v is not None]
        sc = sum(w * v for w, v in comp) / sum(w for w, _ in comp) if comp else None
        shot_rows.append(dict(start=a_, end=b_, pose=pose_sh[i]["score"], framing=fr_sh[i]["score"], identity=id_sh[i]["score"], lipsync=ls, score=sc, view_mismatch=fr_sh[i]["view_mismatch"]))

    step = FPS // 5
    timeline = dict(
        t=[t_ / FPS for t_ in range(0, T, step)],
        framing=[None if np.isnan(R["f"][t_]) else 100 * R["f"][t_] for t_ in range(0, T, step)],
        iou=[R["iou"][t_] for t_ in range(0, T, step)],
        view_mismatch=[R["vm"][t_] for t_ in range(0, T, step)],
        pose_err=[R["pose"][t_] for t_ in range(0, T, step)],
        identity=[idf[t_] for t_ in range(0, T, step)],
    )
    scores = dict(pose=pose_score(pose_e), framing=fr_score, identity=id_score_all, lipsync=lip_clip, background=bg_score, repeat=rep_score, jumps=j_score)
    ws_ = [(W_OVERALL[k], v) for k, v in scores.items() if v is not None]
    overall = sum(w * v for w, v in ws_) / sum(w for w, _ in ws_)

    bad_fr = [i for i, r in enumerate(fr_sh) if r["score"] is not None and r["score"] < 50]
    vm_seg = segments(R["vm"][:T] > 0.25)
    parts = []
    if bad_fr:
        parts.append("framing off in shots " + ",".join(f"{i}({shots[i][0]:.1f}-{shots[i][1]:.1f}s iou {fr_sh[i]['iou']:.2f})" for i in bad_fr[:6]))
    if vm_seg:
        parts.append("back/front view mismatch at " + ",".join(f"{x:.1f}-{y:.1f}s" for x, y in vm_seg[:6]))
    for c in id_char:
        if c["cos_mean"] is None:
            parts.append(f"no face found for character {c['character']}")
        elif c["cos_mean"] < 0.3:
            parts.append(f"identity weak char {c['character']} cos {c['cos_mean']:.2f}")
    if rep["pairs"]:
        parts.append(f"repeated compositions {len(rep['pairs'])} shot pairs")
    if nj:
        parts.append(f"{nj} jumps")
    if lip_clip is not None and lip_clip < 60:
        parts.append(f"lipsync weak ({method})")
    grade = "PASS" if overall >= 70 else ("WARN" if overall >= 50 else "FAIL")
    if grade == "PASS" and any(scores[k] is not None and scores[k] < 35 for k in ("framing", "identity", "lipsync", "pose")):
        grade = "WARN"
    verdict = f"{grade} {overall:.0f}: " + ("; ".join(parts) if parts else "no major issues")

    out = dict(
        overall=overall,
        scores=scores,
        pose=dict(joint_err_torso=pose_e, score=scores["pose"], per_shot=pose_sh),
        framing=dict(bbox_iou_mean=pooled(R["iou"]), group_iou_mean=pooled(R["gi"]), scale_ratio_err=pooled(R["scale"]), center_off_mean=pooled(R["center"]), area_ratio_gm=float(math.exp(pooled(R["area"]))) if pooled(R["area"]) is not None else None, view_mismatch_rate=pooled(R["vm"]), view_mismatch_segments=vm_seg, back_to_front_rate=pooled(R["b2f"]), person_count_mismatch_rate=pooled(R["cnt"]), score=fr_score, per_shot=fr_sh),
        identity=dict(cos_mean=nm(idcos), score=id_score_all, ref_mode="source_faces" if self_ref else "photos", per_character=id_char, per_shot=id_sh),
        lipsync=dict(score=lip_clip, method=method, clip=sync_clip, source=sync_src, per_shot=lip_sh),
        background=dict(color_drift=bgd, score=bg_score),
        jumps=nj,
        jump_times=jt,
        repeat_composition=rep["value"],
        repeat_detail=rep,
        per_shot=shot_rows,
        timeline=timeline,
        verdict=verdict,
        meta=dict(source=a.source, output=a.output, duration=dur, fps=FPS, shots=[list(s) for s in shots], frames=T, device=M.dev, timing=TIMES, runtime_s=time.perf_counter() - T0),
    )
    out = r3(out)
    if a.json:
        Path(a.json).write_text(json.dumps(out, indent=1))
    if a.sheet:
        make_sheet(S, O, shots, shot_rows, n, a.sheet)
    print(verdict)
    log(f"overall {overall:.1f} runtime {time.perf_counter() - T0:.1f}s {TIMES}")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", required=True)
    ap.add_argument("--output", required=True)
    ap.add_argument("--ref", action="append")
    ap.add_argument("--json")
    ap.add_argument("--sheet")
    ap.add_argument("--device", default="cuda", choices=["cuda", "cpu"])
    ap.add_argument("--lipsync", default="syncnet", choices=["syncnet", "proxy", "off"])
    a = ap.parse_args()
    run(a)


if __name__ == "__main__":
    main()
