import json, os, subprocess, sys, threading, time, urllib.request, shutil, copy, uuid

OUT = "/tmp/pub/out"
IN = "/tmp/pub/in"
os.makedirs(OUT, exist_ok=True)
os.makedirs(IN, exist_ok=True)
RES_FILE = "/tmp/pub/results.json"
RES = json.load(open(RES_FILE)) if os.path.exists(RES_FILE) else {"runs": []}
FLAGS = os.environ.get("COMFY_FLAGS", "").split()

PROMPTS = json.load(open("/tmp/bench/scenes.json"))
UNET = {
    "fl2va": "minimax_h3_fl2va_pruned_int8_convrot.safetensors",
    "pink": "PinkCherry_fl2va_MiniMax_H3_pruned_int8_convrot-beta-0.6.safetensors",
    "fused": "minimax_h3_fused_refdelta_r1024_turbo8_mystic07_int8_convrot.safetensors",
}
VAE = {
    "fp16": "minimax_h3_video_vae_fp16.safetensors",
    "int8": "minimax_h3_video_vae_int8_convrot.safetensors",
    "x2": "MiniMax-H3-X2-Detail-v1.safetensors",
}


def http(path, data=None):
    req = urllib.request.Request("http://127.0.0.1:8188" + path, data=json.dumps(data).encode() if data else None,
                                 headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=120))


def sh(c):
    return subprocess.run(c, shell=True, capture_output=True, text=True).stdout.strip()


class Comfy:
    def __init__(self, flags):
        self.log = open("/tmp/pub/comfy_bench.log", "ab")
        self.p = subprocess.Popen(["python3", "main.py", "--listen", "127.0.0.1", "--port", "8188", "--output-directory", OUT,
                                   "--input-directory", IN] + flags, cwd="/opt/ComfyUI", stdout=self.log, stderr=subprocess.STDOUT)
        for _ in range(240):
            try:
                http("/system_stats"); return
            except Exception:
                time.sleep(2)
        raise RuntimeError("comfy did not start")

    def stop(self):
        self.p.terminate()
        try:
            self.p.wait(30)
        except Exception:
            self.p.kill()


def graph(v, scene, seed, frames=None, scale=None, prefix=None):
    s = PROMPTS[scene]
    w, h = s["size"]
    k = v.get("scale", 1.0) if scale is None else scale
    w, h = int(round(w * k / 32) * 32), int(round(h * k / 32) * 32)
    n = frames or s["frames"]
    g = {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": UNET[v["unet"]], "weight_dtype": "default"}},
        "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors", "type": "minimax", "device": "default"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": VAE[v.get("vae", "int8")]}},
        "4": {"class_type": "VAELoader", "inputs": {"vae_name": "minimax_h3_audio_vae_fp32.safetensors"}},
        "5": {"class_type": "MiniMaxH3ImageToVideo", "inputs": {"clip": ["2", 0], "vae": ["3", 0], "prompt": s["prompt"], "width": w, "height": h, "length": n}},
        "7": {"class_type": "RandomNoise", "inputs": {"noise_seed": seed}},
        "8": {"class_type": "KSamplerSelect", "inputs": {"sampler_name": v.get("sampler", "res_multistep")}},
    }
    if s.get("first"):
        g["20"] = {"class_type": "LoadImage", "inputs": {"image": s["first"]}}
        g["5"]["inputs"]["first_frame"] = ["20", 0]
    if s.get("last"):
        g["21"] = {"class_type": "LoadImage", "inputs": {"image": s["last"]}}
        g["5"]["inputs"]["last_frame"] = ["21", 0]
    m = ["1", 0]
    nid = 30
    for name, strength in v.get("loras", []):
        g[str(nid)] = {"class_type": "LoraLoaderModelOnly", "inputs": {"model": m, "lora_name": name, "strength_model": strength}}
        m = [str(nid), 0]; nid += 1
    a = v.get("attn")
    if a == "sla":
        g[str(nid)] = {"class_type": "H3SLAAttention", "inputs": {"model": m, "sparsity_ratio": v.get("sparsity", 0.9), "block_size": "64",
                       "min_seq_len": 8192, "dense_last_steps": v.get("dense_last", 0), "protect_audio": True, "enabled": True}}
        m = [str(nid), 0]; nid += 1
    if v.get("easycache"):
        t, st, en = v["easycache"]
        g[str(nid)] = {"class_type": "EasyCache", "inputs": {"model": m, "reuse_threshold": t, "start_percent": st, "end_percent": en, "verbose": False}}
        m = [str(nid), 0]; nid += 1
    if v.get("shift"):
        g[str(nid)] = {"class_type": "MiniMaxH3SigmaShift", "inputs": {"model": m, "shift_video": v["shift"][0], "shift_audio": v["shift"][1]}}
        m = [str(nid), 0]; nid += 1
    g["6"] = {"class_type": "BasicGuider", "inputs": {"model": m, "conditioning": ["5", 0]}}
    g["9"] = {"class_type": "BasicScheduler", "inputs": {"model": m, "scheduler": v.get("scheduler", "simple"), "steps": v["steps"], "denoise": 1.0}}
    g["10"] = {"class_type": "SamplerCustomAdvanced", "inputs": {"noise": ["7", 0], "guider": ["6", 0], "sampler": ["8", 0], "sigmas": ["9", 0], "latent_image": ["5", 1]}}
    dec = {"class_type": "VAEDecode", "inputs": {"samples": ["10", 0], "vae": ["3", 0]}}
    if v.get("decode"):
        dec = {"class_type": v["decode"], "inputs": {"samples": ["10", 0], "vae": ["3", 0], **v.get("decode_args", {})}}
    g["11"] = dec
    g["12"] = {"class_type": "VAEDecodeAudio", "inputs": {"samples": ["10", 0], "vae": ["4", 0]}}
    g["13"] = {"class_type": "CreateVideo", "inputs": {"images": ["11", 0], "audio": ["12", 0], "fps": 24.0}}
    g["14"] = {"class_type": "SaveVideo", "inputs": {"video": ["13", 0], "filename_prefix": prefix or "x", "format": "mp4", "codec": "h264"}}
    return g


def run_graph(name, g):
    stop = threading.Event(); box = [0]

    def peak():
        while not stop.is_set():
            try:
                box[0] = max(box[0], int(sh("nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits").splitlines()[0]))
            except Exception:
                pass
            time.sleep(0.5)
    threading.Thread(target=peak, daemon=True).start()
    t0 = time.time()
    try:
        pid = http("/prompt", {"prompt": g})["prompt_id"]
        while True:
            time.sleep(1)
            h = http("/history/" + pid)
            if pid in h:
                e = h[pid]; break
    finally:
        stop.set()
    msgs = {m[0]: m[1].get("timestamp") for m in e["status"]["messages"]}
    ex = (msgs["execution_success"] - msgs["execution_start"]) / 1000 if msgs.get("execution_success") and msgs.get("execution_start") else None
    ok = e["status"]["status_str"] == "success"
    files = []
    if ok:
        for o in e["outputs"].values():
            for f in o.get("images", []) + o.get("videos", []):
                files.append(f)
    err = None if ok else json.dumps(e["status"]["messages"][-1])[:600]
    return {"exec_s": ex, "wall_s": round(time.time() - t0, 1), "peak_vram_mb": box[0], "ok": ok, "err": err, "files": files}


def save():
    json.dump(RES, open(RES_FILE, "w"), indent=1)


def main():
    jobs = json.load(open(sys.argv[1]))
    c = Comfy(FLAGS + jobs.get("flags", []))
    RES.setdefault("meta", {})["gpu"] = sh("nvidia-smi --query-gpu=name --format=csv,noheader")
    last_unet = None
    try:
        for job in jobs["runs"]:
            v = job["v"]; name = job["name"]; scene = job["scene"]; seed = job.get("seed", 7)
            if (v["unet"], v.get("vae")) != last_unet:
                try:
                    wg = graph(v, scene, 999, frames=29, scale=0.4, prefix="warm")
                    wg["7"]["inputs"]["noise_seed"] = 999
                    r = run_graph("warm", wg)
                    RES["runs"].append({"name": "warmup:" + name, "scene": scene, "exec_s": r["exec_s"], "ok": r["ok"], "err": r["err"]})
                except Exception as ex:
                    RES["runs"].append({"name": "warmup:" + name, "err": str(ex)})
                last_unet = (v["unet"], v.get("vae")); save()
            rep = job.get("repeat", 1)
            for i in range(rep):
                sd = seed + 1000 * i
                pre = "%s__%s__s%d" % (scene, name, sd)
                try:
                    r = run_graph(name, graph(v, scene, sd, prefix=pre, frames=job.get("frames")))
                except Exception as ex:
                    r = {"ok": False, "err": str(ex)}
                r.update({"name": name, "scene": scene, "seed": sd, "v": v})
                RES["runs"].append(r); save()
                print(name, scene, sd, r.get("exec_s"), r.get("peak_vram_mb"), r.get("ok"), r.get("err"), flush=True)
    finally:
        c.stop()
    print("BENCH_DONE", flush=True)


main()
