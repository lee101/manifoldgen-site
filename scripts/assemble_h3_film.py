#!/usr/bin/env python3
"""Assemble rendered H3 shot clips into a finished short film.

Normalizes createdfilms/<slug>/shots/<id>.mp4 to a common 1920x1080/30fps
h264/aac shape, concatenates them with hard cuts, mixes an optional
sidechain-ducked music bed under the dialogue, burns minimal title/end cards,
and uploads the master to the manifoldgenstatic R2 bucket:

  python3 scripts/assemble_h3_film.py --spec createdfilms/ember/spec.json \
      --music createdfilms/ember/bed.opus

The film directory (shots/, build/, film.mp4) is the spec's parent, so specs
living outside createdfilms/ work too. Mirrors scripts/render_higgsfield_videos.py
conventions (load_dotenv, aws CLI upload with immutable cache headers).
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import textwrap
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
R2_ACCOUNT_ID = os.environ.get("R2_ACCOUNT_ID", "f76d25b8b86cfa5638f43016510d8f77")
R2_BUCKET = "manifoldgenstatic"
R2_PUBLIC_HOST = "manifoldgenstatic.manifoldgen.com"
ENDPOINT = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

TITLE_SECONDS = 2.5
END_SECONDS = 3.5
VIDEO_ARGS = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p"]


def load_dotenv() -> None:
    mg = ROOT / ".env"
    if mg.exists():
        for line in mg.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ[key.strip()] = value.strip().strip('"').strip("'")
    shared = Path("/nvme0n1-disk/code/app-site/.env")
    if shared.exists():
        for line in shared.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            if key in ("CLOUDFLARE_R2_ACCESS_KEY_ID", "CLOUDFLARE_R2_SECRET_ACCESS_KEY", "R2_ACCOUNT_ID") and not os.environ.get(key):
                os.environ[key] = value.strip().strip('"').strip("'")


def aws_env() -> dict[str, str]:
    env = os.environ.copy()
    env["AWS_ACCESS_KEY_ID"] = env.get("CLOUDFLARE_R2_ACCESS_KEY_ID", "")
    env["AWS_SECRET_ACCESS_KEY"] = env.get("CLOUDFLARE_R2_SECRET_ACCESS_KEY", "")
    env["AWS_DEFAULT_REGION"] = "auto"
    if not env["AWS_ACCESS_KEY_ID"] or not env["AWS_SECRET_ACCESS_KEY"]:
        raise SystemExit("missing CLOUDFLARE_R2_ACCESS_KEY_ID / CLOUDFLARE_R2_SECRET_ACCESS_KEY")
    return env


def s3_cp(local: Path, key: str, content_type: str) -> str:
    subprocess.check_call([
        "aws", "--endpoint-url", ENDPOINT, "s3", "cp", str(local), f"s3://{R2_BUCKET}/{key}",
        "--content-type", content_type, "--cache-control", "public, max-age=31536000, immutable",
    ], env=aws_env(), stdout=subprocess.DEVNULL)
    return f"https://{R2_PUBLIC_HOST}/{key}"


def ffmpeg(args: list[str]) -> None:
    subprocess.check_call(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args])


def ffprobe(args: list[str]) -> str:
    return subprocess.check_output(["ffprobe", "-v", "error", *args], text=True).strip()


def duration(path: Path) -> float:
    return float(ffprobe(["-show_entries", "format=duration", "-of", "csv=p=0", str(path)]))


def has_audio(path: Path) -> bool:
    return bool(ffprobe(["-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", str(path)]))


def normalize_shot(src: Path, dst: Path) -> bool:
    if dst.exists() and dst.stat().st_mtime > src.stat().st_mtime:
        return False
    vf = ("scale=1920:1080:force_original_aspect_ratio=decrease:force_divisible_by=2,"
          "pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30")
    cmd = ["-i", str(src)]
    maps = ["-map", "0:v:0"]
    if has_audio(src):
        maps += ["-map", "0:a:0"]
    else:
        cmd += ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"]
        maps += ["-map", "1:a:0", "-shortest"]
    ffmpeg(cmd + maps + [
        "-vf", vf, *VIDEO_ARGS,
        "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2",
        "-video_track_timescale", "15360", str(dst),
    ])
    return True


def concat_shots(clips: list[Path], dst: Path, workdir: Path) -> None:
    listing = workdir / "concat.txt"
    listing.write_text("".join(f"file '{c.resolve().as_posix()}'\n" for c in clips))
    ffmpeg(["-f", "concat", "-safe", "0", "-i", str(listing), "-c", "copy", str(dst)])


def mix_music(src: Path, music: Path, dst: Path) -> None:
    end = duration(src)
    graph = (
        f"[0:a]aformat=sample_rates=48000:channel_layouts=stereo,"
        f"atrim=0:{end:.3f},asetpts=PTS-STARTPTS[bed];"
        f"[1:a]aformat=sample_rates=48000:channel_layouts=stereo,asplit=2[dial][side];"
        f"[bed][side]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[duck];"
        f"[dial][duck]amix=inputs=2:duration=first:normalize=0:weights='1 0.1'[aout]"
    )
    ffmpeg([
        "-stream_loop", "-1", "-i", str(music), "-i", str(src),
        "-filter_complex", graph, "-map", "1:v:0", "-map", "[aout]",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2",
        "-shortest", str(dst),
    ])


def fc_match_font() -> str:
    try:
        found = subprocess.check_output(
            ["fc-match", "-f", "%{file}", "DejaVu Sans:bold"], text=True).strip()
    except (OSError, subprocess.CalledProcessError):
        return ""
    return found if found and Path(found).exists() else ""


def wrap_logline(logline: str) -> str:
    lines = textwrap.wrap(" ".join(logline.split()), width=60) or [""]
    if len(lines) > 3:
        lines = lines[:3]
        lines[2] = lines[2][:57].rstrip() + "…"
    return "\n".join(lines)


def drawtext(font: str, textfile: Path, fontsize: int, y: str, alpha: str, line_spacing: int = 0) -> str:
    options = [
        f"fontfile={font}",
        f"textfile={textfile.resolve().as_posix()}",
        f"fontsize={fontsize}",
        "fontcolor=white",
        "shadowcolor=black@0.7",
        "shadowx=2",
        "shadowy=2",
        "x=(w-text_w)/2",
        f"y={y}",
        f"alpha='{alpha}'",
    ]
    if line_spacing:
        options.append(f"line_spacing={line_spacing}")
    return "drawtext=" + ":".join(options)


def burn_cards(src: Path, dst: Path, title: str, logline: str, font: str, workdir: Path) -> None:
    end_start = duration(src) - END_SECONDS
    title_file = workdir / "card_title.txt"
    title_file.write_text(title)
    filters = [drawtext(font, title_file, 96, "(h-text_h)/2",
                        f"clip(min(t/0.4,({TITLE_SECONDS}-t)/0.4),0,1)")]
    if logline.strip():
        end_title_file = workdir / "card_end_title.txt"
        end_title_file.write_text(title)
        logline_file = workdir / "card_end_logline.txt"
        logline_file.write_text(wrap_logline(logline))
        fade_in = f"clip((t-({end_start:.3f}))/0.5,0,1)"
        filters.append(drawtext(font, end_title_file, 56, "h*0.40", fade_in))
        filters.append(drawtext(font, logline_file, 34, "h*0.40+76", fade_in, line_spacing=10))
    ffmpeg(["-i", str(src), "-vf", ",".join(filters), *VIDEO_ARGS,
            "-c:a", "copy", "-movflags", "+faststart", str(dst)])


def faststart(src: Path, dst: Path) -> None:
    ffmpeg(["-i", str(src), "-c", "copy", "-movflags", "+faststart", str(dst)])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--spec", type=Path, required=True)
    parser.add_argument("--music", type=Path, help="instrumental bed, looped/trimmed to film length and ducked under dialogue")
    parser.add_argument("--no-cards", action="store_true")
    parser.add_argument("--no-upload", action="store_true")
    parser.add_argument("--force", action="store_true", help="rebuild even if the master exists")
    args = parser.parse_args()

    load_dotenv()
    spec = json.loads(args.spec.read_text())
    slug = spec["slug"]
    film_dir = args.spec.parent
    build = film_dir / "build"
    master = film_dir / "film.mp4"
    url = f"https://{R2_PUBLIC_HOST}/films/{slug}/film.mp4"

    if master.exists() and not args.force:
        print(url)
        return
    if not spec.get("shots"):
        raise SystemExit(f"spec has no shots: {args.spec}")
    if args.music and not args.music.exists():
        raise SystemExit(f"missing music bed: {args.music}")

    build.mkdir(parents=True, exist_ok=True)
    clips = []
    for shot in spec["shots"]:
        src = film_dir / "shots" / f"{shot['id']}.mp4"
        if not src.exists():
            raise SystemExit(f"missing shot: {src}")
        dst = build / f"norm_{shot['id']}.mp4"
        fresh = normalize_shot(src, dst)
        clips.append(dst)
        print(f"{'normalized' if fresh else 'cached'} {src.name}", flush=True)

    current = build / "concat.mp4"
    concat_shots(clips, current, build)
    print(f"concatenated {len(clips)} shots", flush=True)

    if args.music:
        mixed = build / "mixed.mp4"
        mix_music(current, args.music, mixed)
        current = mixed
        print(f"mixed music bed {args.music}", flush=True)

    font = "" if args.no_cards else fc_match_font()
    if font:
        burn_cards(current, master, spec["title"], spec.get("logline", ""), font, build)
        print("burned title/end cards", flush=True)
    else:
        if not args.no_cards:
            print("no DejaVu font found, skipping cards", flush=True)
        faststart(current, master)

    print(f"master {master}: {duration(master):.2f}s, {master.stat().st_size / 1048576:.1f} MiB", flush=True)
    if not args.no_upload:
        url = s3_cp(master, f"films/{slug}/film.mp4", "video/mp4")
    print(url)


if __name__ == "__main__":
    main()
