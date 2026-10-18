#!/usr/bin/env python3
"""Lyrics -> spoken guide performance, the input voice for the lyric music generator.

Tiers (what the public quality slider picks between):
  studio    Gemini 3.1 Flash TTS through OpenPaths, steered with a delivery prompt
  standard  Kokoro through text-generator.io (self-hosted)
  lite      Supertonic through text-generator.io (self-hosted, fastest)

Lyrics are sent stanza by stanza and rejoined with a short breath, so long songs
never hit a provider's per-request limit and a failed stanza is retried alone.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
from pathlib import Path
import re
import subprocess
import time
import urllib.error
import urllib.request

import numpy as np
import soundfile as sf

SR = 48000
DELIVERY = ("Perform these lyrics as a hard hip-hop diss track: rhythmic, punchy, aggressive and confident, "
            "rapped on a steady beat with clear diction and attitude. Lyrics:\n")
VOICES = {
    "studio": ["Fenrir", "Orus", "Charon", "Puck"],
    "standard": ["am_michael", "am_fenrir", "am_puck", "am_onyx", "af_heart", "af_bella"],
    "lite": ["M2", "M1", "M3", "F1", "F2"],
}


def _env() -> dict:
    env = dict(os.environ)
    dotenv = Path(__file__).resolve().parents[2] / ".env"
    if dotenv.exists():
        for line in dotenv.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                env.setdefault(k.strip(), v.strip())
    return env


def stanzas(text: str, max_chars: int = 700) -> list[str]:
    blocks = [re.sub(r"\s+\n", "\n", b).strip() for b in re.split(r"\n\s*\n", text) if b.strip()]
    out = []
    for block in blocks:
        lines, current = block.split("\n"), ""
        for line in lines:
            if current and len(current) + len(line) > max_chars:
                out.append(current)
                current = ""
            current = (current + "\n" + line).strip()
        if current:
            out.append(current)
    return out


def _post(url: str, payload: dict, headers: dict, timeout: int = 180) -> tuple[bytes, str]:
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={
        "Content-Type": "application/json", "User-Agent": "manifoldgen-lyric-music/1", **headers})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return response.read(), response.headers.get("Content-Type", "")


def _decode(blob: bytes) -> np.ndarray:
    raw = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", "-", "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         input=blob, check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.float32).copy()


def _gemini_direct(prompt: str, voice: str, key: str) -> tuple[np.ndarray, dict]:
    """Same model as OpenPaths routes to, for when its Google provider is unhealthy."""
    body = {"contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"responseModalities": ["AUDIO"],
                                 "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}}}}
    data, _ = _post("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent",
                    body, {"x-goog-api-key": key})
    data = json.loads(data)
    pcm = base64.b64decode(data["candidates"][0]["content"]["parts"][0]["inlineData"]["data"])
    import librosa
    audio = librosa.resample(np.frombuffer(pcm, "<i2").astype(np.float32) / 32768, orig_sr=24000, target_sr=SR)
    meta = data.get("usageMetadata", {})
    return audio, {"characters": len(prompt), "input_tokens": meta.get("promptTokenCount", 0),
                   "output_tokens": meta.get("candidatesTokenCount", 0)}


def speak(text: str, tier: str, voice: str, env: dict) -> tuple[np.ndarray, dict]:
    """One stanza -> mono 48 kHz audio and a usage record for pricing."""
    if tier in ("lite", "standard"):
        body, _ = _post(env.get("TEXT_GENERATOR_PUBLIC_URL", "https://api.text-generator.io") + "/api/v1/generate_speech",
                        {"text": text, "voice": voice, "language": "en", "speed": 1.12}, {"secret": env["TG_API_KEY"]})
        return _decode(body), {"characters": len(text)}
    base = env.get("OPENPATHS_BASE_URL", "https://openpaths.io").rstrip("/")
    auth = {"Authorization": "Bearer " + env["OPENPATHS_API_KEY"]}
    if tier == "studio" and env.get("GEMINI_API_KEY") and env.get("LYRIC_TTS_GEMINI_DIRECT") == "1":
        return _gemini_direct(DELIVERY + text, voice, env["GEMINI_API_KEY"])
    payload = {"model": "gemini-3.1-flash-tts-preview", "input": DELIVERY + text, "voice": voice,
               "language": "en-US", "temperature": 1}
    body, ctype = _post(base + "/v1/audio/speech", payload, auth)
    usage = {"characters": len(payload["input"])}
    if ctype.startswith("application/json"):
        data = json.loads(body)
        usage.update({k: data.get(k) for k in ("input_tokens", "output_tokens") if data.get(k)})
        if data.get("audio_url"):
            with urllib.request.urlopen(data["audio_url"], timeout=120) as response:
                body = response.read()
        else:
            body = base64.b64decode(data.get("audio") or data.get("audio_base64"))
    return _decode(body), usage


def perform(lyrics: str, tier: str, voice: str | None = None, gap: float = 0.35) -> tuple[np.ndarray, dict]:
    env = _env()
    voice = voice or VOICES[tier][0]
    parts, usage = [], {"tier": tier, "voice": voice, "characters": 0, "input_tokens": 0, "output_tokens": 0, "stanzas": 0}
    started = time.time()
    for stanza in stanzas(lyrics):
        for attempt in range(4):  # rides out short provider circuit breaks
            try:
                audio, used = speak(stanza, tier, voice, env)
                break
            except (urllib.error.URLError, subprocess.CalledProcessError, KeyError, ValueError):
                if attempt == 3:
                    raise
                time.sleep(3 * 2 ** attempt)
        for k, v in used.items():
            usage[k] = usage.get(k, 0) + (v or 0)
        usage["stanzas"] += 1
        # Trim the provider's own leading/trailing silence so stanzas flow.
        loud = np.flatnonzero(np.abs(audio) > 0.01)
        if len(loud):
            audio = audio[max(0, loud[0] - 960):loud[-1] + 2400]
        parts += [audio, np.zeros(int(gap * SR), np.float32)]
    out = np.concatenate(parts) if parts else np.zeros(SR, np.float32)
    usage["seconds"] = round(len(out) / SR, 2)
    usage["wall_s"] = round(time.time() - started, 1)
    return np.stack([out, out], 1), usage


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("lyrics")
    ap.add_argument("--tier", choices=list(VOICES), default="studio")
    ap.add_argument("--voice")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    audio, usage = perform(Path(args.lyrics).read_text(), args.tier, args.voice)
    sf.write(args.out, audio, SR, subtype="PCM_24")
    Path(args.out).with_suffix(".json").write_text(json.dumps(usage, indent=1))
    print(json.dumps(usage))


if __name__ == "__main__":
    main()
