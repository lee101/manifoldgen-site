import json, os, sys
sys.path.insert(0, "/tmp/bench")
import graphs
import bench_pod as b

b.OUT = "/tmp/pub/sweep2.json"
RES = {"gpu": b.sh("nvidia-smi --query-gpu=name --format=csv,noheader").splitlines()[0], "runs": []}
b.RES = RES
NEG = ("missing limbs, deformities, low quality, idle movement, low motion, text, signature, fonts, printed words, "
       "watermark, logo, website url, nnbycam.com, caption, subtitles, blank screens, hard cuts between scenes")
PR = json.load(open("/tmp/prompts.json"))
c = b.Comfy([])
def go(name, prompt, **kw):
    g = graphs.build(prompt, frames=121, prefix=f"video/s2_{name}", negative=kw.pop("negative", NEG), **kw)
    try:
        r = b.run_one(name, g)
    except Exception as e:
        r = {"name": name, "ok": False, "err": repr(e)[:300]}
    RES["runs"].append(r); b.save(); print(r, flush=True)
try:
    go("wm_q4_single_seed2", PR["apartment"], width=1280, height=736, seed=2, unet=graphs.Q4, two_stage=False)
    for s in (1, 2, 3, 4):
        go(f"wm_fp8_2s_seed{s}", PR["apartment"], width=1280, height=704, seed=s, unet=graphs.FP8, two_stage=True)
    go("xf_1024_b8r4", PR["rooftop"], width=1024, height=576, seed=21, unet=graphs.FP8, two_stage=True)
    go("xf_1024_b6r3", PR["rooftop"], width=1024, height=576, seed=22, unet=graphs.FP8, two_stage=True, steps=6, refine_steps=3)
    go("std_b8r4_rooftop", PR["rooftop"], width=1280, height=704, seed=26, unet=graphs.FP8, two_stage=True)
    go("std_b8r3_rooftop", PR["rooftop"], width=1280, height=704, seed=26, unet=graphs.FP8, two_stage=True, refine_steps=3)
    go("std_b6r3_rooftop", PR["rooftop"], width=1280, height=704, seed=26, unet=graphs.FP8, two_stage=True, steps=6, refine_steps=3)
finally:
    c.stop()
RES["done"] = True
b.save()
