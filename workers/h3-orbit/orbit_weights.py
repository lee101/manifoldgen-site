"""Weight plan for the orbit lane: FL2VA transformer, text encoder, video VAE (appstatic mirror) and the orbit LoRA."""

import os

import swap_weights as weights

LORA_NAME = "minimax_h3_flf2v_lora_v1.safetensors"
LORA_SIZE = 155_111_424
LORA_SHA = "14f13e3effaf3e729fdc0c97680344aa63f473be0c55963f963d718b3db2a4d4"
HF_REVISION = "5ddbc2dbbe95edbbdaf5017c3e934b1d01791697"
HF_LORA = f"https://huggingface.co/pablodawson/MiniMax-H3-360-Orbit-LoRA/resolve/{HF_REVISION}/{LORA_NAME}"
ORBIT_BASE = os.environ.get("ORBIT_LORA_BASE", "https://manifoldgenstatic.manifoldgen.com/models/h3-orbit").rstrip("/")
BASE_FILES = (
    "diffusion_models/minimax_h3_fl2va_pruned_int8_convrot.safetensors",
    "text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors",
    "vae/minimax_h3_video_vae_fp16.safetensors",
)


def plan():
    manifest = weights.fetch_json(f"{weights.BASE}/manifest.json")
    if isinstance(manifest, list):
        manifest = {entry["path"]: entry for entry in manifest}
    entries = [{**manifest[path], "url": f"{weights.BASE}/{path}", "path": path} for path in BASE_FILES]
    entries.append({"path": f"loras/{LORA_NAME}", "size": LORA_SIZE, "sha256": LORA_SHA, "url": f"{ORBIT_BASE}/{LORA_NAME}", "fallback": HF_LORA})
    return entries


def ensure_weights():
    weights.plan = plan
    return weights.ensure_weights()
