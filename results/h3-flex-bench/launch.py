"""bench-h3flex pod: Comfy H3 arms (base / turbo6 / Pika Flex) + VDN-H3 on one GPU, on the manifold-models
volume (EU-NL-1). The pod is always deleted; a failsafe inside the pod deletes itself past the budget.

usage: uv run --with boto3 python launch.py [--gpu "NVIDIA H100 80GB HBM3"] [--budget 9] [--arms ...] [--phases comfy,vdn]
"""
import argparse, io, json, os, pathlib, secrets, sys, tarfile, time, urllib.error, urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
import h3_upscale_gpu_probe as p

_opener = urllib.request.build_opener(); _opener.addheaders = [("User-Agent", "curl/8.10")]; urllib.request.install_opener(_opener)

H3_COG = pathlib.Path(os.environ.get("H3_COG_DIR", "/vfast/data/code/h3-cog-flex"))
HERE = pathlib.Path(__file__).resolve().parent
OVERLAY = ["weights.py", "h3_tuning.py", "h3_workflow.py", "h3_runtime.py", "h3_model_profile.py", "h3_image_workflow.py"]
VOLUME, DC = "65aknc5k8g", "EU-NL-1"
FALLBACK_GPUS = ["NVIDIA H100 80GB HBM3", "NVIDIA H200", "NVIDIA RTX PRO 6000 Blackwell Server Edition", "NVIDIA B200"]


def load_env():
    for line in (ROOT / ".env").read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"'))


def kit_tar() -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for name in OVERLAY:
            tar.add(H3_COG / name, f"src/{name}")
        tar.add(HERE / "pod_bench.py", "bench/pod_bench.py")
        tar.add(HERE / "scenes.json", "bench/scenes.json")
        tar.add(HERE / "frames", "bench/frames")
    return buf.getvalue()


def boot_script(token, kit_url):
    return f"""
( sleep $FAILSAFE_S; curl -s -X DELETE -H "Authorization: Bearer $RUNPOD_API_KEY" https://rest.runpod.io/v1/pods/$RUNPOD_POD_ID ) &
set -x
mkdir -p /tmp/pub/{token}; cd /tmp/pub
mkdir -p /tmp/www; ln -sfn /tmp/pub/{token} /tmp/www/{token}; (python3 -c "import http.server as h,functools as f;c=type('C',(h.SimpleHTTPRequestHandler,),{{'list_directory':lambda s,p:s.send_error(404)}});h.ThreadingHTTPServer(('',8000),f.partial(c,directory='/tmp/www')).serve_forever()" >/dev/null 2>&1 &)
exec >> /tmp/pub/{token}/boot.log 2>&1
curl -sfL --retry 5 '{kit_url}' -o /tmp/kit.tgz && mkdir -p /tmp/kit && tar -xzf /tmp/kit.tgz -C /tmp/kit
cp /tmp/kit/src/*.py /src/ && mkdir -p /tmp/bench && cp -r /tmp/kit/bench/* /tmp/bench/
nvidia-smi; free -g; df -h / /runpod-volume; cat /sys/fs/cgroup/memory.max
BENCH_PUB=/tmp/pub/{token} python3 -u /tmp/bench/pod_bench.py
sleep infinity
"""


def fetch(url, dest=None):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "curl/8"}), timeout=300) as r:
        data = r.read()
    if dest:
        dest.write_bytes(data)
    return data


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--gpu", default="NVIDIA H100 80GB HBM3")
    ap.add_argument("--budget", type=float, default=9.0)
    ap.add_argument("--arms", default="")
    ap.add_argument("--phases", default="comfy,vdn")
    ap.add_argument("--image", default="ghcr.io/lee101/h3-cog:cu130-20261008-pinkcherry-opt-r3")
    ap.add_argument("--out", default="")
    ap.add_argument("--volume", action="store_true", help="pin to the EU-NL-1 manifold-models volume")
    ap.add_argument("--vram", default="", help="H3_COMFY_VRAM_MODE for the worker (low|normal|high)")
    ap.add_argument("--env", action="append", default=[], help="extra worker env KEY=VALUE (repeatable)")
    a = ap.parse_args()
    load_env()
    cfg = p.H3_CONFIG
    token = secrets.token_hex(16)
    put_url, get_url = p.presign_pair(f"bench/h3flex/{token}/kit.tgz")
    req = urllib.request.Request(put_url, data=kit_tar(), method="PUT")
    urllib.request.urlopen(req, timeout=120).read()
    env = {**cfg["env"], "H3_VERIFY_STAMP": "portable", "H3_MODEL_SET": "fl2va,turbo,pika", "H3_FACE_REFINE_ENABLED": "0",
           "H3_PREFETCH_WEIGHTS": "1", "BENCH_PHASES": a.phases,
           "FAILSAFE_S": str(int(a.budget / 3.5 * 3600) + 600), "RUNPOD_API_KEY": os.environ.get("RUNPOD_API_KEY") or os.environ["H3_RUNPOD_API_KEY"],
           "HF_TOKEN": os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_TOKEN", "")}
    env.pop("H3_FACE_JUDGE_API_KEY", None)
    if a.arms:
        env["BENCH_ARMS"] = a.arms
    if a.vram:
        env["H3_COMFY_VRAM_MODE"] = a.vram
    for item in a.env:
        key, _, value = item.partition("=")
        env[key] = value
    gpu_tag = a.gpu.split()[-1].lower()
    out = pathlib.Path(a.out) if a.out else HERE / ("out-" + gpu_tag)
    out.mkdir(parents=True, exist_ok=True)
    pod_id = None
    try:
        body = {
            "name": "bench-h3flex-" + gpu_tag, "imageName": a.image,
            "containerRegistryAuthId": p.registry_auth_id(cfg), "gpuTypeIds": [a.gpu], "gpuCount": 1,
            "cloudType": "SECURE", "containerDiskInGb": 300,
            "dockerEntrypoint": ["bash", "-lc", boot_script(token, get_url)], "dockerStartCmd": [],
            "ports": ["8000/http"], "env": env}
        if a.volume:
            body.update({"dataCenterIds": [DC], "networkVolumeId": VOLUME, "volumeMountPath": "/runpod-volume", "containerDiskInGb": 220})
        else:
            env["WEIGHTS_DIR"] = "/root/weights"
        pod = None
        disks = [body["containerDiskInGb"], 240, 200]
        for gpu, disk in [(g, d) for d in disks for g in [a.gpu] + [g for g in FALLBACK_GPUS if g != a.gpu]]:
            body["gpuTypeIds"], body["name"], body["containerDiskInGb"] = [gpu], "bench-h3flex-" + gpu.split()[-1].lower(), disk
            try:
                pod = p.call("/pods", "POST", body)
                print("gpu", gpu, "disk", disk, flush=True)
                break
            except urllib.error.HTTPError as err:
                print("create failed", gpu, err.code, err.read()[:300], flush=True)
        if pod is None:
            raise SystemExit("no capacity")
        pod_id, rate = pod["id"], float(pod.get("costPerHr") or 3.5)
        print("pod", pod_id, rate, flush=True)
        (out / "pod.json").write_text(json.dumps({"id": pod_id, "rate": rate, "token": token}))
        base = f"https://{pod_id}-8000.proxy.runpod.net/{token}"
        started, status, fetched = time.time(), {}, set()
        while True:
            spent = (time.time() - started) / 3600 * rate
            if spent > a.budget:
                print(f"budget hit ${spent:.2f}", flush=True)
                break
            try:
                status = json.loads(fetch(base + "/status.json"))
                print(f"${spent:.2f} {status['phase']} runs={len(status['runs'])} err={len(status['errors'])} vdn={status.get('vdn')}", flush=True)
                for r in status.get("runs", []):  # pull finished clips as we go
                    if r["file"] not in fetched:
                        fetch(f"{base}/out/{r['file']}", out / r["file"]); fetched.add(r["file"])
            except Exception as err:
                print(f"${spent:.2f} poll: {str(err)[:120]}", flush=True)
            if status.get("phase") in {"done", "failed"}:
                break
            time.sleep(30)
        for name in ["status.json", "boot.log", "vdn_setup.log", "vdn_run.log"] + [f"out/{r['file']}" for r in status.get("runs", []) if r["file"] not in fetched]:
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
