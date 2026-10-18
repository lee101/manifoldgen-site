"""Vocal restoration (neural) and a studio rap-vocal chain (DSP)."""
from __future__ import annotations

import os
from pathlib import Path
import tempfile

import numpy as np
import soundfile as sf

MODEL_DIR = Path(os.getenv("VE_SEPARATOR_DIR", Path.home() / ".cache" / "audio-separator"))
ISOLATE = "vocals_mel_band_roformer.ckpt"
DEREVERB = "dereverb_mel_band_roformer_less_aggressive_anvuew_sdr_18.8050.ckpt"
DENOISE = "denoise_mel_band_roformer_aufr33_sdr_27.9959.ckpt"
_SEPARATORS: dict = {}


def _separate(audio: np.ndarray, sr: int, model: str, keep: str) -> np.ndarray:
    from audio_separator.separator import Separator
    with tempfile.TemporaryDirectory(prefix="ve-sep-") as directory:
        if model not in _SEPARATORS:
            sep = Separator(model_file_dir=str(MODEL_DIR), output_dir=directory, output_format="WAV",
                            sample_rate=sr, log_level=30)
            sep.load_model(model)
            _SEPARATORS[model] = sep
        sep = _SEPARATORS[model]
        sep.output_dir = directory
        sep.model_instance.output_dir = directory
        source = Path(directory) / "in.wav"
        sf.write(source, audio, sr, subtype="FLOAT")
        outputs = sep.separate(str(source))
        match = [o for o in outputs if f"({keep})" in o.lower()]
        if not match:
            raise RuntimeError(f"{model} produced {outputs}, no {keep} stem")
        y, out_sr = sf.read(Path(directory) / Path(match[0]).name, dtype="float32", always_2d=True)
    if out_sr != sr:
        raise RuntimeError("separator changed the sample rate")
    return y[:len(audio)] if len(y) >= len(audio) else np.pad(y, ((0, len(audio) - len(y)), (0, 0)))


def restore(audio: np.ndarray, sr: int, dereverb: bool = True, denoise: bool = True) -> dict[str, np.ndarray]:
    """Isolate the voice from room/bleed, then strip reverb and residual noise."""
    stages = {"input": audio}
    v = _separate(audio, sr, ISOLATE, "vocals")
    stages["isolated"] = v
    if dereverb:
        v = _separate(v, sr, DEREVERB, "noreverb")
        stages["dry"] = v
    if denoise:
        v = _separate(v, sr, DENOISE, "dry")
        stages["clean"] = v
    return stages


def _sos_split(x: np.ndarray, sr: int, hz: float) -> tuple[np.ndarray, np.ndarray]:
    """Zero-phase complementary split: low + high == x exactly."""
    from scipy.signal import butter, sosfiltfilt
    low = sosfiltfilt(butter(4, hz, "low", fs=sr, output="sos"), x, axis=0).astype(np.float32)
    return low, (x - low).astype(np.float32)


def _envelope(x: np.ndarray, sr: int, attack: float, release: float) -> np.ndarray:
    from scipy.signal import lfilter
    mag = np.abs(x).max(1) if x.ndim == 2 else np.abs(x)
    # Asymmetric follower: approximate with a fast-up / slow-down pair of one-poles.
    a_up, a_dn = np.exp(-1 / (attack * sr)), np.exp(-1 / (release * sr))
    fast = lfilter([1 - a_up], [1, -a_up], mag)
    return np.maximum(fast, lfilter([1 - a_dn], [1, -a_dn], mag)).astype(np.float32)


def ride(x: np.ndarray, sr: int, target_db: float = -20.0, max_boost: float = 9.0, max_cut: float = 9.0) -> np.ndarray:
    """Slow gain riding so quiet and shouted lines hit the compressor alike."""
    from scipy.ndimage import uniform_filter1d
    mono = x.mean(1) if x.ndim == 2 else x
    win = int(0.4 * sr)
    rms = np.sqrt(uniform_filter1d(mono.astype(np.float64) ** 2, win) + 1e-12)
    level = 20 * np.log10(rms)
    active = level > level.max() - 45
    gain_db = np.where(active, np.clip(target_db - level, -max_cut, max_boost), 0.0)
    gain_db = uniform_filter1d(gain_db, int(0.12 * sr))
    g = (10 ** (gain_db / 20)).astype(np.float32)
    return x * (g[:, None] if x.ndim == 2 else g)


def deess(x: np.ndarray, sr: int, split_hz: float = 5500, threshold_db: float = -30, ratio: float = 4.0) -> np.ndarray:
    low, high = _sos_split(x, sr, split_hz)
    env = _envelope(high, sr, 0.001, 0.05)
    over = 20 * np.log10(env + 1e-9) - threshold_db
    gain = 10 ** (-np.maximum(over, 0) * (1 - 1 / ratio) / 20)
    return low + high * (gain[:, None] if high.ndim == 2 else gain).astype(np.float32)


def rap_chain(clean: np.ndarray, sr: int, bpm: float, emphasis: list[tuple[float, float]] | None = None,
              intensity: float = 1.0) -> dict[str, np.ndarray]:
    """Lead + doubles + space, returned as stems (stereo float32) for the mixer.

    ``emphasis`` lists (start, end) seconds of line-ending words that get a louder
    stacked double, the classic hard-rap punch-in.
    """
    from pedalboard import (Chorus, Compressor, Delay, Distortion, Gain, HighpassFilter, HighShelfFilter,
                            Limiter, LowpassFilter, PeakFilter, Pedalboard, Reverb, LowShelfFilter)
    mono = clean.mean(1).astype(np.float32)
    mono = ride(mono, sr)
    tone = Pedalboard([
        HighpassFilter(90),
        LowShelfFilter(180, -1.5, 0.7),
        PeakFilter(330, -2.5, 1.0),
        PeakFilter(1000, -0.8, 1.4),
        PeakFilter(3300, 2.5 + intensity, 0.8),
        HighShelfFilter(9500, 3.0, 0.7),
    ])
    x = tone(mono[None], sr)[0]
    x = deess(x, sr)
    comp = Pedalboard([
        Compressor(threshold_db=-22, ratio=3.5, attack_ms=4, release_ms=80),
        Compressor(threshold_db=-12, ratio=6, attack_ms=0.8, release_ms=40),
        Gain(6),
    ])
    lead = comp(x[None], sr)[0]
    grit = Pedalboard([Distortion(drive_db=16), LowpassFilter(7500), HighpassFilter(200)])(lead[None], sr)[0]
    lead = lead + 0.12 * intensity * grit / (np.abs(grit).max() + 1e-9) * np.abs(lead).max()
    lead = Limiter(threshold_db=-1.5, release_ms=60)(lead[None], sr)[0]

    # Doubles: two modulated copies, panned hard, tucked under the lead.
    dbl_l = Pedalboard([Chorus(rate_hz=0.45, depth=0.12, centre_delay_ms=14, feedback=0, mix=1.0), HighpassFilter(180)])(lead[None], sr)[0]
    dbl_r = Pedalboard([Chorus(rate_hz=0.63, depth=0.15, centre_delay_ms=21, feedback=0, mix=1.0), HighpassFilter(180)])(lead[None], sr)[0]
    base = 10 ** (-13 / 20)
    gate = np.full(len(lead), base, np.float32)
    for s, e in emphasis or []:
        a, b = int(max(0, s - 0.01) * sr), int((e + 0.04) * sr)
        gate[a:b] = 10 ** (-4 / 20)
    from scipy.ndimage import uniform_filter1d
    gate = uniform_filter1d(gate, int(0.015 * sr)).astype(np.float32)
    doubles = np.stack([dbl_l * gate, dbl_r * gate], 1)

    eighth = 60.0 / bpm / 2
    send = Pedalboard([HighpassFilter(350), LowpassFilter(5000)])(lead[None], sr)[0]
    slap_l = Delay(delay_seconds=eighth, feedback=0.18, mix=1.0)(send[None], sr)[0]
    slap_r = Delay(delay_seconds=eighth * 1.5, feedback=0.12, mix=1.0)(send[None], sr)[0]
    verb = Reverb(room_size=0.32, damping=0.55, wet_level=1.0, dry_level=0.0, width=1.0)(np.stack([send, send]), sr)
    space = 10 ** (-19 / 20) * np.stack([slap_l, slap_r], 1) + 10 ** (-21 / 20) * verb.T
    return {"lead": np.stack([lead, lead], 1), "doubles": doubles, "space": space.astype(np.float32)}
