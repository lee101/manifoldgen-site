import json, os, shutil, subprocess, sys, time, urllib.request
sys.path.insert(0, "/src")
from pathlib import Path
from swap_runtime import SwapRuntime
cfg = json.load(open(sys.argv[1]))
W = Path("/tmp/bench"); PUB = Path("/tmp/pub")
src = W / "rapvid-source.mp4"
if not src.exists():
    req = urllib.request.Request("https://manifoldgenstatic.manifoldgen.com/static/tools/character-swap/rapvid-source.mp4", headers={"User-Agent": "curl/8.10"})
    src.write_bytes(urllib.request.urlopen(req).read())
t0 = time.time(); rt = SwapRuntime(); print("runtime up", round(time.time() - t0, 1), flush=True)
for v in cfg["runs"]:
    clip = W / f"clip-{v['start']}-{v['len']}.mp4"
    if not clip.exists():
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", str(v["start"]), "-t", str(v["len"]), "-i", str(src), "-an", "-c:v", "libx264", "-crf", "12", str(clip)], check=True)
    t = time.time()
    try:
        path, m = rt.generate(prompt=v["prompt"], source_video=clip, character_images=[W / i for i in v["images"]], steps=v.get("steps", 20), seed=v.get("seed", 7),
                              megapixels=v.get("mp", 0.4), turbo=v.get("turbo", False), grid=v.get("grid", "hold"), easycache=tuple(v["ec"]) if v.get("ec") else None, sol=v.get("sol", False))
        shutil.copy(path, PUB / f"{v['name']}.mp4")
        print("RUN", v["name"], json.dumps(m), "wall", round(time.time() - t, 1), flush=True)
    except Exception as e:
        print("RUNFAIL", v["name"], repr(e)[:600], flush=True)
rt.close()
print("ALLDONE", flush=True)
