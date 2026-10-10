set -x
cd /src
export HF_HOME=/runpod-volume/huggingface-cache HF_HUB_DISABLE_XET=1
nvidia-smi --query-gpu=name,memory.total --format=csv
git -C /opt/ComfyUI log -1 --format='%H %cd'; python -c "import torch;print(torch.__version__)"; pip list 2>/dev/null | rg -i "comfy|triton|sage|flash|kitchen" 
ls /opt/ComfyUI/custom_nodes /runpod-volume /runpod-volume/models/MiniMax-H3 /opt/ComfyUI/models/diffusion_models /opt/ComfyUI/models/vae
for i in 1 2 3; do python -u -c "import weights;print({k:str(v) for k,v in weights.ensure_weights(include_ref2va=True, include_face_refine=False).items()})" && break; sleep 5; done
mkdir -p /runpod-volume/h3-fast
python -u - <<'PY'
from huggingface_hub import hf_hub_download
import os
for repo, fn in [("MATLOWAI/minimax-h3-fused-turbo-int8-convrot","diffusion_models/minimax_h3_fused_refdelta_r1024_turbo8_mystic07_int8_convrot.safetensors"),("speach1sdef178/MiniMax-H3-X2-Detail-VAE","MiniMax-H3-X2-Detail-v1.safetensors"),("Comfy-Org/MiniMax-H3","vae/minimax_h3_video_vae_int8_convrot.safetensors")]:
    p = hf_hub_download(repo, fn, token=os.environ.get("HF_TOKEN") or None); print(p)
PY
cd /opt/ComfyUI/custom_nodes
for r in PlagueKind/ComfyUI-PlagueKind-Nodes TripleHeadedMonkey/ComfyUI-MiniMaxH3_LatentUpscaler; do n=$(basename $r); [ -d $n ] || git clone --depth 1 https://github.com/$r.git $n; done
python - <<'PY'
from huggingface_hub import snapshot_download
import os
print(snapshot_download("speach1sdef178/MiniMax-H3-X2-Detail-VAE", allow_patterns=["custom_node/*","workflow/*"], token=os.environ.get("HF_TOKEN") or None))
PY
ls /opt/ComfyUI/custom_nodes
echo SETUP_DONE
