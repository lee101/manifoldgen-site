from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

import numpy as np

from . import beats as beatmod
from . import sfx
from .signals import Signals, intensity_curve


def _hits_curve(sig: Signals, n: int, sr: int) -> np.ndarray:
    return np.interp(np.arange(n) / sr, np.arange(sig.frames) / sig.fps, sig.energy).astype(np.float32)


def drum_bed(sig: Signals, duration: float, bpm_default: float = 112.0) -> np.ndarray:
    """Beat-locked drums whose density and level follow the motion energy, plus SFX on every detected strike."""
    bpm = sig.bpm if sig.bpm >= 80 else bpm_default
    period = 60.0 / bpm
    beats = sig.beats if sig.bpm >= 80 and sig.beats else list(np.arange(0.0, duration, period))
    buf = np.zeros((int(sfx.SR * (duration + 0.8)), 2), np.float32)
    env = _hits_curve(sig, len(buf), sfx.SR)
    for i, b in enumerate(beats):
        if b >= duration:
            break
        e = float(env[min(int(b * sfx.SR), len(env) - 1)])
        sfx.place(buf, sfx.kick(), b, 0.45 + 0.5 * min(e, 1.0))
        if e > 0.25:
            sfx.place(buf, sfx.hat(i), b + period / 2, 0.5 + 0.7 * min(e, 1.0))
        if e > 0.55:
            sfx.place(buf, sfx.hat(i + 100), b + period / 4, 0.4)
            sfx.place(buf, sfx.hat(i + 200), b + 3 * period / 4, 0.4)
        if i % 2 == 1 and e > 0.2:
            sfx.place(buf, sfx.impact(0.35 + 0.3 * e, seed=i)[: int(sfx.SR * 0.22)] * 0.55, b, 0.6)
    items = []
    for ev in sig.events:
        if ev.t < duration:
            items.append(("impact" if ev.kind == "impact" else "strike", ev.t, ev.power, 0.0))
    hit = sfx.mix_events(duration, items)
    n = min(len(hit), len(buf))
    buf[:n] += hit[:n] * 1.1
    peak = float(np.abs(buf).max())
    if peak > 0.95:
        buf *= 0.95 / peak
    return buf[: int(sfx.SR * duration)]


def music_prompt(sig: Signals, style: str = "") -> str:
    curve = intensity_curve(sig, 2.0)
    avg = float(np.mean(curve)) if curve else 0.0
    feel = "relentless, high intensity" if avg > 0.5 else "tense, building"
    bpm = int(round(sig.bpm)) if sig.bpm >= 80 else 112
    base = f"{bpm} BPM martial arts action score, {feel}, taiko drums, driving percussion, hits on beat"
    return f"{style}, {base}" if style else base


def fit_music(music: str, sig: Signals, duration: float) -> tuple[np.ndarray, dict]:
    """Time-stretch (<= +-12%) and phase-shift a track so its beat grid lands on the motion beat grid."""
    x = beatmod.decode(music)
    feats = beatmod.analyze_audio(x)
    info = {"music_bpm": round(feats.bpm, 1), "motion_bpm": round(sig.bpm, 1), "stretch": 1.0, "shift": 0.0}
    ratio = 1.0
    if feats.bpm > 0 and sig.bpm > 0:
        r = sig.bpm / feats.bpm
        for k in (1.0, 2.0, 0.5):
            if abs(r * k - 1) <= 0.12:
                ratio = r * k
                break
    with tempfile.TemporaryDirectory() as td:
        out = Path(td) / "m.wav"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", music, "-vn", "-filter:a", f"atempo={ratio:.4f}", "-ac", "2", "-ar", str(sfx.SR), str(out)], check=True)
        raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(out), "-f", "f32le", "-"], capture_output=True).stdout
    a = np.frombuffer(raw, np.float32).reshape(-1, 2)
    shift = 0.0
    if feats.beats and sig.beats and sig.bpm > 0:
        period = 60.0 / sig.bpm
        mb = feats.beats[0] / ratio
        shift = (sig.beats[0] - mb) % period
        if shift > period / 2:
            shift -= period
    info["stretch"], info["shift"] = round(ratio, 4), round(shift, 3)
    n = int(sfx.SR * duration)
    out_buf = np.zeros((n, 2), np.float32)
    if shift >= 0:
        s0 = int(shift * sfx.SR)
        m = min(n - s0, len(a))
        if m > 0:
            out_buf[s0:s0 + m] = a[:m]
    else:
        s0 = int(-shift * sfx.SR)
        m = min(n, len(a) - s0)
        if m > 0:
            out_buf[:m] = a[s0:s0 + m]
    fade = int(sfx.SR * 0.6)
    out_buf[-fade:] *= np.linspace(1, 0, fade)[:, None] if n > fade else 1
    return out_buf, info


def duck(music: np.ndarray, sig: Signals, depth: float = 0.45) -> np.ndarray:
    g = np.ones(len(music), np.float32)
    for ev in sig.events:
        if ev.kind != "impact":
            continue
        i = int(ev.t * sfx.SR)
        n = int(sfx.SR * 0.28)
        if i < len(g):
            seg = np.minimum(g[i:i + n], 1 - depth * np.exp(-np.arange(min(n, len(g) - i)) / (sfx.SR * 0.1)))
            g[i:i + len(seg)] = seg
    return music * g[:, None]


def score(video: str, out: str, sig: Signals, duration: float, *, music: str | None = None, keep_audio: bool = False) -> dict:
    bed = drum_bed(sig, duration)
    info = {}
    mix = bed
    if music:
        m, info = fit_music(music, sig, duration)
        m = duck(m, sig)
        mix = bed * 0.8 + m * 0.75
    peak = float(np.abs(mix).max())
    if peak > 0.97:
        mix = mix * (0.97 / peak)
    with tempfile.TemporaryDirectory() as td:
        wav = Path(td) / "score.wav"
        sfx.write_wav(str(wav), mix)
        cmd = ["ffmpeg", "-v", "error", "-y", "-i", video, "-i", str(wav)]
        if keep_audio:
            cmd += ["-filter_complex", "[0:a]volume=0.5[o];[o][1:a]amix=inputs=2:duration=first:normalize=0[a]", "-map", "0:v", "-map", "[a]"]
        else:
            cmd += ["-map", "0:v", "-map", "1:a"]
        cmd += ["-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", f"{duration:.3f}", "-movflags", "+faststart", out]
        subprocess.run(cmd, check=True, capture_output=True)
        Path(out).with_suffix(".wav").write_bytes(wav.read_bytes())
    return {"bpm": round(sig.bpm, 1), "beats": len(sig.beats), "hits": len(sig.events), "music": info, "prompt": music_prompt(sig)}
