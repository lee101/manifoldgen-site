from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from scipy.ndimage import gaussian_filter1d
from scipy.signal import find_peaks

from .track import EFFECTORS, TrackSet


@dataclass
class Event:
    frame: int
    t: float
    track: int
    joint: int
    x: float
    y: float
    speed: float
    kind: str
    target: int | None = None
    power: float = 0.0

    def to_json(self) -> dict:
        return {"frame": self.frame, "t": round(self.t, 3), "track": self.track, "joint": self.joint,
                "x": round(self.x, 1), "y": round(self.y, 1), "speed": round(self.speed, 2), "kind": self.kind,
                "target": self.target, "power": round(self.power, 3)}


@dataclass
class Signals:
    fps: float
    frames: int
    energy: np.ndarray
    track_energy: dict[int, np.ndarray]
    speeds: dict[int, np.ndarray]
    events: list[Event] = field(default_factory=list)
    bpm: float = 0.0
    beats: list[float] = field(default_factory=list)

    def to_json(self) -> dict:
        return {"fps": self.fps, "frames": self.frames, "bpm": round(self.bpm, 1),
                "beats": [round(b, 3) for b in self.beats],
                "energy": np.round(self.energy, 3).tolist(),
                "events": [e.to_json() for e in self.events]}


def _torso_center(kp: np.ndarray) -> np.ndarray:
    return (kp[:, 5] + kp[:, 6] + kp[:, 11] + kp[:, 12]) / 4.0


def analyze(ts: TrackSet, *, min_power: float = 0.35) -> Signals:
    fps, n = ts.fps, ts.frames
    speeds: dict[int, np.ndarray] = {}
    track_energy: dict[int, np.ndarray] = {}
    energy = np.zeros(n, np.float32)
    for t in ts.tracks:
        scale = max(t.scale(), 1.0)
        v = np.zeros((len(t.kp), 17), np.float32)
        d = np.diff(t.kp, axis=0, prepend=t.kp[:1])
        v = np.linalg.norm(d, axis=2) * fps / scale
        valid = t.valid
        v[~valid] = 0
        v[1:][~(valid[1:] & valid[:-1])] = 0
        v = gaussian_filter1d(v, 1.0, axis=0)
        full = np.zeros((n, 17), np.float32)
        full[t.first:t.first + len(v)] = v
        speeds[t.id] = full
        te = full[:, [7, 8, 9, 10, 13, 14, 15, 16]].sum(axis=1)
        track_energy[t.id] = te
        energy += te
    peak = float(np.percentile(energy[energy > 0], 98)) if (energy > 0).any() else 1.0
    energy = np.clip(energy / max(peak, 1e-6), 0, 1.5)
    energy = gaussian_filter1d(energy, 1.5)
    events = _events(ts, speeds, min_power)
    bpm, beats = _tempo(energy, fps)
    return Signals(fps, n, energy, track_energy, speeds, events, bpm, beats)


def _events(ts: TrackSet, speeds: dict[int, np.ndarray], min_power: float) -> list[Event]:
    fps = ts.fps
    allpeaks = []
    for tid, sp in speeds.items():
        for j in EFFECTORS:
            allpeaks.append(float(np.percentile(sp[:, j][sp[:, j] > 0], 95)) if (sp[:, j] > 0).any() else 0.0)
    ref = max(float(np.median([p for p in allpeaks if p > 0])) if any(p > 0 for p in allpeaks) else 1.0, 0.5)
    by_id = {t.id: t for t in ts.tracks}
    raw: list[Event] = []
    for tid, sp in speeds.items():
        t = by_id[tid]
        for j in EFFECTORS:
            s = sp[:, j]
            pk, props = find_peaks(s, height=ref * 0.8, prominence=ref * 0.5, distance=max(2, int(fps * 0.2)))
            for p in pk:
                end = p
                while end + 1 < len(s) - 1 and s[end + 1] < s[end] and s[end] > 0.5 * s[p]:
                    end += 1
                f = int(min(len(s) - 1, max(p, end)))
                if not t.at(f):
                    f = int(p)
                if not t.at(f):
                    continue
                x, y = t.kp_at(f)[j]
                target = _nearest_target(ts, t, f, x, y)
                power = float(min(1.5, s[p] / (ref * 1.6)))
                if power < min_power:
                    continue
                raw.append(Event(f, f / fps, tid, j, float(x), float(y), float(s[p]), "impact" if target else "strike", target, power))
    raw.sort(key=lambda e: e.frame)
    merged: list[Event] = []
    for e in raw:
        if merged and e.frame - merged[-1].frame <= max(2, int(fps * 0.15)):
            if e.power > merged[-1].power:
                merged[-1] = e
            continue
        merged.append(e)
    return merged


def _nearest_target(ts: TrackSet, owner, f: int, x: float, y: float) -> int | None:
    best, bd = None, 1e9
    for o in ts.active(f):
        if o.id == owner.id:
            continue
        b = o.box_at(f)
        pad = 0.06 * (b[3] - b[1])
        if b[0] - pad <= x <= b[2] + pad and b[1] - pad <= y <= b[3] + pad:
            c = _torso_center(o.kp_at(f)[None])[0]
            d = float(np.hypot(c[0] - x, c[1] - y))
            if d < bd:
                best, bd = o.id, d
    return best


def _tempo(energy: np.ndarray, fps: float) -> tuple[float, list[float]]:
    if len(energy) < int(fps * 2) or energy.max() <= 0:
        return 0.0, []
    onset = np.maximum(np.diff(energy, prepend=energy[0]), 0)
    onset = gaussian_filter1d(onset, 1.0)
    lo, hi = int(fps * 60 / 180), int(fps * 60 / 70)
    ac = np.correlate(onset - onset.mean(), onset - onset.mean(), "full")[len(onset) - 1:]
    if hi >= len(ac):
        return 0.0, []
    lag = lo + int(np.argmax(ac[lo:hi + 1]))
    bpm = 60.0 * fps / lag
    while bpm < 80:
        bpm *= 2
    while bpm > 170:
        bpm /= 2
    period = 60.0 / bpm
    best, phase = -1.0, 0.0
    for ph in np.linspace(0, period, 24, endpoint=False):
        grid = np.arange(ph, len(onset) / fps, period)
        idx = np.clip((grid * fps).astype(int), 0, len(onset) - 1)
        score = float(onset[idx].sum())
        if score > best:
            best, phase = score, float(ph)
    beats = list(np.arange(phase, len(onset) / fps, period))
    return float(bpm), [float(b) for b in beats]


def intensity_curve(sig: Signals, out_fps: float = 4.0) -> list[float]:
    n = int(sig.frames / sig.fps * out_fps)
    xs = np.linspace(0, sig.frames - 1, max(n, 1))
    return [round(float(np.interp(x, np.arange(sig.frames), sig.energy)), 3) for x in xs]


def combos(events: list[Event], window: float = 1.2) -> list[tuple[int, int, int]]:
    """(frame, attacker, hits so far) for each impact; the count resets after `window` seconds idle per attacker."""
    out, last, count = [], {}, {}
    for e in events:
        if e.kind != "impact":
            continue
        if e.track in last and e.t - last[e.track] > window:
            count[e.track] = 0
        count[e.track] = count.get(e.track, 0) + 1
        last[e.track] = e.t
        out.append((e.frame, e.track, count[e.track]))
    return out


def fight_stats(ts: TrackSet, sig: Signals) -> dict:
    """Per-fighter and overall numbers for analytics and caption/HUD use."""
    per = {}
    for t in ts.tracks:
        own = [e for e in sig.events if e.track == t.id]
        taken = [e for e in sig.events if e.target == t.id]
        sp = sig.speeds.get(t.id)
        top = float(np.max(sp[:, list(EFFECTORS)])) if sp is not None and sp.size else 0.0
        c = [x for x in combos(sig.events) if x[1] == t.id]
        per[str(t.id)] = {
            "frames": int(t.valid.sum()), "strikes": len(own), "impacts": sum(e.kind == "impact" for e in own),
            "hits_taken": len(taken), "avg_power": round(float(np.mean([e.power for e in own])), 3) if own else 0.0,
            "top_speed": round(top, 2), "best_combo": max((x[2] for x in c), default=0),
            "active_seconds": round(float(t.valid.sum()) / ts.fps, 2),
        }
    peak = int(np.argmax(sig.energy)) if len(sig.energy) else 0
    return {"fighters": per, "total_strikes": len(sig.events), "total_impacts": sum(e.kind == "impact" for e in sig.events),
            "peak_intensity_t": round(peak / ts.fps, 2), "bpm": round(sig.bpm, 1),
            "most_active": max(per, key=lambda k: per[k]["strikes"] + per[k]["impacts"], default=None)}
