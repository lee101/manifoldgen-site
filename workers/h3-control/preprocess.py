"""Turn ordinary uploaded footage into a ControlNet video pass."""

from __future__ import annotations

import math
import os
import tempfile
from pathlib import Path

import av
import cv2
import numpy as np
from PIL import Image

_DETECTORS = {}


def _detector(kind: str):
    if kind in _DETECTORS:
        return _DETECTORS[kind]
    from controlnet_aux import DWposeDetector, HEDdetector, MLSDdetector, ZoeDetector

    classes = {"depth": ZoeDetector, "hed": HEDdetector, "mlsd": MLSDdetector, "pose": DWposeDetector}
    cls = classes[kind]
    try:
        detector = cls.from_pretrained("lllyasviel/Annotators")
    except TypeError:
        detector = cls()
    _DETECTORS[kind] = detector
    return detector


def preprocess_video(source: Path, kind: str, max_seconds: int = 15, fps: int = 24) -> Path:
    if kind not in {"canny", "depth", "hed", "mlsd", "pose"}:
        raise ValueError(f"unsupported control preprocessor: {kind}")
    detector = None if kind == "canny" else _detector(kind)
    detector_on_cuda = False
    if detector is not None and hasattr(detector, "to"):
        import torch
        if torch.cuda.is_available():
            detector.to("cuda")
            detector_on_cuda = True
    descriptor, filename = tempfile.mkstemp(prefix=f"h3-{kind}-", suffix=".mp4")
    os.close(descriptor)
    output = Path(filename)
    source_container = av.open(str(source))
    stream = source_container.streams.video[0]
    source_fps = float(stream.average_rate or fps)
    output_fps = min(source_fps, float(fps))
    output_rate = stream.average_rate if source_fps <= fps and stream.average_rate else fps
    limit = max(5, math.ceil(max_seconds * output_fps))
    encoded = av.open(str(output), "w")
    out_stream = None
    written = 0
    next_sample_time = 0.0
    for index, frame in enumerate(source_container.decode(stream)):
        frame_time = float(frame.time) if frame.time is not None else index / source_fps
        if frame_time + 1e-6 < next_sample_time or written >= limit:
            continue
        rgb = frame.to_ndarray(format="rgb24")
        if kind == "canny":
            edge = cv2.Canny(cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY), 100, 200)
            result = np.repeat(edge[:, :, None], 3, axis=2)
        else:
            result = np.asarray(detector(Image.fromarray(rgb)))
            if result.ndim == 2:
                result = np.repeat(result[:, :, None], 3, axis=2)
            result = result[:, :, :3].astype(np.uint8)
        if out_stream is None:
            height, width = result.shape[:2]
            out_stream = encoded.add_stream("libx264", rate=output_rate)
            out_stream.width, out_stream.height = width // 2 * 2, height // 2 * 2
            out_stream.pix_fmt = "yuv420p"
            out_stream.options = {"crf": "18", "preset": "fast"}
        result = cv2.resize(result, (out_stream.width, out_stream.height), interpolation=cv2.INTER_AREA)
        for packet in out_stream.encode(av.VideoFrame.from_ndarray(result, format="rgb24")):
            encoded.mux(packet)
        written += 1
        next_sample_time = written / output_fps
    if out_stream is None or written < 5:
        encoded.close(); source_container.close(); output.unlink(missing_ok=True)
        raise ValueError("source video must contain at least five decodable frames")
    for packet in out_stream.encode():
        encoded.mux(packet)
    encoded.close(); source_container.close()
    if detector_on_cuda:
        detector.to("cpu")
        torch.cuda.empty_cache()
    return output
