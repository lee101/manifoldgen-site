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
mkdir -p /tmp/pub; cd /tmp/pub
(python3 -m http.server 8000 --directory /tmp/pub >/dev/null 2>&1 &)
exec >> /tmp/pub/speed.log 2>&1
python3 -u - <<'PY'
import time, urllib.request
from concurrent.futures import ThreadPoolExecutor
U="https://manifoldgenstatic.manifoldgen.com/models/ltx23-uncensored-v1.4/diffusion_models/ltxv23_uncensored_v1.4_fp8mixed.safetensors"
def part(a,b):
    r=urllib.request.Request(U,headers={"Range":f"bytes={a}-{b}","User-Agent":"x"}); n=0
    with urllib.request.urlopen(r,timeout=120) as resp:
        st=resp.status
        while c:=resp.read(8<<20): n+=len(c)
    return st,n
for parts in (1,8,32,64,128):
    total=2<<30; step=total//parts; off=(parts*7)<<24
    t=time.time()
    with ThreadPoolExecutor(parts) as ex: res=list(ex.map(lambda i:part(off+i*step,off+(i+1)*step-1),range(parts)))
    dt=time.time()-t; got=sum(n for _,n in res)
    print(f"parts={parts} status={set(s for s,_ in res)} MB/s={got/dt/1e6:.0f} got={got}",flush=True)
print("SPEED_DONE",flush=True)
PY
sleep infinity
'''
import sys
GPU = sys.argv[1]
r = call("/pods", "POST", {"name": "ltx-speed", "gpuTypeIds": [GPU], "gpuCount": 1, "cloudType": "SECURE", "imageName": "python:3.12-slim", "containerDiskInGb": 20,
                           "dockerEntrypoint": ["bash", "-lc", SCRIPT], "dockerStartCmd": [], "ports": ["8000/http"]})
print({k: r.get(k) for k in ("id", "costPerHr", "err", "body")})
if r.get("id"): pathlib.Path("/tmp/speed_pod").write_text(r["id"])
