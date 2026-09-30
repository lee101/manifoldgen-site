FROM ghcr.io/lee101/h3-cog:cu130-20260826-face-judge-r7

ARG LTX_NODE_REV=main
ENV LTX_COMFY_DIR=/opt/ComfyUI \
    H3_MODERATION_DEVICE=cpu \
    HF_HUB_ENABLE_HF_TRANSFER=1

RUN python -m pip install --break-system-packages --no-cache-dir "gguf>=0.13.0" sentencepiece protobuf hf_transfer \
    && git clone https://github.com/ChrisColeTech/ComfyUI-GGUF-Loader /opt/ComfyUI/custom_nodes/ComfyUI-GGUF-Loader \
    && git -C /opt/ComfyUI/custom_nodes/ComfyUI-GGUF-Loader checkout ${LTX_NODE_REV}

RUN --mount=type=secret,id=hf_token HF_TOKEN=$(cat /run/secrets/hf_token 2>/dev/null || true) python - <<'PY'
import os
from pathlib import Path
from huggingface_hub import hf_hub_download
repo = "ChrisColeTech/LTX-2.3-uncensored-v1.4-FP8"
models = Path("/opt/ComfyUI/models")
for filename, folder in (
    ("split/diffusion_models/ltxv23_uncensored_v1.4_Q4_K_M.gguf", "diffusion_models"),
    ("split/text_encoders/gemma-3-12b-it-ablit-norms-biproj-Q4_K_M.gguf", "text_encoders"),
    ("split/text_encoders/ltxv23_uncensored_v1.4_projections.safetensors", "text_encoders"),
    ("split/vae/ltxv23_uncensored_v1.4_audio_vae.safetensors", "vae"),
    ("split/vae/ltxv23_uncensored_v1.4_video_vae.safetensors", "vae"),
    ("split/latent_upscale_models/ltx-2.3-spatial-upscaler-x2-1.0.safetensors", "latent_upscale_models"),
):
    src = Path(hf_hub_download(repo, filename, token=os.environ.get("HF_TOKEN") or None))
    dst = models / folder / Path(filename).name
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_bytes(src.read_bytes())
    src.unlink()
PY

COPY graphs.py ltx_runtime.py ltx_handler.py /src/
CMD ["python", "-u", "/src/ltx_handler.py"]
