import json
import os
import time
import uuid
from pathlib import Path

import orbit_graph as graph
import orbit_weights
import swap_runtime
from swap_runtime import IN_DIR, OUT_DIR, SwapRuntime, http

import swap_weights

swap_weights.plan = orbit_weights.plan


class OrbitRuntime(SwapRuntime):
    def generate(self, *, image, prompt=graph.PROMPT, steps=graph.DEFAULT_STEPS, frames=graph.DEFAULT_FRAMES, size=graph.DEFAULT_SIZE,
                 seed=None, lora_strength=1.0):
        from PIL import Image

        prompt = str(prompt).strip() or graph.PROMPT
        if not 4 <= int(steps) <= 50:
            raise ValueError("steps must be between 4 and 50")
        frames = graph.grid_frames(frames)
        if not 5 <= frames <= 141:
            raise ValueError("frames must be between 5 and 141")
        seed = int(seed) if seed is not None else int.from_bytes(os.urandom(6), "big")
        with Image.open(image) as photo:
            width, height = graph.orbit_dimensions(*photo.size, size=int(size))
            tag = uuid.uuid4().hex
            name = f"orbit-src-{tag}.png"
            photo.convert("RGB").resize((width, height), Image.LANCZOS).save(IN_DIR / name)
        started = time.monotonic()
        try:
            workflow = graph.build_orbit_graph(
                prompt=prompt, width=width, height=height, frames=frames, steps=int(steps), seed=seed, image_name=name,
                lora_strength=lora_strength, prefix=f"orbit-{tag}")
            with self.lock:
                pid = http("/prompt", {"prompt": workflow})["prompt_id"]
                deadline = time.monotonic() + swap_runtime.TIMEOUT
                while True:
                    time.sleep(0.5)
                    history = http("/history/" + pid)
                    if pid in history:
                        entry = history[pid]
                        break
                    if time.monotonic() > deadline:
                        http("/interrupt", {})
                        raise TimeoutError("orbit generation timed out")
            if entry["status"]["status_str"] != "success":
                raise RuntimeError("ComfyUI job failed: " + json.dumps(entry["status"])[-800:])
            files = [i for o in entry["outputs"].values() for key in ("images", "videos", "gifs") for i in o.get(key, [])]
            path = OUT_DIR / files[0].get("subfolder", "") / files[0]["filename"]
            return path, {
                "generation_seconds": round(time.monotonic() - started, 2), "width": width, "height": height, "frames": frames,
                "steps": int(steps), "seed": seed, "lora_strength": float(lora_strength), "video_seconds": round(frames / graph.FPS, 3),
            }
        finally:
            (IN_DIR / name).unlink(missing_ok=True)
