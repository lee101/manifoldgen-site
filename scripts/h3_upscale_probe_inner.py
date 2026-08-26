#!/usr/bin/env python3
"""Inner probe: runs inside the production h3-cog image on a scratch pod.

Exercises the real worker path (balanced accel profile, ck attention backend,
face gate + face-refine second pass) for three upscale variants:
  base    — sample -> decode at preview size
  latent  — sample -> clean-latent 2x -> decode
  twopass — sample -> learned 2x + CONST re-noise -> short pass 2 -> decode

Prints one "PROBE_RESULT {json}" line per variant with wall/generation seconds,
face-refine outcome, and peak VRAM sampled during the run.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
import time
import urllib.request
from pathlib import Path

os.environ.setdefault("COMFY_ROOT", "/opt/ComfyUI")
os.environ.setdefault("WEIGHTS_DIR", "/weights")
os.environ.update(
    {
        "H3_ACCEL_PROFILE": "balanced",
        "H3_ATTENTION_BACKEND": "ck",
        "H3_FACE_REFINE_ENABLED": "1",
        "H3_FACE_REFINE_REQUIRED": "0",
        "H3_MODEL_SET": "fl2va,ref2va,face_refine",
        "H3_LAZY_REF2VA": "1",
    }
)
sys.path.insert(0, "/src")

GPU = subprocess.run(
    ["nvidia-smi", "--query-gpu=name,memory.total,driver_version"],
    capture_output=True,
    text=True,
).stdout.strip()
PROMPT = os.environ.get("PROBE_PROMPT", "close-up portrait of an old fisherman talking about the sea")
SEED = int(os.environ.get("PROBE_SEED", "1234"))
DURATION = 5.0
STEPS = 20
OUT = Path("/tmp/out")
OUT.mkdir(parents=True, exist_ok=True)

_samples: list[tuple[float, int]] = []
_stop = threading.Event()


def _sampler() -> None:
    while not _stop.is_set():
        try:
            out = subprocess.run(
                ["nvidia-smi", "--query-gpu=memory.used", "--format=csv,noheader,nounits"],
                capture_output=True,
                text=True,
            ).stdout.strip()
            _samples.append((time.monotonic(), int(out.splitlines()[0])))
        except Exception:
            pass
        time.sleep(0.5)


def peak_since(mark: float) -> int:
    return max((mib for when, mib in _samples if when >= mark), default=0)


def report(tag: str, **fields) -> None:
    payload = {"tag": tag, "gpu": GPU, **fields}
    print("PROBE_RESULT " + json.dumps(payload), flush=True)


def middle_frame(video: Path, name: str, seconds: float) -> None:
    subprocess.run(
        [
            "ffmpeg", "-y", "-v", "error",
            "-ss", f"{max(seconds / 2, 0):.3f}", "-i", str(video),
            "-frames:v", "1", str(OUT / name),
        ],
        check=False,
    )


def submit(graph: dict, host: str) -> str:
    payload = json.dumps({"prompt": graph, "client_id": "upscale-probe"}).encode()
    request = urllib.request.Request(
        f"{host}/prompt", data=payload, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        body = json.loads(response.read())
    if "prompt_id" not in body:
        raise RuntimeError(f"queue rejected: {body}")
    return body["prompt_id"]


def wait_history(prompt_id: str, host: str, timeout_s: float = 3600) -> dict:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        with urllib.request.urlopen(f"{host}/history/{prompt_id}", timeout=30) as response:
            history = json.loads(response.read())
        if prompt_id in history:
            entry = history[prompt_id]
            status = entry.get("status", {})
            if status.get("status_str") == "error":
                raise RuntimeError(json.dumps(status.get("messages", []))[:2000])
            return entry
        time.sleep(3)
    raise TimeoutError(prompt_id)


def first_output_video(entry: dict) -> Path | None:
    for node_output in entry.get("outputs", {}).values():
        for key in ("gifs", "videos", "images"):
            for item in node_output.get(key, []):
                source = Path(item.get("fullpath") or item.get("filename"))
                if not source.is_absolute():
                    source = (
                        Path(os.environ["COMFY_ROOT"]) / "output" / item.get("subfolder", "") / source.name
                    )
                if source.is_file():
                    return source
    return None


def twopass_graph(base: dict, ckpt: str) -> dict:
    """Same construction as scripts/latent_upscale_experiment.py:twopass_graph."""
    graph = json.loads(json.dumps(base))
    seed = graph["7"]["inputs"]["noise_seed"]
    graph["20"] = {"class_type": "RandomNoise", "inputs": {"noise_seed": int(seed) + 1}}
    graph["21"] = {
        "class_type": "BasicScheduler",
        "inputs": {"model": ["1", 0], "scheduler": "simple", "steps": 8, "denoise": 0.45},
    }
    graph["22"] = {
        "class_type": "MiniMaxH3LatentUpscaleCombined",
        "inputs": {
            "samples": ["10", 0],
            "method": "learned model",
            "learned_model": ckpt,
            "model": ["1", 0],
            "noise": ["20", 0],
            "sigmas": ["21", 0],
            "audio_denoise": 0.0,
            "noise_resample": "independent",
            "positive": ["5", 0],
        },
    }
    graph["23"] = {"class_type": "BasicGuider", "inputs": {"model": ["1", 0], "conditioning": ["22", 1]}}
    graph["24"] = {"class_type": "DisableNoise", "inputs": {}}
    graph["25"] = {
        "class_type": "SamplerCustomAdvanced",
        "inputs": {
            "noise": ["24", 0],
            "guider": ["23", 0],
            "sampler": ["8", 0],
            "sigmas": ["21", 0],
            "latent_image": ["22", 0],
        },
    }
    graph["11"]["inputs"]["samples"] = ["25", 0]
    return graph


def main() -> None:
    from h3_runtime import GenerationResult, H3Runtime, comfy_port
    from h3_workflow import aligned_frames, build_workflow, dimensions

    thread = threading.Thread(target=_sampler, daemon=True)
    thread.start()

    print(f"probe start gpu={GPU!r} prompt={PROMPT[:80]!r} seed={SEED}", flush=True)
    boot_started = time.monotonic()
    rt = H3Runtime()
    print(f"runtime ready (comfy child up) seconds={time.monotonic() - boot_started:.1f}", flush=True)

    def run(tag: str, *, latent_upscale: bool) -> None:
        mark = time.monotonic()
        # The production image's runtime predates the per-request kwarg; the
        # env flag is read at generation time, so toggle it around the call.
        os.environ["H3_LATENT_UPSCALE_ENABLED"] = "1" if latent_upscale else "0"
        result = rt.generate(
            prompt=PROMPT,
            size="preview",
            duration=DURATION,
            steps=STEPS,
            seed=SEED,
            return_metrics=True,
        )
        elapsed = time.monotonic() - mark
        if isinstance(result, GenerationResult):
            metrics = dict(result.metrics or {})
            path = Path(result.path)
        else:  # plain Path fallback
            metrics = {}
            path = Path(result)
        face = metrics.get("face_refine") or {}
        report(
            tag,
            wall_seconds=round(elapsed, 2),
            generation_seconds=metrics.get("generation_seconds"),
            face_refine_seconds=metrics.get("face_refine_seconds"),
            face_applied=face.get("applied"),
            face_error=(face.get("error") or "")[:300],
            total_seconds=metrics.get("total_seconds"),
            encode_seconds=metrics.get("encode_seconds"),
            width=metrics.get("width"),
            height=metrics.get("height"),
            frames=metrics.get("frames"),
            vram_mode=metrics.get("vram_mode"),
            latent_upscale=metrics.get("latent_upscale"),
            peak_vram_mib=peak_since(mark),
            output=str(path),
        )
        middle_frame(path, f"{tag}.png", float(metrics.get("duration_seconds") or DURATION))

    run("base", latent_upscale=False)
    run("latent", latent_upscale=True)

    # Twopass runs as a direct graph against the same live ComfyUI child so the
    # combined learned-upscale + re-noise pass is measured without a second
    # model load cycle.
    mark = time.monotonic()
    host = f"http://127.0.0.1:{comfy_port()}"
    width, height = dimensions("16:9", "preview")
    frames = aligned_frames(DURATION, size="preview")
    ckpt = os.getenv(
        "H3_LATENT_UPSCALER_MODEL", "h3_clean_latent_upscaler_v1_mamad8.safetensors"
    )
    base_graph = build_workflow(
        prompt=PROMPT, width=width, height=height, frames=frames, steps=STEPS, seed=SEED
    )
    prompt_id = submit(twopass_graph(base_graph, ckpt), host)
    entry = wait_history(prompt_id, host)
    video = first_output_video(entry)
    report(
        "twopass",
        wall_seconds=round(time.monotonic() - mark, 2),
        checkpoint=ckpt,
        width=width * 2,
        height=height * 2,
        frames=frames,
        output=str(video or ""),
        peak_vram_mib=peak_since(mark),
    )
    if video:
        middle_frame(video, "twopass.png", DURATION)

    rt.close()
    _stop.set()
    print("PROBE_DONE", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # always surface the traceback in the uploaded log
        import traceback

        traceback.print_exc()
        print(f"PROBE_FAILED {type(error).__name__}: {error}", flush=True)
        raise SystemExit(1)
