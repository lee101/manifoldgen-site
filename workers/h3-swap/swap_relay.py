"""Masked character swap (the LoRA author's recipe): SAM 3.1 finds and tracks the selected person, the mask is expanded, and H3 regenerates
only that region with the character reference while the rest of the shot is preserved from the source video.

The graph is the upstream akatz-ai/h3-relay toolkit workflow (GPL-3.0 node pack, so it is fetched and installed at runtime on the pod, pinned
to RELAY_SHA, never vendored or baked into an image). Without the mask the model only treats the source as a loose reference and photoreal
faces do not change.
"""
import copy
import json
import subprocess
import urllib.request
from pathlib import Path

RELAY_SHA = "e2a7665b6eb8ea37a88c0de2c9c6b69a8f7c9220"
RELAY_REPO = "https://github.com/akatz-ai/h3-relay.git"
TEMPLATE_URL = f"https://raw.githubusercontent.com/akatz-ai/h3-relay/{RELAY_SHA}/example_workflows/toolkit/H3-Character-Swap.api.json"
SAM_URL = "https://huggingface.co/Comfy-Org/sam3.1/resolve/main/checkpoints/sam3.1_multiplex_fp16.safetensors"
SAM_NAME = "sam3.1_multiplex_fp16.safetensors"
CACHE = Path("/tmp/relay_swap.api.json")


def ensure_installed(comfy_dir):
    """Install the node pack and SAM weights if missing. Returns True when ComfyUI must be restarted to load them."""
    comfy = Path(comfy_dir)
    changed = False
    nodes = comfy / "custom_nodes" / "h3-relay"
    if not nodes.exists():
        subprocess.run(["git", "clone", "--quiet", RELAY_REPO, str(nodes)], check=True)
        subprocess.run(["git", "-C", str(nodes), "checkout", "--quiet", RELAY_SHA], check=True)
        changed = True
    sam = comfy / "models" / "checkpoints" / SAM_NAME
    if not sam.exists():
        subprocess.run(["curl", "-sL", "--fail", "-o", str(sam) + ".part", SAM_URL], check=True)
        sam.with_name(SAM_NAME + ".part").rename(sam)
        changed = True
    return changed


def template():
    if not CACHE.exists():
        req = urllib.request.Request(TEMPLATE_URL, headers={"User-Agent": "manifoldgen-h3-swap/1.0"})
        CACHE.write_bytes(urllib.request.urlopen(req, timeout=60).read())
    return json.loads(CACHE.read_text())


def build_relay_graph(*, prompt, subject, video_name, image_name, seed, steps=8, prefix="relay", swap_lora="h3_character_swap_v1.5.safetensors",
                      lora_strength=1.0, window_frames=124, expansion_px=64, resolution="768", sam_threshold=0.35, selection="largest",
                      anchor_name=None, blur_scale=None):
    g = copy.deepcopy(template())
    if anchor_name:  # first frame with the person already swapped (image-editor result): H3 carries its identity through the motion
        g["anchor_img"] = {"class_type": "LoadImage", "inputs": {"image": anchor_name}}
        g["window"]["inputs"]["anchor"] = ["anchor_img", 0]
    if blur_scale:  # hide the selected person's identity in the video the model sees (pixelate inside the mask only); pose and silhouette stay
        g["blur_down"] = {"class_type": "ImageScaleBy", "inputs": {"image": ["prepare", 0], "upscale_method": "area", "scale_by": float(blur_scale)}}
        g["blur_up"] = {"class_type": "ImageScaleBy", "inputs": {"image": ["blur_down", 0], "upscale_method": "bilinear", "scale_by": 1.0 / float(blur_scale)}}
        g["blur_comp"] = {"class_type": "ImageCompositeMasked", "inputs": {"destination": ["prepare", 0], "source": ["blur_up", 0], "x": 0, "y": 0,
                                                                          "resize_source": False, "mask": ["expand_mask", 0]}}
        g["window"]["inputs"]["source"] = ["blur_comp", 0]
    g["source"]["inputs"]["file"] = video_name
    g["reference"]["inputs"]["image"] = image_name
    g["subject"]["inputs"]["text"] = subject
    g["reference_conditioning"]["inputs"]["prompt"] = prompt
    g["adapter"]["inputs"]["lora_name"] = swap_lora
    g["adapter"]["inputs"]["strength_model"] = float(lora_strength)
    g["plan"]["inputs"]["seed"] = int(seed)
    g["plan"]["inputs"]["window_frames"] = str(int(window_frames))
    g["schedule"]["inputs"]["steps"] = int(steps)
    g["expand_mask"]["inputs"]["expansion_px"] = int(expansion_px)
    g["prepare"]["inputs"]["resolution"] = str(resolution)
    g["detect"]["inputs"]["threshold"] = float(sam_threshold)
    g["select"]["inputs"]["selection"] = selection
    g["save"]["inputs"]["filename_prefix"] = prefix
    if "mask_preview" in g:  # preview nodes need no output
        g.pop("mask_preview")
    return g
