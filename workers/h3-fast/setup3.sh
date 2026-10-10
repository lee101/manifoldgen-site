set -x
export HF_HOME=/tmp/hf HF_HUB_DISABLE_XET=1
python -u - <<'PY'
from huggingface_hub import hf_hub_download
import os, glob
t = os.environ.get("HF_TOKEN") or None
M = "/opt/ComfyUI/models/"
def link(src, dst):
    if os.path.lexists(M + dst): os.remove(M + dst)
    os.symlink(src, M + dst)
p = glob.glob("/runpod-volume/huggingface-cache/hub/models--SexGod1979--PinkCherry_MiniMax-H3/snapshots/*/beta-0.6-fl2va/*.safetensors")
print(p)
link(p[0], "diffusion_models/PinkCherry_fl2va_MiniMax_H3_pruned_int8_convrot-beta-0.6.safetensors")
os.makedirs(M + "loras", exist_ok=True)
for repo, fn in [("lightx2v/Minimax-h3-Turbo", "minimax_h3_fl2v_turbo_4step_v1.2_768p_comfyui_bf16.safetensors"),
                 ("lightx2v/Minimax-h3-Turbo", "minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors"),
                 ("Kijai/MiniMax-H3_comfy", "loras/minimax_h3_taomate_3step_lora_avg_rank_19_bf16.safetensors"),
                 ("Kijai/MiniMax-H3_comfy", "loras/minimax_h3_fl2v_lightx2v_turbo_8step_v1.0_resized_avg_rank_24_bf16.safetensors")]:
    f = hf_hub_download(repo, fn, token=t); print(f); link(f, "loras/" + os.path.basename(fn))
PY
ls -la /opt/ComfyUI/models/loras /opt/ComfyUI/models/diffusion_models | cat
echo SETUP3_DONE
