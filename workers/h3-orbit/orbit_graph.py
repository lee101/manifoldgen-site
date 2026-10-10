"""360 orbit ComfyUI graph: MiniMax H3 FL2VA + pablodawson orbit LoRA, one photo as first and last frame."""

import math

FPS = 24
FL2VA_MODEL = "minimax_h3_fl2va_pruned_int8_convrot.safetensors"
TEXT_ENCODER = "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors"
VIDEO_VAE = "minimax_h3_video_vae_fp16.safetensors"
ORBIT_LORA = "minimax_h3_flf2v_lora_v1.safetensors"
DEFAULT_FRAMES = 73
DEFAULT_STEPS = 28
DEFAULT_SIZE = 768
PROMPT = (
    "One frozen instant. Only the camera moves. In a continuous 360 orbit. Preserve every person and object in exactly the same "
    "world position, orientation, shape and pose throughout the shot. Airborne objects remain suspended at the captured height "
    "and angle: no wobbling, shaking, spinning, drifting, falling or continued action. Keep faces, hands, clothing, liquids and "
    "the background motionless while retaining their natural appearance. Camera parallax is the only source of apparent movement. "
    "No cuts, zoom, morphing or added objects."
)


def grid_frames(frames):
    """Nearest valid H3 length (17n+5) at or above `frames`."""
    n = max(5, int(frames))
    down = n - (n - 5) % 17
    return down if down == n else down + 17


def orbit_dimensions(src_w, src_h, size=DEFAULT_SIZE):
    """Fit the photo inside size x size, multiples of 32, aspect kept."""
    scale = size / max(src_w, src_h)
    return max(32, round(src_w * scale / 32) * 32), max(32, round(src_h * scale / 32) * 32)


def build_orbit_graph(*, prompt, width, height, frames, steps, seed, image_name, lora_strength=1.0, prefix="orbit"):
    graph = {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": FL2VA_MODEL, "weight_dtype": "default"}},
        "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": TEXT_ENCODER, "type": "minimax", "device": "default"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": VIDEO_VAE}},
        "20": {"class_type": "LoadImage", "inputs": {"image": image_name}},
        "22": {"class_type": "LoraLoaderModelOnly", "inputs": {"model": ["1", 0], "lora_name": ORBIT_LORA, "strength_model": float(lora_strength)}},
        "5": {"class_type": "MiniMaxH3ImageToVideo", "inputs": {
            "clip": ["2", 0], "vae": ["3", 0], "prompt": prompt, "width": int(width), "height": int(height), "length": int(frames),
            "first_frame": ["20", 0], "last_frame": ["20", 0]}},
        "6": {"class_type": "BasicGuider", "inputs": {"model": ["22", 0], "conditioning": ["5", 0]}},
        "7": {"class_type": "RandomNoise", "inputs": {"noise_seed": int(seed)}},
        "8": {"class_type": "KSamplerSelect", "inputs": {"sampler_name": "res_multistep"}},
        "9": {"class_type": "BasicScheduler", "inputs": {"model": ["22", 0], "scheduler": "simple", "steps": int(steps), "denoise": 1.0}},
        "10": {"class_type": "SamplerCustomAdvanced", "inputs": {"noise": ["7", 0], "guider": ["6", 0], "sampler": ["8", 0], "sigmas": ["9", 0], "latent_image": ["5", 1]}},
        "11": {"class_type": "VAEDecode", "inputs": {"samples": ["10", 0], "vae": ["3", 0]}},
        "13": {"class_type": "CreateVideo", "inputs": {"images": ["11", 0], "fps": float(FPS)}},
        "14": {"class_type": "SaveVideo", "inputs": {"video": ["13", 0], "filename_prefix": prefix, "format": "auto", "codec": "auto"}},
    }
    return graph
