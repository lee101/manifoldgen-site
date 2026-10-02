"""Character-swap ComfyUI graph: Ref2VA + Akatz character-swap LoRA, source video as <Video 1>."""

import json
import math
import subprocess
from pathlib import Path

FPS = 24
REF2VA_MODEL = "minimax_h3_ref2va_pruned_int8_convrot.safetensors"
TEXT_ENCODER = "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors"
VIDEO_VAE = "minimax_h3_video_vae_fp16.safetensors"
AUDIO_VAE = "minimax_h3_audio_vae_fp32.safetensors"
SWAP_LORA = "h3_character_swap_pro4500_1000.safetensors"
TURBO_LORA = "minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors"
MAX_SECONDS = 15.0
MIN_SECONDS = 0.2
TURBO_STEPS = 4
DEFAULT_STEPS = 20


def grid_frames(source_frames, mode="hold"):
    """Generation length on H3's 17n+5 grid for a source with `source_frames` frames.

    hold: round up and pad the reference with its last frame; floor: round down; ceil: round up with a
    shorter reference (the model then invents people, kept for measurement only).
    """
    n = max(5, int(source_frames))
    down = n - (n - 5) % 17
    if mode == "floor":
        return down
    return down if down == n else down + 17


def swap_frames(seconds):
    return grid_frames(round(float(seconds) * FPS), "hold")


def swap_dimensions(src_w, src_h, megapixels=0.4):
    aspect = src_w / src_h
    h = math.sqrt(megapixels * 1_000_000 / aspect)
    return max(32, round(h * aspect / 32) * 32), max(32, round(h / 32) * 32)


def probe_video(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
         "-show_entries", "format=duration", "-of", "json", str(path)],
        capture_output=True, text=True, check=True,
    ).stdout
    data = json.loads(out)
    stream = data["streams"][0]
    return int(stream["width"]), int(stream["height"]), float(data["format"]["duration"])


def count_frames(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-count_frames", "-show_entries", "stream=nb_read_frames",
         "-of", "csv=p=0", str(path)], capture_output=True, text=True, check=True,
    ).stdout.strip()
    return int(out)


def normalize_source(src, dst, width, height, frames):
    """24 fps, no audio, exactly `frames` frames (the last frame is held if the source is shorter):
    the loader does not resample frame rate and the reference must be as long as the generation."""
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-i", str(src), "-an",
         "-vf", f"fps={FPS},scale={width}:{height}:flags=lanczos,tpad=stop_mode=clone:stop_duration=1", "-frames:v", str(frames),
         "-c:v", "libx264", "-crf", "14", "-pix_fmt", "yuv420p", str(dst)],
        check=True,
    )


def build_swap_graph(*, prompt, width, height, frames, steps, seed, video_name, image_names, turbo=False,
                     lora_strength=1.0, ref_image_size="match", prefix="swap", easycache=None, sol=False):
    if not image_names:
        raise ValueError("at least one character image is required")
    if turbo and int(steps) != TURBO_STEPS:
        raise ValueError(f"turbo requires exactly {TURBO_STEPS} steps")
    graph = {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": REF2VA_MODEL, "weight_dtype": "default"}},
        "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": TEXT_ENCODER, "type": "minimax", "device": "default"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": VIDEO_VAE}},
        "4": {"class_type": "VAELoader", "inputs": {"vae_name": AUDIO_VAE}},
        "20": {"class_type": "LoadVideo", "inputs": {"file": video_name}},
        "21": {"class_type": "GetVideoComponents", "inputs": {"video": ["20", 0]}},
        "22": {"class_type": "LoraLoaderModelOnly", "inputs": {"model": ["1", 0], "lora_name": SWAP_LORA, "strength_model": float(lora_strength)}},
    }
    model = ["22", 0]
    if turbo:
        graph["23"] = {"class_type": "LoraLoaderModelOnly", "inputs": {"model": model, "lora_name": TURBO_LORA, "strength_model": 1.0}}
        model = ["23", 0]
    if sol:
        graph["24"] = {"class_type": "SolAttnPatch", "inputs": {
            "model": model, "tau": 1.3, "start_percent": 0.2, "end_percent": 0.9, "min_tokens": 4096,
            "int8_qk": True, "sink_conditioning": "exact_kv_and_rows", "morton": True, "morton_curve": "2d_frame",
            "int8_pv": True, "verbose": False, "use_tma": False, "dense_blocks": "0,-1"}}
        model = ["24", 0]
    if easycache is not None:
        graph["25"] = {"class_type": "EasyCache", "inputs": {
            "model": model, "reuse_threshold": easycache[0], "start_percent": easycache[1],
            "end_percent": easycache[2], "verbose": False}}
        model = ["25", 0]
    cond = {
        "clip": ["2", 0], "vae": ["3", 0], "audio_vae": ["4", 0], "prompt": prompt,
        "width": int(width), "height": int(height), "length": int(frames), "ref_image_size": ref_image_size,
        "ref_videos.ref_video_0": ["21", 0],
    }
    for index, name in enumerate(image_names):
        graph[str(30 + index)] = {"class_type": "LoadImage", "inputs": {"image": name}}
        cond[f"ref_images.ref_image_{index}"] = [str(30 + index), 0]
    graph["5"] = {"class_type": "MiniMaxH3ReferenceToVideo", "inputs": cond}
    graph.update({
        "6": {"class_type": "BasicGuider", "inputs": {"model": model, "conditioning": ["5", 0]}},
        "7": {"class_type": "RandomNoise", "inputs": {"noise_seed": int(seed)}},
        "8": {"class_type": "KSamplerSelect", "inputs": {"sampler_name": "res_multistep"}},
        "9": {"class_type": "BasicScheduler", "inputs": {"model": model, "scheduler": "simple", "steps": int(steps), "denoise": 1.0}},
        "10": {"class_type": "SamplerCustomAdvanced", "inputs": {"noise": ["7", 0], "guider": ["6", 0], "sampler": ["8", 0], "sigmas": ["9", 0], "latent_image": ["5", 1]}},
        "11": {"class_type": "VAEDecode", "inputs": {"samples": ["10", 0], "vae": ["3", 0]}},
        "13": {"class_type": "CreateVideo", "inputs": {"images": ["11", 0], "fps": float(FPS)}},
        "14": {"class_type": "SaveVideo", "inputs": {"video": ["13", 0], "filename_prefix": prefix, "format": "auto", "codec": "auto"}},
    })
    return graph
