import json, os, pathlib, sys, urllib.request
urllib.request.install_opener(urllib.request.build_opener(*[]))
_o = urllib.request.build_opener(); _o.addheaders = [("User-Agent", "curl/8.10")]; urllib.request.install_opener(_o)
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

VOLUME, DC = sys.argv[1], sys.argv[2]
h3 = json.load(open(ROOT / "config/runpod-h3.json"))
pink = next(e for e in h3["endpoints"] if "pinkcherry" in e["name"])["env"]
ltx = json.load(open(ROOT / "config/runpod-ltx.json"))
SCRIPT = r'''
mkdir -p /tmp/pub; cd /tmp/pub
(python3 -m http.server 8000 --directory /tmp/pub >/dev/null 2>&1 &)
exec >> /tmp/pub/populate.log 2>&1
cd /src
df -h /runpod-volume | tail -1
python -u -c "import ltx_weights,os;print(ltx_weights.ensure_weights(os.environ['LTX_UNET']))"
for i in 1 2 3 4; do python -u -c "import weights;print({k:str(v) for k,v in weights.ensure_weights(include_ref2va=True, include_face_refine=False).items()})" && break; echo "h3 retry $i"; sleep 10; done
du -sh /runpod-volume/* 2>/dev/null
find /runpod-volume -type f -size +100M -printf "%s %p\n"; find /runpod-volume -type l -printf "%p -> %l\n" | head -20
df -h /runpod-volume | tail -1
echo POPULATE_DONE
sleep infinity
'''
env = {**ltx["env"], **pink, "HF_TOKEN": os.environ["HF_TOKEN"], "H3_INCLUDE_REF2VA": "1", "HF_HOME": "/runpod-volume/huggingface-cache", "HF_HUB_DISABLE_XET": "1"}
gpus = [g for g in sys.argv[3:]] or ["NVIDIA L40S", "NVIDIA RTX PRO 6000 Blackwell Server Edition", "NVIDIA H100 80GB HBM3"]
sys.path.insert(0, str(ROOT / "scripts"))
import music3_bench as bench
import h3_upscale_gpu_probe as p
bench.load_env(ROOT / ".env")
auth = p.registry_auth_id(p.H3_CONFIG)
for gpu in gpus:
    r = call("/pods", "POST", {"name": "ltx-volume-populate", "imageName": ltx["image"], "containerRegistryAuthId": auth, "gpuTypeIds": [gpu], "gpuCount": 1,
        "cloudType": "SECURE", "dataCenterIds": [DC], "networkVolumeId": VOLUME, "volumeMountPath": "/runpod-volume", "containerDiskInGb": 30,
        "dockerEntrypoint": ["bash", "-lc", SCRIPT], "dockerStartCmd": [], "ports": ["8000/http"], "env": env})
    print(gpu, {k: r.get(k) for k in ("id", "costPerHr", "err", "body")})
    if r.get("id"):
        pathlib.Path("/tmp/populate_pod").write_text(r["id"]); break
