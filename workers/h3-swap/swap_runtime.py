import json
import os
import shutil
import subprocess
import threading
import time
import urllib.request
import uuid
from pathlib import Path

import swap_graph as graph
import swap_weights as weights

COMFY_DIR = Path(os.environ.get("SWAP_COMFY_DIR", "/opt/ComfyUI"))
OUT_DIR = Path(os.environ.get("SWAP_OUT_DIR", "/tmp/swap-out"))
IN_DIR = Path(os.environ.get("SWAP_IN_DIR", "/tmp/swap-in"))
PORT = int(os.environ.get("SWAP_COMFY_PORT", "8188"))
TIMEOUT = int(os.environ.get("SWAP_TIMEOUT_SECONDS", str(40 * 60)))


def http(path, data=None, timeout=60):
    req = urllib.request.Request(
        f"http://127.0.0.1:{PORT}{path}",
        data=json.dumps(data).encode() if data is not None else None,
        headers={"Content-Type": "application/json"},
    )
    return json.load(urllib.request.urlopen(req, timeout=timeout))


def comfy_flags():
    configured = os.environ.get("SWAP_COMFY_FLAGS")
    if configured is not None:
        return configured.split()
    flags = ["--disable-metadata", "--reserve-vram", "1.5"]
    if "--use-ck-attention" in (COMFY_DIR / "comfy" / "cli_args.py").read_text(errors="replace"):
        flags.append("--use-ck-attention")
    return flags


class SwapRuntime:
    def __init__(self):
        self.lock = threading.Lock()
        self.proc = None
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        IN_DIR.mkdir(parents=True, exist_ok=True)
        weights.ensure_weights()
        self.start()

    def start(self):
        self.proc = subprocess.Popen(
            ["python3", "main.py", "--listen", "127.0.0.1", "--port", str(PORT),
             "--output-directory", str(OUT_DIR), "--input-directory", str(IN_DIR), "--disable-auto-launch", *comfy_flags()],
            cwd=COMFY_DIR,
            env={**os.environ, "PYTORCH_CUDA_ALLOC_CONF": os.environ.get("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")},
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

    def generate(self, *, prompt, source_video, character_images, steps=graph.DEFAULT_STEPS, seed=None, megapixels=0.4,
                 turbo=False, lora_strength=1.0, easycache=None, sol=False, grid="hold"):
        prompt = str(prompt).strip()
        if not prompt:
            raise ValueError("prompt is required")
        if not 1 <= len(character_images) <= 3:
            raise ValueError("between one and three character images are required")
        if turbo:
            steps = graph.TURBO_STEPS
        if not 2 <= int(steps) <= 50:
            raise ValueError("steps must be between 2 and 50")
        seed = int(seed) if seed is not None else int.from_bytes(os.urandom(6), "big")
        src_w, src_h, src_seconds = graph.probe_video(source_video)
        seconds = min(src_seconds, graph.MAX_SECONDS)
        if seconds < graph.MIN_SECONDS:
            raise ValueError(f"source video must be at least {graph.MIN_SECONDS:g} seconds")
        source_frames = min(graph.count_frames(source_video), int(graph.MAX_SECONDS * graph.FPS))
        frames = graph.grid_frames(source_frames, grid)
        ref_frames = frames if grid != "ceil" else source_frames
        width, height = graph.swap_dimensions(src_w, src_h, megapixels)
        tag = uuid.uuid4().hex
        clip_name = f"swap-src-{tag}.mp4"
        names = []
        started = time.monotonic()
        try:
            graph.normalize_source(source_video, IN_DIR / clip_name, width, height, ref_frames)
            for index, path in enumerate(character_images):
                suffix = Path(path).suffix.lower() if Path(path).suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"} else ".png"
                name = f"swap-ref-{tag}-{index}{suffix}"
                shutil.copy(path, IN_DIR / name)
                names.append(name)
            workflow = graph.build_swap_graph(
                prompt=prompt, width=width, height=height, frames=frames, steps=int(steps), seed=seed, video_name=clip_name,
                image_names=names, turbo=turbo, lora_strength=lora_strength, prefix=f"swap-{tag}", easycache=easycache, sol=sol,
            )
            with self.lock:
                pid = http("/prompt", {"prompt": workflow})["prompt_id"]
                deadline = time.monotonic() + TIMEOUT
                while True:
                    time.sleep(0.5)
                    history = http("/history/" + pid)
                    if pid in history:
                        entry = history[pid]
                        break
                    if time.monotonic() > deadline:
                        http("/interrupt", {})
                        raise TimeoutError("character swap timed out")
            if entry["status"]["status_str"] != "success":
                raise RuntimeError("ComfyUI job failed: " + json.dumps(entry["status"])[-800:])
            files = [i for o in entry["outputs"].values() for key in ("images", "videos", "gifs") for i in o.get(key, [])]
            path = OUT_DIR / files[0].get("subfolder", "") / files[0]["filename"]
            return path, {
                "generation_seconds": round(time.monotonic() - started, 2), "width": width, "height": height, "frames": frames, "source_frames": source_frames, "grid": grid,
                "steps": int(steps), "seed": seed, "turbo": bool(turbo), "source_seconds": round(seconds, 3),
                "megapixels": megapixels, "easycache": easycache, "sol": sol,
            }
        finally:
            (IN_DIR / clip_name).unlink(missing_ok=True)
            for name in names:
                (IN_DIR / name).unlink(missing_ok=True)
