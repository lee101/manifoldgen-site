#!/usr/bin/env python3
"""Content-addressed recurrent video matting worker."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import shlex
import socket
import subprocess
import sys
import tempfile
import threading
import time
from urllib.parse import urlparse
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / "cache"
DOWNLOADS = ROOT / "downloads"
RESULTS = ROOT / "results"
MODEL_URL = "https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/rvm_resnet50_fp32.torchscript"
MODEL_SHA256 = "072adec3c75a1af773ec35d8b595612f8e3472b7a4b8a210684432b493376852"
MODEL_PATH = CACHE / "models" / "rvm_resnet50_fp32.torchscript"
JOBCTL = Path(os.environ.get("OMNI_JOBCTL", ROOT / "../../omniserve-native/build/omni-job")).resolve()
QUEUE = Path(os.environ.get("VIDEO_MATTING_QUEUE", CACHE / "jobs.sqlite")).resolve()
CPU_FFMPEG = os.environ.get("VIDEO_MATTING_CPU_FFMPEG", "/usr/bin/ffmpeg")
CPU_FFPROBE = os.environ.get("VIDEO_MATTING_CPU_FFPROBE", "/usr/bin/ffprobe")
GPU_FFMPEG = os.environ.get("VIDEO_MATTING_GPU_FFMPEG", "ffmpeg")


def run(command, *, capture=False, check=True):
    print("+", " ".join(str(x) for x in command), flush=True)
    return subprocess.run(
        [str(x) for x in command], check=check, text=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None,
    )


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(4 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download(url: str) -> Path:
    DOWNLOADS.mkdir(parents=True, exist_ok=True)
    name = Path(urlparse(url).path).name or "input-video"
    destination = DOWNLOADS / name
    if destination.is_file() and destination.stat().st_size:
        return destination
    partial = destination.with_suffix(destination.suffix + ".partial")
    with urlopen(url, timeout=60) as response, partial.open("wb") as output:
        shutil.copyfileobj(response, output, 4 << 20)
    partial.replace(destination)
    return destination


def resolve_input(value: str) -> Path:
    if value.startswith(("https://", "http://")):
        return download(value).resolve()
    path = Path(value).expanduser().resolve()
    if not path.is_file():
        raise FileNotFoundError(path)
    return path


def model_config(args, source: Path) -> dict:
    return {
        "schema": 1,
        "kind": "video-matting",
        "input": str(source),
        "input_sha256": sha256_file(source),
        "engine": "rvm-resnet50-torchscript-v1.0.0",
        "downsample_ratio": float(args.ratio),
        "recolor": args.recolor,
        "recolor_strength": float(args.recolor_strength),
        "transport_preference": args.transport,
        "output_pixels": "source-plus-low-frequency-delta",
    }


def job_key(config: dict) -> str:
    identity = {key: value for key, value in config.items() if key != "input"}
    # Auto permits fallback, so it shares portable cache entries. A strict
    # zero-copy request must never be satisfied by a portable result.
    if identity.get("transport_preference") != "zero-copy":
        identity.pop("transport_preference", None)
    return hashlib.sha256(json.dumps(identity, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def ensure_jobctl() -> None:
    if not JOBCTL.is_file():
        run(["make", "-C", ROOT / "../../omniserve-native", "build/omni-job"])


def jobctl(*arguments, allowed=(0,)) -> dict:
    ensure_jobctl()
    completed = run([JOBCTL, *arguments], capture=True, check=False)
    if completed.returncode not in allowed:
        raise RuntimeError(completed.stderr.strip() or completed.stdout.strip())
    return json.loads(completed.stdout)


def submit(args) -> tuple[str, dict]:
    source = resolve_input(args.input)
    config = model_config(args, source)
    key = job_key(config)
    manifest_dir = CACHE / "manifests"
    manifest_dir.mkdir(parents=True, exist_ok=True)
    manifest = manifest_dir / f"{key}.json"
    temporary = manifest.with_suffix(".tmp")
    temporary.write_text(json.dumps(config, indent=2, sort_keys=True) + "\n")
    temporary.replace(manifest)
    response = jobctl("submit", QUEUE, key, "video-matting", manifest, str(args.required_mib), str(args.priority))
    print(json.dumps(response, indent=2))
    return key, response


def probe(path: Path) -> dict:
    completed = run([CPU_FFPROBE, "-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", path], capture=True)
    return json.loads(completed.stdout)


def video_info(path: Path) -> tuple[int, int, int, int]:
    data = probe(path)
    stream = next(item for item in data["streams"] if item["codec_type"] == "video")
    numerator, denominator = (int(x) for x in stream["avg_frame_rate"].split("/"))
    fps = round(numerator / denominator)
    frames = int(stream.get("nb_read_frames") or stream.get("nb_frames") or round(float(data["format"]["duration"]) * fps))
    return int(stream["width"]), int(stream["height"]), fps, frames


def ensure_model() -> Path:
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    if MODEL_PATH.is_file() and sha256_file(MODEL_PATH) == MODEL_SHA256:
        return MODEL_PATH
    partial = MODEL_PATH.with_suffix(".partial")
    with urlopen(MODEL_URL, timeout=60) as response, partial.open("wb") as output:
        shutil.copyfileobj(response, output, 4 << 20)
    actual = sha256_file(partial)
    if actual != MODEL_SHA256:
        partial.unlink(missing_ok=True)
        raise RuntimeError(f"model checksum mismatch: expected {MODEL_SHA256}, got {actual}")
    partial.replace(MODEL_PATH)
    return MODEL_PATH


def decode_frames(source: Path, frame_dir: Path) -> list[Path]:
    frame_dir.mkdir(parents=True, exist_ok=True)
    complete = frame_dir / ".complete"
    existing = sorted(frame_dir.glob("*.png"))
    if complete.is_file() and existing:
        return existing
    for old in existing:
        old.unlink()
    run([CPU_FFMPEG, "-hide_banner", "-loglevel", "error", "-c:v", "libdav1d", "-i", source,
         "-map", "0:v:0", "-vsync", "0", frame_dir / "%06d.png", "-y"])
    existing = sorted(frame_dir.glob("*.png"))
    if not existing:
        raise RuntimeError("decoder produced no frames")
    complete.write_text(f"{len(existing)}\n")
    return existing


def low_frequency_recolor(source, alpha, style: str, strength: float):
    import torch
    import torch.nn.functional as functional

    if style == "none" or strength == 0:
        return source
    height, width = source.shape[-2:]
    low = functional.interpolate(source, size=(max(2, height // 4), max(2, width // 4)), mode="area")
    red, green, blue = low.unbind(1)
    if style == "rose-gold":
        graded = torch.stack((red * 1.055 + 0.025, green * 0.975 + 0.006, blue * 1.025 + 0.018), 1)
    elif style == "cool":
        graded = torch.stack((red * 0.975, green * 1.01 + 0.005, blue * 1.06 + 0.015), 1)
    else:
        raise ValueError(f"unknown recolor style: {style}")
    delta = functional.interpolate((graded.clamp(0, 1) - low) * strength, size=(height, width), mode="bicubic", align_corners=False)
    # Only a smooth additive field changes. The source's high-frequency residual is untouched.
    return (source + delta * alpha).clamp(0, 1)


def checkerboard(height: int, width: int, device):
    import torch
    y = torch.arange(height, device=device)[:, None] // 32
    x = torch.arange(width, device=device)[None, :] // 32
    cells = ((x + y) & 1).float()[None, None]
    return (cells * 0.18 + 0.30).expand(1, 3, height, width)


def write_png(path: Path, tensor, alpha=None) -> None:
    import cv2
    import numpy as np
    rgb = (tensor[0].permute(1, 2, 0).clamp(0, 1) * 255).round().byte().cpu().numpy()
    bgr = rgb[:, :, ::-1]
    if alpha is not None:
        a = (alpha[0, 0].clamp(0, 1) * 255).round().byte().cpu().numpy()
        bgr = np.dstack((bgr, a))
    if not cv2.imwrite(str(path), bgr):
        raise RuntimeError(f"failed to write {path}")


def encoder_names(executable: str) -> str:
    completed = run([executable, "-hide_banner", "-encoders"], capture=True)
    return completed.stdout + completed.stderr


def encode_lossless_intermediates(source: Path, work: Path, fps: int) -> dict[str, Path]:
    intermediate = work / "encode-intermediate"
    intermediate.mkdir(parents=True, exist_ok=True)
    paths = {name: intermediate / f"{name}.mkv" for name in ("recolor", "checker", "matte")}
    for frames, destination, audio, pixel_format in (
        ("recolor", paths["recolor"], True, "gbrp"),
        ("checker", paths["checker"], True, "gbrp"),
        ("matte", paths["matte"], False, "gray"),
    ):
        if destination.is_file() and destination.stat().st_size:
            continue
        command = [CPU_FFMPEG, "-hide_banner", "-loglevel", "error", "-framerate", str(fps),
                   "-i", work / frames / "%06d.png"]
        if audio:
            command += ["-i", source, "-map", "0:v:0", "-map", "1:a:0?", "-c:a", "copy", "-shortest"]
        command += ["-c:v", "ffv1", "-level", "3", "-coder", "1", "-context", "1",
                    "-g", "1", "-slicecrc", "1", "-pix_fmt", pixel_format, destination, "-y"]
        run(command)
    return paths


def remote_av1_encode(source: Path, work: Path, result: Path, fps: int, host: str) -> dict[str, Path]:
    paths = encode_lossless_intermediates(source, work, fps)
    remote_root = os.environ.get(
        "VIDEO_MATTING_AV1_REMOTE_DIR",
        "/nvme0n1-disk/code/manifoldgen-site/video-matting/cache/encode-incoming",
    )
    remote = f"{remote_root}/{result.name}"
    run(["ssh", host, shlex.join(["mkdir", "-p", remote])])
    for path in paths.values():
        run(["scp", path, f"{host}:{remote}/{path.name}"])
    outputs = {
        "recolored_av1": result / "recolored-detail-preserved-av1.webm",
        "checker_av1": result / "matted-checkerboard-av1.webm",
        "matte_av1": result / "matte-av1.webm",
    }
    remote_outputs = {
        "recolored_av1": f"{remote}/recolored-detail-preserved-av1.webm",
        "checker_av1": f"{remote}/matted-checkerboard-av1.webm",
        "matte_av1": f"{remote}/matte-av1.webm",
    }
    for name, input_name in (("recolored_av1", "recolor.mkv"), ("checker_av1", "checker.mkv"), ("matte_av1", "matte.mkv")):
        command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", f"{remote}/{input_name}",
                   "-map", "0", "-c:v", "av1_nvenc", "-preset", "p7", "-tune", "hq", "-rc", "vbr",
                   "-cq", "18", "-b:v", "8M", "-maxrate", "16M", "-bufsize", "32M",
                   "-pix_fmt", "yuv420p", "-c:a", "copy", remote_outputs[name], "-y"]
        run(["ssh", host, shlex.join(command)])
        run(["scp", f"{host}:{remote_outputs[name]}", outputs[name]])
    return outputs


def encode_outputs(source: Path, work: Path, result: Path, fps: int) -> dict:
    result.mkdir(parents=True, exist_ok=True)
    host = os.environ.get("VIDEO_MATTING_AV1_HOST", "").strip()
    if host:
        outputs = remote_av1_encode(source, work, result, fps, host)
    else:
        outputs = {
            "recolored_av1": result / "recolored-detail-preserved-av1.webm",
            "checker_av1": result / "matted-checkerboard-av1.webm",
            "matte_av1": result / "matte-av1.webm",
        }
        names = encoder_names(CPU_FFMPEG)
        encoder = "libsvtav1" if "libsvtav1" in names else "libaom-av1" if "libaom-av1" in names else ""
        if not encoder:
            raise RuntimeError("no local AV1 encoder; set VIDEO_MATTING_AV1_HOST to an Ada/Blackwell node")
        options = ["-c:v", encoder, "-crf", "22", "-pix_fmt", "yuv420p"]
        if encoder == "libsvtav1": options += ["-preset", "8"]
        else: options += ["-cpu-used", "6", "-row-mt", "1"]
        for frames, destination, audio in (
            ("recolor", outputs["recolored_av1"], True),
            ("checker", outputs["checker_av1"], True),
            ("matte", outputs["matte_av1"], False),
        ):
            command = [CPU_FFMPEG, "-hide_banner", "-loglevel", "error", "-framerate", str(fps),
                       "-i", work / frames / "%06d.png"]
            if audio:
                command += ["-i", source, "-map", "0:v:0", "-map", "1:a:0?", *options, "-c:a", "copy", "-shortest"]
            else:
                command += ["-map", "0:v:0", *options]
            run([*command, destination, "-y"])
    outputs["alpha_vp9"] = result / "foreground-vp9-alpha.webm"
    run([CPU_FFMPEG, "-hide_banner", "-loglevel", "error", "-framerate", str(fps),
         "-i", work / "rgba" / "%06d.png", "-i", source, "-map", "0:v:0", "-map", "1:a:0?",
         "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-auto-alt-ref", "0", "-crf", "18", "-b:v", "0",
         "-metadata:s:v:0", "alpha_mode=1", "-c:a", "copy", "-shortest", outputs["alpha_vp9"], "-y"])
    return {name: str(path) for name, path in outputs.items()}


def process_zero_copy(config: dict, source: Path, work: Path, result: Path,
                      width: int, height: int, fps: int, expected_frames: int) -> dict:
    """Run NVDEC -> DLPack/Torch -> CUDA Array Interface -> AV1 NVENC."""
    import torch
    import zero_copy

    ok, reason = zero_copy.available()
    if not ok:
        raise RuntimeError(reason)
    result.mkdir(parents=True, exist_ok=True)
    fast = work / "zero-copy"
    rgba = fast / "rgba"
    rgba.mkdir(parents=True, exist_ok=True)
    temporary = {
        "recolored_av1": fast / "recolored.mp4",
        "checker_av1": fast / "checker.mp4",
        "matte_av1": fast / "matte.mp4",
    }
    for path in temporary.values():
        path.unlink(missing_ok=True)
    encoders = {
        name: zero_copy.Av1NvEncoder(path, width, height, fps)
        for name, path in temporary.items()
    }
    model = torch.jit.load(str(ensure_model()), map_location="cuda").eval()
    recurrent = [None] * 4
    board = checkerboard(height, width, "cuda")
    count = 0
    started = time.perf_counter()
    try:
        for count, (owner, decoded) in enumerate(zero_copy.decoded_rgbp(source), 1):
            # `owner` pins the NVDEC allocation until all consumers accept it.
            source_tensor = decoded[None].float().div_(255)
            with torch.inference_mode(), torch.autocast("cuda", dtype=torch.float16):
                _, alpha, *recurrent = model(source_tensor, *recurrent, config["downsample_ratio"])
                recolored = low_frequency_recolor(source_tensor, alpha, config["recolor"], config["recolor_strength"])
                checked = recolored * alpha + board * (1 - alpha)
            encoders["recolored_av1"].write(zero_copy.rgb_to_nv12(recolored))
            encoders["checker_av1"].write(zero_copy.rgb_to_nv12(checked))
            encoders["matte_av1"].write(zero_copy.rgb_to_nv12(alpha.expand(-1, 3, -1, -1)))
            # Browser VP9 alpha needs processed RGBA on the CPU. The decoded
            # input never crosses PCIe before inference and the AV1 encoders.
            write_png(rgba / f"{count:06d}.png", recolored, alpha)
            if count == 1 or count % 24 == 0:
                print(f"zero-copy matted/encoded {count}/{expected_frames}", flush=True)
    finally:
        for encoder in encoders.values():
            encoder.close()
    torch.cuda.synchronize()
    seconds = time.perf_counter() - started
    if count != expected_frames:
        raise RuntimeError(f"zero-copy decoder produced {count} frames; expected {expected_frames}")
    outputs = {
        "recolored_av1": result / "recolored-detail-preserved-av1.webm",
        "checker_av1": result / "matted-checkerboard-av1.webm",
        "matte_av1": result / "matte-av1.webm",
        "alpha_vp9": result / "foreground-vp9-alpha.webm",
    }
    for name in ("recolored_av1", "checker_av1"):
        run([CPU_FFMPEG, "-hide_banner", "-loglevel", "error", "-i", temporary[name], "-i", source,
             "-map", "0:v:0", "-map", "1:a:0?", "-c", "copy", "-shortest", outputs[name], "-y"])
    run([CPU_FFMPEG, "-hide_banner", "-loglevel", "error", "-i", temporary["matte_av1"],
         "-map", "0:v:0", "-c", "copy", outputs["matte_av1"], "-y"])
    run([CPU_FFMPEG, "-hide_banner", "-loglevel", "error", "-framerate", str(fps),
         "-i", rgba / "%06d.png", "-i", source, "-map", "0:v:0", "-map", "1:a:0?",
         "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-auto-alt-ref", "0", "-crf", "18", "-b:v", "0",
         "-metadata:s:v:0", "alpha_mode=1", "-c:a", "copy", "-shortest", outputs["alpha_vp9"], "-y"])
    return {
        "outputs": {name: str(path) for name, path in outputs.items()},
        "inference_seconds": seconds,
        "inference_fps": count / seconds,
        "inference_reused": False,
        "transport": "nvdec-dlpack-torch-cuda-array-interface-nvenc",
        "av1_encoder": "PyNvVideoCodec av1_nvenc",
        "decoded_input_host_copies": 0,
        "frames": count,
    }


def process_manifest(key: str, manifest: Path) -> Path:
    import cv2
    import torch

    config = json.loads(manifest.read_text())
    source = Path(config["input"])
    if sha256_file(source) != config["input_sha256"]:
        raise RuntimeError("input content changed after submission")
    width, height, fps, expected_frames = video_info(source)
    work = CACHE / "work" / key
    result = RESULTS / key[:16]
    preference = config.get("transport_preference", "portable")
    if preference != "portable":
        try:
            fast_metadata = process_zero_copy(
                config, source, work, result, width, height, fps, expected_frames,
            )
            outputs = fast_metadata.pop("outputs")
            metadata = {
                "job_key": key, "source": str(source), "source_sha256": config["input_sha256"],
                "width": width, "height": height, "fps": fps,
                "expected_frames": expected_frames, "engine": config["engine"],
                "downsample_ratio": config["downsample_ratio"],
                "pixel_strategy": config["output_pixels"], "outputs": outputs,
                **fast_metadata,
            }
            metadata["sha256"] = {name: sha256_file(Path(path)) for name, path in outputs.items()}
            (result / "manifest.json").write_text(json.dumps(metadata, indent=2, sort_keys=True) + "\n")
            return result
        except Exception as exc:
            if preference == "zero-copy":
                raise
            print(f"zero-copy transport unavailable; using portable fallback: {exc}", file=sys.stderr, flush=True)
    frames = decode_frames(source, work / "source")
    for name in ("matte", "rgba", "recolor", "checker"):
        (work / name).mkdir(parents=True, exist_ok=True)
    matte_marker = work / ".matted.complete"
    frames_complete = all(len(list((work / name).glob("*.png"))) == len(frames) for name in ("matte", "rgba", "recolor", "checker"))
    inference_reused = frames_complete
    if frames_complete:
        inference_seconds = 0.0
        print(f"reusing {len(frames)} cached matted frames", flush=True)
        if not matte_marker.is_file():
            matte_marker.write_text(f"{len(frames)}\n")
    else:
        model = torch.jit.load(str(ensure_model()), map_location="cuda").eval()
        recurrent = [None, None, None, None]
        board = checkerboard(height, width, "cuda")
        torch.backends.cudnn.benchmark = True
        started = time.perf_counter()
        for index, frame_path in enumerate(frames, 1):
            image = cv2.imread(str(frame_path), cv2.IMREAD_COLOR)
            if image is None:
                raise RuntimeError(f"cannot read decoded frame {frame_path}")
            source_tensor = torch.from_numpy(image[:, :, ::-1].copy()).permute(2, 0, 1)[None].cuda().float().div_(255)
            with torch.inference_mode(), torch.autocast("cuda", dtype=torch.float16):
                _, alpha, *recurrent = model(source_tensor, *recurrent, config["downsample_ratio"])
                recolored = low_frequency_recolor(source_tensor, alpha, config["recolor"], config["recolor_strength"])
                checked = recolored * alpha + board * (1 - alpha)
            name = f"{index:06d}.png"
            write_png(work / "matte" / name, alpha.expand(-1, 3, -1, -1))
            write_png(work / "rgba" / name, recolored, alpha)
            write_png(work / "recolor" / name, recolored)
            write_png(work / "checker" / name, checked)
            if index == 1 or index % 24 == 0 or index == len(frames):
                print(f"matted {index}/{len(frames)} frames", flush=True)
        torch.cuda.synchronize()
        inference_seconds = time.perf_counter() - started
        matte_marker.write_text(f"{len(frames)}\n")
    outputs = encode_outputs(source, work, result, fps)
    metadata = {
        "job_key": key, "source": str(source), "source_sha256": config["input_sha256"],
        "width": width, "height": height, "fps": fps, "frames": len(frames),
        "expected_frames": expected_frames, "engine": config["engine"],
        "downsample_ratio": config["downsample_ratio"], "inference_seconds": inference_seconds,
        "inference_fps": len(frames) / inference_seconds if inference_seconds else None,
        "inference_reused": inference_reused,
        "transport": "portable-png-fallback",
        "av1_encoder": f"av1_nvenc@{os.environ['VIDEO_MATTING_AV1_HOST']}" if os.environ.get("VIDEO_MATTING_AV1_HOST") else "software",
        "pixel_strategy": config["output_pixels"], "outputs": outputs,
    }
    metadata["sha256"] = {name: sha256_file(Path(path)) for name, path in outputs.items()}
    (result / "manifest.json").write_text(json.dumps(metadata, indent=2, sort_keys=True) + "\n")
    return result


class Heartbeat:
    def __init__(self, key: str, worker: str, lease: int):
        self.key, self.worker, self.lease = key, worker, lease
        self.stop_event = threading.Event()
        self.thread = threading.Thread(target=self._run, daemon=True)

    def _run(self):
        while not self.stop_event.wait(max(5, self.lease // 3)):
            try:
                jobctl("heartbeat", QUEUE, self.key, self.worker, str(self.lease))
            except Exception as exc:
                print(f"heartbeat failed: {exc}", file=sys.stderr, flush=True)

    def __enter__(self): self.thread.start(); return self
    def __exit__(self, *_): self.stop_event.set(); self.thread.join(timeout=2)


def available_mib(reserve: int) -> int:
    query = run(["nvidia-smi", "--query-gpu=memory.total,memory.used", "--format=csv,noheader,nounits"], capture=True)
    total, used = (int(x.strip()) for x in query.stdout.splitlines()[0].split(","))
    return max(0, total - used - reserve)


def work_once(args) -> dict:
    worker = args.worker or f"{socket.gethostname()}:{os.getpid()}"
    gpu = args.gpu_name or f"{socket.gethostname()}:{args.gpu}"
    response = jobctl("claim", QUEUE, worker, gpu, str(available_mib(args.reserve_mib)), str(args.lease_seconds), "video-matting")
    if response.get("disposition") == "empty":
        print(json.dumps(response)); return response
    key = response["key"]
    try:
        with Heartbeat(key, worker, args.lease_seconds):
            result = process_manifest(key, Path(response["payload"]))
        settled = jobctl("finish", QUEUE, key, worker, str(result))
        print(json.dumps(settled, indent=2))
        return {"key": key, "result": str(result)}
    except Exception as exc:
        try: jobctl("fail", QUEUE, key, worker, str(exc))
        except Exception: pass
        raise


def benchmark(args) -> dict:
    import cv2
    import numpy as np
    import torch

    source = resolve_input(args.input)
    frames = decode_frames(source, CACHE / "bench" / sha256_file(source)[:16] / "source")
    model = torch.jit.load(str(ensure_model()), map_location="cuda").eval()
    ratios = [float(value) for value in args.ratios.split(",")]
    warm_image = cv2.imread(str(frames[0]), cv2.IMREAD_COLOR)
    warm_tensor = torch.from_numpy(warm_image[:, :, ::-1].copy()).permute(2, 0, 1)[None].cuda().float().div_(255)
    with torch.inference_mode(), torch.autocast("cuda", dtype=torch.float16):
        model(warm_tensor, None, None, None, None, ratios[0])
    torch.cuda.synchronize()
    all_alpha, timings = {}, {}
    for ratio in ratios:
        recurrent = [None] * 4; values = []; started = time.perf_counter()
        for frame in frames:
            image = cv2.imread(str(frame), cv2.IMREAD_COLOR)
            tensor = torch.from_numpy(image[:, :, ::-1].copy()).permute(2, 0, 1)[None].cuda().float().div_(255)
            with torch.inference_mode(), torch.autocast("cuda", dtype=torch.float16):
                _, alpha, *recurrent = model(tensor, *recurrent, ratio)
            values.append((alpha[0, 0].clamp(0, 1) * 255).byte().cpu().numpy())
        torch.cuda.synchronize(); timings[ratio] = time.perf_counter() - started
        all_alpha[ratio] = np.stack(values)
    reference = all_alpha[ratios[-1]].astype(np.float32) / 255
    edge = (reference > 0.02) & (reference < 0.98)
    report = {"source": str(source), "frames": len(frames), "reference_ratio": ratios[-1], "ratios": {}}
    for ratio in ratios:
        candidate = all_alpha[ratio].astype(np.float32) / 255
        intersection = np.logical_and(candidate >= .5, reference >= .5).sum()
        union = np.logical_or(candidate >= .5, reference >= .5).sum()
        report["ratios"][str(ratio)] = {
            "fps": len(frames) / timings[ratio], "seconds": timings[ratio],
            "edge_mae_vs_reference": float(np.abs(candidate - reference)[edge].mean()) if edge.any() else 0,
            "mask_iou_vs_reference": float(intersection / union) if union else 1,
            "mean_frame_delta": float(np.abs(np.diff(candidate, axis=0)).mean()),
        }
    output = RESULTS / "quality-benchmark.json"; output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    print(json.dumps(report, indent=2)); return report


def parser() -> argparse.ArgumentParser:
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--input", required=True)
    common.add_argument("--ratio", type=float, default=1.0)
    common.add_argument("--recolor", choices=("none", "rose-gold", "cool"), default="rose-gold")
    common.add_argument("--recolor-strength", type=float, default=0.7)
    common.add_argument("--transport", choices=("auto", "portable", "zero-copy"), default="auto")
    common.add_argument("--required-mib", type=int, default=1800)
    common.add_argument("--priority", type=int, default=10)
    root = argparse.ArgumentParser(description=__doc__)
    sub = root.add_subparsers(dest="command", required=True)
    sub.add_parser("submit", parents=[common])
    sub.add_parser("run", parents=[common])
    worker = sub.add_parser("worker")
    worker.add_argument("--once", action="store_true", default=True)
    worker.add_argument("--worker")
    worker.add_argument("--gpu", type=int, default=0)
    worker.add_argument("--gpu-name")
    worker.add_argument("--reserve-mib", type=int, default=2048)
    worker.add_argument("--lease-seconds", type=int, default=120)
    bench = sub.add_parser("benchmark")
    bench.add_argument("--input", required=True)
    bench.add_argument("--ratios", default="0.25,0.375,0.5,0.75,1.0")
    return root


def main() -> int:
    args = parser().parse_args()
    CACHE.mkdir(parents=True, exist_ok=True); RESULTS.mkdir(parents=True, exist_ok=True)
    if args.command == "submit": submit(args)
    elif args.command == "worker": work_once(args)
    elif args.command == "run":
        key, response = submit(args)
        if response.get("state") == "succeeded":
            print(json.dumps({"key": key, "cached": True, "result": response.get("result")}, indent=2))
        else:
            if response.get("state") == "failed":
                jobctl("retry", QUEUE, key)
            worker_args = argparse.Namespace(worker=None, gpu=0, gpu_name=None, reserve_mib=2048, lease_seconds=120)
            work_once(worker_args)
    elif args.command == "benchmark": benchmark(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
