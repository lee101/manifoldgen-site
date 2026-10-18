"""Zero-shot singing voice conversion (Seed-VC v1, 44.1 kHz, f0-conditioned).

Used by regen mode to put the singer's own timbre on YuE's re-performance.
Variant study on a 40 s rap excerpt (WER vs the source excerpt / speaker sim
resemblyzer, wavlm-sv against the singer): v1 SVC 40 steps cfg 0.7 scored
0.169 / 0.89 / 0.90; 80 steps cfg 0.5 0.209; the 22 kHz speech VC model 0.244;
v2 0.36, v2 with style conversion 0.71. Unconverted YuE scored 0.70 / 0.78.
"""
from __future__ import annotations

import os
from pathlib import Path
import subprocess
import tempfile

import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
SEED_VC = Path(os.getenv("SEED_VC_DIR", HERE / "tools" / "seed-vc"))


def reference_clip(clean: np.ndarray, sr: int, words: list[dict], seconds: float = 24.0) -> np.ndarray:
    """Densest-speech window of the singer's clean vocal (Seed-VC keeps ~25 s of reference)."""
    starts = np.array([w["s"] for w in words])
    best, best_count = 0.0, -1
    for t0 in np.arange(0, max(0.1, len(clean) / sr - seconds), 0.5):
        count = int(((starts >= t0) & (starts < t0 + seconds)).sum())
        if count > best_count:
            best, best_count = t0, count
    return clean[int(best * sr):int((best + seconds) * sr)]


def convert(source: np.ndarray, reference: np.ndarray, sr: int, steps: int = 40, cfg: float = 0.7,
            semitones: int = 0) -> np.ndarray:
    with tempfile.TemporaryDirectory(prefix="ve-svc-") as directory:
        d = Path(directory)
        sf.write(d / "source.wav", source.mean(1) if source.ndim == 2 else source, sr, subtype="FLOAT")
        sf.write(d / "reference.wav", reference.mean(1) if reference.ndim == 2 else reference, sr, subtype="FLOAT")
        run = subprocess.run([str(SEED_VC / ".venv" / "bin" / "python"), "inference.py",
                        "--source", str(d / "source.wav"), "--target", str(d / "reference.wav"),
                        "--output", str(d / "out"), "--diffusion-steps", str(steps),
                        "--inference-cfg-rate", str(cfg), "--f0-condition", "True",
                        "--auto-f0-adjust", "False", "--semi-tone-shift", str(semitones),
                        "--length-adjust", "1.0", "--fp16", "True"],
                       cwd=SEED_VC, capture_output=True, text=True)
        if run.returncode:
            raise RuntimeError("seed-vc failed: " + run.stderr[-1500:])
        out = next((d / "out").glob("*.wav"))
        y, out_sr = sf.read(out, dtype="float32", always_2d=True)
    if out_sr != sr:
        import librosa
        y = librosa.resample(y.T, orig_sr=out_sr, target_sr=sr).T
    y = y.mean(1)
    n = len(source)
    return np.pad(y, (0, max(0, n - len(y))))[:n].astype(np.float32)


def swap_vocal(song: np.ndarray, original_vocal: np.ndarray, new_vocal: np.ndarray, sr: int) -> np.ndarray:
    """Replace the vocal inside the generated master, keeping its instrumental and balance.

    The new vocal follows the original's loudness envelope (80 ms) so the model's
    own mix decisions (drops, ad-lib levels) survive the swap.
    """
    from scipy.ndimage import uniform_filter1d
    inst = song - original_vocal
    win = int(0.08 * sr)
    e_old = np.sqrt(uniform_filter1d(original_vocal.mean(1) ** 2, win) + 1e-10)
    e_new = np.sqrt(uniform_filter1d(new_vocal ** 2, win) + 1e-10)
    gain = np.clip(e_old / e_new, 0.1, 4.0)
    gain = uniform_filter1d(gain, int(0.03 * sr))
    return (inst + (new_vocal * gain)[:, None]).astype(np.float32)
