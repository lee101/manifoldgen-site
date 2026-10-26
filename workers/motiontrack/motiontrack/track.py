from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import numpy as np

from .bytetrack import ByteTracker

COCO = ["nose", "leye", "reye", "lear", "rear", "lsho", "rsho", "lelb", "relb", "lwri", "rwri",
        "lhip", "rhip", "lkne", "rkne", "lank", "rank"]
BONES = [(5, 7), (7, 9), (6, 8), (8, 10), (5, 6), (5, 11), (6, 12), (11, 12), (11, 13), (13, 15), (12, 14), (14, 16),
         (0, 5), (0, 6)]
EFFECTORS = (9, 10, 15, 16)


@dataclass
class Track:
    id: int
    first: int
    kp: np.ndarray
    conf: np.ndarray
    box: np.ndarray
    valid: np.ndarray

    @property
    def last(self) -> int:
        return self.first + len(self.kp) - 1

    def at(self, f: int) -> bool:
        i = f - self.first
        return 0 <= i < len(self.kp) and bool(self.valid[i])

    def kp_at(self, f: int) -> np.ndarray:
        return self.kp[f - self.first]

    def box_at(self, f: int) -> np.ndarray:
        return self.box[f - self.first]

    def _lerp(self, arr: np.ndarray, tf: float) -> np.ndarray:
        x = min(max(tf - self.first, 0.0), len(arr) - 1.0)
        i = int(x)
        j = min(i + 1, len(arr) - 1)
        w = x - i
        return arr[i] * (1 - w) + arr[j] * w

    def kp_f(self, tf: float) -> np.ndarray:
        return self._lerp(self.kp, tf)

    def conf_f(self, tf: float) -> np.ndarray:
        return self._lerp(self.conf, tf)

    def box_f(self, tf: float) -> np.ndarray:
        return self._lerp(self.box, tf)

    def at_f(self, tf: float, pad: float = 0.5) -> bool:
        return self.first - pad <= tf <= self.last + pad and self.at(int(round(min(max(tf, self.first), self.last))))

    def scale(self) -> float:
        h = self.box[self.valid][:, 3] - self.box[self.valid][:, 1]
        return float(np.median(h)) if len(h) else 1.0


@dataclass
class TrackSet:
    fps: float
    width: int
    height: int
    frames: int
    tracks: list[Track] = field(default_factory=list)

    def active(self, f: int) -> list[Track]:
        return [t for t in self.tracks if t.at(f)]

    def to_json(self, ndigits: int = 1) -> dict:
        out = []
        for t in self.tracks:
            frames = []
            for i in range(len(t.kp)):
                if not t.valid[i]:
                    frames.append(None)
                    continue
                kp = np.concatenate([t.kp[i], t.conf[i][:, None]], axis=1)
                frames.append({"box": np.round(t.box[i], ndigits).tolist(), "kp": np.round(kp, ndigits).tolist()})
            out.append({"id": t.id, "first": t.first, "last": t.last, "frames": frames})
        return {"version": 1, "keypoints": COCO, "fps": self.fps, "width": self.width, "height": self.height,
                "frames": self.frames, "tracks": out}

    def save(self, path: Path) -> None:
        Path(path).write_text(json.dumps(self.to_json(), separators=(",", ":")))

    @staticmethod
    def load(path: Path) -> "TrackSet":
        d = json.loads(Path(path).read_text())
        ts = TrackSet(d["fps"], d["width"], d["height"], d["frames"])
        for t in d["tracks"]:
            n = len(t["frames"])
            kp = np.zeros((n, 17, 2), np.float32)
            conf = np.zeros((n, 17), np.float32)
            box = np.zeros((n, 4), np.float32)
            valid = np.zeros(n, bool)
            for i, fr in enumerate(t["frames"]):
                if fr is None:
                    continue
                a = np.asarray(fr["kp"], np.float32)
                kp[i], conf[i], box[i], valid[i] = a[:, :2], a[:, 2], fr["box"], True
            ts.tracks.append(Track(t["id"], t["first"], kp, conf, box, valid))
        return ts


class Pose:
    def __init__(self, mode: str = "balanced", device: str = "cpu"):
        from rtmlib import Body

        self.body = Body(mode=mode, backend="onnxruntime", device=device)

    def __call__(self, frame: np.ndarray):
        boxes = self.body.det_model(frame)
        if boxes is None or len(boxes) == 0:
            return np.zeros((0, 4), np.float32), np.zeros((0, 17, 2), np.float32), np.zeros((0, 17), np.float32), np.zeros(0, np.float32)
        kp, sc = self.body.pose_model(frame, bboxes=boxes)
        return np.asarray(boxes, np.float32)[:, :4], kp.astype(np.float32), sc.astype(np.float32), np.ones(len(boxes), np.float32)


def read_meta(path: str) -> tuple[float, int, int, int]:
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
    w, h = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.release()
    return fps, w, h, n


def _interp_gaps(a: np.ndarray, valid: np.ndarray, max_gap: int) -> tuple[np.ndarray, np.ndarray]:
    n = len(valid)
    idx = np.flatnonzero(valid)
    if len(idx) < 2:
        return a, valid
    out_valid = valid.copy()
    flat = a.reshape(n, -1).copy()
    for lo, hi in zip(idx[:-1], idx[1:]):
        gap = hi - lo - 1
        if 0 < gap <= max_gap:
            for k in range(1, gap + 1):
                w = k / (gap + 1)
                flat[lo + k] = flat[lo] * (1 - w) + flat[hi] * w
            out_valid[lo + 1:hi] = True
    return flat.reshape(a.shape), out_valid


def smooth_series(a: np.ndarray, valid: np.ndarray, sigma: float) -> np.ndarray:
    if sigma <= 0 or valid.sum() < 3:
        return a
    from scipy.ndimage import gaussian_filter1d

    out = a.copy()
    idx = np.flatnonzero(valid)
    lo, hi = idx[0], idx[-1] + 1
    seg = a[lo:hi]
    out[lo:hi] = gaussian_filter1d(seg, sigma, axis=0, mode="nearest")
    return out


def track_video(path: str, *, mode: str = "balanced", device: str = "cpu", max_side: int = 1280, stride: int = 1,
                max_frames: int | None = None, min_len: int = 6, smooth: float = 1.0, progress=None) -> TrackSet:
    fps, w0, h0, n = read_meta(path)
    scale = min(1.0, max_side / max(w0, h0))
    pose = Pose(mode, device)
    tracker = ByteTracker(buffer=int(fps * 1.5))
    cap = cv2.VideoCapture(path)
    rec: dict[int, dict[int, tuple]] = {}
    f = 0
    total = n if max_frames is None else min(n, max_frames)
    while True:
        ok, frame = cap.read()
        if not ok or (max_frames is not None and f >= max_frames):
            break
        if scale < 1.0:
            frame = cv2.resize(frame, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
        boxes, kps, scs, conf = pose(frame)
        if len(boxes):
            keep = (scs.mean(axis=1) > 0.3)
            boxes, kps, scs, conf = boxes[keep], kps[keep], scs[keep], conf[keep]
        if len(boxes):
            for tid, j in tracker.update(boxes, np.clip(scs.mean(axis=1) + 0.2, 0, 1)):
                rec.setdefault(tid, {})[f] = (boxes[j], kps[j], scs[j])
        else:
            tracker.update(np.zeros((0, 4), np.float32), np.zeros(0, np.float32))
        f += 1
        if progress and f % 10 == 0:
            progress(f, total)
    cap.release()
    rec = _stitch(rec, fps)
    inv = 1.0 / scale
    ts = TrackSet(fps, int(round(w0)), int(round(h0)), f)
    nid = 1
    for tid in sorted(rec, key=lambda k: min(rec[k])):
        frames = rec[tid]
        if len(frames) < min_len:
            continue
        lo, hi = min(frames), max(frames)
        m = hi - lo + 1
        kp = np.zeros((m, 17, 2), np.float32)
        conf = np.zeros((m, 17), np.float32)
        box = np.zeros((m, 4), np.float32)
        valid = np.zeros(m, bool)
        for fr, (b, k, s) in frames.items():
            i = fr - lo
            box[i], kp[i], conf[i], valid[i] = b * inv, k * inv, s, True
        kp, v2 = _interp_gaps(kp, valid, max_gap=int(fps * 0.5))
        box, _ = _interp_gaps(box, valid, max_gap=int(fps * 0.5))
        conf, _ = _interp_gaps(conf, valid, max_gap=int(fps * 0.5))
        kp = smooth_series(kp, v2, smooth)
        box = smooth_series(box, v2, smooth)
        ts.tracks.append(Track(nid, lo, kp, conf, box, v2))
        nid += 1
    return ts


def _stitch(rec: dict[int, dict[int, tuple]], fps: float) -> dict[int, dict[int, tuple]]:
    """Merge a track that ends with one that starts shortly after at about the same place (ID switch repair)."""
    from .bytetrack import iou_matrix

    max_gap = int(fps * 1.0)
    ids = sorted(rec, key=lambda k: min(rec[k]))
    merged: dict[int, dict[int, tuple]] = {}
    for tid in ids:
        frames = rec[tid]
        lo = min(frames)
        best, score = None, 0.0
        for mid, mf in merged.items():
            end = max(mf)
            if 0 < lo - end <= max_gap and min(mf) < lo:
                a = np.asarray([mf[end][0]])
                b = np.asarray([frames[lo][0]])
                v = float(iou_matrix(a, b)[0, 0])
                if v > 0.3 and v > score:
                    best, score = mid, v
        if best is None:
            merged[tid] = dict(frames)
        else:
            merged[best].update(frames)
    return merged
