import json, os, shutil, sys, time
from pathlib import Path

sys.path.insert(0, "/src")
PUB = Path(os.environ["BENCH_PUB"])
OUT = PUB / "out"
OUT.mkdir(parents=True, exist_ok=True)
STATE = {"phase": "start", "io": {}, "runs": [], "errors": []}
PROMPTS = json.loads(Path("/tmp/prompts.json").read_text())
ARMS = [a for a in os.environ.get("BENCH_ARMS", "base,cap14,turbo8,turbo6").split(",") if a]
ARM_ENV = {
    "base": {"H3_ACCEL_PROFILE": "balanced"},
    "cap14": {"H3_ACCEL_PROFILE": "balanced", "H3_MAX_STEPS": "14"},
    "cap16": {"H3_ACCEL_PROFILE": "balanced", "H3_MAX_STEPS": "16"},
    "aggr": {"H3_ACCEL_PROFILE": "aggressive"},
    "turbo8": {"H3_ACCEL_PROFILE": "turbo-8", "H3_TURBO_REMAP_STEPS": "1"},
    "turbo6": {"H3_ACCEL_PROFILE": "turbo-6", "H3_TURBO_REMAP_STEPS": "1"},
}
ARM_KEYS = {k for env in ARM_ENV.values() for k in env}


def save():
    (PUB / "status.json").write_text(json.dumps(STATE, indent=1))


def seq_read(path, limit):
    started, done = time.monotonic(), 0
    with open(path, "rb", buffering=0) as handle:
        while done < limit and (chunk := handle.read(8 << 20)):
            done += len(chunk)
    return round(done / (time.monotonic() - started) / 1e6)


def main():
    import h3_prefetch
    import weights
    t = time.monotonic()
    weights.ensure_weights(include_turbo="turbo8" in ARMS or "turbo6" in ARMS, include_face_refine=False)
    STATE["io"]["ensure_weights_s"] = round(time.monotonic() - t, 1)
    files = h3_prefetch.default_files()
    STATE["io"]["seq_te_4gb_mb_s"] = seq_read(files[0].resolve(), 4 << 30)
    STATE["io"]["parallel_fl2va"] = h3_prefetch.prefetch([files[1]])
    STATE["io"]["parallel_rest"] = h3_prefetch.prefetch([files[0], files[2], files[3]])
    STATE["phase"] = "runtime"; save()
    from h3_runtime import H3Runtime
    t = time.monotonic()
    runtime = H3Runtime()
    STATE["io"]["runtime_init_s"] = round(time.monotonic() - t, 1)
    plan = [("warmup", "base", "rooftop")] + [(arm, arm, scene) for arm in ARMS for scene in PROMPTS]
    for label, arm, scene in plan:
        STATE["phase"] = f"{label}:{scene}"; save()
        for key in ARM_KEYS:
            os.environ.pop(key, None)
        os.environ.update(ARM_ENV[arm])
        try:
            t = time.monotonic()
            result = runtime.generate(prompt=PROMPTS[scene], aspect_ratio="16:9", size="balanced", duration=5,
                                      steps=20, seed=7 if label == "warmup" else 1, return_metrics=True, encode_quality=26)
            wall = round(time.monotonic() - t, 2)
            target = OUT / f"{label}_{scene}.webm"
            shutil.move(str(result.path), target)
            STATE["runs"].append({"label": label, "arm": arm, "scene": scene, "wall_s": wall,
                                  "generation_s": result.metrics.get("generation_seconds"),
                                  "steps": result.metrics.get("steps"), "file": target.name})
        except Exception as err:
            STATE["errors"].append({"label": label, "scene": scene, "error": repr(err)[:400]})
        save()
    runtime.close()


try:
    main()
    STATE["phase"] = "done"
except Exception as err:
    STATE["phase"] = "failed"
    STATE["errors"].append({"fatal": repr(err)[:800]})
save()
