"""Runs ON the pod: keeps one SwapRuntime warm and drains /tmp/queue/*.json, writing /tmp/pub/<name>.mp4 (+ .json / .err).

Job file: {"name", "video_url", "image_urls": [..], "prompt", "params": {steps, seed, megapixels, turbo, sampler, scheduler, ...}}
"""
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, "/src")
from swap_runtime import SwapRuntime  # noqa: E402

Q, PUB, WORK = Path("/tmp/queue"), Path("/tmp/pub"), Path("/tmp/jobs")
for d in (Q, PUB, WORK):
    d.mkdir(parents=True, exist_ok=True)


def fetch(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": "curl/8.10"})
    dest.write_bytes(urllib.request.urlopen(req, timeout=300).read())
    return dest


def main():
    import swap_relay
    swap_relay.ensure_installed(os.environ.get("SWAP_COMFY_DIR", "/opt/ComfyUI"))  # node pack + SAM weights, before ComfyUI boots
    t0 = time.time()
    rt = SwapRuntime()
    print("RUNTIME_UP", round(time.time() - t0, 1), flush=True)
    while True:
        jobs = sorted(Q.glob("*.json"))
        if not jobs:
            time.sleep(2)
            continue
        jf = jobs[0]
        job = json.loads(jf.read_text())
        jf.rename(jf.with_suffix(".running"))
        name = job["name"]
        t = time.time()
        try:
            if job.get("video_from"):  # chained pass: read the previous pass's trimmed output
                clip = PUB / f"{job['video_from']}.mp4"
            else:
                clip = fetch(job["video_url"], WORK / f"{name}.mp4")
            imgs = [fetch(u, WORK / f"{name}-ref{i}{Path(u).suffix or '.jpg'}") for i, u in enumerate(job["image_urls"])]
            params = dict(job.get("params") or {})
            if params.get("easycache"):
                params["easycache"] = tuple(params["easycache"])
            if job.get("relay"):  # masked single-person edit (SAM subject), the LoRA author's recipe
                anchor = fetch(job["anchor_url"], WORK / f"{name}-anchor.png") if job.get("anchor_url") else None
                path, metrics = rt.generate_relay(prompt=job["prompt"], subject=job["relay"]["subject"], source_video=clip, character_image=imgs[0],
                                                  anchor_image=anchor, **params)
            else:
                path, metrics = rt.generate(prompt=job["prompt"], source_video=clip, character_images=imgs, **params)
            # the worker pads to H3's 17n+5 grid by holding the last frame: trim back so chained passes and the edit stay in sync
            subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(path), "-t", str(metrics["source_seconds"]), "-c:v", "libx264", "-crf", "10",
                            "-pix_fmt", "yuv420p", "-an", str(PUB / f"{name}.mp4")], check=True)
            (PUB / f"{name}.json").write_text(json.dumps({**metrics, "wall": round(time.time() - t, 1)}))
            print("DONE", name, round(time.time() - t, 1), flush=True)
        except Exception as exc:  # keep the daemon alive for the rest of the batch
            (PUB / f"{name}.err").write_text(repr(exc)[:2000])
            print("FAIL", name, repr(exc)[:300], flush=True)
        jf.with_suffix(".running").unlink(missing_ok=True)


if __name__ == "__main__":
    main()
