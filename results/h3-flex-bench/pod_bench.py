"""Runs on the bench pod. Phase A: H3 Comfy arms (base / turbo6 / Pika Flex) through H3Runtime.
Phase B: VDN-H3 8-NFE fp8 (separate venv, weights fetched in the background during phase A).
Everything is published under $BENCH_PUB (served over the pod's HTTP port) for launch.py to fetch."""
import json, os, shlex, shutil, subprocess, sys, time, traceback
from pathlib import Path

sys.path.insert(0, "/src")
PUB = Path(os.environ["BENCH_PUB"])
OUT = PUB / "out"
OUT.mkdir(parents=True, exist_ok=True)
STATE = {"phase": "start", "io": {}, "runs": [], "errors": [], "vdn": {}}
SCENES = json.loads(Path("/tmp/bench/scenes.json").read_text())
FRAMES = Path("/tmp/bench/frames")
PHASES = set(os.environ.get("BENCH_PHASES", "comfy,vdn").split(","))
PINK = {
    "H3_FL2VA_REPO": "SexGod1979/PinkCherry_MiniMax-H3",
    "H3_FL2VA_HF_FILENAME": "beta-0.6-fl2va/PinkCherry_fl2va_MiniMax_H3_pruned_int8_convrot-beta-0.6.safetensors",
    "H3_FL2VA_MODEL": "PinkCherry_fl2va_MiniMax_H3_pruned_int8_convrot-beta-0.6.safetensors",
    "H3_FL2VA_REVISION": "f71e0eee7c0414904b66c4efa617c34548dd2bb0",
}
# arm -> (env, size, duration, scenes or None for all)
ARMS = {
    "base": ({"H3_ACCEL_PROFILE": "balanced"}, "balanced", 5, None),
    "turbo6": ({"H3_ACCEL_PROFILE": "turbo-6", "H3_TURBO_REMAP_STEPS": "1"}, "balanced", 5, None),
    "pika6": ({"H3_ACCEL_PROFILE": "pika-6", "H3_TURBO_REMAP_STEPS": "1"}, "balanced", 5, None),
    "pika6_native": ({"H3_ACCEL_PROFILE": "pika-6", "H3_TURBO_REMAP_STEPS": "1"}, "native", 5, None),
    "pika6_hd": ({"H3_ACCEL_PROFILE": "pika-6", "H3_TURBO_REMAP_STEPS": "1"}, "hd", 5, ["dancer", "tram"]),
    "pika6_15s": ({"H3_ACCEL_PROFILE": "pika-6", "H3_TURBO_REMAP_STEPS": "1"}, "native", 15, ["fox"]),
    "pink_pika6": ({"H3_ACCEL_PROFILE": "pika-6", "H3_TURBO_REMAP_STEPS": "1", **PINK}, "balanced", 5, ["dancer", "potter"]),
}
ORDER = [a for a in os.environ.get("BENCH_ARMS", ",".join(ARMS)).split(",") if a]
ARM_KEYS = {k for env, *_ in ARMS.values() for k in env}
VDN = Path("/root/vdn")
VDN_PY = VDN / ".venv/bin/python"


def save():
    (PUB / "status.json").write_text(json.dumps(STATE, indent=1))


def sh(cmd, log, env=None, cwd=None):
    with open(PUB / log, "ab") as fh:
        fh.write(f"\n$ {cmd}\n".encode()); fh.flush()
        return subprocess.run(cmd, shell=True, stdout=fh, stderr=subprocess.STDOUT, env=env, cwd=cwd).returncode


def vdn_prepare():
    """Background: venv + patched diffusers + weights onto container disk. GPU-free."""
    t = time.monotonic()
    # UV_PYTHON pins every `uv pip` to the venv: VIRTUAL_ENV alone was ignored by the image's uv config and
    # replaced the system cu130 torch that ComfyUI runs on.
    env = {**os.environ, "HF_HOME": "/root/hf", "HF_HUB_ENABLE_HF_TRANSFER": "0", "UV_LINK_MODE": "copy",
           "UV_PYTHON": str(VDN_PY), "UV_SYSTEM_PYTHON": "0", "GIT_AUTHOR_NAME": "bench", "GIT_AUTHOR_EMAIL": "bench@localhost",
           "GIT_COMMITTER_NAME": "bench", "GIT_COMMITTER_EMAIL": "bench@localhost"}
    steps = [
        "(apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq gcc g++ >/dev/null) || true",
        "pip install -q uv",
        f"git clone -q --depth 1 https://github.com/OpenVDN/vdn-minimax-h3 {VDN}",
        "env -u UV_PYTHON uv venv -q -p 3.12 .venv",
        "uv pip install -q torch==2.13.0 torchvision==0.28.0 --index-url https://download.pytorch.org/whl/cu129",
        "uv pip install -q --prerelease=allow -e .",
        "PIP='uv pip' bash scripts/setup_diffusers.sh",
    ]
    for i, cmd in enumerate(steps):
        if sh(cmd, "vdn_setup.log", env=env, cwd=VDN if i > 2 else "/root") != 0:
            STATE["vdn"]["setup_error"] = cmd; save(); return False
    STATE["vdn"]["setup_s"] = round(time.monotonic() - t, 1); save()
    dl = (f"{VDN_PY} -c \"from huggingface_hub import snapshot_download as s; "
          "s('OpenVDN/vdn-minimax-h3', allow_patterns=['h3-base/**','stage-dmd-step-250/**'], local_dir='ckpts', max_workers=16); "
          "s('MiniMaxAI/MiniMax-H3', allow_patterns=['processor/**','text_encoder/**'], max_workers=16)\"")
    for attempt in range(3):
        if sh(dl, "vdn_setup.log", env=env, cwd=VDN) == 0:
            STATE["vdn"]["download_s"] = round(time.monotonic() - t, 1); save(); return True
        env["HF_HUB_DISABLE_XET"] = "1"
    STATE["vdn"]["setup_error"] = "download"; save()
    return False


def comfy_phase():
    import weights
    probe = subprocess.run(["python3", "-c", "import torch, torchaudio; print(torch.__version__)"], capture_output=True, text=True)
    STATE["io"]["system_torch"] = (probe.stdout or probe.stderr).strip()[-200:]
    t = time.monotonic()
    weights.ensure_weights(include_turbo=True, include_pika=True, include_face_refine=False)
    STATE["io"]["ensure_weights_s"] = round(time.monotonic() - t, 1)
    STATE["phase"] = "runtime"; save()
    from h3_runtime import H3Runtime
    t = time.monotonic()
    runtime = H3Runtime()
    STATE["io"]["runtime_init_s"] = round(time.monotonic() - t, 1)
    plan = [("warmup", "pika6", "fox")] + [(arm, arm, s) for arm in ORDER for s in (ARMS[arm][3] or SCENES)]
    for label, arm, scene in plan:
        STATE["phase"] = f"{label}:{scene}"; save()
        env, size, duration, _ = ARMS[arm]
        for key in ARM_KEYS:
            os.environ.pop(key, None)
        os.environ.update(env)
        s = SCENES[scene]
        try:
            t = time.monotonic()
            result = runtime.generate(
                prompt=s["prompt"], aspect_ratio=s["aspect"], size=size, duration=duration, steps=20, seed=1,
                first_frame=FRAMES / s["first"] if s.get("first") else None,
                return_metrics=True, encode_quality=22)
            wall = round(time.monotonic() - t, 2)
            if label == "warmup":
                continue
            target = OUT / f"{arm}_{scene}.webm"
            shutil.move(str(result.path), target)
            m = result.metrics
            STATE["runs"].append({"arm": arm, "scene": scene, "size": size, "duration": duration, "wall_s": wall,
                                  "generation_s": m.get("generation_seconds"), "steps": m.get("steps"),
                                  "res": f"{m.get('width')}x{m.get('height')}", "frames": m.get("frames"),
                                  "file": target.name})
        except Exception as err:
            STATE["errors"].append({"arm": arm, "scene": scene, "error": repr(err)[:600]})
            traceback.print_exc()
        save()
    runtime.close()


def vdn_phase(prep):
    STATE["phase"] = "vdn:wait-download"; save()
    if not prep.result():
        return
    env = {**os.environ, "HF_HOME": "/root/hf", "PYTHONPATH": str(VDN)}
    for k in [k for k in env if k.startswith("H3_")]:
        env.pop(k)
    jobs = [(s, 124, f"vdn8_{s}") for s in SCENES] + [("fox", 362, "vdn8_15s_fox")]
    encoded = {}
    for scene in SCENES:
        STATE["phase"] = f"vdn:encode:{scene}"; save()
        s, pt = SCENES[scene], VDN / f"prompts/bench_{scene}.pt"
        from h3_prompt import format_h3_prompt
        prompt = format_h3_prompt(s["prompt"], first_frame=bool(s.get("first")), effective_seconds=5.17)
        t = time.monotonic()
        if s.get("first"):
            cmd = f"{VDN_PY} src/inference/encode_keyframes.py --prompt {shlex.quote(prompt)} --first {FRAMES / s['first']} --out {pt}"
        else:
            cmd = f"{VDN_PY} src/inference/encode_prompt.py --prompt {shlex.quote(prompt)} --out {pt}"
        rc = sh(cmd, "vdn_run.log", env=env, cwd=VDN)
        STATE["vdn"][f"encode_{scene}_s"] = round(time.monotonic() - t, 1)
        if rc == 0:
            encoded[scene] = pt
        else:
            STATE["errors"].append({"arm": "vdn8", "scene": scene, "error": "encode failed"})
    for scene, frames, name in jobs:
        if scene not in encoded:
            continue
        STATE["phase"] = f"vdn:render:{name}"; save()
        out = OUT / f"{name}.mp4"
        t = time.monotonic()
        cmd = (f"{VDN_PY} src/inference/infer.py --config configs/inference/8nfe_tuned_fp8.yaml checkpoint=ckpts/stage-dmd-step-250 "
               f"render.prompt_file={encoded[scene]} render.out={out} render.num_frames={frames} render.seed=1 render.record=true")
        rc = sh(cmd, "vdn_run.log", env=env, cwd=VDN)
        wall = round(time.monotonic() - t, 2)
        rec = {}
        try:
            rec = json.loads(Path(str(out) + ".inference.json").read_text())
            shutil.copy(str(out) + ".inference.json", OUT / f"{name}.inference.json")
        except Exception:
            pass
        if rc == 0 and out.exists():
            STATE["runs"].append({"arm": "vdn8_15s" if frames > 200 else "vdn8", "scene": scene, "size": "native",
                                  "duration": 15 if frames > 200 else 5, "wall_s": wall, "frames": frames,
                                  "file": out.name, "nfe_timings": rec.get("timings") or rec.get("nfe_timings")})
        else:
            STATE["errors"].append({"arm": "vdn8", "scene": name, "error": f"render rc={rc}"})
        save()


def main():
    from concurrent.futures import ThreadPoolExecutor
    pool = ThreadPoolExecutor(1)
    prep = pool.submit(vdn_prepare) if "vdn" in PHASES else None
    if "comfy" in PHASES:
        comfy_phase()
    if prep is not None:
        vdn_phase(prep)


try:
    main()
    STATE["phase"] = "done"
except Exception as err:
    STATE["phase"] = "failed"
    STATE["errors"].append({"fatal": repr(err)[:800], "tb": traceback.format_exc()[-1500:]})
save()
