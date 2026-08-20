#!/usr/bin/env python3
"""Recompose the shots against the master audio, frame-exact.

Each clip is trimmed to its planned frame count (the generated tail is thrown
away), the trimmed segments are concatenated, and the original song is muxed
back as the primary audio track. H3's own generated audio is kept as a second
track so nothing is lost.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import common
from common import FPS


def segment(clip: Path, frames: int, width: int, height: int, destination: Path, crf: int) -> None:
    common.run([
        "ffmpeg", "-y", "-v", "error", "-i", str(clip),
        "-vf", f"fps={FPS},scale={width}:{height}:force_original_aspect_ratio=increase,"
               f"crop={width}:{height},setsar=1",
        "-frames:v", str(frames), "-an",
        "-c:v", "libx264", "-preset", "slow", "-crf", str(crf), "-pix_fmt", "yuv420p",
        str(destination),
    ])


def still_segment(image: Path, frames: int, width: int, height: int, destination: Path, crf: int) -> None:
    common.run([
        "ffmpeg", "-y", "-v", "error", "-loop", "1", "-i", str(image),
        "-vf", f"scale={width}:{height}:force_original_aspect_ratio=increase,"
               f"crop={width}:{height},setsar=1,fps={FPS}",
        "-frames:v", str(frames), "-an",
        "-c:v", "libx264", "-preset", "slow", "-crf", str(crf), "-pix_fmt", "yuv420p",
        str(destination),
    ])


def clip_audio(clip: Path, seconds: float, destination: Path) -> bool:
    try:
        common.run([
            "ffmpeg", "-y", "-v", "error", "-i", str(clip), "-vn",
            "-af", "apad", "-t", f"{seconds:.4f}", "-ac", "2", "-ar", "48000",
            "-c:a", "pcm_s16le", str(destination),
        ])
        return True
    except RuntimeError:
        return False


def silence(seconds: float, destination: Path) -> None:
    common.run([
        "ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
        "-t", f"{seconds:.4f}", "-c:a", "pcm_s16le", str(destination),
    ])


def concat(paths: list[Path], listing: Path, destination: Path, copy: bool = True) -> None:
    listing.write_text("".join(f"file '{path.resolve()}'\n" for path in paths))
    cmd = ["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(listing)]
    cmd += ["-c", "copy"] if copy else ["-c:a", "pcm_s16le"]
    common.run(cmd + [str(destination)])


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--plan", type=Path, default=Path("work/plan.json"))
    parser.add_argument("--clips", type=Path, default=Path("work/clips"))
    parser.add_argument("--work", type=Path, default=Path("work/segments"))
    parser.add_argument("--out", type=Path, default=Path("finalresult"))
    parser.add_argument("--name", default="")
    parser.add_argument("--width", type=int, default=1344)
    parser.add_argument("--height", type=int, default=768)
    parser.add_argument("--crf", type=int, default=16)
    parser.add_argument("--allow-missing", action="store_true",
                        help="hold the still for shots with no clip instead of failing")
    args = parser.parse_args()

    plan = json.loads(args.plan.read_text())
    audio = Path(plan["audio"])
    name = args.name or f"{audio.stem}-video"
    args.work.mkdir(parents=True, exist_ok=True)
    args.out.mkdir(parents=True, exist_ok=True)

    segments: list[Path] = []
    audio_parts: list[Path] = []
    missing: list[int] = []
    for shot in plan["shots"]:
        index = shot["index"]
        matches = sorted(args.clips.glob(f"{index:03d}_*.webm")) or sorted(args.clips.glob(f"{index:03d}.webm"))
        piece = args.work / f"{index:03d}.mp4"
        part = args.work / f"{index:03d}.wav"
        if matches:
            segment(matches[0], shot["use_frames"], args.width, args.height, piece, args.crf)
            if not clip_audio(matches[0], shot["use_seconds"], part):
                silence(shot["use_seconds"], part)
        elif args.allow_missing:
            missing.append(index)
            still_segment(Path(shot["image_path"]), shot["use_frames"], args.width, args.height, piece, args.crf)
            silence(shot["use_seconds"], part)
        else:
            raise SystemExit(f"missing clip for shot {index}; render it or pass --allow-missing")
        segments.append(piece)
        audio_parts.append(part)

    silent_video = args.work / "concat.mp4"
    concat(segments, args.work / "segments.txt", silent_video)
    generated_audio = args.work / "h3-audio.wav"
    concat(audio_parts, args.work / "audio.txt", generated_audio, copy=False)

    final = args.out / f"{name}.mp4"
    common.run([
        "ffmpeg", "-y", "-v", "error",
        "-i", str(silent_video), "-i", str(audio), "-i", str(generated_audio),
        "-map", "0:v:0", "-map", "1:a:0", "-map", "2:a:0",
        "-c:v", "copy", "-c:a:0", "aac", "-b:a:0", "320k", "-c:a:1", "aac", "-b:a:1", "192k",
        "-metadata:s:a:0", "title=master music", "-metadata:s:a:1", "title=h3 generated audio",
        "-disposition:a:0", "default", "-disposition:a:1", "0",
        "-movflags", "+faststart", str(final),
    ])

    video_seconds = common.probe_duration(silent_video)
    audio_seconds = common.probe_duration(audio)
    print(f"{final}: {video_seconds:.3f}s video vs {audio_seconds:.3f}s audio "
          f"(drift {abs(video_seconds - audio_seconds) * 1000:.0f}ms), {len(segments)} shots"
          + (f", stills held for {missing}" if missing else ""))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
