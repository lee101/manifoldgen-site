"""Make clean TTS sound like it was recorded mid-fight: exertion text for the TTS, then a dull, compressed, roomy, breathy chain."""
import subprocess
from pathlib import Path


def exertion_text(text: str, level: float = 0.6) -> str:
    """MiniMax speech-2.8 interjection tags: breath before, pant after, short clipped sentences."""
    t = text.strip().replace(". ", "... ")
    if level >= 0.3:
        t = "(breath) " + t
    if level >= 0.6:
        t += " (pant)"
    if level >= 0.85:
        t = t.replace("...", " (gasps)...", 1)
    return t


def fight_voice(src, out, exertion: float = 0.6, room: float = 0.25):
    """Band-limit (a mic that is moving), compress, short slap room, breath noise bed that swells with the voice, soft clip."""
    breath_db = -34 + 10 * exertion
    chain = (f"[0:a]highpass=f=130,lowpass=f=6200,equalizer=f=3800:t=q:w=1.2:g=-4,equalizer=f=220:t=q:w=1:g=3,"
             f"acompressor=threshold=-24dB:ratio=5:attack=4:release=80:makeup=6,aecho=0.8:0.55:28|61:{room}|{room / 2},asoftclip=type=tanh,volume=0.95,asplit[v][s];"
             f"anoisesrc=color=pink:amplitude=0.6,highpass=f=900,lowpass=f=4500,tremolo=f=2.3:d=0.6,volume={breath_db}dB[n];"
             f"[n][s]sidechaingate=threshold=0.02:range=0.05:attack=5:release=300[nb];"
             f"[v][nb]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[a]")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-filter_complex", chain, "-map", "[a]", "-ar", "44100", str(out)], check=True)
    return Path(out)
