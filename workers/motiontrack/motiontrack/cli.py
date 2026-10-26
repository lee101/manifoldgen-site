from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def _progress(stage: str, frac: float) -> None:
    print(f"\r{stage} {frac * 100:3.0f}%", end="", file=sys.stderr, flush=True)


def main(argv: list[str] | None = None) -> int:
    from . import render as R

    ap = argparse.ArgumentParser(prog="motiontrack")
    sub = ap.add_subparsers(dest="cmd", required=True)
    t = sub.add_parser("track", help="video -> tracks.json (+ events)")
    t.add_argument("video")
    t.add_argument("out")
    t.add_argument("--mode", default="balanced", choices=["lightweight", "balanced", "performance"])
    t.add_argument("--device", default="cpu")
    t.add_argument("--max-seconds", type=float, default=30)
    f = sub.add_parser("fx", help="apply a preset")
    f.add_argument("video")
    f.add_argument("out")
    f.add_argument("--preset", default="anime-fight", choices=[k for k, v in R.PRESETS.items() if not v.get("hidden")])
    f.add_argument("--tracks")
    f.add_argument("--intensity", type=float, default=1.0)
    f.add_argument("--palette")
    f.add_argument("--slowmo", choices=["on", "off"])
    f.add_argument("--sfx", choices=["on", "off"])
    f.add_argument("--text", choices=["on", "off"])
    f.add_argument("--target", type=int)
    f.add_argument("--names", help="comma separated")
    f.add_argument("--music")
    f.add_argument("--reactive-audio")
    f.add_argument("--extra", help="comma separated extra effects")
    f.add_argument("--max-seconds", type=float, default=30)
    f.add_argument("--max-side", type=int, default=1280)
    f.add_argument("--device", default="cpu")
    f.add_argument("--manifest")
    j = sub.add_parser("job", help="run a job args.json (server contract)")
    j.add_argument("args")
    sub.add_parser("presets")
    a = ap.parse_args(argv)
    if a.cmd == "job":
        from . import job

        return job.main([a.args])
    if a.cmd == "presets":
        print(json.dumps({k: {"title": v["title"], "blurb": v["blurb"], "fx": v["fx"]} for k, v in R.PRESETS.items() if not v.get("hidden")}, indent=1))
        return 0
    if a.cmd == "track":
        from .signals import analyze

        ts = R.get_tracks(a.video, a.out, device=a.device, mode=a.mode, max_seconds=a.max_seconds, progress=lambda i, n: _progress("track", i / max(n, 1)))
        sig = analyze(ts)
        Path(a.out).with_suffix(".signals.json").write_text(json.dumps(sig.to_json()))
        print(f"\ntracks={len(ts.tracks)} events={len(sig.events)} bpm={sig.bpm:.0f}")
        return 0
    onoff = lambda v: None if v is None else v == "on"
    m = R.render(a.video, a.out, a.preset, tracks=a.tracks, intensity=a.intensity, palette=a.palette, slowmo=onoff(a.slowmo),
                 with_sfx=onoff(a.sfx), text=onoff(a.text), target=a.target, names=a.names.split(",") if a.names else None,
                 max_seconds=a.max_seconds, max_side=a.max_side, music=a.music, reactive_audio=a.reactive_audio,
                 extra_fx=a.extra.split(",") if a.extra else None, device=a.device, progress=_progress)
    print()
    if a.manifest:
        Path(a.manifest).write_text(json.dumps(m))
    print(f"{m['output']} {m['seconds']}s {m['width']}x{m['height']} events={len(m['events'])} elapsed={m['elapsed']}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
