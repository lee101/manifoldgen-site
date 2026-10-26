from __future__ import annotations

import numpy as np
from scipy.optimize import linear_sum_assignment


def iou_matrix(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    if len(a) == 0 or len(b) == 0:
        return np.zeros((len(a), len(b)), np.float32)
    x1 = np.maximum(a[:, None, 0], b[None, :, 0])
    y1 = np.maximum(a[:, None, 1], b[None, :, 1])
    x2 = np.minimum(a[:, None, 2], b[None, :, 2])
    y2 = np.minimum(a[:, None, 3], b[None, :, 3])
    inter = np.clip(x2 - x1, 0, None) * np.clip(y2 - y1, 0, None)
    aa = ((a[:, 2] - a[:, 0]) * (a[:, 3] - a[:, 1]))[:, None]
    bb = ((b[:, 2] - b[:, 0]) * (b[:, 3] - b[:, 1]))[None, :]
    return inter / np.maximum(aa + bb - inter, 1e-6)


class _T:
    def __init__(self, tid: int, box: np.ndarray, frame: int):
        self.id, self.box, self.vel, self.last, self.hits, self.born = tid, box.astype(np.float32), np.zeros(4, np.float32), frame, 1, frame

    def predict(self, frame: int) -> np.ndarray:
        return self.box + self.vel * (frame - self.last)

    def update(self, box: np.ndarray, frame: int) -> None:
        dt = max(frame - self.last, 1)
        self.vel = 0.6 * self.vel + 0.4 * (box - self.box) / dt
        self.box, self.last = box.astype(np.float32), frame
        self.hits += 1


class ByteTracker:
    """Two-stage IoU association with constant-velocity prediction (ByteTrack scheme)."""

    def __init__(self, high: float = 0.5, match: float = 0.2, buffer: int = 36, confirm: int = 2):
        self.high, self.match, self.buffer, self.confirm = high, match, buffer, confirm
        self.tracks: list[_T] = []
        self.next = 1
        self.frame = 0

    def _assoc(self, tracks: list[_T], boxes: np.ndarray, thr: float):
        if not tracks or len(boxes) == 0:
            return [], list(range(len(tracks))), list(range(len(boxes)))
        pred = np.stack([t.predict(self.frame) for t in tracks])
        iou = iou_matrix(pred, boxes)
        r, c = linear_sum_assignment(-iou)
        pairs = [(i, j) for i, j in zip(r, c) if iou[i, j] >= thr]
        mi = {i for i, _ in pairs}
        mj = {j for _, j in pairs}
        return pairs, [i for i in range(len(tracks)) if i not in mi], [j for j in range(len(boxes)) if j not in mj]

    def update(self, boxes: np.ndarray, scores: np.ndarray) -> list[tuple[int, int]]:
        """Returns (track_id, detection_index) for confirmed tracks seen this frame."""
        self.frame += 1
        out: list[tuple[int, int]] = []
        hi = [i for i in range(len(boxes)) if scores[i] >= self.high]
        lo = [i for i in range(len(boxes)) if scores[i] < self.high]
        alive = [t for t in self.tracks if self.frame - t.last <= self.buffer]
        pairs, rest_t, rest_h = self._assoc(alive, boxes[hi], self.match)
        for ti, hj in pairs:
            alive[ti].update(boxes[hi[hj]], self.frame)
            out.append((alive[ti].id, hi[hj]))
        rest_tr = [alive[i] for i in rest_t]
        pairs2, rest_t2, _ = self._assoc(rest_tr, boxes[lo], 0.4)
        for ti, lj in pairs2:
            rest_tr[ti].update(boxes[lo[lj]], self.frame)
            out.append((rest_tr[ti].id, lo[lj]))
        for hj in rest_h:
            t = _T(self.next, boxes[hi[hj]], self.frame)
            self.next += 1
            self.tracks.append(t)
            out.append((t.id, hi[hj]))
        self.tracks = alive + [t for t in self.tracks if t not in alive and self.frame - t.last <= self.buffer]
        return [(tid, j) for tid, j in out if self._by_id(tid).hits >= self.confirm or self._by_id(tid).born == 1]

    def _by_id(self, tid: int) -> _T:
        for t in self.tracks:
            if t.id == tid:
                return t
        raise KeyError(tid)
