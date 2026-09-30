import json, os, subprocess, sys, time
sys.path.insert(0, "/tmp/bench")
import graphs
import bench_pod as b

OUT = "/tmp/pub/sweep.json"
RES = {"gpu": None, "runs": []}
b.OUT = OUT
b.RES = RES
RES["gpu"] = b.sh("nvidia-smi --query-gpu=name --format=csv,noheader").splitlines()[0]
vram = int(b.sh("nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits").splitlines()[0]) // 1024
fp8 = "/opt/ComfyUI/models/diffusion_models/" + graphs.FP8
if not os.path.exists(fp8):
    from huggingface_hub import hf_hub_download
    os.environ["HF_HUB_ENABLE_HF_TRANSFER"] = "1"
    src = hf_hub_download("ChrisColeTech/LTX-2.3-uncensored-v1.4-FP8", "split/diffusion_models/" + graphs.FP8, local_dir="/workspace/models")
    os.symlink(src, fp8)
P = json.load(open("/tmp/prompts.json"))["rooftop"]
variants = [
    ("fp8_2s_base8_ref4", [], dict(unet=graphs.FP8, two_stage=True, steps=8, refine_steps=4)),
    ("fp8_2s_base8_ref3", [], dict(unet=graphs.FP8, two_stage=True, steps=8, refine_steps=3)),
    ("fp8_2s_base6_ref3", [], dict(unet=graphs.FP8, two_stage=True, steps=6, refine_steps=3)),
    ("fp8_2s_base8_ref4_fast", ["--fast"], dict(unet=graphs.FP8, two_stage=True, steps=8, refine_steps=4)),
    ("fp8_2s_base8_ref4_compile", [], dict(unet=graphs.FP8, two_stage=True, steps=8, refine_steps=4, attention_compile=True)),
    ("fp8_2s_base8_ref4_cfg1", [], dict(unet=graphs.FP8, two_stage=True, steps=8, refine_steps=4, cfg=1.0)),
    ("q4_2s_base8_ref3", [], dict(unet=graphs.Q4, two_stage=True, steps=8, refine_steps=3)),
]
flagset = {}
for name, flags, kw in variants:
    flagset.setdefault(tuple(flags), []).append((name, kw))
for flags, items in flagset.items():
    c = b.Comfy(list(flags))
    try:
        for name, kw in items:
            for rep in (1, 2, 3):
                g = graphs.build(P, width=1280, height=704, frames=121, seed=10 + rep, prefix=f"video/sweep_{name}_r{rep}", **kw)
                try:
                    r = b.run_one(f"{name}|run{rep}", g)
                except Exception as e:
                    r = {"name": f"{name}|run{rep}", "ok": False, "err": repr(e)[:300]}
                RES["runs"].append(r); b.save(); print(r, flush=True)
                if not r["ok"]:
                    break
    finally:
        c.stop()
RES["done"] = True
b.save()
