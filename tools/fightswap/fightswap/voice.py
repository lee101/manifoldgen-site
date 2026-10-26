"""Voice reference extraction (Gemini finds clean solo-speech spans), cloning and TTS (fal MiniMax)."""
from __future__ import annotations

import base64
import json
import os
import subprocess
from pathlib import Path

import requests

from . import cloud

MODEL = os.environ.get("FIGHTSWAP_AUDIO_MODEL", "gemini-3.5-flash")
FAL = "https://fal.run"


def _fal(path, body, timeout=600):
    r = requests.post(f"{FAL}/{path}", json=body, headers={"Authorization": "Key " + os.environ["FAL_KEY"]}, timeout=timeout)
    r.raise_for_status()
    return r.json()


def pick_solo_spans(wav, speaker, want=4):
    """Ask Gemini for spans where only `speaker` talks (no music, interviewer, laughter, overlap). Returns [(start, end)] seconds."""
    mp3 = Path(wav).with_suffix(".16k.ogg")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(wav), "-ac", "1", "-ar", "16000", "-c:a", "libopus", "-b:a", "24k", str(mp3)], check=True)
    data = base64.b64encode(mp3.read_bytes()).decode()
    prompt = (f"This is an interview. Find {want} spans, each 6 to 14 seconds long, in which ONLY {speaker} is speaking continuously: no interviewer, "
              "no other voices, no music, no applause or laughter, no long pauses. Spread them out. Return JSON: "
              "{\"spans\":[{\"start\":seconds,\"end\":seconds}]}")
    r = requests.post(f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent", timeout=300,
                      headers={"x-goog-api-key": os.environ["GEMINI_API_KEY"]},
                      json={"contents": [{"parts": [{"text": prompt}, {"inline_data": {"mime_type": "audio/ogg", "data": data}}]}],
                            "generationConfig": {"responseMimeType": "application/json", "temperature": 0}})
    r.raise_for_status()
    spans = json.loads(r.json()["candidates"][0]["content"]["parts"][0]["text"])["spans"]
    return [(float(s["start"]), float(s["end"])) for s in spans]


def build_reference(wav, spans, out):
    """Cut the spans and join them into one loudness-normalised reference clip."""
    out = Path(out)
    parts = []
    for i, (a, b) in enumerate(spans):
        p = out.with_name(f"{out.stem}_{i}.wav")
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", str(a), "-t", str(b - a), "-i", str(wav), "-ac", "1", "-ar", "32000", str(p)], check=True)
        parts.append(p)
    lst = out.with_suffix(".txt")
    lst.write_text("".join(f"file '{p.resolve()}'\n" for p in parts))
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-af", "loudnorm=I=-18:TP=-2", "-ar", "32000", "-ac", "1", str(out)], check=True)
    for p in parts:
        p.unlink()
    lst.unlink()
    return out


def clone(ref_wav):
    """MiniMax voice clone from a reference clip. Returns the custom voice id."""
    url = cloud.stage(ref_wav, prefix="fightswap-tmp")
    try:
        res = _fal("fal-ai/minimax/voice-clone", {"audio_url": url, "model": "speech-02-hd", "accuracy": 0.8, "noise_reduction": True,
                                                  "text": "Hello, this is a quick preview of the cloned voice."})
    finally:
        cloud.unstage(url)
    return res["custom_voice_id"]


def speak(voice_id, text, out, emotion="neutral", speed=1.0):
    res = _fal("fal-ai/minimax/speech-02-hd", {"text": text, "output_format": "url", "voice_setting": {"voice_id": voice_id, "emotion": emotion, "speed": speed, "vol": 1},
                                               "audio_setting": {"format": "mp3", "sample_rate": 44100, "channel": 1}})
    Path(out).write_bytes(requests.get(res["audio"]["url"], timeout=120).content)
    return Path(out)
