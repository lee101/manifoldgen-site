#!/usr/bin/env python3
import json
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "motiontrack"
sys.path.insert(0, str(ROOT))

from motiontrack import ptfx  # noqa: E402


def make_clip(path: str, seconds: int = 2) -> None:
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"testsrc2=size=640x360:rate=24:duration={seconds}",
                    "-f", "lavfi", "-i", f"sine=frequency=110:duration={seconds}", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", path], check=True)


def main() -> int:
    import torch

    if not torch.cuda.is_available():
        print("FAIL no CUDA device")
        return 1
    out = Path(tempfile.mkdtemp(prefix="ptfx-smoke-"))
    clip = str(out / "in.mp4")
    make_clip(clip)
    cases = {
        "track-blur": {"region": {"x": 0.3, "y": 0.3, "w": 0.3, "h": 0.3}, "style": "pixelate"},
        "sticky-overlay": {"text": "TEST", "x": 0.5, "y": 0.5, "width": 0.2},
        "flow-fx": {"effects": ["motion-blur", "trails", "jelly"]},
        "reactive-fx": {},
        "mask-propagate": {"region": {"x": 0.3, "y": 0.3, "w": 0.3, "h": 0.3}, "shape": "ellipse"},
    }
    ptfx.KEEP_WARM = True
    bad = 0
    for tool, params in cases.items():
        t = time.time()
        try:
            r = ptfx.run(tool, clip, out / tool, params, audio=str(out / 'in.mp4') if tool == 'reactive-fx' else None)
            ok = (out / tool / "result.mp4").stat().st_size > 1000 and r.get("ok")
        except Exception as e:
            ok, r = False, {"error": f"{type(e).__name__}: {e}"}
        bad += not ok
        print(f"{'ok  ' if ok else 'FAIL'} {tool:15s} {time.time() - t:5.1f}s {json.dumps({k: v for k, v in r.items() if k in ('error', 'elapsed')})}")
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
