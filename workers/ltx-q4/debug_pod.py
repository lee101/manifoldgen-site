import json, os, pathlib, sys, time, urllib.request
ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
o = urllib.request.build_opener(); o.addheaders = [("User-Agent", "curl/8.10")]; urllib.request.install_opener(o)
import music3_bench as bench
import h3_upscale_gpu_probe as p
bench.load_env(ROOT / ".env")
cfg = json.load(open(ROOT / "config/runpod-ltx.json"))
prompts = json.load(open(ROOT / "results/ltx-vs-pinkcherry/prompts.json"))
test = {"input": {"prompt": prompts["rooftop"], "aspect_ratio": "16:9", "size": "balanced", "duration": 5, "seed": 7, "output_codec": "webm-av1"}}
script = r'''
mkdir -p /tmp/pub; cd /tmp/pub
(python3 -m http.server 8000 --directory /tmp/pub >/dev/null 2>&1 &)
exec >> /tmp/pub/handler.log 2>&1
nvidia-smi --query-gpu=name,memory.total --format=csv; free -g | head -2; df -h /opt /tmp | tail -2
cd /src
echo '%s' > /tmp/test_input.json
if [ "$DEBUG_MODE" = "weights" ]; then python -u -c "import ltx_weights,os;ltx_weights.ensure_weights(os.environ[\"LTX_UNET\"])"; df -h /opt | tail -1; else python -u ltx_handler.py --test_input "$(cat /tmp/test_input.json)"; fi
echo HANDLER_EXIT:$?
sleep infinity
''' % json.dumps(test).replace("'", "'\\''")
gpu = sys.argv[1] if len(sys.argv) > 1 else "NVIDIA GeForce RTX 5090"
pod = p.call("/pods", "POST", {"name": "ltx-debug", "imageName": cfg["image"], "containerRegistryAuthId": p.registry_auth_id(p.H3_CONFIG),
    "gpuTypeIds": [gpu], "gpuCount": 1, "cloudType": "SECURE", "containerDiskInGb": 100, "volumeInGb": 0, "allowedCudaVersions": ["13.0"] if (len(sys.argv) < 3) else [],
    "dockerEntrypoint": ["bash", "-lc", script], "dockerStartCmd": [], "ports": ["8000/http"], "env": {**cfg["env"], "DEBUG_MODE": sys.argv[2] if len(sys.argv) > 2 else ""}})
print(pod["id"], pod.get("costPerHr"))
pathlib.Path("/tmp/debug_pod").write_text(pod["id"])
