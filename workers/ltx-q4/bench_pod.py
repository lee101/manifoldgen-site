import json, os, subprocess, sys, threading, time, urllib.request, shutil
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import graphs

OUT = "/tmp/pub/bench.json"
PROMPT = json.load(open("/tmp/prompts.json"))
RES = {"gpu": None, "vram_gb": None, "runs": [], "log": []}


def save():
    json.dump(RES, open(OUT, "w"), indent=1)


def sh(c):
    return subprocess.run(c, shell=True, capture_output=True, text=True).stdout.strip()


def http(path, data=None):
    req = urllib.request.Request("http://127.0.0.1:8188" + path, data=json.dumps(data).encode() if data else None,
                                 headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=60))


class Comfy:
    def __init__(self, flags):
        self.log = open("/tmp/pub/comfy_bench.log", "ab")
        self.p = subprocess.Popen(["python3", "main.py", "--listen", "127.0.0.1", "--port", "8188",
                                   "--output-directory", "/tmp/pub/out", "--input-directory", "/tmp/pub/in"] + flags,
                                  cwd="/opt/ComfyUI", stdout=self.log, stderr=subprocess.STDOUT)
        for _ in range(180):
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


def peak_vram(stop, box):
    while not stop.is_set():
        try:
            v = int(sh("nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits").splitlines()[0])
            box[0] = max(box[0], v)
        except Exception:
            pass
        time.sleep(0.5)


def run_one(name, graph):
    stop = threading.Event(); box = [0]
    threading.Thread(target=peak_vram, args=(stop, box), daemon=True).start()
    t0 = time.time()
    try:
        pid = http("/prompt", {"prompt": graph})["prompt_id"]
        while True:
            time.sleep(1)
            h = http("/history/" + pid)
            if pid in h:
                e = h[pid]; break
    finally:
        stop.set()
    msgs = {m[0]: m[1].get("timestamp") for m in e["status"]["messages"]}
    ex = None
    if msgs.get("execution_start") and msgs.get("execution_success"):
        ex = (msgs["execution_success"] - msgs["execution_start"]) / 1000
    ok = e["status"]["status_str"] == "success"
    files = [i["filename"] for o in e["outputs"].values() for i in o.get("images", [])]
    return {"name": name, "ok": ok, "exec_s": ex, "wall_s": round(time.time() - t0, 1), "peak_vram_mb": box[0], "files": files,
            "err": None if ok else json.dumps(e["status"])[-600:]}


def main():
    RES["gpu"] = sh("nvidia-smi --query-gpu=name --format=csv,noheader").splitlines()[0]
    RES["vram_gb"] = round(int(sh("nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits").splitlines()[0]) / 1024)
    RES["ram_gb"] = int(sh("free -g | awk '/Mem:/{print $2}'"))
    help_txt = sh("cd /opt/ComfyUI && python3 main.py --help 2>&1")
    RES["flags_available"] = [f for f in ("--use-sage-attention", "--use-flash-attention", "--use-ck-attention", "--fast", "--use-pytorch-cross-attention") if f in help_txt]
    sage = sh("python3 -m pip install --break-system-packages -q sageattention 2>&1 | tail -2")
    RES["sage_install"] = sage[-200:]
    save()
    have_fp8 = os.path.exists("/opt/ComfyUI/models/diffusion_models/" + graphs.FP8) and RES["vram_gb"] >= 40
    P = PROMPT["rooftop"]
    configs = [("q4_single_1280x736", dict(unet=graphs.Q4, width=1280, height=736, two_stage=False)),
               ("q4_two_stage_1280x704", dict(unet=graphs.Q4, width=1280, height=704, two_stage=True))]
    if have_fp8:
        configs += [("fp8_single_1280x736", dict(unet=graphs.FP8, width=1280, height=736, two_stage=False)),
                    ("fp8_two_stage_1280x704", dict(unet=graphs.FP8, width=1280, height=704, two_stage=True))]
    modes = [("default", [])]
    if "--use-sage-attention" in RES["flags_available"] and "Successfully" in sage + "Successfully":
        modes.append(("sage", ["--use-sage-attention"]))
    for mode, flags in modes:
        c = Comfy(flags)
        try:
            for cname, kw in configs:
                if mode != "default" and "two_stage" not in cname:
                    continue
                for rep in (1, 2, 3):
                    g = graphs.build(P, frames=121, seed=rep, prefix=f"video/bench_{cname}_{mode}_r{rep}", **kw)
                    r = run_one(f"{cname}|{mode}|run{rep}", g)
                    RES["runs"].append(r); save()
                    print(r, flush=True)
        finally:
            c.stop()
    c = Comfy([])
    try:
        for cname, kw in configs:
            if "two_stage" not in cname:
                continue
            for key, text in PROMPT.items():
                g = graphs.build(text, frames=121, seed=1, prefix=f"video/ab_{cname}_{key}", **kw)
                r = run_one(f"ab|{cname}|{key}", g)
                RES["runs"].append(r); save()
                print(r, flush=True)
    finally:
        c.stop()
    RES["done"] = True
    save()


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        RES["fatal"] = repr(e); save(); raise
