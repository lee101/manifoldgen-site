import json, sys, time, uuid, shutil, subprocess, os, urllib.request, argparse

p = argparse.ArgumentParser()
p.add_argument("--port", type=int, default=8199)
p.add_argument("--clip", required=True)
p.add_argument("--out", required=True)
p.add_argument("--scale", type=int, default=4)
p.add_argument("--detail", type=float, default=1.0)
p.add_argument("--unet", default=None)
p.add_argument("--vae", default=None)
p.add_argument("--comfy", default="/vfast/data/code/vsrbench/ComfyUI-new")
p.add_argument("--sampler", default="euler")
p.add_argument("--scheduler", default="simple")
a = p.parse_args()

unet = a.unet or ("relayvsr_x4_int8_convrot.safetensors" if a.scale == 4 else "relayvsr_x2_lightx2v_int8_convrot.safetensors")
vae = a.vae or f"relayvsr_flash_vae_x{a.scale}_fp32.safetensors"
name = f"{uuid.uuid4().hex[:8]}_{os.path.basename(a.clip)}"
shutil.copy(a.clip, f"{a.comfy}/input/{name}")
prefix = f"vsr_{uuid.uuid4().hex[:8]}"
g = {
    "1": {"class_type": "UNETLoader", "inputs": {"unet_name": unet, "weight_dtype": "default"}},
    "2": {"class_type": "VAELoader", "inputs": {"vae_name": vae}},
    "3": {"class_type": "LoadVideo", "inputs": {"file": name}},
    "4": {"class_type": "GetVideoComponents", "inputs": {"video": ["3", 0]}},
    "5": {"class_type": "RelayVSRConditioning", "inputs": {"model": ["1", 0], "images": ["4", 0]}},
    "6": {"class_type": "KSampler", "inputs": {"model": ["1", 0], "seed": 0, "steps": 1, "cfg": 1.0, "sampler_name": a.sampler, "scheduler": a.scheduler, "positive": ["5", 0], "negative": ["5", 0], "latent_image": ["5", 1], "denoise": 1.0}},
    "7": {"class_type": "VSRDecode", "inputs": {"vae": ["2", 0], "samples": ["6", 0], "images": ["4", 0], "detail": a.detail}},
    "8": {"class_type": "CreateVideo", "inputs": {"images": ["7", 0], "fps": ["4", 2]}},
    "9": {"class_type": "SaveVideo", "inputs": {"video": ["8", 0], "filename_prefix": prefix, "format": "mp4", "codec": "h264"}},
}
base = f"http://127.0.0.1:{a.port}"
def req(path, data=None):
    r = urllib.request.Request(base + path, data=json.dumps(data).encode() if data else None, headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(r))
t0 = time.time()
pid = req("/prompt", {"prompt": g, "client_id": "b"})["prompt_id"]
while True:
    h = req(f"/history/{pid}")
    if pid in h:
        break
    time.sleep(0.5)
wall = time.time() - t0
h = h[pid]
st = h["status"]
if st["status_str"] != "success":
    print(json.dumps({"error": st}, default=str)[:3000])
    sys.exit(1)
msgs = {m[0]: m[1] for m in st["messages"]}
ex = (msgs["execution_success"]["timestamp"] - msgs["execution_start"]["timestamp"]) / 1000
outs = h["outputs"]["9"]["images"][0]
src = f"{a.comfy}/output/{outs.get('subfolder','')}/{outs['filename']}"
os.makedirs(os.path.dirname(a.out), exist_ok=True)
shutil.move(src, a.out)
os.remove(f"{a.comfy}/input/{name}")
print(json.dumps({"clip": a.clip, "out": a.out, "wall_s": round(wall, 2), "exec_s": round(ex, 2)}))
