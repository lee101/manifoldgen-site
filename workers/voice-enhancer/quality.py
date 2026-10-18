"""Objective quality signals: Meta audiobox-aesthetics (CE/CU/PC/PQ, 1-10) and loudness."""
from __future__ import annotations

import numpy as np

_PREDICTOR = None


def aesthetics(audio: np.ndarray, sr: int) -> dict:
    """Content enjoyment, content usefulness, production complexity, production quality."""
    global _PREDICTOR
    import torch
    if _PREDICTOR is None:
        from audiobox_aesthetics.infer import initialize_predictor
        _PREDICTOR = initialize_predictor()
    wav = torch.from_numpy(np.ascontiguousarray((audio.T if audio.ndim == 2 else audio[None]).astype(np.float32)))
    out = _PREDICTOR.forward([{"path": wav, "sample_rate": sr}])[0]
    return {k: round(float(v), 2) for k, v in out.items()}


def loudness(audio: np.ndarray, sr: int) -> dict:
    import pyloudnorm
    meter = pyloudnorm.Meter(sr)
    peak = float(np.abs(audio).max())
    return {"lufs": round(float(meter.integrated_loudness(audio)), 2), "peak_dbfs": round(20 * np.log10(peak + 1e-12), 2)}
