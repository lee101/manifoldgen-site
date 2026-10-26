"""Identity audit of a swapped clip: Gemini compares sampled frames against the reference photos and scores each person."""
from __future__ import annotations

import base64
import json
import os
import subprocess
import tempfile
from pathlib import Path

import requests

MODEL = os.environ.get("FIGHTSWAP_VISION", "gemini-3.5-flash")


def _b64(path, max_w=640):
    from PIL import Image
    im = Image.open(path).convert("RGB")
    if im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)))
    p = Path(tempfile.mkstemp(suffix=".jpg")[1]); im.save(p, quality=88)
    return base64.b64encode(p.read_bytes()).decode()


def sample_frames(video, n=3):
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(video)], capture_output=True, text=True, check=True).stdout)
    out = []
    for i in range(n):
        p = Path(tempfile.mkstemp(suffix=".png")[1])
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", f"{dur * (i + 0.5) / n:.3f}", "-i", str(video), "-frames:v", "1", str(p)], check=True)
        out.append(p)
    return out


def identity_score(video, people: dict[str, Path], n=3):
    """people: {name: reference photo}. Returns {"scores": {name: mean 0-10}, "artifacts": 0-10, "notes": str}. Scores 0 mean that person is absent/unchanged."""
    parts = [{"text": ("First the reference photos, one per named person; then {n} frames from an edited fight clip in which those people were face-swapped. "
                      "For each named person visible in the frames, score 0-10 how clearly their face matches THEIR reference photo (10 = unmistakably that person, "
                      "0 = a different person). The frames come from a swap of a different actor, so be strict: a face that still looks like some other actor is a 0-3. "
                      "If a named person is not visible in a frame give null for that frame. Also give an artifacts score 0-10 (10 = clean). "
                      "JSON: {{\"people\":{{\"Name\":[score per frame]}},\"artifacts\":n,\"notes\":\"short\"}}").format(n=n)}]
    for name, ref in people.items():
        parts += [{"text": f"Reference for {name}:"}, {"inline_data": {"mime_type": "image/jpeg", "data": _b64(ref)}}]
    parts.append({"text": "Frames:"})
    for f in sample_frames(video, n):
        parts.append({"inline_data": {"mime_type": "image/jpeg", "data": _b64(f)}})
    r = requests.post(f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent", timeout=180,
                      headers={"x-goog-api-key": os.environ["GEMINI_API_KEY"]},
                      json={"contents": [{"parts": parts}], "generationConfig": {"responseMimeType": "application/json", "temperature": 0}})
    r.raise_for_status()
    data = json.loads(r.json()["candidates"][0]["content"]["parts"][0]["text"])
    scores = {}
    for name, vals in data["people"].items():
        vals = [v for v in vals if isinstance(v, (int, float))]
        scores[name] = sum(vals) / len(vals) if vals else None
    return {"scores": scores, "artifacts": data.get("artifacts"), "notes": data.get("notes", "")}
