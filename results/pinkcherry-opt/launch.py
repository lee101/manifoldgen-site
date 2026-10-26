"""bench-pinkcherry-* pod: PinkCherry arms on the manifold-models volume (EU-NL-1). Pod is always deleted.

usage: launch.py [--gpu "NVIDIA H100 80GB HBM3"] [--budget 3.5] [--arms base,cap14,turbo8,turbo6]
"""
import argparse, base64, json, os, pathlib, secrets, sys, time, urllib.error, urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
import h3_upscale_gpu_probe as p

_opener = urllib.request.build_opener(); _opener.addheaders = [("User-Agent", "curl/8.10")]; urllib.request.install_opener(_opener)

H3_COG = pathlib.Path(os.environ.get("H3_COG_DIR", "/nvme0n1-disk/code/h3-cog-pinkcherry-opt"))
HERE = pathlib.Path(__file__).resolve().parent
OVERLAY = [n for n in os.environ.get("BENCH_OVERLAY", "").split(",") if n]
VOLUME, DC = "65aknc5k8g", "EU-NL-1"


def load_env():
    for line in (ROOT / ".env").read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"'))


def boot_script(token):
    b64 = lambda path: base64.b64encode(path.read_bytes()).decode()
    writes = "\n".join(f"echo {b64(H3_COG / n)} | base64 -d > /src/{n}" for n in OVERLAY)
    return f"""
( sleep $FAILSAFE_S; curl -s -X DELETE -H "Authorization: Bearer $RUNPOD_API_KEY" https://rest.runpod.io/v1/pods/$RUNPOD_POD_ID ) &
set -x
mkdir -p /tmp/pub/{token}; cd /tmp/pub
mkdir -p /tmp/www; ln -sfn /tmp/pub/{token} /tmp/www/{token}; (python3 -c "import http.server as h,functools as f;c=type('C',(h.SimpleHTTPRequestHandler,),{{'list_directory':lambda s,p:s.send_error(404)}});h.ThreadingHTTPServer(('',8000),f.partial(c,directory='/tmp/www')).serve_forever()" >/dev/null 2>&1 &)
exec >> /tmp/pub/{token}/boot.log 2>&1
{writes}
echo {b64(HERE / 'pod_bench.py')} | base64 -d > /tmp/pod_bench.py
echo {b64(ROOT / 'results/ltx-vs-pinkcherry/prompts.json')} | base64 -d > /tmp/prompts.json
nvidia-smi; free -g; cat /sys/fs/cgroup/memory.max
BENCH_PUB=/tmp/pub/{token} python3 -u /tmp/pod_bench.py
sleep infinity
"""


def fetch(url, dest=None):
    req = urllib.request.Request(url, headers={"User-Agent": "curl/8"})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = r.read()
    if dest:
        dest.write_bytes(data)
    return data


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--gpu", default="NVIDIA H100 80GB HBM3")
    ap.add_argument("--budget", type=float, default=3.5)
    ap.add_argument("--arms", default="base,cap14,turbo8,turbo6")
    ap.add_argument("--image", default="ghcr.io/lee101/h3-cog:cu130-20261008-pinkcherry-opt-r2")
    a = ap.parse_args()
    load_env()
    cfg = p.H3_CONFIG
    pink = next(e for e in cfg["endpoints"] if "pinkcherry" in e["name"])
    env = {**cfg["env"], **pink.get("env", {}), "H3_MODEL_SET": "fl2va,turbo", "H3_FACE_REFINE_ENABLED": "0",
           "H3_VERIFY_STAMP": "portable", "BENCH_ARMS": a.arms, "FAILSAFE_S": str(int(a.budget / 3.5 * 3600) + 600),
           "RUNPOD_API_KEY": os.environ["RUNPOD_API_KEY"], "HF_TOKEN": os.environ.get("HF_TOKEN", "")}
    token = secrets.token_hex(16)
    out = HERE / ("out-" + a.gpu.split()[-1].lower())
    out.mkdir(exist_ok=True)
    pod_id = None
    try:
        body = {
            "name": "bench-pinkcherry-" + a.gpu.split()[-1].lower(), "imageName": a.image,
            "containerRegistryAuthId": p.registry_auth_id(cfg), "gpuTypeIds": [a.gpu], "gpuCount": 1,
            "cloudType": "SECURE", "allowedCudaVersions": ["13.0"], "dataCenterIds": [DC], "networkVolumeId": VOLUME, "volumeMountPath": "/runpod-volume",
            "containerDiskInGb": 60, "dockerEntrypoint": ["bash", "-lc", boot_script(token)], "dockerStartCmd": [],
            "ports": ["8000/http"], "env": env}
        try:
            pod = p.call("/pods", "POST", body)
        except urllib.error.HTTPError as err:
            print("create failed", err.code, err.read()[:600], flush=True)
            raise
        pod_id, rate = pod["id"], float(pod.get("costPerHr") or 3.5)
        print("pod", pod_id, rate, flush=True)
        base = f"https://{pod_id}-8000.proxy.runpod.net/{token}"
        started, status = time.time(), {}
        while True:
            spent = (time.time() - started) / 3600 * rate
            if spent > a.budget:
                print(f"budget hit ${spent:.2f}", flush=True)
                break
            try:
                status = json.loads(fetch(base + "/status.json"))
                print(f"${spent:.2f} {status['phase']} runs={len(status['runs'])} err={len(status['errors'])}", flush=True)
            except Exception:
                pass
            if status.get("phase") in {"done", "failed"}:
                break
            time.sleep(30)
        for name in ["status.json", "boot.log"] + [f"out/{r['file']}" for r in status.get("runs", [])]:
            try:
                fetch(f"{base}/{name}", out / pathlib.Path(name).name)
            except Exception as err:
                print("fetch failed", name, err, flush=True)
        status["spent_usd"] = round((time.time() - started) / 3600 * rate, 3)
        (out / "status.json").write_text(json.dumps(status, indent=1))
    finally:
        if pod_id:
            for _ in range(5):
                try:
                    p.call(f"/pods/{pod_id}", "DELETE")
                    print("deleted", pod_id, flush=True)
                    break
                except Exception as err:
                    print("delete retry", err, flush=True)
                    time.sleep(10)


if __name__ == "__main__":
    main()
