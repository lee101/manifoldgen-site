import sys, json, time, argparse
sys.path.insert(0, "/vfast/data/code/vsrbench/ComfyUI-new")
import torch
from safetensors import safe_open
from comfy.ldm.wan.model_vsr import RelayFlash, relay_keyframes, relay_latent_size
import comfy.ops

p = argparse.ArgumentParser()
p.add_argument("--scale", type=int, default=2)
p.add_argument("--w", type=int, default=1344)
p.add_argument("--h", type=int, default=768)
p.add_argument("--frames", type=int, default=16)
p.add_argument("--dtype", default="fp16")
p.add_argument("--profile", action="store_true")
p.add_argument("--compile", action="store_true")
a = p.parse_args()

path = f"/vfast/data/code/vsrbench/relayvsr/vae/relayvsr_flash_vae_x{a.scale}_fp32.safetensors"
sd = {}
with safe_open(path, "pt") as f:
    meta = f.metadata()
    for k in f.keys():
        sd[k] = f.get_tensor(k)
dt = {"fp16": torch.float16, "bf16": torch.bfloat16, "fp32": torch.float32}[a.dtype]
m = RelayFlash(json.loads(meta["config"])["upscale_factor"])
print(m.load_state_dict(sd, strict=False))
m = m.to("cuda", dt).eval()
stride = 16 // a.scale
lh, lw = relay_latent_size(a.h, a.w, stride)
T = a.frames
kf = relay_keyframes(T)
x = torch.randn(1, 48, len(kf), lh, lw, device="cuda", dtype=dt)
lq = torch.rand(T, a.h, a.w, 3)
out = torch.empty(1, 3, T, a.h * a.scale, a.w * a.scale)
if a.compile:
    m.decode_frame = torch.compile(m.decode_frame, dynamic=False)
    m.prepare_condition = torch.compile(m.prepare_condition, dynamic=False)


def run():
    with torch.no_grad():
        m.decode(x, lq_images=lq, output_buffer=out)
    torch.cuda.synchronize()


run()
torch.cuda.reset_peak_memory_stats()
t0 = time.time()
run()
el = time.time() - t0
print(json.dumps({"scale": a.scale, "dtype": a.dtype, "compile": a.compile, "frames": T, "sec": round(el, 2), "ms_per_frame": round(el / T * 1000, 1), "peak_gb": round(torch.cuda.max_memory_allocated() / 2**30, 2)}))
if a.profile:
    from torch.profiler import profile, ProfilerActivity
    with profile(activities=[ProfilerActivity.CUDA, ProfilerActivity.CPU]) as pr:
        run()
    print(pr.key_averages().table(sort_by="cuda_time_total", row_limit=12, max_name_column_width=60))
