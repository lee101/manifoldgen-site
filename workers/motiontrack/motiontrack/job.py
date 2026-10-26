from __future__ import annotations

import json
import subprocess
import sys
import time
import traceback
from pathlib import Path

import cv2
import numpy as np

from . import render as R
from .signals import analyze, fight_stats, intensity_curve
from .track import TrackSet, read_meta

PALETTES = {"gold-blue", "fire", "neon", "ice"}


class BadInput(Exception):
    pass


def _num(p: dict, k: str, d: float, lo: float, hi: float) -> float:
    v = p.get(k, d)
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        return d
    return float(min(hi, max(lo, v)))


def _poster(video: str, out: str, at: float | None = None) -> None:
    cap = cv2.VideoCapture(video)
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 24
    cap.set(cv2.CAP_PROP_POS_FRAMES, int(min(n - 1, max(0, (at * fps) if at is not None else n // 2))))
    ok, fr = cap.read()
    cap.release()
    if ok:
        cv2.imwrite(out, fr, [cv2.IMWRITE_JPEG_QUALITY, 90])


def _probe(video: str) -> tuple[float, int, int, float]:
    fps, w, h, n = read_meta(video)
    if w <= 0 or h <= 0 or n <= 0:
        raise BadInput("video is not readable")
    return fps, w, h, n / fps


def _best_poster_time(events: list[dict], fallback: float) -> float:
    if not events:
        return fallback
    return max(events, key=lambda e: e["power"])["t"] + 0.08


def run(args: dict) -> dict:
    t0 = time.time()
    tool = args["tool"]
    video, out = args["video"], Path(args["out"])
    out.mkdir(parents=True, exist_ok=True)
    p = args.get("params") or {}
    fps, w, h, dur = _probe(video)
    max_seconds = _num(p, "max_seconds", min(dur, 30), 1, 120)
    seconds = min(dur, max_seconds)
    names = [str(n)[:16] for n in (p.get("names") or [])][:4]
    palette = p.get("palette") if p.get("palette") in PALETTES else None
    device = args.get("device", "cpu")
    tracks_path = str(out / "tracks.json")
    result: dict = {"ok": True, "tool": tool}

    if tool in ("motion-fx", "beat-drop"):
        preset = str(p.get("preset") or ("beat-drop" if tool == "beat-drop" else "anime-fight"))
        if preset not in R.PRESETS:
            raise BadInput(f"unknown preset {preset}")
        audio = args.get("audio")
        if preset == "beat-drop" and not audio:
            raise BadInput("beat-drop needs an audio file")
        extra = [x for x in (p.get("extra") or []) if x in ("trails", "aura", "lightning", "speedlines", "impact")]
        m = R.render(video, str(out / "result.mp4"), preset, tracks=tracks_path, intensity=_num(p, "intensity", 1.0, 0.3, 1.6),
                     palette=palette, slowmo=p.get("slowmo") if isinstance(p.get("slowmo"), bool) else None,
                     with_sfx=p.get("sfx") if isinstance(p.get("sfx"), bool) else None,
                     text=p.get("text") if isinstance(p.get("text"), bool) else None,
                     target=int(p["target"]) if isinstance(p.get("target"), (int, float)) and not isinstance(p.get("target"), bool) else None,
                     names=names, max_seconds=seconds, max_side=int(_num(p, "max_side", 1280, 480, 1920)), music=args.get("music"),
                     reactive_audio=audio, extra_fx=extra, device=device, seed=int(_num(p, "seed", 7, 0, 1 << 30)), audio_start=_num(p, "audio_start", 0.0, 0, 3600),
                     aspect=p.get("aspect") if p.get("aspect") in ("9:16", "4:5", "1:1", "16:9") else None, log=lambda *_: None)
        _poster(str(out / "result.mp4"), str(out / "poster.jpg"), _best_poster_time(m["events"], m["seconds"] / 2))
        result.update({"video": "result.mp4", "poster": "poster.jpg", "seconds": m["seconds"], "width": m["width"], "height": m["height"],
                       "preset": preset, "tracks_count": m["tracks"], "events_count": len(m["events"]), "bpm": m["bpm"],
                       "audio_bpm": m.get("audio_bpm"), "slowmo_hits": len(m["slowmo_hits"]), "events": m["events"][:64]})
        if Path(tracks_path).exists():
            result["tracks"] = "tracks.json"
            if m["tracks"]:
                ts_stats = TrackSet.load(Path(tracks_path))
                result["stats"] = fight_stats(ts_stats, analyze(ts_stats))

    elif tool == "motion-track":
        ts = R.get_tracks(video, tracks_path, device=device, max_seconds=seconds)
        sig = analyze(ts)
        sj = sig.to_json()
        sj["intensity"] = intensity_curve(sig, 4.0)
        (out / "signals.json").write_text(json.dumps(sj))
        pm = R.render(video, str(out / "preview.mp4"), "tracking-overlay", tracks=tracks_path, max_seconds=seconds, max_side=960,
                      slowmo=False, with_sfx=False, device=device, log=lambda *_: None)
        gm = R.render(video, str(out / "guide.mp4"), "track-guide", tracks=tracks_path, max_seconds=seconds, max_side=640,
                      slowmo=False, with_sfx=False, device=device, log=lambda *_: None)
        _poster(str(out / "preview.mp4"), str(out / "poster.jpg"), _best_poster_time(pm["events"], pm["seconds"] / 2))
        result.update({"tracks": "tracks.json", "signals": "signals.json", "preview": "preview.mp4", "guide": "guide.mp4", "poster": "poster.jpg",
                       "seconds": pm["seconds"], "width": pm["width"], "height": pm["height"], "tracks_count": len(ts.tracks),
                       "events_count": len(sig.events), "bpm": round(sig.bpm, 1), "events": [e.to_json() for e in sig.events][:64],
                       "stats": fight_stats(ts, sig)})

    elif tool == "motion-score":
        from . import score as S

        ts = R.get_tracks(video, tracks_path, device=device, max_seconds=seconds)
        sig = analyze(ts)
        info = S.score(video, str(out / "result.mp4"), sig, seconds, music=args.get("music"), keep_audio=bool(p.get("keep_audio")))
        (out / "cues.json").write_text(json.dumps({**info, "events": [e.to_json() for e in sig.events], "beats": [round(b, 3) for b in sig.beats]}))
        _poster(str(out / "result.mp4"), str(out / "poster.jpg"), _best_poster_time([e.to_json() for e in sig.events], seconds / 2))
        result.update({"video": "result.mp4", "audio": "result.wav", "cues": "cues.json", "poster": "poster.jpg", "seconds": round(seconds, 2),
                       "width": w, "height": h, "tracks_count": len(ts.tracks), "events_count": len(sig.events), "bpm": info["bpm"],
                       "music_prompt": info["prompt"], "music": info["music"]})
    else:
        raise BadInput(f"unknown tool {tool}")
    result["elapsed"] = round(time.time() - t0, 1)
    return result


def main(argv: list[str]) -> int:
    args = json.loads(Path(argv[0]).read_text())
    out = Path(args["out"])
    out.mkdir(parents=True, exist_ok=True)
    try:
        manifest = run(args)
        code = 0
    except BadInput as e:
        manifest, code = {"ok": False, "error": str(e)}, 2
    except Exception as e:
        (out / "error.log").write_text(traceback.format_exc())
        manifest, code = {"ok": False, "error": f"{type(e).__name__}: {e}"[:300]}, 1
    (out / "manifest.json").write_text(json.dumps(manifest))
    return code


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
