"""Cut a long video into shots and flag the ones that are usable for a swap (no burned-in subtitles, enough motion)."""
import json
import re
import subprocess
from pathlib import Path

import cv2
import numpy as np


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,width,height,r_frame_rate,duration",
                          "-of", "json", str(path)], capture_output=True, text=True, check=True).stdout
    info = json.loads(out)
    video = next(s for s in info["streams"] if s["codec_type"] == "video")
    num, den = video["r_frame_rate"].split("/")
    return {"width": video["width"], "height": video["height"], "fps": int(num) / int(den), "duration": float(video["duration"])}


def detect_cuts(path, start, end, threshold=0.3):
    """Hard-cut times (seconds) in [start, end] using ffmpeg's scene score."""
    cmd = ["ffmpeg", "-hide_banner", "-ss", str(start), "-t", str(end - start), "-i", str(path),
           "-vf", f"select='gt(scene,{threshold})',showinfo", "-an", "-f", "null", "-"]
    err = subprocess.run(cmd, capture_output=True, text=True).stderr
    return [start + float(m) for m in re.findall(r"pts_time:([0-9.]+)", err)]


def subtitle_ratio(frame):
    """Fraction of bright yellow pixels in the bottom band (the film's burned-in subtitles are yellow)."""
    h = frame.shape[0]
    band = cv2.cvtColor(frame[int(h * 0.62):], cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(band, (20, 120, 170), (38, 255, 255))
    return float(mask.mean() / 255)


def shot_stats(path, t0, t1, samples=5):
    cap = cv2.VideoCapture(str(path))
    ratios, motion, prev = [], [], None
    for i in range(samples):
        t = t0 + (t1 - t0) * (i + 0.5) / samples
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
        ok, frame = cap.read()
        if not ok:
            continue
        ratios.append(subtitle_ratio(frame))
        g = cv2.cvtColor(cv2.resize(frame, (160, 64)), cv2.COLOR_BGR2GRAY).astype(np.float32)
        if prev is not None:
            motion.append(float(np.abs(g - prev).mean()))
        prev = g
    cap.release()
    return {"subtitle": max(ratios) if ratios else 0.0, "motion": float(np.mean(motion)) if motion else 0.0}


def build_shots(path, start, end, threshold=0.3, min_len=0.8):
    cuts = [start] + [c for c in detect_cuts(path, start, end, threshold) if start < c < end] + [end]
    shots = []
    for a, b in zip(cuts, cuts[1:]):
        if b - a < min_len:
            continue
        s = shot_stats(path, a, b)
        shots.append({"index": len(shots), "start": round(a, 3), "end": round(b, 3), "duration": round(b - a, 3),
                      "has_subtitle": s["subtitle"] > 0.004, **s})
    return shots


def contact_sheet(path, shots, out, cols=6, thumb=(296, 128)):
    cap = cv2.VideoCapture(str(path))
    tiles = []
    for s in shots:
        cap.set(cv2.CAP_PROP_POS_MSEC, (s["start"] + s["duration"] / 2) * 1000)
        ok, frame = cap.read()
        tile = cv2.resize(frame, thumb) if ok else np.zeros((thumb[1], thumb[0], 3), np.uint8)
        label = f"#{s['index']} {s['start']:.0f}s {s['duration']:.1f}s" + (" SUB" if s["has_subtitle"] else "")
        cv2.putText(tile, label, (4, 14), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 255, 255), 1, cv2.LINE_AA)
        tiles.append(tile)
    while len(tiles) % cols:
        tiles.append(np.zeros_like(tiles[0]))
    rows = [np.hstack(tiles[i:i + cols]) for i in range(0, len(tiles), cols)]
    cv2.imwrite(str(out), np.vstack(rows))
    cap.release()


def cut_clip(src, start, duration, out, keep_audio=True, fps=24):
    cmd = ["ffmpeg", "-y", "-v", "error", "-ss", f"{start:.3f}", "-i", str(src), "-t", f"{duration:.3f}", "-r", str(fps),
           "-c:v", "libx264", "-crf", "12", "-pix_fmt", "yuv420p"]
    cmd += ["-c:a", "aac", "-b:a", "192k"] if keep_audio else ["-an"]
    subprocess.run(cmd + [str(out)], check=True)
    return Path(out)
