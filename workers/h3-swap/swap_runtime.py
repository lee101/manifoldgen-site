import asyncio
import json
import os
import shutil
import subprocess
import threading
import time
import urllib.request
import uuid
from pathlib import Path

import gpu_profile
import swap_graph as graph
import swap_relay as relay
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


STAGE_OF_NODE = {"5": "encode", "10": "sample", "11": "decode", "13": "save", "14": "save"}


def comfy_flags(profile=None):
    configured = os.environ.get("SWAP_COMFY_FLAGS")
    if configured is not None:
        return configured.split()
    return gpu_profile.comfy_flags(profile or gpu_profile.SAFE)


class StageTimer:
    def __init__(self, port, client_id):
        self.port, self.client_id = port, client_id
        self.events = []
        self.lock = threading.Lock()
        threading.Thread(target=self._run, name="swap-stage-timer", daemon=True).start()

    def _run(self):
        try:
            asyncio.run(self._listen())
        except Exception as error:
            print(f"stage timer stopped: {error!r}", flush=True)

    async def _listen(self):
        import aiohttp
        while True:
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.ws_connect(f"http://127.0.0.1:{self.port}/ws?clientId={self.client_id}", max_msg_size=0) as ws:
                        async for message in ws:
                            if message.type != aiohttp.WSMsgType.TEXT:
                                continue
                            data = json.loads(message.data)
                            if data.get("type") in ("executing", "execution_success", "execution_error"):
                                with self.lock:
                                    self.events.append((time.monotonic(), data["type"], data.get("data", {})))
            except Exception:
                await asyncio.sleep(1)

    def mark(self):
        with self.lock:
            return len(self.events)

    def stages(self, since, prompt_id):
        with self.lock:
            events = [e for e in self.events[since:] if e[2].get("prompt_id") in (None, prompt_id)]
        out, current, started = {}, None, None
        for at, kind, data in events:
            if current is not None:
                out[current] = out.get(current, 0.0) + at - started
                current = None
            if kind == "executing" and data.get("node") is not None:
                current, started = STAGE_OF_NODE.get(str(data["node"]), "load"), at
        return {key: round(value, 2) for key, value in out.items()}


class SwapRuntime:
    def __init__(self, profile=None, gpu=None):
        self.lock = threading.Lock()
        self.proc = None
        self.gpu = gpu or gpu_profile.detect()
        self.profile = profile or gpu_profile.select(self.gpu)
        self.client_id = uuid.uuid4().hex
        self.demoted = None
        self.jobs_ok = 0
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        IN_DIR.mkdir(parents=True, exist_ok=True)
        # ComfyUI's interpreter/custom-node boot does not read weights; overlap it with the download.
        self.spawn()
        try:
            weights.ensure_weights(*([self.profile.quant] if self.profile.quant != "int8_convrot" else []))
            self.wait_ready()
        except BaseException:
            self.close()
            raise
        self.timer = StageTimer(PORT, self.client_id)
        print("swap runtime", json.dumps(gpu_profile.describe(self.gpu, self.profile)), flush=True)

    def start(self):
        self.spawn()
        self.wait_ready()

    def demote(self, reason):
        self.demoted = reason[:300]
        self.profile = gpu_profile.SAFE
        self.close()
        self.start()
        print(f"swap runtime demoted to safe profile: {self.demoted}", flush=True)

    def spawn(self):
        self.proc = subprocess.Popen(
            ["python3", "main.py", "--listen", "127.0.0.1", "--port", str(PORT),
             "--output-directory", str(OUT_DIR), "--input-directory", str(IN_DIR), "--disable-auto-launch", *comfy_flags(self.profile)],
            cwd=COMFY_DIR,
            env={**os.environ, "PYTORCH_CUDA_ALLOC_CONF": os.environ.get("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")},
        )

    def wait_ready(self):
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
                 turbo=False, lora_strength=1.0, easycache=None, sol=False, spectrum=False, fbc=None, grid="hold",
                 swap_lora=graph.SWAP_LORA, sampler="res_multistep", scheduler="simple"):
        prompt = str(prompt).strip()
        if not prompt:
            raise ValueError("prompt is required")
        if not 1 <= len(character_images) <= 3:
            raise ValueError("between one and three character images are required")
        if turbo is True:
            steps = graph.TURBO_STEPS
        if not 2 <= int(steps) <= 50:
            raise ValueError("steps must be between 2 and 50")
        seed = int(seed) if seed is not None else int.from_bytes(os.urandom(6), "big")
        if turbo and turbo is not True and graph.TURBOS.get(turbo, ("",))[0] in weights.LIGHTX_FILES:
            weights.ensure_lightx(graph.TURBOS[turbo][0], self.profile.quant)
        profile = self.profile
        requested_mp = float(megapixels)
        megapixels = gpu_profile.clamp_megapixels(requested_mp, profile)
        src_w, src_h, src_seconds = graph.probe_video(source_video)
        seconds = min(src_seconds, graph.MAX_SECONDS)
        if seconds < graph.MIN_SECONDS:
            raise ValueError(f"source video must be at least {graph.MIN_SECONDS:g} seconds")
        # The source is resampled to 24 fps, so the grid is sized on 24 fps frames (a 30 fps clip would otherwise gain padding).
        source_frames = min(round(src_seconds * graph.FPS), int(graph.MAX_SECONDS * graph.FPS))
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
                image_names=names, turbo=turbo, lora_strength=lora_strength, prefix=f"swap-{tag}", easycache=easycache, sol=sol, spectrum=spectrum, fbc=fbc,
                swap_lora=swap_lora, sampler=sampler, scheduler=scheduler, vae_tiled=profile.vae_tiled, compile_backend=profile.compile,
                model_name=graph.QUANT_MODELS.get(profile.quant, graph.REF2VA_MODEL),
            )
            prep_seconds = time.monotonic() - started
            with self.lock:
                mark = self.timer.mark() if hasattr(self, "timer") else 0
                submitted = time.monotonic()
                pid = http("/prompt", {"prompt": workflow, "client_id": self.client_id})["prompt_id"]
                deadline = time.monotonic() + TIMEOUT
                while True:
                    time.sleep(0.25)
                    history = http("/history/" + pid)
                    if pid in history:
                        entry = history[pid]
                        break
                    if time.monotonic() > deadline:
                        http("/interrupt", {})
                        raise TimeoutError("character swap timed out")
                comfy_seconds = time.monotonic() - submitted
            if entry["status"]["status_str"] != "success":
                raise RuntimeError("ComfyUI job failed: " + json.dumps(entry["status"])[-800:])
            files = [i for o in entry["outputs"].values() for key in ("images", "videos", "gifs") for i in o.get(key, [])]
            path = OUT_DIR / files[0].get("subfolder", "") / files[0]["filename"]
            stages = self.timer.stages(mark, pid) if hasattr(self, "timer") else {}
            return path, {
                "generation_seconds": round(time.monotonic() - started, 2), "width": width, "height": height, "frames": frames, "source_frames": source_frames, "grid": grid,
                "steps": int(steps), "seed": seed, "turbo": turbo, "swap_lora": swap_lora, "sampler": sampler, "scheduler": scheduler, "source_seconds": round(seconds, 3),
                "megapixels": megapixels, "megapixels_requested": requested_mp, "easycache": easycache, "sol": sol, "spectrum": spectrum, "fbc": fbc,
                "gpu": self.gpu.name, "profile": profile.name, "profile_path": "safe-retry" if self.demoted else ("fast" if profile is not gpu_profile.SAFE else "safe"),
                "stage_seconds": {"prep": round(prep_seconds, 2), "comfy": round(comfy_seconds, 2), **stages},
            }
        finally:
            (IN_DIR / clip_name).unlink(missing_ok=True)
            for name in names:
                (IN_DIR / name).unlink(missing_ok=True)

    def generate_resilient(self, **kwargs):
        try:
            result = self.generate(**kwargs)
            self.jobs_ok += 1
            return result
        except (ValueError, TimeoutError):
            raise
        except Exception as error:
            if self.profile is gpu_profile.SAFE or self.jobs_ok:
                raise
            fast_error = repr(error)[:300]
            self.demote(fast_error)
            path, metrics = self.generate(**kwargs)
            self.jobs_ok += 1
            metrics["fast_path_error"] = fast_error
            return path, metrics

    def generate_relay(self, *, prompt, subject, source_video, character_image, seed=None, steps=8, window_frames=124, expansion_px=64, resolution="768",
                       swap_lora=graph.SWAP_LORA, lora_strength=1.0, sam_threshold=0.35, selection="largest", anchor_image=None, blur_scale=None):
        """Masked swap of ONE selected person (SAM subject text) with the reference character; everything else is kept from the source."""
        seed = int(seed) if seed is not None else int.from_bytes(os.urandom(6), "big")
        tag = uuid.uuid4().hex
        clip_name = f"relay-src-{tag}.mp4"
        suffix = Path(character_image).suffix.lower() if Path(character_image).suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"} else ".png"
        ref_name = f"relay-ref-{tag}{suffix}"
        started = time.monotonic()
        try:
            shutil.copy(source_video, IN_DIR / clip_name)
            shutil.copy(character_image, IN_DIR / ref_name)
            anchor_name = None
            if anchor_image:
                anchor_name = f"relay-anchor-{tag}.png"
                shutil.copy(anchor_image, IN_DIR / anchor_name)
            workflow = relay.build_relay_graph(prompt=prompt, subject=subject, video_name=clip_name, image_name=ref_name, seed=seed, steps=steps,
                                               prefix=f"relay-{tag}", swap_lora=swap_lora, lora_strength=lora_strength, window_frames=window_frames,
                                               expansion_px=expansion_px, resolution=resolution, sam_threshold=sam_threshold, selection=selection,
                                               anchor_name=anchor_name, blur_scale=blur_scale)
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
                        raise TimeoutError("relay swap timed out")
            if entry["status"]["status_str"] != "success":
                raise RuntimeError("ComfyUI relay job failed: " + json.dumps(entry["status"])[-1200:])
            saved = entry["outputs"]["save"]  # the SaveVideo node; other nodes also write previews into the output dir
            files = [i for key in ("images", "videos", "gifs") for i in saved.get(key, [])]
            path = OUT_DIR / files[0].get("subfolder", "") / files[0]["filename"]
            return path, {"generation_seconds": round(time.monotonic() - started, 2), "seed": seed, "steps": steps, "subject": subject, "mode": "relay",
                          "source_seconds": graph.probe_video(source_video)[2], "swap_lora": swap_lora, "resolution": resolution, "expansion_px": expansion_px}
        finally:
            (IN_DIR / clip_name).unlink(missing_ok=True)
            (IN_DIR / ref_name).unlink(missing_ok=True)
            if anchor_image:
                (IN_DIR / f"relay-anchor-{tag}.png").unlink(missing_ok=True)
