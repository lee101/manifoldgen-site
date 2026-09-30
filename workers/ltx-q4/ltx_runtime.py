import json
import os
import shutil
import subprocess
import threading
import time
import urllib.request
from pathlib import Path

import graphs

COMFY_DIR = Path(os.environ.get("LTX_COMFY_DIR", "/opt/ComfyUI"))
OUT_DIR = Path(os.environ.get("LTX_OUT_DIR", "/tmp/ltx-out"))
IN_DIR = Path(os.environ.get("LTX_IN_DIR", "/tmp/ltx-in"))
PORT = int(os.environ.get("LTX_COMFY_PORT", "8188"))
UNET = os.environ.get("LTX_UNET", graphs.Q4)
FPS = 24
LONG_SIDE = {"preview": 768, "balanced": 1024, "quality": 1280}
MAX_SECONDS = float(os.environ.get("LTX_MAX_SECONDS", "15"))


def dimensions(aspect_ratio, size):
    long_side = LONG_SIDE.get(size, LONG_SIDE["balanced"])
    try:
        a, b = (float(x) for x in str(aspect_ratio).split(":"))
    except ValueError:
        a, b = 16.0, 9.0
    ratio = max(0.4, min(2.5, a / b))
    if ratio >= 1:
        w, h = long_side, long_side / ratio
    else:
        w, h = long_side * ratio, long_side
    snap = lambda v: max(256, int(round(v / 64)) * 64)
    return snap(w), snap(h)


def frame_count(duration):
    seconds = max(1.0, min(MAX_SECONDS, float(duration)))
    return int(round(seconds * FPS / 8)) * 8 + 1


def http(path, data=None, timeout=60):
    req = urllib.request.Request(
        f"http://127.0.0.1:{PORT}{path}",
        data=json.dumps(data).encode() if data is not None else None,
        headers={"Content-Type": "application/json"},
    )
    return json.load(urllib.request.urlopen(req, timeout=timeout))


class LtxRuntime:
    def __init__(self):
        self.lock = threading.Lock()
        self.proc = None
        self.jobs = 0
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        IN_DIR.mkdir(parents=True, exist_ok=True)
        self.start()

    def start(self):
        flags = os.environ.get("LTX_COMFY_FLAGS", "").split()
        self.proc = subprocess.Popen(
            ["python3", "main.py", "--listen", "127.0.0.1", "--port", str(PORT),
             "--output-directory", str(OUT_DIR), "--input-directory", str(IN_DIR), *flags],
            cwd=COMFY_DIR,
        )
        for _ in range(300):
            if self.proc.poll() is not None:
                raise RuntimeError("ComfyUI exited during startup")
            try:
                http("/system_stats", timeout=5)
                return
            except Exception:
                time.sleep(1)
        raise RuntimeError("ComfyUI did not start")

    def close(self):
        if self.proc and self.proc.poll() is None:
            self.proc.terminate()
            try:
                self.proc.wait(20)
            except subprocess.TimeoutExpired:
                self.proc.kill()

    def generate(self, prompt, *, aspect_ratio="16:9", size="balanced", duration=5, seed=None,
                 image=None, audio=None, steps=8, cfg=3.5, negative=None, two_stage=True):
        width, height = dimensions(aspect_ratio, size)
        frames = frame_count(duration)
        seed = int(seed) if seed is not None else int.from_bytes(os.urandom(4), "big")
        names = {}
        for key, src in (("image", image), ("audio", audio)):
            if src:
                name = f"{key}-{seed}-{int(time.time())}{Path(src).suffix}"
                shutil.copy(src, IN_DIR / name)
                names[key] = name
        prefix = f"job-{seed}-{int(time.time())}"
        graph = graphs.build(
            prompt, width=width, height=height, frames=frames, seed=seed, unet=UNET, two_stage=two_stage,
            steps=steps, cfg=cfg, negative=negative or graphs.NEGATIVE, image=names.get("image"),
            audio=names.get("audio"), prefix=prefix,
        )
        started = time.monotonic()
        with self.lock:
            try:
                pid = http("/prompt", {"prompt": graph})["prompt_id"]
                deadline = time.monotonic() + 1800
                while True:
                    time.sleep(0.5)
                    h = http("/history/" + pid)
                    if pid in h:
                        entry = h[pid]
                        break
                    if time.monotonic() > deadline:
                        raise TimeoutError("generation timed out")
            finally:
                for n in names.values():
                    (IN_DIR / n).unlink(missing_ok=True)
            self.jobs += 1
        if entry["status"]["status_str"] != "success":
            raise RuntimeError("ComfyUI job failed: " + json.dumps(entry["status"])[-800:])
        files = [i for o in entry["outputs"].values() for i in o.get("images", [])]
        path = OUT_DIR / files[0].get("subfolder", "") / files[0]["filename"]
        return path, {
            "generation_seconds": round(time.monotonic() - started, 2), "width": width, "height": height,
            "frames": frames, "fps": FPS, "seed": seed, "two_stage": two_stage, "unet": UNET,
            "model_lane": "ltx23-q4",
        }
