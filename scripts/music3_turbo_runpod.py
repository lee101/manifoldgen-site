#!/usr/bin/env python3
"""Run the community MiniMax Music 3 Turbo FP8 bundle on a temporary RunPod."""

import argparse
import json
import os
import pathlib
import ssl
import socket
import subprocess
import time
import urllib.parse
import urllib.request

import music3_bench as bench


ROOT = pathlib.Path(__file__).resolve().parents[1]
HF_REPO = "guillaume127/MiniMax-Music-3-Turbo-FP8"
IMAGE = os.environ.get("MUSIC3_TURBO_IMAGE", "runpod/comfyui:latest")
MODEL_FILES = {
    "diffusion_models/minimax_music3_dit_fp8_e4m3fn.safetensors": "minimax_music3_dit_fp8_e4m3fn.safetensors",
    "text_encoders/minimax_music3_text_encoder_fp8_e4m3fn.safetensors": "minimax_music3_text_encoder_fp8_e4m3fn.safetensors",
    "loras/minimax_music3_turbo_lora_8step.safetensors": "minimax_music3_turbo_lora_8step.safetensors",
}


def load_env(path):
    bench.load_env(path)


def runpod(method, path, payload=None):
    key = os.environ.get("RUNPOD_API_KEY") or os.environ["H3_RUNPOD_API_KEY"]
    data = json.dumps(payload).encode() if payload is not None else None
    api_base = os.environ.get("RUNPOD_API_BASE", "https://rest.runpod.io/v1")
    request = urllib.request.Request(
        api_base.rstrip("/") + path,
        data=data,
        method=method,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    last_error = None
    tunnel_host = None
    if api_base.startswith("https://rest.runpod.io:"):
        tunnel_host = urllib.parse.urlparse(api_base).port
    context = ssl._create_unverified_context() if api_base.startswith("https://127.0.0.1:") else None
    for attempt in range(3):
        try:
            original_getaddrinfo = socket.getaddrinfo
            if tunnel_host:
                def tunnel_getaddrinfo(host, port, *args, **kwargs):
                    if host == "rest.runpod.io" and port == tunnel_host:
                        host = "127.0.0.1"
                    return original_getaddrinfo(host, port, *args, **kwargs)
                socket.getaddrinfo = tunnel_getaddrinfo
            with urllib.request.urlopen(request, timeout=30, context=context) as response:
                body = response.read()
                return json.loads(body) if body else {}
        except urllib.error.URLError as error:
            last_error = error
            if attempt == 2:
                raise
            print(f"RunPod API retry {attempt + 1}/2: {error}", flush=True)
            time.sleep(10)
        finally:
            if tunnel_host:
                socket.getaddrinfo = original_getaddrinfo
    raise last_error


DIRECT_RUNNER = r'''#!/usr/bin/env python3
"""Standalone MiniMax Music 3 runner.

This intentionally does not start ComfyUI or submit a workflow.  The small
amount of upstream model math is used as a Python library: we instantiate the
AR text/audio-code model, the flow DiT, and the DAV decoder, then run the
sampling loop here so the FP8 bundle is exercised directly.
"""

import argparse
import json
import pathlib
import re
import sys
import urllib.request

# comfy.model_management parses process arguments at import time.  Keep its
# CUDA/FP8 switches, but do not expose our application arguments to it.
_argv = sys.argv[:]
sys.argv = [sys.argv[0], "--supports-fp8-compute"]
import torch
from safetensors.torch import load_file

try:
    import comfy_kitchen
except ImportError:
    import types
    comfy_kitchen = types.ModuleType("comfy_kitchen")
    sys.modules["comfy_kitchen"] = comfy_kitchen


def _fallback_rope(x, rotation_matrix):
    dtype = x.dtype
    shaped = x.reshape(*x.shape[:-1], 2, -1).movedim(-2, -1).unsqueeze(-2)
    shaped = shaped.to(rotation_matrix.dtype)
    rotated = rotation_matrix[..., 0] * shaped[..., 0] + rotation_matrix[..., 1] * shaped[..., 1]
    return rotated.movedim(-1, -2).flatten(-2).to(dtype)


if not hasattr(comfy_kitchen, "int8_attention_is_available"):
    comfy_kitchen.int8_attention_is_available = lambda: False
if not hasattr(comfy_kitchen, "flash_attention_decode_is_available"):
    comfy_kitchen.flash_attention_decode_is_available = lambda device: False
if not hasattr(comfy_kitchen, "apply_rope_split_half"):
    comfy_kitchen.apply_rope_split_half = lambda q, k, rotation_matrix: (
        _fallback_rope(q, rotation_matrix), _fallback_rope(k, rotation_matrix)
    )

import comfy.ops
from comfy.ldm.minimax_music.ar import MiniMaxMusic3AR
from comfy.ldm.minimax_music.dav import MiniMaxMusic3DAV
from comfy.ldm.minimax_music.dit import MiniMaxMusic3DiT, latent_length
from comfy.ldm.minimax_music.prompt import build_prompt
from comfy.text_encoders.minimax_music import (
    MODEL_CONFIG,
    MiniMaxMusic3TEModel,
    MiniMaxMusic3Tokenizer,
    detect_merged_config,
)
sys.argv = _argv


def load_weights(path):
    print("loading", path, flush=True)
    return load_file(str(path), device="cpu")


def strip_prefixes(state, prefixes):
    for prefix in prefixes:
        if state and all(key.startswith(prefix) for key in state):
            return {key[len(prefix):]: value for key, value in state.items()}
    return state


def load_text_encoder(path, device):
    state = load_weights(path)
    tokenizer_json = state.pop("tokenizer_json")
    tokenizer = MiniMaxMusic3Tokenizer(tokenizer_data={"tokenizer_json": tokenizer_json})
    projection = detect_merged_config(state)
    # assign=True preserves native FP8 tensors instead of expanding the 9 GB
    # checkpoint to BF16 during load.  The model is moved to CUDA afterwards.
    model = MiniMaxMusic3TEModel(
        device="cpu",
        dtype=torch.bfloat16,
        model_options={"custom_operations": comfy.ops.fp8_ops},
        projection_config=projection,
    )
    missing, unexpected = model.load_state_dict(state, strict=False, assign=True)
    print("text encoder loaded; missing", len(missing), "unexpected", len(unexpected), flush=True)
    model.model.prefetch_dynamic_vbars = False
    model.model.graph_dynamic_vbar_blocks = False
    model.to(device)
    model.eval()
    return model, tokenizer


def load_dit(path, lora_path, device):
    state = strip_prefixes(load_weights(path), ("diffusion_model.", "model.diffusion_model."))
    model = MiniMaxMusic3DiT(dtype=torch.bfloat16, device="cpu", operations=comfy.ops.fp8_ops)
    missing, unexpected = model.load_state_dict(state, strict=False, assign=True)
    print("DiT loaded; missing", len(missing), "unexpected", len(unexpected), flush=True)
    model.to(device).eval()
    apply_lora(model, load_weights(lora_path), strength=0.85)
    return model


def _lora_base(key):
    key = key.removeprefix("base_model.model.")
    key = key.removeprefix("diffusion_model.")
    key = key.removeprefix("unet.")
    for marker in (".lora_A.", ".lora_B.", ".lora_down.", ".lora_up."):
        if marker in key:
            return key.split(marker, 1)[0]
    # Older Comfy LoRAs use a flat suffix after the target path.
    key = re.sub(r"\.(?:lora_[AB]|lora_(?:down|up))(?:\.[^.]+)?\.weight$", "", key)
    return key


def _lora_kind(key):
    if ".lora_A." in key or ".lora_down." in key or key.endswith(".lora_A.weight") or key.endswith(".lora_down.weight"):
        return "down"
    if ".lora_B." in key or ".lora_up." in key or key.endswith(".lora_B.weight") or key.endswith(".lora_up.weight"):
        return "up"
    return None


def apply_lora(model, state, strength):
    targets = {name + ".weight": (name, module) for name, module in model.named_modules() if hasattr(module, "weight")}
    by_name = {}
    for full, item in targets.items():
        bare = full[:-len(".weight")]
        by_name[bare] = item
        by_name[bare.replace(".", "_")] = item
        by_name[("diffusion_model." + bare)] = item
        by_name[("diffusion_model." + bare).replace(".", "_")] = item
    down = {}
    up = {}
    alpha = {}
    for key, value in state.items():
        kind = _lora_kind(key)
        base = _lora_base(key)
        if kind == "down":
            down[base] = value
        elif kind == "up":
            up[base] = value
        elif key.endswith(".alpha"):
            alpha[_lora_base(key)] = float(value.item())
    merged = 0
    unmatched = []
    with torch.no_grad():
        for base, down_weight in down.items():
            up_weight = up.get(base)
            target = by_name.get(base)
            if target is None:
                target = by_name.get(base.replace(".", "_"))
            if up_weight is None or target is None:
                unmatched.append(base)
                continue
            _, module = target
            delta = up_weight.float() @ down_weight.float()
            if delta.shape != module.weight.shape:
                if delta.T.shape == module.weight.shape:
                    delta = delta.T
                else:
                    unmatched.append(base + " shape=" + str(tuple(delta.shape)))
                    continue
            rank = down_weight.shape[0]
            scale = strength * alpha.get(base, rank) / rank
            # Merging changes only the DiT's ~2.5 GB of FP8 matrices to BF16;
            # the text encoder remains native FP8.
            module.weight.data = module.weight.data.to(dtype=torch.bfloat16) + delta.to(device=module.weight.device, dtype=torch.bfloat16) * scale
            merged += 1
    print("turbo LoRA merged", merged, "modules; unmatched", len(unmatched), flush=True)
    if unmatched:
        print("unmatched LoRA examples", unmatched[:8], flush=True)


def load_vae(path, device):
    state = strip_prefixes(load_weights(path), ("vae.", "first_stage_model.", "model."))
    model = MiniMaxMusic3DAV(dtype=torch.bfloat16, device="cpu", operations=comfy.ops.disable_weight_init)
    missing, unexpected = model.load_state_dict(state, strict=False, assign=True)
    print("DAV loaded; missing", len(missing), "unexpected", len(unexpected), flush=True)
    model.to(device=device, dtype=torch.bfloat16).eval()
    return model


@torch.inference_mode()
def generate(text_model, tokenizer, dit, vae, caption, lyrics, duration, seed, device):
    max_frames = max(1, int(round(duration * 25)))
    prompt = build_prompt(caption, lyrics)
    input_ids = torch.tensor([tokenizer.tokenizer.encode(prompt, add_special_tokens=False).ids], dtype=torch.long)
    hidden = text_model.generate(input_ids, seed, max_frames, device, cfg_scale=1.5, top_k=50)
    print("AR frames", hidden.shape[0], flush=True)
    context = hidden.unsqueeze(0).to(device=device, dtype=torch.bfloat16)
    latent_frames = latent_length(hidden.shape[0])
    generator = torch.Generator(device=device).manual_seed(int(seed))
    x = torch.randn((1, 128, latent_frames), generator=generator, device=device, dtype=torch.bfloat16)

    # MiniMax Music 3's model config uses multiplier=1 and shift=1.  The
    # Comfy "simple" scheduler therefore samples evenly from sigma 1 to 0.
    sigmas = torch.linspace(1.0, 0.0, 9, device=device, dtype=torch.float32)
    conditioning_scale = torch.ones((1, 1, 1), device=device, dtype=torch.bfloat16)
    for index in range(8):
        sigma = sigmas[index]
        timestep = torch.full((1,), 1.0 - sigma, device=device, dtype=torch.float32)
        velocity = dit(x, timestep, context, conditioning_scale)
        x = x + velocity * (sigmas[index + 1] - sigma)
        print("DiT step", index + 1, "/ 8", flush=True)

    audio = vae.decode(x)[0].float().cpu()
    std = audio.std() * 5.0
    if std >= 1.0:
        audio /= std
    return audio


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", type=pathlib.Path, required=True)
    parser.add_argument("--vae", type=pathlib.Path, required=True)
    parser.add_argument("--caption", required=True)
    parser.add_argument("--lyrics", required=True)
    parser.add_argument("--duration", type=float, required=True)
    parser.add_argument("--seed", type=int, required=True)
    parser.add_argument("--output", type=pathlib.Path, required=True)
    parser.add_argument("--upload-url")
    parser.add_argument("--no-upload", action="store_true")
    args = parser.parse_args()
    device = "cuda"
    args.output.parent.mkdir(parents=True, exist_ok=True)
    text_model, tokenizer = load_text_encoder(args.model_dir / "minimax_music3_text_encoder_fp8_e4m3fn.safetensors", device)
    dit = load_dit(args.model_dir / "minimax_music3_dit_fp8_e4m3fn.safetensors", args.model_dir / "minimax_music3_turbo_lora_8step.safetensors", device)
    vae = load_vae(args.vae, device)
    audio = generate(text_model, tokenizer, dit, vae, args.caption, args.lyrics, args.duration, args.seed, device)
    import wave
    import numpy as np
    pcm = (audio.clamp(-1.0, 1.0).numpy().T * 32767.0).astype(np.int16)
    with wave.open(str(args.output), "wb") as wav:
        wav.setnchannels(pcm.shape[1] if pcm.ndim == 2 else 1)
        wav.setsampwidth(2)
        wav.setframerate(44100)
        wav.writeframes(pcm.tobytes())
    if args.no_upload:
        print("saved", args.output, args.output.stat().st_size, "bytes", flush=True)
        return
    if not args.upload_url:
        raise ValueError("--upload-url is required unless --no-upload is set")
    data = args.output.read_bytes()
    request = urllib.request.Request(args.upload_url, data=data, method="PUT", headers={"Content-Type": "audio/wav"})
    with urllib.request.urlopen(request, timeout=300) as response:
        response.read()
    print("uploaded", len(data), "bytes", flush=True)


if __name__ == "__main__":
    main()
'''


def pod_script(lyrics, prompt, seed, duration, upload_url):
    # No ComfyUI server or workflow is launched.  The public CUDA image is
    # only a convenient PyTorch runtime; the runner above is the process that
    # loads checkpoints and performs all three model stages directly.
    runner_json = json.dumps(DIRECT_RUNNER)
    lyrics_json = json.dumps(lyrics)
    prompt_json = json.dumps(prompt)
    upload_json = json.dumps(upload_url)
    return f'''set -Eeuo pipefail
exec > >(tee -a /tmp/turbo-fp8-run.log) 2>&1
model_dir=/workspace/models/minimax-music3-turbo
vae_dir=/workspace/models/minimax-music3-comfy
mkdir -p /runpod-volume/omniserve/music3 "$model_dir" "$vae_dir"
python3 - <<'PY'
from huggingface_hub import hf_hub_download
from pathlib import Path
base = Path("/workspace/models/minimax-music3-turbo")
base.mkdir(parents=True, exist_ok=True)
for filename in {list(MODEL_FILES.values())!r}:
    print("ensuring", filename, flush=True)
    hf_hub_download(repo_id={HF_REPO!r}, filename=filename, local_dir=str(base))
vae_base = Path("/workspace/models/minimax-music3-comfy")
vae_base.mkdir(parents=True, exist_ok=True)
hf_hub_download(repo_id="Comfy-Org/MiniMax-Music-3", filename="vae/minimax_music3_dav.safetensors", local_dir=str(vae_base))
PY
python3 - <<'PY'
import json
from pathlib import Path
Path("/runpod-volume/omniserve/music3/music3_turbo_direct.py").write_text(json.loads({runner_json!r}))
PY
if [ -f /opt/comfyui-baked/comfy/ldm/minimax_music/dit.py ] && [ -f /opt/comfyui-baked/comfy/text_encoders/minimax_music.py ]; then
  comfy_root=/opt/comfyui-baked
else
  comfy_root=/opt/comfyui-direct
  if [ ! -d "$comfy_root/.git" ]; then
    git clone --depth=1 https://github.com/Comfy-Org/ComfyUI.git "$comfy_root"
  fi
fi
PYTHONPATH="$comfy_root" python3 /runpod-volume/omniserve/music3/music3_turbo_direct.py \
  --model-dir "$model_dir" \
  --vae "$vae_dir/vae/minimax_music3_dav.safetensors" \
  --caption {prompt_json} --lyrics {lyrics_json} --duration {float(duration)!r} --seed {int(seed)} \
  --output /runpod-volume/omniserve/music3/turbo-fp8-result.wav --upload-url {upload_json}
sleep 5
'''


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--name", default="observer-effect-turbo-fp8")
    parser.add_argument("--lyrics-file", required=True)
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--duration", type=int, default=60)
    parser.add_argument("--seed", type=int, default=20260822)
    parser.add_argument("--output-dir", type=pathlib.Path, default=ROOT / "testresults")
    args = parser.parse_args()
    load_env(ROOT / ".env")
    load_env(pathlib.Path("/vfast/data/code/omniserve-native/.runpod-music3.env"))
    args.output_dir.mkdir(parents=True, exist_ok=True)
    upload_url, public_url, fetch_url = bench.presign(f"createdmusic/{args.name}-{int(time.time())}.wav")
    script = pod_script(args.lyrics_file and pathlib.Path(args.lyrics_file).read_text().strip(), args.prompt, args.seed, args.duration, upload_url)
    pod = runpod("POST", "/pods", {
        "name": f"manifoldgen-{args.name}", "imageName": IMAGE,
        "gpuTypeIds": ["NVIDIA GeForce RTX 4090", "NVIDIA RTX PRO 6000 Blackwell Server Edition", "NVIDIA H200"],
        "gpuCount": 1, "cloudType": "SECURE", "networkVolumeId": os.environ["MUSIC3_RUNPOD_NETWORK_VOLUME_ID"],
        "dataCenterIds": [os.environ["MUSIC3_RUNPOD_DATACENTER_ID"]], "containerDiskInGb": 30,
        "volumeMountPath": "/runpod-volume", "dockerEntrypoint": [],
        "dockerStartCmd": ["bash", "-lc", script], "ports": [],
    })
    pod_id = pod["id"]
    print("pod", pod_id, flush=True)
    try:
        for attempt in range(180):
            try:
                status = runpod("GET", f"/pods/{pod_id}")
                if status.get("desiredStatus") == "EXITED":
                    raise RuntimeError(f"RunPod pod exited: {status.get('lastStatusChange', 'unknown reason')}")
                with urllib.request.urlopen(fetch_url, timeout=60) as response:
                    output = response.read()
                wav = args.output_dir / f"{args.name}.wav"
                wav.write_bytes(output)
                subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-c:a", "libopus", "-b:a", "128k", str(args.output_dir / f"{args.name}.opus")], check=True)
                (args.output_dir / f"{args.name}.json").write_text(json.dumps({"pod_id": pod_id, "public_url": public_url, "model": HF_REPO, "steps": 8, "lora_strength": 0.85, "attention": "sage"}, indent=2))
                print("saved", wav, wav.stat().st_size, flush=True)
                return
            except Exception as error:
                if attempt % 6 == 0:
                    print("waiting", attempt * 10, error, flush=True)
                time.sleep(10)
        raise TimeoutError("Turbo FP8 output did not appear")
    finally:
        runpod("DELETE", f"/pods/{pod_id}")
        print("terminated", pod_id, flush=True)


if __name__ == "__main__":
    main()
