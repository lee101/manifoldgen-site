import json, os, pathlib, urllib.request
ROOT = pathlib.Path(__file__).resolve().parents[2]
for line in (ROOT / ".env").read_text().splitlines():
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1); os.environ.setdefault(k, v.strip().strip('"'))

def call(path, method="GET", payload=None):
    req = urllib.request.Request("https://rest.runpod.io/v1" + path, data=json.dumps(payload).encode() if payload is not None else None, method=method,
                                 headers={"Authorization": "Bearer " + os.environ["RUNPOD_API_KEY"], "Content-Type": "application/json", "User-Agent": "curl/8"})
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
REPO="ChrisColeTech/LTX-2.3-uncensored-v1.4-FP8"; PREFIX="models/ltx23-uncensored-v1.4"
s3=boto3.client("s3",endpoint_url="https://f76d25b8b86cfa5638f43016510d8f77.r2.cloudflarestorage.com",aws_access_key_id=os.environ["R2K"],aws_secret_access_key=os.environ["R2S"],region_name="auto")
cfg=TransferConfig(multipart_threshold=64<<20,multipart_chunksize=128<<20,max_concurrency=16)
FILES=["diffusion_models/ltxv23_uncensored_v1.4_fp8mixed.safetensors","diffusion_models/ltxv23_uncensored_v1.4_Q4_K_M.gguf","text_encoders/gemma-3-12b-it-ablit-norms-biproj-Q4_K_M.gguf","text_encoders/ltxv23_uncensored_v1.4_projections.safetensors","vae/ltxv23_uncensored_v1.4_audio_vae.safetensors","vae/ltxv23_uncensored_v1.4_video_vae.safetensors","latent_upscale_models/ltx-2.3-spatial-upscaler-x2-1.0.safetensors"]
def sha(p):
    h=hashlib.sha256()
    with open(p,"rb") as f:
        for c in iter(lambda:f.read(32<<20),b""): h.update(c)
    return h.hexdigest()
def one(rel):
    p=hf_hub_download(REPO,"split/"+rel,local_dir="/work/hf",token=os.environ.get("HF_TOKEN"))
    e={"path":rel,"size":os.path.getsize(p),"sha256":sha(p)}
    s3.upload_file(p,"manifoldgenstatic",f"{PREFIX}/{rel}",Config=cfg,ExtraArgs={"CacheControl":"public, max-age=31536000, immutable"})
    os.unlink(p); print(json.dumps(e),flush=True); return e
with ThreadPoolExecutor(3) as ex: entries=list(ex.map(one,FILES))
s3.put_object(Bucket="manifoldgenstatic",Key=f"{PREFIX}/manifest.json",Body=json.dumps({"repo":REPO,"prefix":PREFIX,"files":entries},indent=1).encode(),ContentType="application/json",CacheControl="public, max-age=60")
print("MIRROR_DONE",flush=True)
PY
sleep infinity
'''
env = {"HF_TOKEN": os.environ["HF_TOKEN"], "R2K": os.environ["CLOUDFLARE_R2_ACCESS_KEY_ID"], "R2S": os.environ["CLOUDFLARE_R2_SECRET_ACCESS_KEY"]}
r = call("/pods", "POST", {"name": "ltx-mirror", "computeType": "CPU", "cpuFlavorIds": ["cpu3c"], "vcpuCount": 8, "imageName": "python:3.12-slim",
                           "containerDiskInGb": 80, "dockerEntrypoint": ["bash", "-lc", SCRIPT], "dockerStartCmd": [], "ports": ["8000/http"], "env": env})
print({k: r.get(k) for k in ("id", "costPerHr", "err", "body")})
if r.get("id"):
    pathlib.Path("/tmp/mirror_pod").write_text(r["id"])
