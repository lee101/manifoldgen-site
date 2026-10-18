"""Beat grids and elastic beat-locking of a free-time vocal onto an instrumental.

An a cappella rap take drifts: the reference take wanders 82-106 BPM. Laying it
over a steady beat as-is puts every line off the pocket within a bar or two. We
instead anchor word onsets to 16th-note slots of the beat's own grid with a
dynamic program that prefers small, smooth stretches inside a phrase and spends
the large corrections in the pauses, then render each phrase with Rubber Band
(formant preserving) and place it at its exact grid time.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

SUBDIV = 4  # 16th notes per beat


def track_beats(audio: np.ndarray, sr: int, device: str = "cuda") -> tuple[np.ndarray, np.ndarray]:
    """Beat and downbeat times (s) with beat_this."""
    from beat_this.inference import Audio2Beats
    mono = audio.mean(1) if audio.ndim == 2 else audio
    beats, downbeats = Audio2Beats(checkpoint_path="final0", device=device, dbn=False)(mono.astype(np.float32), sr)
    return np.asarray(beats, float), np.asarray(downbeats, float)


def steady_grid(bpm: float, start: float, duration: float) -> tuple[np.ndarray, np.ndarray]:
    period = 60.0 / bpm
    beats = start + period * np.arange(int((duration - start) / period) + 1)
    return beats, beats[::4]


def sixteenths(beats: np.ndarray, downbeats: np.ndarray, until: float) -> np.ndarray:
    """16th-note times from the first downbeat, extrapolated past the last tracked beat."""
    first = downbeats[0] if len(downbeats) else beats[0]
    b = beats[beats >= first - 1e-3]
    period = float(np.median(np.diff(b[-17:]))) if len(b) > 2 else 60 / 95
    while b[-1] < until + 4 * period:
        b = np.append(b, b[-1] + period)
    steps = np.diff(b)[:, None] * (np.arange(SUBDIV)[None] / SUBDIV)
    return np.concatenate([(b[:-1, None] + steps).ravel(), b[-1:]])


def local_bpm(onsets: np.ndarray, lo: float = 70, hi: float = 180) -> float:
    """Tempo whose 16th grid best explains the onsets (phase-free circular fit)."""
    bpms = np.arange(lo, hi, 0.1)
    fit = [abs(np.exp(2j * np.pi * onsets * b * SUBDIV / 60).mean()) for b in bpms]
    return float(bpms[int(np.argmax(fit))])


def vocal_bpm(onsets: np.ndarray, window: float = 16.0, lo: float = 80, hi: float = 110) -> float:
    """Median windowed tempo. Rap tempos fold into 80-110 (half-time trap counts the same)."""
    found = []
    for t0 in np.arange(onsets[0], onsets[-1] - window / 2, window * 0.75):
        sel = onsets[(onsets >= t0) & (onsets < t0 + window)]
        if len(sel) >= 12:
            found.append(local_bpm(sel, lo, hi))
    return float(np.median(found)) if found else 95.0


def refine_onsets(vocal: np.ndarray, sr: int, starts: np.ndarray, before: float = 0.06, after: float = 0.04) -> np.ndarray:
    """Snap rough ASR word starts to the strongest nearby acoustic onset."""
    import librosa
    hop = sr // 200
    env = librosa.onset.onset_strength(y=vocal.astype(np.float32), sr=sr, hop_length=hop)
    out = starts.copy()
    floor = np.percentile(env, 75)
    for i, s in enumerate(starts):
        a, b = int((s - before) * 200), int((s + after) * 200)
        a, b = max(a, 0), min(b, len(env))
        if b > a and env[a:b].max() > floor:
            out[i] = (a + int(np.argmax(env[a:b]))) / 200
    return np.maximum.accumulate(out)


@dataclass
class Anchor:
    t: float          # input onset
    k: int            # grid slot
    T: float          # output onset


def align(onsets: np.ndarray, pauses: np.ndarray, grid: np.ndarray, first_slot: int,
          speech_limits=(0.8, 1.25), pause_limits=(0.3, 3.5), max_skip: int = 3,
          offbeat_cost: float = 0.08, phrase_offbeat_cost: float = 0.6, skip_cost: float = 0.35) -> list[Anchor]:
    """Monotone onset -> 16th slot assignment by dynamic programming.

    ``pauses[i]`` is True when a breath/pause precedes onset i; those intervals can
    stretch a lot. Words that would need extreme stretching may be skipped (left
    unanchored and carried by their neighbours) at ``skip_cost`` each.
    """
    n, K = len(onsets), len(grid)
    inf = np.inf
    D = np.full((n, K), inf)
    back_j = np.full((n, K), -1, dtype=np.int32)
    back_k = np.full((n, K), -1, dtype=np.int32)
    slot = np.arange(K)
    onbeat = (slot % SUBDIV) == 0
    position = np.where(slot % 2 == 1, offbeat_cost, 0.0)
    D[0, first_slot] = 0.0
    g16 = float(np.median(np.diff(grid)))
    for i in range(1, n):
        phrase = position + np.where(pauses[i] & ~onbeat, phrase_offbeat_cost, 0.0)
        for j in range(max(0, i - 1 - max_skip), i):
            dt = onsets[i] - onsets[j]
            if dt <= 0.02:
                continue
            gap = bool(pauses[j + 1:i + 1].any())
            lo, hi = pause_limits if gap else speech_limits
            weight = 0.15 if gap else 1.0
            dk_lo = max(1, int(np.floor(dt * lo / g16)))
            dk_hi = min(K - 1, int(np.ceil(dt * hi / g16)) + 1)
            prev = D[j]
            for dk in range(dk_lo, dk_hi + 1):
                r = (grid[dk:] - grid[:-dk]) / dt
                ok = (r >= lo) & (r <= hi)
                cost = prev[:-dk] + weight * np.log(np.clip(r, 1e-3, None)) ** 2 * 6 + phrase[dk:] + skip_cost * (i - j - 1)
                cost = np.where(ok, cost, inf)
                better = cost < D[i, dk:]
                if better.any():
                    D[i, dk:] = np.where(better, cost, D[i, dk:])
                    back_j[i, dk:] = np.where(better, j, back_j[i, dk:])
                    back_k[i, dk:] = np.where(better, slot[:-dk], back_k[i, dk:])
    # Allow dropping up to max_skip trailing words.
    tail = range(max(0, n - 1 - max_skip), n)
    i = min(tail, key=lambda r: D[r].min() + skip_cost * (n - 1 - r))
    if not np.isfinite(D[i].min()):
        raise RuntimeError("no feasible beat alignment; widen stretch limits")
    k = int(np.argmin(D[i]))
    path = []
    while i >= 0 and k >= 0:
        path.append(Anchor(float(onsets[i]), k, float(grid[k])))
        i, k = int(back_j[i, k]), int(back_k[i, k])
    return path[::-1]


def time_map(anchors: list[Anchor]) -> tuple[np.ndarray, np.ndarray]:
    t = np.array([a.t for a in anchors])
    T = np.array([a.T for a in anchors])
    return t, T


def render(vocal: np.ndarray, sr: int, anchors: list[Anchor], phrases: list[tuple[float, float]],
           out_seconds: float, lead: float = 0.03) -> np.ndarray:
    """Warp each phrase through the anchor time map and drop it at its grid time.

    Phrases are separated by silence, so placing them independently costs nothing
    audible and stops Rubber Band's block quantisation from accumulating drift.
    """
    import pedalboard
    t, T = time_map(anchors)
    channels = vocal.shape[1] if vocal.ndim == 2 else 1
    x = vocal.reshape(len(vocal), channels)
    out = np.zeros((int(out_seconds * sr) + sr, channels), np.float32)
    for start, end in phrases:
        a, b = max(0.0, start - lead), end + 0.12
        inside = (t >= a) & (t <= b)
        if inside.sum() == 0:
            # No anchor: keep natural timing relative to the nearest anchor.
            near = int(np.argmin(np.abs(t - start)))
            out_a = T[near] + (a - t[near])
            seg = x[int(a * sr):int(b * sr)]
        else:
            ti, Ti = t[inside], T[inside]
            # Edge pieces keep the neighbouring interval's ratio.
            ratio_in = (Ti[1] - Ti[0]) / (ti[1] - ti[0]) if len(ti) > 1 else 1.0
            ratio_out = (Ti[-1] - Ti[-2]) / (ti[-1] - ti[-2]) if len(ti) > 1 else 1.0
            pts_t = np.concatenate([[a], ti, [b]])
            pts_T = np.concatenate([[Ti[0] - (ti[0] - a) * ratio_in], Ti, [Ti[-1] + (b - ti[-1]) * ratio_out]])
            seg = x[int(a * sr):int(b * sr)]
            n = len(seg)
            if n < sr // 20:
                continue
            sample_t = a + np.arange(n) / sr
            idx = np.clip(np.searchsorted(pts_t, sample_t, side="right") - 1, 0, len(pts_t) - 2)
            ratio = (pts_T[idx + 1] - pts_T[idx]) / (pts_t[idx + 1] - pts_t[idx])
            speed = (1.0 / np.clip(ratio, 0.25, 4.0)).astype(np.float64)
            if np.abs(speed - 1).max() > 0.005:
                seg = pedalboard.time_stretch(np.ascontiguousarray(seg.T.astype(np.float32)), sr, speed,
                                              high_quality=True, transient_mode="crisp",
                                              preserve_formants=True).T
            out_a = pts_T[0]
        i0 = int(round(out_a * sr))
        if i0 < 0:
            seg, i0 = seg[-i0:], 0
        seg = seg[:len(out) - i0]
        fade = min(int(0.008 * sr), len(seg) // 4)
        if fade > 1:
            ramp = np.linspace(0, 1, fade)[:, None]
            seg = seg.copy()
            seg[:fade] *= ramp
            seg[-fade:] *= ramp[::-1]
        out[i0:i0 + len(seg)] += seg
    return out[:int(out_seconds * sr)]


def phrases_from_words(words: list[dict], gap: float = 0.25) -> list[tuple[float, float]]:
    out = []
    for w in words:
        if out and w["s"] - out[-1][1] <= gap:
            out[-1][1] = max(out[-1][1], w["e"])
        else:
            out.append([w["s"], w["e"]])
    return [tuple(p) for p in out]


def pocket(onsets: np.ndarray, grid: np.ndarray) -> dict:
    """How tightly onsets sit on the 16th grid (ms error), for reports."""
    idx = np.clip(np.searchsorted(grid, onsets), 1, len(grid) - 1)
    err = np.minimum(np.abs(onsets - grid[idx - 1]), np.abs(grid[idx] - onsets)) * 1000
    return {"median_ms": round(float(np.median(err)), 1), "p90_ms": round(float(np.percentile(err, 90)), 1),
            "within_30ms": round(float((err < 30).mean()), 3)}
