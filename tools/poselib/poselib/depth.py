"""Depth maps for library images via Depth Anything V2 (small), saved as grayscale webp (near = bright)."""
import json
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from transformers import AutoImageProcessor, AutoModelForDepthEstimation

MODEL = "depth-anything/Depth-Anything-V2-Small-hf"


def run(out: Path, only: str = "shisei", batch: int = 16):
    entries = json.loads((out / f"{only}.json").read_text())
    dev = "cuda" if torch.cuda.is_available() else "cpu"
    proc = AutoImageProcessor.from_pretrained(MODEL)
    model = AutoModelForDepthEstimation.from_pretrained(MODEL).to(dev).eval().half() if dev == "cuda" else \
        AutoModelForDepthEstimation.from_pretrained(MODEL).eval()
    dd = out / "images" / "depth"
    dd.mkdir(parents=True, exist_ok=True)
    jobs = [(e, v, rel) for e in entries for v, rel in e["views"].items()]
    todo = [j for j in jobs if not (dd / (Path(j[2]).stem + ".webp")).exists()]
    for i, (e, v, rel) in enumerate(todo):
        im = Image.open(out / "images" / rel).convert("RGB")
        inp = proc(images=im, return_tensors="pt").to(dev)
        if dev == "cuda":
            inp["pixel_values"] = inp["pixel_values"].half()
        with torch.no_grad():
            d = model(**inp).predicted_depth
        d = torch.nn.functional.interpolate(d[None].float(), size=im.size[::-1], mode="bicubic")[0, 0].cpu().numpy()
        lo, hi = np.percentile(d, 1), np.percentile(d, 99.5)
        n = np.clip((d - lo) / max(hi - lo, 1e-6), 0, 1)
        Image.fromarray((n * 255).astype(np.uint8)).save(dd / (Path(rel).stem + ".webp"), quality=88)
        if i % 100 == 0:
            print(f"{i}/{len(todo)}", flush=True)
    for e in entries:
        e["depth"] = {v: f"depth/{Path(rel).stem}.webp" for v, rel in e["views"].items()}
    (out / f"{only}.json").write_text(json.dumps(entries, ensure_ascii=False))
