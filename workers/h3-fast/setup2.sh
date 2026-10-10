set -x
export HF_HOME=/tmp/hf HF_HUB_DISABLE_XET=1
python -u - <<'PY'
from huggingface_hub import hf_hub_download, snapshot_download
import os, glob
t = os.environ.get("HF_TOKEN") or None
x = hf_hub_download("speach1sdef178/MiniMax-H3-X2-Detail-VAE", "MiniMax-H3-X2-Detail-v1.safetensors", token=t); print(x)
v = hf_hub_download("Comfy-Org/MiniMax-H3", "vae/minimax_h3_video_vae_int8_convrot.safetensors", token=t); print(v)
s = snapshot_download("speach1sdef178/MiniMax-H3-X2-Detail-VAE", allow_patterns=["custom_node/*", "workflow/*", "README.md"], token=t); print(s)
f = glob.glob("/runpod-volume/huggingface-cache/hub/models--MATLOWAI--*/snapshots/*/diffusion_models/*.safetensors")[0]
M = "/opt/ComfyUI/models/"
for src, dst in [(f, "diffusion_models/minimax_h3_fused_refdelta_r1024_turbo8_mystic07_int8_convrot.safetensors"), (x, "vae/MiniMax-H3-X2-Detail-v1.safetensors"), (v, "vae/minimax_h3_video_vae_int8_convrot.safetensors")]:
    if os.path.lexists(M + dst): os.remove(M + dst)
    os.symlink(src, M + dst)
print(os.listdir(s + "/custom_node"))
PY
find /tmp/hf -path '*custom_node*' | head -20
ls /opt/ComfyUI/custom_nodes/ComfyUI-MiniMaxH3_LatentUpscaler /opt/ComfyUI/custom_nodes/ComfyUI-PlagueKind-Nodes
echo SETUP2_DONE
