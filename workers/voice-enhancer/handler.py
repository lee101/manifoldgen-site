#!/usr/bin/env python3
"""RunPod serverless handler: voice enhancer and lyric music generator.

Input
  task         "enhance" (audio_url required) or "lyrics" (lyrics required)
  audio_url    https URL of the sung/rapped take (enhance)
  lyrics       pasted lyrics; for enhance it overrides speech-to-text
  prompt       style, e.g. "hard hip-hop diss track"
  tts          {"tier": "studio|standard|lite", "voice": "..."} (lyrics task)
  tracks       subset of ["voice", "studio", "produce"]
  seed, candidates
  uploads      {track: {"upload_url": presigned PUT, "public_url": ...}} MP3 targets
Output
  {"tracks": {track: {"audio_url", "seconds", "lufs"}}, "lyrics", "metrics", "timing", "tts"}
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
import traceback
import urllib.request

HERE = Path(__file__).resolve().parent
MAX_INPUT_BYTES = int(os.getenv("VE_MAX_INPUT_BYTES", str(200 << 20)))
MAX_SECONDS = float(os.getenv("VE_MAX_SECONDS", "360"))
MAX_LYRIC_CHARS = int(os.getenv("VE_MAX_LYRIC_CHARS", "6000"))
TRACKS = ("voice", "studio", "produce")


def _dry() -> bool:
    """Local container tests: file:// inputs and outputs on disk instead of R2."""
    return bool(os.getenv("VE_DRY_UPLOAD_DIR"))


def _download(url: str, dest: Path) -> None:
    if _dry() and url.startswith("file://"):
        shutil.copyfile(url[len("file://"):], dest)
        return
    if not url.startswith("https://"):
        raise ValueError("audio_url must be https")
    req = urllib.request.Request(url, headers={"User-Agent": "manifoldgen-voice-enhancer/1"})
    with urllib.request.urlopen(req, timeout=120) as response, dest.open("wb") as out:
        total = 0
        while chunk := response.read(1 << 20):
            total += len(chunk)
            if total > MAX_INPUT_BYTES:
                raise ValueError("input audio is too large")
            out.write(chunk)


def _duration(path: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         capture_output=True, text=True, timeout=60)
    try:
        return float(out.stdout.strip())
    except ValueError as error:
        raise ValueError("input is not decodable audio") from error


def _upload(wav: Path, target: dict) -> str:
    mp3 = wav.with_suffix(".mp3")
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(wav), "-codec:a", "libmp3lame", "-b:a", "320k", str(mp3)],
                   check=True, timeout=300)
    data = mp3.read_bytes()
    if _dry():
        dest = Path(os.environ["VE_DRY_UPLOAD_DIR"]) / Path(target["public_url"]).name
        dest.write_bytes(data)
        return target["public_url"]
    req = urllib.request.Request(target["upload_url"], data=data, method="PUT",
                                 headers={"Content-Type": "audio/mpeg", "Content-Length": str(len(data))})
    with urllib.request.urlopen(req, timeout=300):
        pass
    return target["public_url"]


def normalize(raw: dict) -> dict:
    job = raw.get("input", raw) if isinstance(raw, dict) else {}
    task = job.get("task", "enhance")
    if task not in ("enhance", "lyrics"):
        raise ValueError("task must be enhance or lyrics")
    lyric_text = str(job.get("lyrics") or "").strip()
    if len(lyric_text) > MAX_LYRIC_CHARS:
        raise ValueError(f"lyrics are limited to {MAX_LYRIC_CHARS} characters")
    if task == "lyrics" and len(lyric_text.split()) < 8:
        raise ValueError("lyrics need at least 8 words")
    if task == "enhance" and not str(job.get("audio_url") or "").startswith("file://" if _dry() else "https://"):
        raise ValueError("audio_url is required")
    tracks = tuple(t for t in job.get("tracks") or TRACKS if t in TRACKS) or TRACKS
    uploads = job.get("uploads") or {}
    for name in tracks:
        target = uploads.get(name) or {}
        if not str(target.get("upload_url", "")).startswith("https://") or not str(target.get("public_url", "")).startswith("https://"):
            raise ValueError(f"uploads.{name} needs https upload_url and public_url")
    tts = job.get("tts") or {}
    from lyrics_tts import VOICES
    tier = tts.get("tier", "studio")
    if tier not in VOICES:
        raise ValueError("tts.tier must be studio, standard or lite")
    voice = tts.get("voice") or VOICES[tier][0]
    if voice not in VOICES[tier]:
        raise ValueError(f"tts.voice must be one of {VOICES[tier]}")
    seed = int(job.get("seed") or 831001)
    candidates = min(max(int(job.get("candidates") or 2), 1), 3)
    prompt = str(job.get("prompt") or "hard hip-hop diss track").strip()[:300]
    return {"task": task, "audio_url": job.get("audio_url"), "lyrics": lyric_text, "prompt": prompt,
            "tts": {"tier": tier, "voice": voice}, "tracks": tracks, "uploads": uploads,
            "seed": seed % 2_000_000_000, "candidates": candidates}


def run(raw: dict) -> dict:
    import enhance
    import lyrics_tts
    import soundfile as sf
    request = normalize(raw)
    enhance.warm_yue_cache()
    started = time.time()
    work = Path(tempfile.mkdtemp(prefix="ve-job-"))
    try:
        source = work / "source"
        tts_usage = None
        if request["task"] == "lyrics":
            audio, tts_usage = lyrics_tts.perform(request["lyrics"], request["tts"]["tier"], request["tts"]["voice"])
            source = work / "source.wav"
            sf.write(source, audio, lyrics_tts.SR, subtype="PCM_24")
        else:
            _download(request["audio_url"], source)
        seconds = _duration(source)
        if not 5 <= seconds <= MAX_SECONDS:
            raise ValueError(f"audio must be between 5 seconds and {MAX_SECONDS / 60:.0f} minutes")
        lyric_file = None
        if request["lyrics"]:
            lyric_file = work / "lyrics.txt"
            lyric_file.write_text(request["lyrics"])
        args = argparse.Namespace(
            input=str(source), prompt=request["prompt"], out=str(work / "out.wav"), track=None, beat=None,
            lyrics=str(lyric_file) if lyric_file else None, yue_dir=None, intro_bars=2, intensity=1.0,
            lufs=-9.0, vocal_db=2.0, seed=request["seed"], candidates=request["candidates"], voice="user",
            dereverb=False)
        report = enhance.run_job(args, work, request["tracks"])
        tracks = {}
        for name, info in report.pop("tracks").items():
            tracks[name] = {"audio_url": _upload(Path(info["path"]), request["uploads"][name]),
                            "seconds": info["seconds"], "lufs": info["lufs"]}
        return {"tracks": tracks, "lyrics": report.pop("lyrics"), "input_seconds": round(seconds, 2),
                "tts": tts_usage, "metrics": report, "timing": {**report.pop("timing"),
                                                                "job_s": round(time.time() - started, 1)}}
    finally:
        shutil.rmtree(work, ignore_errors=True)


def handler(job: dict) -> dict:
    try:
        return run(job)
    except ValueError as error:
        return {"error": str(error)}
    except Exception as error:  # noqa: BLE001 - surfaced to RunPod as a failed job
        traceback.print_exc()
        return {"error": f"voice enhancer failed: {type(error).__name__}"}


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        print(json.dumps(handler(json.loads(Path(sys.argv[1]).read_text())), indent=1))
    else:
        import runpod
        runpod.serverless.start({"handler": handler})
