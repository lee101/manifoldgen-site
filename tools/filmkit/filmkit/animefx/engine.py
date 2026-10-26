"""animefx engine: a recipe (ordered layers with time windows) rendered over video or a still.

Recipe JSON:
  {"seed": 7, "layers": [
     {"fx": "on_twos"},
     {"fx": "grain", "amount": 0.04},
     {"fx": "surprise", "at": 2.0, "dur": 0.6, "ease": "decay", "strength": 1.2}]}
`at` / `dur` are seconds (omitted = whole clip). `ease` shapes the intensity envelope k:
  hold (default, k=1) | in_out | decay (hit then fall) | pop (fast rise, slow fall) | fade_in | fade_out | pulse
"""
from __future__ import annotations

import json
import math
import subprocess
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import cv2
import numpy as np

from .fx import FX, Ctx

EASES = ("hold", "in_out", "decay", "pop", "fade_in", "fade_out", "pulse")


def envelope(ease: str, u: float) -> float:
    if ease == "in_out":
        return math.sin(math.pi * u)
    if ease == "decay":
        return math.exp(-4.0 * u)
    if ease == "pop":
        return min(1.0, u / 0.12) * math.exp(-2.2 * max(0.0, u - 0.12))
    if ease == "fade_in":
        return u
    if ease == "fade_out":
        return 1 - u
    if ease == "pulse":
        return 0.5 + 0.5 * math.sin(2 * math.pi * u * 3)
    return 1.0


def load_recipe(spec) -> dict:
    if isinstance(spec, (str, Path)):
        p = Path(spec)
        spec = json.loads(p.read_text() if p.exists() else str(spec))
    if isinstance(spec, list):
        spec = {"layers": spec}
    for layer in spec.get("layers", []):
        if layer.get("fx") not in FX:
            raise ValueError(f"unknown fx {layer.get('fx')!r}; known: {', '.join(FX)}")
        if layer.get("ease", "hold") not in EASES:
            raise ValueError(f"unknown ease {layer.get('ease')!r}")
    return spec


class Renderer:
    def __init__(self, recipe: dict, w: int, h: int, fps: float, duration: float):
        self.recipe = recipe
        self.w, self.h, self.fps, self.duration = w, h, fps, duration
        self.layers = recipe.get("layers", [])
        self.states = [{"dur": self._window(l)[1] - self._window(l)[0]} for l in self.layers]
        self.seed = int(recipe.get("seed", 1))

    def _window(self, layer: dict) -> tuple[float, float]:
        at = float(layer.get("at", 0.0))
        dur = layer.get("dur")
        return at, (at + float(dur)) if dur is not None else self.duration

    def frame(self, rgb_u8: np.ndarray, idx: int) -> np.ndarray:
        t = idx / self.fps
        img = rgb_u8.astype(np.float32) / 255.0
        for layer, state in zip(self.layers, self.states):
            t0, t1 = self._window(layer)
            if t < t0 or t > t1 + 1e-9:
                continue
            u = 0.0 if t1 <= t0 else min(1.0, (t - t0) / (t1 - t0))
            k = envelope(layer.get("ease", "hold"), u) * float(layer.get("mix", 1.0))
            f = FX[layer["fx"]]
            P = {n: d for n, (d, _) in f.params.items()}
            P.update({n: v for n, v in layer.items() if n in P})
            ctx = Ctx(self.w, self.h, self.fps, t, idx, self.seed + int(layer.get("seed", 0)), state)
            img = f.fn(img, u, k, P, ctx)
            img = np.clip(img, 0.0, 1.0)
        return (img * 255.0 + 0.5).astype(np.uint8)


def probe(path: str) -> dict:
    out = subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                                   "stream=width,height,r_frame_rate,nb_frames:format=duration", "-of", "json", path])
    d = json.loads(out)
    s = d["streams"][0]
    n, den = s["r_frame_rate"].split("/")
    return {"w": int(s["width"]), "h": int(s["height"]), "fps": float(n) / float(den),
            "duration": float(d["format"]["duration"])}


def render_video(src: str | Path, dst: str | Path, recipe, *, crf: int = 15, size: tuple[int, int] | None = None,
                 fps: float | None = None, max_seconds: float | None = None) -> dict:
    """Decode src -> apply recipe -> encode dst (H.264, audio copied). Returns timing info."""
    recipe = load_recipe(recipe)
    info = probe(str(src))
    w, h = size or (info["w"], info["h"])
    fps = fps or info["fps"]
    dur = min(info["duration"], max_seconds) if max_seconds else info["duration"]
    scale = [] if (w, h) == (info["w"], info["h"]) else ["-vf", f"scale={w}:{h}:flags=lanczos"]
    dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", str(src), *scale, "-r", str(fps), "-t", f"{dur:.3f}",
                            "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}",
                            "-r", str(fps), "-i", "-", "-i", str(src), "-map", "0:v", "-map", "1:a?", "-t", f"{dur:.3f}",
                            "-c:v", "libx264", "-crf", str(crf), "-preset", "medium", "-pix_fmt", "yuv420p",
                            "-c:a", "aac", "-b:a", "192k", str(dst)], stdin=subprocess.PIPE)
    r = Renderer(recipe, w, h, fps, dur)
    n = 0
    size_b = w * h * 3
    while True:
        buf = dec.stdout.read(size_b)
        if len(buf) < size_b:
            break
        frame = np.frombuffer(buf, np.uint8).reshape(h, w, 3)
        enc.stdin.write(r.frame(frame, n).tobytes())
        n += 1
    enc.stdin.close()
    dec.wait()
    enc.wait()
    if enc.returncode:
        raise RuntimeError(f"ffmpeg encode failed for {dst}")
    return {"frames": n, "fps": fps, "size": [w, h], "output": str(dst)}


def render_still(src: str | Path, dst: str | Path, recipe, t: float = 0.0, fps: float = 24.0) -> Path:
    recipe = load_recipe(recipe)
    im = cv2.cvtColor(cv2.imread(str(src)), cv2.COLOR_BGR2RGB)
    h, w = im.shape[:2]
    r = Renderer(recipe, w, h, fps, max(t + 1, 1.0))
    out = r.frame(im, int(round(t * fps)))
    cv2.imwrite(str(dst), cv2.cvtColor(out, cv2.COLOR_RGB2BGR))
    return Path(dst)


def _job(args):
    return render_video(*args)


def render_batch(jobs: list[tuple], workers: int = 8) -> list[dict]:
    """jobs: [(src, dst, recipe)] rendered in parallel processes (one clip per core)."""
    with ProcessPoolExecutor(workers) as ex:
        return list(ex.map(_job, jobs))
