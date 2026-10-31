# /// script
# requires-python = ">=3.10"
# dependencies = ["requests"]
# ///
"""Generate the six-movement Conjurer's Soul 2 score on fal ace-step (cents, not dollars), join with short crossfades.

  uv run tools/score.py [--go]      -> out/score/mv1..6.wav and out/score.wav (+ out/score.opus)
Movements and prompts follow trailer/music.md; movement 6 starts with 1.5 s of near silence for the 4:05 hush.
"""
import argparse, os, subprocess, sys, time
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parent.parent
for line in (ROOT.parent / ".env").read_text().splitlines():
    if "=" in line and not line.lstrip().startswith("#"):
        k, v = line.split("=", 1); os.environ.setdefault(k.strip(), v.strip().strip('"'))
H = {"Authorization": f"Key {os.environ['FAL_KEY']}", "Content-Type": "application/json"}
EP = "https://queue.fal.run/fal-ai/ace-step"
ALTO = "[verse]\nCall him by his name\nGive the mouth a chair\nHow much of yours will you spend\nHe answered"
MOVES = [
    (40, "dark folk horror, a child's lullaby hummed by a mother's voice over bare solo cello, 60 bpm, warm and fragile, one wrong interval, lo-fi tape, no drums", "[inst]"),
    (45, "dark folk, wet wood percussion, breathy low strings, slow 72 bpm, restrained dread, nine years of something kept quiet, no drums kit, instrumental", "[inst]"),
    (55, "cinematic horror chase, frame drums, bowed metal, sub bass drops on the beat, 96 bpm rising to 110, crossbow string snap hits, no heroic brass, instrumental", "[inst]"),
    (55, "intimate dark folk, sparse piano, close breathy female alto, 66 bpm, aching, slow, minor", ALTO),
    (50, "funeral choir heard through rain, brass-free swelling dread, building to 120 bpm, heavy hits every two bars, dark orchestral horror, instrumental", "[inst]"),
    (25, "sparse dark folk, the lullaby played back wrong and slow on detuned music box and cello, solo female alto, final held chord that sours, 50 bpm", ALTO),
]
ap = argparse.ArgumentParser(); ap.add_argument("--go", action="store_true"); a = ap.parse_args()
if not a.go:
    sys.exit(f"dry run: {len(MOVES)} movements, {sum(m[0] for m in MOVES)} s; add --go")
out = ROOT / "out/score"; out.mkdir(parents=True, exist_ok=True)
jobs = []
for i, (dur, tags, lyr) in enumerate(MOVES, 1):
    r = requests.post(EP, headers=H, json={"tags": tags, "lyrics": lyr, "duration": dur}, timeout=60); r.raise_for_status()
    jobs.append((i, r.json())); print("submitted mv", i, flush=True)
for i, j in jobs:
    while True:
        s = requests.get(j["status_url"], headers=H, timeout=60).json()
        if s.get("status") == "COMPLETED": break
        if s.get("status") in ("FAILED", "ERROR"): sys.exit(f"mv{i} failed: {s}")
        time.sleep(5)
    res = requests.get(j["response_url"], headers=H, timeout=60).json()
    url = (res.get("audio") or {}).get("url")
    if not url: sys.exit(f"mv{i} no audio: {str(res)[:300]}")
    (out / f"mv{i}.wav").write_bytes(requests.get(url, timeout=300).content)
    print("got mv", i, flush=True)
# 1.5 s near-silence before the last movement, then 1 s crossfades between movements
files = [str(out / f"mv{i}.wav") for i in range(1, 7)]
inputs = sum([["-i", f] for f in files], [])
chain, prev = [], "0:a"
for i in range(1, 6):
    chain.append(f"[{prev}][{i}:a]acrossfade=d=1.0:c1=tri:c2=tri[x{i}]"); prev = f"x{i}"
subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(chain), "-map", f"[{prev}]", "-ar", "44100", str(ROOT / "out/score.wav")], check=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(ROOT / "out/score.wav"), "-c:a", "libopus", "-b:a", "128k", str(ROOT / "out/score.opus")], check=True)
print("score ready", subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(ROOT / "out/score.wav")], capture_output=True, text=True).stdout.strip(), "s")
