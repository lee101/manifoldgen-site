import json, os, pathlib, urllib.request
ROOT = pathlib.Path(__file__).resolve().parents[2]
for line in (ROOT / ".env").read_text().splitlines():
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1); os.environ.setdefault(k, v.strip().strip('"'))

def call(path, method="GET", payload=None):
    req = urllib.request.Request("https://rest.runpod.io/v1" + path, data=json.dumps(payload).encode() if payload is not None else None, method=method,
                                 headers={"Authorization": "Bearer " + os.environ.get("RUNPOD_API_KEY", os.environ.get("H3_RUNPOD_API_KEY", "")), "Content-Type": "application/json", "User-Agent": "curl/8"})
    try:
        return json.load(urllib.request.urlopen(req, timeout=60))
    except urllib.error.HTTPError as e:
        return {"err": e.code, "body": e.read()[:300].decode()}

SCRIPT = r'''
mkdir -p /tmp/pub /work; cd /tmp/pub
(python3 -m http.server 8000 --directory /tmp/pub >/dev/null 2>&1 &)
exec >> /tmp/pub/mirror.log 2>&1
pip install -q huggingface_hub hf_xet boto3 2>&1 | tail -1
python3 -u - <<'PY'
import hashlib, json, os, boto3
from concurrent.futures import ThreadPoolExecutor
from boto3.s3.transfer import TransferConfig
from huggingface_hub import hf_hub_download
REPO="Comfy-Org/MiniMax-H3"; REV="e5eb578a89295337b8ff433a035929ce0279e0b6"; PREFIX="models/h3-character-swap"
s3=boto3.client("s3",endpoint_url="https://"+os.environ["R2A"]+".r2.cloudflarestorage.com",aws_access_key_id=os.environ["R2K"],aws_secret_access_key=os.environ["R2S"],region_name="auto")
cfg=TransferConfig(multipart_threshold=64<<20,multipart_chunksize=128<<20,max_concurrency=16)
FILES={"diffusion_models/minimax_h3_ref2va_pruned_int8_convrot.safetensors":"9255f52b6677845ad238f20dfaafa94727053694127ab7f255c048f0f9365779","loras/minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors":"5b9ab5ade15d0775676d01a907268a69a1468dc6033b3b0d3ded5502f3ebb84c"}
def sha(p):
    h=hashlib.sha256()
    with open(p,"rb") as f:
        for c in iter(lambda:f.read(32<<20),b""): h.update(c)
    return h.hexdigest()
def one(item):
    rel,want=item
    p=hf_hub_download(REPO,rel,revision=REV,local_dir="/work/hf",token=os.environ.get("HF_TOKEN"))
    got=sha(p); assert got==want,(rel,got)
    s3.upload_file(p,"manifoldgenstatic",f"{PREFIX}/{rel}",Config=cfg,ExtraArgs={"CacheControl":"public, max-age=31536000, immutable"})
    os.unlink(p); print(json.dumps({"path":rel,"size":os.path.getsize(p) if os.path.exists(p) else None,"sha256":got}),flush=True)
with ThreadPoolExecutor(2) as ex: list(ex.map(one,FILES.items()))
print("MIRROR_DONE",flush=True)
PY
sleep infinity
'''
env = {"HF_TOKEN": os.environ.get("HF_TOKEN", ""), "R2A": os.environ["R2_ACCOUNT_ID"], "R2K": os.environ["CLOUDFLARE_R2_ACCESS_KEY_ID"], "R2S": os.environ["CLOUDFLARE_R2_SECRET_ACCESS_KEY"]}
r = call("/pods", "POST", {"name": "h3swap-mirror", "computeType": "CPU", "cpuFlavorIds": ["cpu3c"], "vcpuCount": 8, "imageName": "python:3.12-slim",
                           "containerDiskInGb": 80, "dockerEntrypoint": ["bash", "-lc", SCRIPT], "dockerStartCmd": [], "ports": ["8000/http"], "env": env})
print({k: r.get(k) for k in ("id", "costPerHr", "err", "body")})
if r.get("id"):
    pathlib.Path("/tmp/h3swap_mirror_pod").write_text(r["id"])
