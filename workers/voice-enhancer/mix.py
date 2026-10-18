"""Beat fitting, vocal-over-beat mix, and loudness mastering."""
from __future__ import annotations

import numpy as np


def _lufs(x: np.ndarray, sr: int) -> float:
    import pyloudnorm
    value = pyloudnorm.Meter(sr).integrated_loudness(x.astype(np.float64))
    return float(value) if np.isfinite(value) else -70.0


def fit_beat(beat: np.ndarray, sr: int, downbeats: np.ndarray, start_bar: float, need_seconds: float,
             tail_bars: int = 2) -> np.ndarray:
    """Trim the beat to whole bars covering the vocal, looping middle bars if it is short.

    ``start_bar`` is the beat time that becomes t=0 of the output (a downbeat).
    """
    bars = downbeats[downbeats >= start_bar - 1e-3]
    bar_len = float(np.median(np.diff(bars))) if len(bars) > 1 else 2.5
    out = beat[int(start_bar * sr):]
    end_needed = need_seconds + tail_bars * bar_len
    if len(out) / sr < end_needed and len(bars) > 9:
        # Loop the last 8 full bars (skip the beat's own outro) with an equal-power seam.
        loop_a, loop_b = bars[-9] - start_bar, bars[-1] - start_bar
        body = out[:int(loop_b * sr)]
        loop = out[int(loop_a * sr):int(loop_b * sr)]
        fade = int(0.02 * sr)
        ramp = np.sqrt(np.linspace(0, 1, fade))[:, None]
        while len(body) / sr < end_needed:
            seam = body[-fade:] * ramp[::-1] + loop[:fade] * ramp
            body = np.concatenate([body[:-fade], seam, loop[fade:]])
        out = body
    # End on the first downbeat after the vocal plus tail bars, with a release.
    rel = bars - start_bar
    after = rel[rel >= need_seconds]
    cut = (after[min(tail_bars, len(after) - 1)] if len(after) else len(out) / sr)
    out = out[:int(min(cut + 1.5, len(out) / sr) * sr)].copy()
    fade_n = min(int(1.5 * sr), len(out))
    out[-fade_n:] *= np.linspace(1, 0, fade_n)[:, None] ** 2
    return out


def end_after(song: np.ndarray, sr: int, last_word: float, downbeats: np.ndarray, tail_bars: int = 2,
              fade_bars: float = 1.0) -> np.ndarray:
    """Close the song a couple of bars after the last lyric, landing the fade on a bar line."""
    bar = float(np.median(np.diff(downbeats))) if len(downbeats) > 1 else 2.5
    later = downbeats[downbeats > last_word + 0.25]
    cut = later[min(tail_bars, len(later) - 1)] if len(later) else last_word + tail_bars * bar
    cut = min(cut + fade_bars * bar, len(song) / sr)
    out = song[:int(cut * sr)].copy()
    n = min(int(fade_bars * bar * sr), len(out))
    out[-n:] *= (np.linspace(1, 0, n) ** 2)[:, None]
    return out


def duck(beat: np.ndarray, vocal: np.ndarray, sr: int, depth_db: float = 2.5) -> np.ndarray:
    """Sidechain the beat's midrange under the vocal so words cut through the 808s."""
    from scipy.ndimage import uniform_filter1d
    from scipy.signal import butter, sosfiltfilt
    n = min(len(beat), len(vocal))
    beat, vocal = beat[:n], vocal[:n]
    env = uniform_filter1d(np.abs(vocal.mean(1)), int(0.03 * sr))
    env = env / (np.percentile(env, 95) + 1e-9)
    gain = 10 ** (-depth_db * np.clip(env, 0, 1) / 20)
    gain = uniform_filter1d(gain, int(0.08 * sr))[:, None]
    lo = sosfiltfilt(butter(2, 280, "low", fs=sr, output="sos"), beat, axis=0)
    hi = sosfiltfilt(butter(2, 5500, "high", fs=sr, output="sos"), beat, axis=0)
    mid = beat - lo - hi
    return (lo + hi + mid * gain).astype(np.float32)


def master(mix: np.ndarray, sr: int, target_lufs: float = -9.0, ceiling_db: float = -1.0) -> np.ndarray:
    from pedalboard import Compressor, Gain, HighpassFilter, Limiter, Pedalboard
    glue = Pedalboard([HighpassFilter(28), Compressor(threshold_db=-16, ratio=2.0, attack_ms=20, release_ms=180)])
    x = glue(np.ascontiguousarray(mix.T), sr)
    # Limiting changes loudness, so iterate the pre-limiter gain on the measured miss.
    gain = target_lufs - _lufs(x.T, sr)
    for _ in range(4):
        y = Pedalboard([Gain(gain), Limiter(threshold_db=ceiling_db, release_ms=80)])(x, sr)
        miss = target_lufs - _lufs(y.T, sr)
        if abs(miss) < 0.2:
            break
        gain += miss
    # Hard ceiling against inter-sample overs from the limiter's lookahead edge.
    return np.clip(y.T, -10 ** (ceiling_db / 20), 10 ** (ceiling_db / 20)).astype(np.float32)


def mix_song(beat: np.ndarray, stems: dict[str, np.ndarray], sr: int, vocal_over_beat_db: float = 2.0,
             target_lufs: float = -9.0) -> tuple[np.ndarray, dict]:
    n = len(beat)
    pad = {k: np.pad(v, ((0, max(0, n - len(v))), (0, 0)))[:n] for k, v in stems.items()}
    vocal_bus = pad["lead"] + pad["doubles"] + pad["space"]
    active = np.abs(pad["lead"].mean(1)) > 1e-4
    beat_level = _lufs(beat, sr)
    vocal_level = _lufs(vocal_bus[active], sr) if active.any() else -70
    vocal_bus = vocal_bus * 10 ** ((beat_level + vocal_over_beat_db - vocal_level) / 20)
    ducked = duck(beat, vocal_bus, sr)
    mixed = master(ducked + vocal_bus, sr, target_lufs)
    return mixed, {"beat_lufs": round(beat_level, 2), "vocal_gain_db": round(beat_level + vocal_over_beat_db - vocal_level, 2)}
