#!/usr/bin/env python3
import argparse
import json
import os
import pathlib
import shlex
import socket
import ssl
import time
import urllib.parse
import urllib.request

import music3_bench as bench

ROOT = pathlib.Path(__file__).resolve().parents[1]
IMAGE = "hongccc/sglang-omni@sha256:374d0b1c30b2bff685b1716fc64a02ad3b3d0a90fe2ce73ce9861a6992c28101"
RUNTIME = "/runpod-volume/omniserve/music3/sglang-omni-e0c98529"
COMMIT = "e0c98529e5730f60e19251025877387b9476c8d4"
MODEL_DIR = "/runpod-volume/models/minimax-music3"
BASE = "/runpod-volume/omniserve/music3"
PATCH_PATH = pathlib.Path("/vfast/data/code/omniserve-native/music3/sglang-music3-a100.patch")
DEFAULT_CONFIGS = "prod_bf16:bfloat16:30:1.7:--quantization fp8,fp32:float32:30:1.7:--quantization fp8,fp32_s50:float32:50:1.7:--quantization fp8"


def load_env(path):
    bench.load_env(path)


def runpod(method, path, payload=None):
    key = os.environ.get("RUNPOD_API_KEY") or os.environ["H3_RUNPOD_API_KEY"]
    data = json.dumps(payload).encode() if payload is not None else None
    api_base = os.environ.get("RUNPOD_API_BASE", "https://rest.runpod.io/v1")
    request = urllib.request.Request(
        api_base.rstrip("/") + path,
        data=data,
        method=method,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    last_error = None
    tunnel_host = None
    if api_base.startswith("https://rest.runpod.io:"):
        tunnel_host = urllib.parse.urlparse(api_base).port
    context = ssl._create_unverified_context() if api_base.startswith("https://127.0.0.1:") else None
    for attempt in range(3):
        try:
            original_getaddrinfo = socket.getaddrinfo
            if tunnel_host:
                def tunnel_getaddrinfo(host, port, *args, **kwargs):
                    if host == "rest.runpod.io" and port == tunnel_host:
                        host = "127.0.0.1"
                    return original_getaddrinfo(host, port, *args, **kwargs)
                socket.getaddrinfo = tunnel_getaddrinfo
            with urllib.request.urlopen(request, timeout=30, context=context) as response:
                body = response.read()
                return json.loads(body) if body else {}
        except urllib.error.URLError as error:
            last_error = error
            if attempt == 2:
                raise
            print(f"RunPod API retry {attempt + 1}/2: {error}", flush=True)
            time.sleep(10)
        finally:
            if tunnel_host:
                socket.getaddrinfo = original_getaddrinfo
    raise last_error


def presign_json(key, content_type="application/json"):
    import boto3
    from botocore.config import Config
    account = os.environ["R2_ACCOUNT_ID"]
    client = boto3.client(
        "s3",
        endpoint_url=f"https://{account}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["CLOUDFLARE_R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["CLOUDFLARE_R2_SECRET_ACCESS_KEY"],
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )
    bucket = os.environ["R2_BUCKET"]
    url = client.generate_presigned_url(
        "put_object",
        Params={"Bucket": bucket, "Key": key, "ContentType": content_type},
        ExpiresIn=7200,
    )
    fetch = client.generate_presigned_url(
        "get_object", Params={"Bucket": bucket, "Key": key}, ExpiresIn=7200
    )
    return url, f"https://{os.environ['R2_PUBLIC_HOST']}/{key}", fetch


def parse_configs(spec):
    configs = []
    for item in spec.split(","):
        name, dtype, steps, cfg, extra = item.split(":", 4)
        configs.append({"name": name, "dtype": dtype, "steps": int(steps), "cfg": float(cfg),
                        "extra_args": shlex.split(extra.strip())})
    return configs


RUNNER = r'''#!/usr/bin/env python3
import json
import os
import signal
import subprocess
import sys
import time
import urllib.request


def log(message):
    print(f"{time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())} {message}", flush=True)


def put(url, data, content_type):
    request = urllib.request.Request(url, data=data, method="PUT",
                                     headers={"Content-Type": content_type})
    with urllib.request.urlopen(request, timeout=300) as response:
        response.read()


def wait_health(port, proc, timeout=1200):
    start = time.monotonic()
    while time.monotonic() - start < timeout:
        if proc.poll() is not None:
            raise RuntimeError(f"sgl-omni exited with status {proc.returncode}")
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=5) as response:
                if response.status < 400:
                    log("server healthy")
                    return
        except Exception as error:
            log(f"health wait: {error}")
        time.sleep(5)
    raise TimeoutError("sgl-omni server did not become healthy")


def gpu_used_mib():
    try:
        out = subprocess.run(["nvidia-smi", "--query-gpu=memory.used", "--format=csv,noheader,nounits"],
                             capture_output=True, text=True, timeout=30)
        return int(out.stdout.strip().splitlines()[0])
    except Exception:
        return -1


def stop_group(proc):
    for sig, wait in ((signal.SIGTERM, 45), (signal.SIGKILL, 15)):
        try:
            os.killpg(proc.pid, sig)
        except ProcessLookupError:
            break
        try:
            proc.wait(timeout=wait)
            break
        except subprocess.TimeoutExpired:
            continue
    for _ in range(24):
        used = gpu_used_mib()
        log(f"gpu memory used after stop: {used} MiB")
        if 0 <= used < 2048:
            break
        time.sleep(5)


def gpu_name():
    try:
        out = subprocess.run(["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"],
                             capture_output=True, text=True, timeout=30)
        return out.stdout.strip().splitlines()[0].strip()
    except Exception:
        return "unknown"


def main():
    plan = json.load(open(sys.argv[1]))
    gpu = gpu_name()
    log(f"gpu: {gpu}")
    for config in plan["configs"]:
        cmd = ["python3", "-m", "sglang_omni.cli", "serve", "--model-path", plan["model_dir"],
               "--host", "127.0.0.1", "--port", "8000", "--max-running-requests", "1",
               "--stages.dit_dav.factory-args.dtype", config["dtype"],
               "--stages.dit_dav.factory-args.dit_steps", str(config["steps"]),
               "--stages.dit_dav.factory-args.dit_cfg_scale", str(config["cfg"])] + config["extra_args"]
        log(f"starting config {config['name']}: {' '.join(cmd)}")
        log_file = open(f"{plan['base']}/ablation-server-{config['name']}.log", "ab")
        proc = subprocess.Popen(cmd, stdout=log_file, stderr=subprocess.STDOUT, cwd="/", start_new_session=True)
        try:
            wait_health(8000, proc)
            metrics = []
            for song in config["songs"]:
                payload = {"model": "MiniMaxAI/MiniMax-Music3", "input": song["lyrics"],
                           "instructions": song["caption"], "response_format": "wav",
                           "seed": song["seed"], "max_new_tokens": int(song["duration"]) * 25,
                           "stream": False}
                log(f"generating {config['name']}/{song['id']}")
                started = time.monotonic()
                request = urllib.request.Request(
                    "http://127.0.0.1:8000/v1/audio/speech",
                    data=json.dumps(payload).encode(), method="POST",
                    headers={"Content-Type": "application/json"})
                with urllib.request.urlopen(request, timeout=1800) as response:
                    audio = response.read()
                seconds = time.monotonic() - started
                log(f"generated {config['name']}/{song['id']} {len(audio)} bytes in {seconds:.1f}s")
                put(song["upload_url"], audio, "audio/wav")
                log(f"uploaded {config['name']}/{song['id']}")
                metrics.append({"config": config["name"], "song": song["id"],
                                "generation_seconds": seconds, "bytes": len(audio), "gpu": gpu})
                put(config["metrics_url"], json.dumps(metrics).encode(), "application/json")
                log(f"uploaded metrics for {config['name']}/{song['id']}")
        finally:
            log(f"stopping server for {config['name']}")
            stop_group(proc)
            log_file.close()
    put(plan["done_url"], json.dumps({"done": True, "gpu": gpu}).encode(), "application/json")
    log("done marker uploaded")


if __name__ == "__main__":
    main()
'''


def pod_script(plan, patch_text):
    runner_json = json.dumps(RUNNER)
    patch_json = json.dumps(patch_text)
    plan_json = json.dumps(plan)
    log_url = plan.get("log_url", "")
    return f'''set -Eeuo pipefail
mkdir -p {BASE}
: > {BASE}/ablation.log
exec > >(tee -a {BASE}/ablation.log) 2>&1
echo "--- ablation boot $(date -u +%FT%TZ) ---"
upload_log() {{ ( echo "=== boot log (uploaded $(date -u +%FT%TZ)) ==="; cat {BASE}/ablation.log; echo "=== server logs ==="; tail -n 120 {BASE}/ablation-server-*.log 2>/dev/null ) > /tmp/ablation-upload.log; curl -s -X PUT -H 'Content-Type: text/plain' --data-binary @/tmp/ablation-upload.log {json.dumps(log_url)} >/dev/null || true; }}
trap 'echo "EXIT status=$?"; upload_log; sleep 20' EXIT
echo "gpu: $(nvidia-smi --query-gpu=name --format=csv,noheader 2>&1)"; upload_log
( while true; do sleep 45; upload_log; done ) &
runtime={RUNTIME}
if [ ! -f "$runtime/pyproject.toml" ]; then
  git clone --filter=blob:none https://github.com/sgl-project/sglang-omni.git "$runtime"
  git -C "$runtime" checkout {COMMIT}
fi
python3 - <<'PY'
import json
from pathlib import Path
Path("/tmp/music3-a100.patch").write_text(json.loads({patch_json!r}))
Path("{BASE}/ablation_runner.py").write_text(json.loads({runner_json!r}))
Path("{BASE}/ablation_plan.json").write_text(json.loads({plan_json!r}))
PY
if git -C "$runtime" apply --check /tmp/music3-a100.patch; then
  git -C "$runtime" apply /tmp/music3-a100.patch
fi
export PYTHONPATH="$runtime" SGLANG_OMNI_AUTO_CLONE=0 HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 HF_HOME=/runpod-volume/huggingface TORCHINDUCTOR_CACHE_DIR={BASE}/torchinductor TRITON_CACHE_DIR={BASE}/triton FLASHINFER_WORKSPACE_BASE={BASE}/flashinfer
cd /
model_dir={MODEL_DIR}
if [ ! -f "$model_dir/flowmatching_vae.pth" ]; then
  echo "ERROR: $model_dir/flowmatching_vae.pth missing" >&2
  exit 1
fi
python3 {BASE}/ablation_runner.py {BASE}/ablation_plan.json
sleep 5
'''


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--songs", type=pathlib.Path, required=True)
    parser.add_argument("--configs", default=DEFAULT_CONFIGS)
    parser.add_argument("--output-dir", type=pathlib.Path, default=ROOT / "musicresults")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    songs = json.loads(args.songs.read_text())
    configs = parse_configs(args.configs)
    run_ts = int(time.time())
    if args.dry_run:
        plan = {"model_dir": MODEL_DIR, "base": BASE, "done_url": "https://example.invalid/done.json",
                "configs": [{"name": c["name"], "dtype": c["dtype"], "steps": c["steps"], "cfg": c["cfg"],
                             "extra_args": c["extra_args"], "metrics_url": "https://example.invalid/metrics.json",
                             "songs": [{**s, "upload_url": "https://example.invalid/song.wav"} for s in songs]}
                            for c in configs]}
        print(pod_script(plan, PATCH_PATH.read_text()))
        return
    load_env(ROOT / ".env")
    load_env(pathlib.Path("/vfast/data/code/omniserve-native/.runpod-music3.env"))
    args.output_dir.mkdir(parents=True, exist_ok=True)
    plan_configs = []
    fetches = {}
    for config in configs:
        config_songs = []
        for song in songs:
            upload_url, _, fetch_url = bench.presign(f"musicresults/{run_ts}/{config['name']}/{song['id']}.wav")
            fetches[(config["name"], song["id"])] = fetch_url
            config_songs.append({**song, "upload_url": upload_url})
        metrics_url, _, metrics_fetch = presign_json(f"musicresults/{run_ts}/{config['name']}/metrics.json")
        fetches[(config["name"], "metrics.json")] = metrics_fetch
        plan_configs.append({**config, "songs": config_songs, "metrics_url": metrics_url})
    done_url, _, done_fetch = presign_json(f"musicresults/{run_ts}/done.json")
    log_url, _, log_fetch = presign_json(f"musicresults/{run_ts}/ablation.log", "text/plain")
    plan = {"model_dir": MODEL_DIR, "base": BASE, "done_url": done_url, "log_url": log_url, "configs": plan_configs}
    print("log", log_fetch, flush=True)
    script = pod_script(plan, PATCH_PATH.read_text())
    started_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    pod = runpod("POST", "/pods", {
        "name": "manifoldgen-music3-ablation", "imageName": IMAGE,
        "gpuTypeIds": ["NVIDIA H200", "NVIDIA H100 80GB HBM3", "NVIDIA H100 NVL"],
        "gpuCount": 1, "cloudType": "SECURE",
        "networkVolumeId": os.environ["MUSIC3_RUNPOD_NETWORK_VOLUME_ID"],
        "dataCenterIds": [os.environ["MUSIC3_RUNPOD_DATACENTER_ID"]],
        "containerDiskInGb": 30, "volumeMountPath": "/runpod-volume",
        "dockerEntrypoint": [], "dockerStartCmd": ["bash", "-lc", script], "ports": [],
    })
    pod_id = pod["id"]
    print("pod", pod_id, flush=True)
    try:
        for attempt in range(360):
            status = runpod("GET", f"/pods/{pod_id}")
            if status.get("desiredStatus") == "EXITED":
                raise RuntimeError(f"RunPod pod exited: {status.get('lastStatusChange', 'unknown reason')}")
            try:
                with urllib.request.urlopen(done_fetch, timeout=60) as response:
                    done = json.loads(response.read())
                if done.get("done"):
                    gpu = done.get("gpu", "unknown")
                    for config in plan_configs:
                        config_dir = args.output_dir / config["name"]
                        config_dir.mkdir(parents=True, exist_ok=True)
                        for song in config["songs"]:
                            with urllib.request.urlopen(fetches[(config["name"], song["id"])], timeout=300) as response:
                                (config_dir / f"{song['id']}.wav").write_bytes(response.read())
                        with urllib.request.urlopen(fetches[(config["name"], "metrics.json")], timeout=60) as response:
                            (config_dir / "metrics.json").write_bytes(response.read())
                    manifest = {"configs": configs, "songs": songs, "pod_id": pod_id, "gpu": gpu,
                                "run_ts": run_ts, "started_at": started_at,
                                "finished_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
                    (args.output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))
                    print("saved", args.output_dir, flush=True)
                    return
            except urllib.error.URLError as error:
                if attempt % 4 == 0:
                    print("waiting", attempt * 15, error, flush=True)
                    try:
                        with urllib.request.urlopen(log_fetch, timeout=30) as response:
                            (args.output_dir / "ablation.log").write_bytes(response.read())
                    except urllib.error.URLError:
                        pass
            time.sleep(15)
        raise TimeoutError("ablation output did not appear within 90 minutes")
    finally:
        runpod("DELETE", f"/pods/{pod_id}")
        print("terminated", pod_id, flush=True)


if __name__ == "__main__":
    main()
