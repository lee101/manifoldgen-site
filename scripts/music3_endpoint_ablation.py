#!/usr/bin/env python3
import argparse
import json
import os
import pathlib
import threading
import time
import urllib.request

import music3_bench as bench
from music3_acoustic_ablation import runpod

ROOT = pathlib.Path(__file__).resolve().parents[1]
PREFIX = "omniserve-minimax-music3-ablation-"
PATCH = ROOT / "musicresults" / "sglang-music3-ablation.patch"
PATCHED_RUNTIME = "/runpod-volume/omniserve/music3/sglang-omni-e0c98529-abl"
VARIANTS = {
    "bf16": {},
    "fp32": {"MUSIC3_ACOUSTIC_DTYPE": "float32"},
    "fp32_s50": {"MUSIC3_ACOUSTIC_DTYPE": "float32", "MUSIC3_SERVE_EXTRA_ARGS": "--quantization fp8 --stages.dit_dav.factory-args.dit_steps 50"},
    "bf16_state32": {"MUSIC3_DIT_FP32_STATE": "1", "_patch": True},
    "bf16_dav32": {"MUSIC3_DAV_DTYPE": "float32", "_patch": True},
    "bf16_state32_dav32": {"MUSIC3_DIT_FP32_STATE": "1", "MUSIC3_DAV_DTYPE": "float32", "_patch": True},
    "fp16": {"MUSIC3_ACOUSTIC_DTYPE": "float16", "_patch": True},
    "fp16_dav32": {"MUSIC3_ACOUSTIC_DTYPE": "float16", "MUSIC3_DAV_DTYPE": "float32", "_patch": True},
}


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


def ensure_template(base, name, env_overrides):
    if not env_overrides:
        return base["id"], False
    for t in runpod("GET", "/templates"):
        if t.get("name") == name:
            return t["id"], True
    env = dict(base["env"])
    start_cmd = list(base["dockerStartCmd"])
    if env_overrides.get("_patch"):
        import base64
        env["MUSIC3_SGL_PATCH_B64"] = base64.b64encode(PATCH.read_bytes()).decode()
        runtime = PATCHED_RUNTIME + "-" + name[len(PREFIX):]
        env["PYTHONPATH"] = runtime
        start_cmd = [part.replace("/runpod-volume/omniserve/music3/sglang-omni-e0c98529", runtime) for part in start_cmd]
    env.update({k: v for k, v in env_overrides.items() if not k.startswith("_")})
    env["MUSIC3_RESULT_CACHE_NAMESPACE"] = name
    payload = {"name": name, "imageName": base["imageName"], "containerDiskInGb": base["containerDiskInGb"],
               "dockerEntrypoint": [], "dockerStartCmd": start_cmd, "env": env, "isServerless": True,
               "volumeMountPath": base.get("volumeMountPath") or "/runpod-volume"}
    if base.get("containerRegistryAuthId"):
        payload["containerRegistryAuthId"] = base["containerRegistryAuthId"]
    created = runpod("POST", "/templates", payload)
    return created["id"], True


def ensure_endpoint(name, template_id, prod):
    for e in runpod("GET", "/endpoints"):
        if e.get("name") == name:
            return e["id"]
    payload = {"templateId": template_id, "computeType": "GPU", "gpuCount": 1, "name": name,
               "workersMin": 0, "workersMax": 1, "idleTimeout": 20, "flashboot": True,
               "scalerType": "REQUEST_COUNT", "scalerValue": 1, "executionTimeoutMs": 2400000,
               "allowedCudaVersions": prod.get("allowedCudaVersions") or ["13.0"],
               "gpuTypeIds": ["NVIDIA H200"], "networkVolumeId": prod["networkVolumeId"]}
    return runpod("POST", "/endpoints", payload)["id"]


def run_variant(name, endpoint, songs, out_dir, run_ts, results):
    out_dir.mkdir(parents=True, exist_ok=True)
    for song in songs:
        key = f"musicresults/{run_ts}/{name}/{song['id']}.wav"
        upload_url, public_url, fetch_url = bench.presign(key)
        body = {"workload": "minimax-music3", "prompt": song["caption"], "lyrics": song["lyrics"],
                "duration_seconds": int(song["duration"]), "seed": int(song["seed"]),
                "output_upload_url": upload_url, "output_public_url": public_url}
        try:
            state = bench.run(f"{name}/{song['id']}", endpoint, body, poll=10, deadline=3000)
        except Exception as error:
            log(name, song["id"], "error", error)
            results.append({"variant": name, "song": song["id"], "error": str(error)})
            continue
        (out_dir / f"{song['id']}.json").write_text(json.dumps(state, indent=1))
        if state.get("status") != "COMPLETED":
            results.append({"variant": name, "song": song["id"], "status": state.get("status"), "error": str(state.get("error"))[:500]})
            continue
        for attempt in range(10):
            try:
                with urllib.request.urlopen(fetch_url, timeout=300) as response:
                    (out_dir / f"{song['id']}.wav").write_bytes(response.read())
                break
            except Exception:
                time.sleep(5)
        metrics = (state.get("output") or {}).get("metrics") or {}
        results.append({"variant": name, "song": song["id"], "gpu": metrics.get("gpu"),
                        "generation_seconds": metrics.get("generation_seconds"), "server_start_seconds": metrics.get("server_start_seconds"),
                        "duration_seconds": metrics.get("duration_seconds"), "wall": state.get("_wall_seconds"),
                        "execution_ms": state.get("executionTime"), "delay_ms": state.get("delayTime")})
        log(name, song["id"], "done", metrics.get("gpu"), metrics.get("generation_seconds"))


def cleanup(prod_template_id):
    for e in runpod("GET", "/endpoints"):
        if str(e.get("name", "")).startswith(PREFIX):
            log("delete endpoint", e["name"])
            runpod("PATCH", f"/endpoints/{e['id']}", {"workersMin": 0, "workersMax": 0})
            runpod("DELETE", f"/endpoints/{e['id']}")
    for t in runpod("GET", "/templates"):
        if str(t.get("name", "")).startswith(PREFIX) and t["id"] != prod_template_id:
            log("delete template", t["name"])
            runpod("DELETE", f"/templates/{t['id']}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--songs", type=pathlib.Path)
    parser.add_argument("--variants", default=",".join(VARIANTS))
    parser.add_argument("--output-dir", type=pathlib.Path, default=ROOT / "musicresults" / "endpoint-ablation")
    parser.add_argument("--cleanup", action="store_true")
    args = parser.parse_args()
    bench.load_env(ROOT / ".env")
    bench.load_env(pathlib.Path("/vfast/data/code/omniserve-native/.runpod-music3.env"))
    prod_template_id = os.environ["MUSIC3_RUNPOD_TEMPLATE_ID"]
    if args.cleanup:
        cleanup(prod_template_id)
        return
    base = runpod("GET", f"/templates/{prod_template_id}")
    prod = runpod("GET", f"/endpoints/{os.environ['MUSIC3_RUNPOD_ENDPOINT_ID']}")
    songs = json.loads(args.songs.read_text())
    run_ts = int(time.time())
    threads, results = [], []
    for name in args.variants.split(","):
        template_id, _ = ensure_template(base, PREFIX + name, VARIANTS[name])
        endpoint = ensure_endpoint(PREFIX + name, template_id, prod)
        log(name, "template", template_id, "endpoint", endpoint)
        thread = threading.Thread(target=run_variant, args=(name, endpoint, songs, args.output_dir / name, run_ts, results), daemon=True)
        thread.start()
        threads.append(thread)
    for thread in threads:
        thread.join()
    (args.output_dir / "results.json").write_text(json.dumps({"run_ts": run_ts, "results": results}, indent=1))
    log("finished", json.dumps(results)[:2000])


if __name__ == "__main__":
    main()
