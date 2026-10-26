"""Hard-cut the swapped shots together and rebuild the soundtrack: original foley/music per shot + ducked dialogue lines."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path


def _run(cmd):
    subprocess.run(cmd, check=True, capture_output=True)


def dur(path):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                                capture_output=True, text=True, check=True).stdout.strip())


def concat_video(clips, out, size=None, fps=24):
    out = Path(out)
    lst = out.with_suffix(".txt")
    norm = []
    for i, c in enumerate(clips):
        n = out.with_name(f"{out.stem}_n{i}.mp4")
        vf = f"fps={fps}" + (f",scale={size[0]}:{size[1]}:flags=lanczos" if size else "")
        _run(["ffmpeg", "-y", "-v", "error", "-i", str(c), "-vf", vf, "-an", "-c:v", "libx264", "-crf", "12", "-pix_fmt", "yuv420p", str(n)])
        norm.append(n)
    lst.write_text("".join(f"file '{n.resolve()}'\n" for n in norm))
    _run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(out)])
    for n in norm:
        n.unlink()
    lst.unlink()
    return out


def source_audio(src, shots, out):
    """Original soundtrack for each shot (start, duration), joined with 15 ms fades so cuts don't click."""
    out = Path(out)
    parts = []
    for i, (start, d) in enumerate(shots):
        p = out.with_name(f"{out.stem}_{i}.wav")
        _run(["ffmpeg", "-y", "-v", "error", "-ss", f"{start:.3f}", "-t", f"{d:.3f}", "-i", str(src), "-vn", "-ac", "2", "-ar", "44100",
              "-af", f"afade=t=in:d=0.015,afade=t=out:st={max(d - 0.015, 0):.3f}:d=0.015", str(p)])
        parts.append(p)
    lst = out.with_suffix(".txt")
    lst.write_text("".join(f"file '{p.resolve()}'\n" for p in parts))
    _run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(out)])
    for p in parts:
        p.unlink()
    lst.unlink()
    return out


def mix(bed, lines, out, duck_db=-12, lufs=-16):
    """lines: [(path, start_seconds)]. The bed is ducked under each line (sidechain-free: gain envelope from line spans)."""
    inputs = ["-i", str(bed)]
    filt = []
    spans = []
    for i, (p, t) in enumerate(lines):
        inputs += ["-i", str(p)]
        d = dur(p)
        spans.append((t, t + d))
        filt.append(f"[{i + 1}:a]aformat=sample_rates=44100:channel_layouts=stereo,adelay={int(t * 1000)}|{int(t * 1000)},volume=1.4[l{i}]")
    gain = "+".join(f"between(t,{a - 0.1:.2f},{b + 0.2:.2f})" for a, b in spans) or "0"
    filt.append(f"[0:a]volume='if(gt({gain},0),{10 ** (duck_db / 20):.3f},1)':eval=frame[bed]")
    mixin = "".join(f"[l{i}]" for i in range(len(lines)))
    filt.append(f"[bed]{mixin}amix=inputs={len(lines) + 1}:duration=first:normalize=0,loudnorm=I={lufs}:TP=-1.5:LRA=11[a]")
    _run(["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", ";".join(filt), "-map", "[a]", str(out)])
    return Path(out)


def mux(video, audio, out):
    _run(["ffmpeg", "-y", "-v", "error", "-i", str(video), "-i", str(audio), "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", str(out)])
    return Path(out)
