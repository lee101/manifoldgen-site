"""Split the MOSS color+depth control adapter into the pieces sd.cpp loads.

The adapter file ships LoRA weights plus a replacement video_embedder ([3072, 384]: noisy | color | depth
latents). sd.cpp applies the LoRA from the original file and loads the embedder from a small sidecar passed
with --control-net, stored under the name control_embedder so it cannot collide with the base video_embedder.

usage: uv run split_control.py moss-control.safetensors moss-control-embedder.safetensors
"""
import sys

from safetensors import safe_open
from safetensors.torch import save_file

src, dst = sys.argv[1:3]
with safe_open(src, "pt") as f:
    tensors = {
        f"model.diffusion_model.control_embedder.{name}": f.get_tensor(f"video_embedder.{name}").contiguous()
        for name in ("weight", "bias")
    }
save_file(tensors, dst, metadata={"format": "pt", "moss_control": "color,depth"})
print({k: tuple(v.shape) for k, v in tensors.items()})
