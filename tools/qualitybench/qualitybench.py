"""qualitybench: first / middle / last frame audit sheets + objective metrics for video model A/B runs.

Clips are found as <arm>_<scene>.(webm|mp4) in one or more directories. For every scene it writes
sheets/<scene>.jpg (one row per arm: first, middle, last frame, labelled with metrics and timing) and
frames/<arm>_<scene>_{first,mid,last}.jpg, plus metrics.json and report.md.

usage: uv run tools/qualitybench/qualitybench.py OUT_DIR CLIP_DIR [CLIP_DIR ...]
         [--timing status.json ...] [--inputs DIR_WITH_<scene>.png] [--order fal,base,pika6,...]

Metrics (all on frames resized to 960 px wide):
  sharp      mean Laplacian variance (detail; higher = crisper, also rises with noise)
  motion     mean absolute frame-to-frame difference (0-255)
  jumps      frame steps > 4x the median step + 2 (cuts, pops, flicker)
  flicker    std of per-frame mean luma after removing a linear trend (exposure pumping)
  drift      mean abs colour difference between the first and last frame (scene change)
  first_psnr PSNR of frame 0 against the conditioning image (image-to-video fidelity)
  audio_db   RMS level of the soundtrack (None = silent / missing)
"""
# /// script
# requires-python = ">=3.10"
# dependencies = ["opencv-python-headless", "numpy", "pillow"]
# ///
import argparse, json, re, subprocess, sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

NAME = re.compile(r"^(?P<arm>.+?)_(?P<scene>[a-z0-9]+)\.(webm|mp4|mov)$")


def read_frames(path):
    """Decode through ffmpeg (OpenCV builds often lack AV1, which our workers emit)."""
    probe = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate",
                            "-of", "json", str(path)], capture_output=True, text=True)
    stream = json.loads(probe.stdout or "{}").get("streams", [{}])[0]
    w, h = stream.get("width"), stream.get("height")
    if not w or not h:
        return [], 0.0
    num, _, den = stream.get("r_frame_rate", "24/1").partition("/")
    fps = float(num) / float(den or 1)
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "rawvideo", "-pix_fmt", "bgr24", "-"],
                         capture_output=True).stdout
    n = len(raw) // (w * h * 3)
    frames = list(np.frombuffer(raw[: n * w * h * 3], dtype=np.uint8).reshape(n, h, w, 3))
    return frames, fps


def resize_w(frame, width=960):
    h = round(frame.shape[0] * width / frame.shape[1])
    return cv2.resize(frame, (width, h), interpolation=cv2.INTER_AREA if frame.shape[1] > width else cv2.INTER_CUBIC)


def audio_db(path):
    proc = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
                          capture_output=True)
    a = np.frombuffer(proc.stdout, dtype=np.float32)
    if a.size < 1600:
        return None
    rms = float(np.sqrt((a ** 2).mean()))
    return round(20 * np.log10(rms + 1e-9), 1) if rms > 1e-5 else None


def psnr(a, b):
    b = cv2.resize(b, (a.shape[1], a.shape[0]), interpolation=cv2.INTER_AREA)
    mse = ((a.astype(np.float32) - b.astype(np.float32)) ** 2).mean()
    return 99.0 if mse == 0 else round(float(10 * np.log10(255 ** 2 / mse)), 2)


def metrics(path, inputs, scene):
    frames, fps = read_frames(path)
    if not frames:
        return None, []
    small = [resize_w(f) for f in frames]
    gray = [cv2.cvtColor(f, cv2.COLOR_BGR2GRAY).astype(np.float32) for f in small]
    step = max(1, len(gray) // 16)
    diffs = np.array([np.abs(gray[i] - gray[i - 1]).mean() for i in range(1, len(gray))]) if len(gray) > 1 else np.zeros(1)
    med = float(np.median(diffs)) + 1e-6
    luma = np.array([g.mean() for g in gray])
    x = np.arange(len(luma))
    trend = np.polyval(np.polyfit(x, luma, 1), x) if len(luma) > 2 else luma
    m = {
        "frames": len(frames), "fps": round(fps, 2), "res": f"{frames[0].shape[1]}x{frames[0].shape[0]}",
        "seconds": round(len(frames) / fps, 2) if fps else None,
        "sharp": round(float(np.mean([cv2.Laplacian(g, cv2.CV_32F).var() for g in gray[::step]])), 1),
        "motion": round(float(diffs.mean()), 2),
        "jumps": int((diffs > 4 * med + 2).sum()),
        "flicker": round(float(np.std(luma - trend)), 2),
        "drift": round(float(np.abs(small[0].astype(np.float32) - small[-1].astype(np.float32)).mean()), 1),
        "audio_db": audio_db(path),
    }
    ref = inputs / f"{scene}.png" if inputs else None
    if ref is not None and ref.exists():
        m["first_psnr"] = psnr(frames[0], cv2.imread(str(ref)))
    picks = [frames[0], frames[len(frames) // 2], frames[-1]]
    return m, picks


def font(size):
    for f in ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/TTF/DejaVuSans.ttf"]:
        if Path(f).exists():
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def label(m, t):
    parts = [m["res"], f"{m['seconds']}s", f"sharp {m['sharp']}", f"motion {m['motion']}", f"jumps {m['jumps']}",
             f"flicker {m['flicker']}"]
    if "first_psnr" in m:
        parts.append(f"f0 psnr {m['first_psnr']}")
    parts.append("audio " + (f"{m['audio_db']}dB" if m["audio_db"] is not None else "none"))
    if t:
        parts.append(f"gen {t:.0f}s")
    return "  ".join(parts)


def sheet(rows, dest, cell_w=480):
    f_big, f_small = font(22), font(15)
    blocks = []
    for arm, m, picks, t in rows:
        cells = []
        for frame in picks:
            img = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            img = img.resize((cell_w, round(img.height * cell_w / img.width)), Image.LANCZOS)
            cells.append(img)
        h = max(c.height for c in cells)
        block = Image.new("RGB", (cell_w * 3, h + 52), "black")
        for i, c in enumerate(cells):
            block.paste(c, (i * cell_w, 52))
        d = ImageDraw.Draw(block)
        d.text((8, 2), arm, fill="yellow", font=f_big)
        d.text((8, 28), label(m, t), fill="white", font=f_small)
        blocks.append(block)
    W = max(b.width for b in blocks)
    out = Image.new("RGB", (W, sum(b.height for b in blocks) + 4 * len(blocks)), "gray")
    y = 0
    for b in blocks:
        out.paste(b, (0, y)); y += b.height + 4
    out.save(dest, quality=88)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("dirs", nargs="+")
    ap.add_argument("--timing", nargs="*", default=[], help="status.json files with runs[{arm,scene,generation_s|wall_s}]")
    ap.add_argument("--inputs", default=None, help="dir with <scene>.png conditioning frames")
    ap.add_argument("--order", default="", help="comma list of arms, first rows first")
    a = ap.parse_args()
    out = Path(a.out); (out / "sheets").mkdir(parents=True, exist_ok=True); (out / "frames").mkdir(exist_ok=True)
    timing = {}
    for t in a.timing:
        data = json.loads(Path(t).read_text())
        for r in data if isinstance(data, list) else data.get("runs", []):
            if "arm" in r:
                timing[(r["arm"], r["scene"])] = r.get("generation_s") or r.get("wall_s")
            elif "scene" in r and "wall_s" in r:
                timing[("fal", r["scene"])] = r["wall_s"]
    clips = {}
    for d in a.dirs:
        for f in sorted(Path(d).iterdir()):
            mt = NAME.match(f.name)
            if mt:
                clips.setdefault(mt["scene"], {})[mt["arm"]] = f
    order = [x for x in a.order.split(",") if x]
    rank = lambda arm: (order.index(arm) if arm in order else len(order), arm)
    report, all_m = ["| scene | arm | res | s | gen s | sharp | motion | jumps | flicker | drift | f0 psnr | audio dB |",
                     "|---|---|---|---|---|---|---|---|---|---|---|---|"], {}
    inputs = Path(a.inputs) if a.inputs else None
    for scene in sorted(clips):
        rows = []
        for arm in sorted(clips[scene], key=rank):
            m, picks = metrics(clips[scene][arm], inputs, scene)
            if m is None:
                print("unreadable", clips[scene][arm], file=sys.stderr); continue
            t = timing.get((arm, scene))
            m["gen_s"] = t
            all_m[f"{arm}/{scene}"] = m
            for tag, frame in zip(["first", "mid", "last"], picks):
                cv2.imwrite(str(out / "frames" / f"{arm}_{scene}_{tag}.jpg"), resize_w(frame, 960), [cv2.IMWRITE_JPEG_QUALITY, 90])
            rows.append((arm, m, picks, t))
            report.append(f"| {scene} | {arm} | {m['res']} | {m['seconds']} | {t if t is None else round(t)} | {m['sharp']} | "
                          f"{m['motion']} | {m['jumps']} | {m['flicker']} | {m['drift']} | {m.get('first_psnr', '')} | {m['audio_db']} |")
        if rows:
            sheet(rows, out / "sheets" / f"{scene}.jpg")
    (out / "metrics.json").write_text(json.dumps(all_m, indent=1))
    (out / "report.md").write_text("\n".join(report) + "\n")
    print("\n".join(report))


if __name__ == "__main__":
    main()
