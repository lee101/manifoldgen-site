import base64, json, os, pathlib, sys, time, urllib.request
ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
o = urllib.request.build_opener(); o.addheaders = [("User-Agent", "curl/8.10")]; urllib.request.install_opener(o)
import music3_bench as bench
import h3_upscale_gpu_probe as p
bench.load_env(ROOT / ".env")
HERE = pathlib.Path(__file__).resolve().parent
OUT = ROOT / "results/ltx-vs-pinkcherry/bench"
OUT.mkdir(parents=True, exist_ok=True)
VRAM = {"NVIDIA GeForce RTX 5090": 32, "NVIDIA GeForce RTX 4090": 24, "NVIDIA L40S": 48, "NVIDIA RTX PRO 5000 Blackwell": 48,
        "NVIDIA RTX 6000 Ada Generation": 48, "NVIDIA A100 80GB PCIe": 80, "NVIDIA H100 PCIe": 80, "NVIDIA H100 80GB HBM3": 80,
        "NVIDIA RTX PRO 6000 Blackwell Server Edition": 96, "NVIDIA H200": 141}
b64 = lambda s: base64.b64encode(s.encode()).decode()
files = {n: b64((HERE / n).read_text()) for n in ("graphs.py", "bench_pod.py", "execsrv.py")}
prompts_b64 = b64((ROOT / "results/ltx-vs-pinkcherry/prompts.json").read_text())

def boot(fp8):
    return r'''
mkdir -p /tmp/pub /workspace/models /tmp/bench; cd /tmp/pub
(python3 -m http.server 8000 --directory /tmp/pub >/dev/null 2>&1 &)
exec >> /tmp/pub/boot.log 2>&1
set -x
echo %s | base64 -d > /tmp/bench/graphs.py; echo %s | base64 -d > /tmp/bench/bench_pod.py; echo %s | base64 -d > /tmp/prompts.json; echo %s | base64 -d > /tmp/bench/execsrv.py; (python3 /tmp/bench/execsrv.py &)
nvidia-smi; free -g
python3 -m pip install --break-system-packages -q "gguf>=0.13.0" sentencepiece protobuf requests huggingface_hub hf_transfer &
git clone -q --depth 1 https://github.com/ChrisColeTech/ComfyUI-GGUF-Loader /opt/ComfyUI/custom_nodes/ComfyUI-GGUF-Loader
wait
export HF_HUB_ENABLE_HF_TRANSFER=1
python3 - <<'PY'
import os
from huggingface_hub import hf_hub_download
from concurrent.futures import ThreadPoolExecutor
R="ChrisColeTech/LTX-2.3-uncensored-v1.4-FP8"; M="/opt/ComfyUI/models"
files=[("split/diffusion_models/ltxv23_uncensored_v1.4_Q4_K_M.gguf","diffusion_models"),
("split/text_encoders/gemma-3-12b-it-ablit-norms-biproj-Q4_K_M.gguf","text_encoders"),
("split/text_encoders/ltxv23_uncensored_v1.4_projections.safetensors","text_encoders"),
("split/vae/ltxv23_uncensored_v1.4_audio_vae.safetensors","vae"),
("split/vae/ltxv23_uncensored_v1.4_video_vae.safetensors","vae"),
("split/latent_upscale_models/ltx-2.3-spatial-upscaler-x2-1.0.safetensors","latent_upscale_models")]
if os.environ.get("WANT_FP8")=="1": files.append(("split/diffusion_models/ltxv23_uncensored_v1.4_fp8mixed.safetensors","diffusion_models"))
def f(a):
    fn,d=a; os.makedirs(f"{M}/{d}",exist_ok=True)
    hf_hub_download(R,fn,local_dir="/workspace/models")
    dst=f"{M}/{d}/{os.path.basename(fn)}"
    if not os.path.exists(dst): os.symlink(f"/workspace/models/{fn}",dst)
    print("got",fn,flush=True)
list(ThreadPoolExecutor(7).map(f,files))
PY
echo MODELS_DONE
cd /tmp/bench && python3 -u bench_pod.py > /tmp/pub/bench_stdout.log 2>&1
echo BENCH_DONE
( sleep ${FAILSAFE_S:-7200}; curl -s -X DELETE -H "Authorization: Bearer $RUNPOD_API_KEY" https://rest.runpod.io/v1/pods/$RUNPOD_POD_ID ) &
sleep infinity
''' % (files["graphs.py"], files["bench_pod.py"], prompts_b64, files["execsrv.py"])

cfg = p.H3_CONFIG
auth = p.registry_auth_id(cfg)
import secrets
meta = json.load(open(OUT / "pods_meta.json")) if (OUT / "pods_meta.json").exists() else {}
TOKEN = meta.get("token") or secrets.token_hex(12)
pods = dict(meta.get("pods") or {}) if os.environ.get("MERGE") else {}
for gpu in sys.argv[1:]:
    try:
        pod = p.call("/pods", "POST", {
            "name": "ltx-bench-" + gpu.split()[-1].lower(), "imageName": cfg["image"], "containerRegistryAuthId": auth,
            "gpuTypeIds": [gpu], "gpuCount": 1, "cloudType": "SECURE", "containerDiskInGb": 120, "volumeInGb": 0,
            "allowedCudaVersions": ["13.0"],
            "dockerEntrypoint": ["bash", "-lc", boot(VRAM.get(gpu, 0) >= 40)], "dockerStartCmd": [],
            "ports": ["8000/http", "8001/http"],
            "env": {"HF_TOKEN": os.environ["HF_TOKEN"], "RUNPOD_API_KEY": os.environ["RUNPOD_API_KEY"], "FAILSAFE_S": "9000", "EXEC_TOKEN": TOKEN,
                    "WANT_FP8": "1" if VRAM.get(gpu, 0) >= 40 else "0"}})
        pods[gpu] = {"id": pod["id"], "cost": pod.get("costPerHr")}
        print(gpu, pod["id"], pod.get("costPerHr"), flush=True)
    except Exception as e:
        print("FAILED", gpu, repr(e)[:200], getattr(e, "read", lambda: b"")()[:300], flush=True)
json.dump({"token": TOKEN, "pods": pods}, open(OUT / "pods_meta.json", "w"), indent=1)
json.dump(pods, open(OUT / "pods.json", "w"), indent=1)
