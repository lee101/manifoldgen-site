"""fightswap CLI. A project.json drives the whole flow:

{
  "video": "src24.mp4", "work": "work", "out": "out", "style": "ghibli",
  "roles": {"jackie": {"look": "man in white top", "name": "Elon", "photo": "Elon_Musk.jpg", "costume": "...", "strip": ""}},
  "edit": [12, 14, 16], "reroll": {"14": 11},
  "params": {"steps": 20, "turbo": false, "megapixels": 0.66, "easycache": [0.12, 0.15, 0.9]},
  "voices": {"jackie": "elon_voice.json"}, "lines": "audio/lines.json", "gpu": null
}
"""
import argparse
import json
from pathlib import Path

from . import assemble, cast, cloud, detect, pipeline, pod, shots as shotlib, voice

SLOW = {"turbo": False, "steps": 20, "sampler": "res_multistep", "scheduler": "simple", "megapixels": 0.66, "easycache": [0.12, 0.15, 0.9], "seed": 7}


def load(path):
    p = Path(path)
    cfg = json.loads(p.read_text())
    base = p.parent
    cfg["_base"] = base
    cfg["video"] = base / cfg["video"]
    cfg["work"] = base / cfg.get("work", "work")
    cfg["out"] = base / cfg.get("out", "out")
    for d in (cfg["work"], cfg["out"]):
        d.mkdir(parents=True, exist_ok=True)
    cfg["roles"] = {k: cast.Role(k, v["look"], v["name"], str(base / v["photo"]), v.get("costume", ""), v.get("strip", "")) for k, v in cfg["roles"].items()}
    return cfg


def cmd_shots(a):
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    info = shotlib.probe(a.video)
    found = shotlib.build_shots(a.video, a.start, a.end or info["duration"], a.threshold)
    (out / "shots.json").write_text(json.dumps({"video": str(a.video), "info": info, "shots": found}, indent=1))
    for i in range(0, len(found), 36):
        shotlib.contact_sheet(a.video, found[i:i + 36], out / f"sheet{i // 36}.jpg")
    print(f"{len(found)} shots, {sum(not s['has_subtitle'] for s in found)} subtitle-free")


def cmd_detect(a):
    cfg = load(a.project)
    cloud.load_env()
    path = cfg["work"] / "shots.json"
    data = json.loads(path.read_text())
    look = {k: r.look for k, r in cfg["roles"].items()}
    wanted = set(cfg["edit"])
    for s in data["shots"]:
        if s["index"] in wanted:
            s["cast"] = detect.detect_shot(data["video"], s["start"], s["end"], look)
            print(s["index"], s["cast"]["framing"], s["cast"]["order"], "stable" if s["cast"]["stable"] else "UNSTABLE")
    path.write_text(json.dumps(data, indent=1))


def cmd_cards(a):
    cfg = load(a.project)
    cloud.load_env()
    for r in cfg["roles"].values():
        cast.make_card(r, cfg["work"] / "cards" / f"{r.key}_{cfg['style']}.png", cfg["style"])
    print("cards ok")


def cmd_run(a):
    """Cards -> jobs for every edit shot -> one pod -> results -> (optionally) pod down."""
    cfg = load(a.project)
    cloud.load_env()
    cmd_cards(a)
    data = json.loads((cfg["work"] / "shots.json").read_text())
    S = {s["index"]: s for s in data["shots"]}
    cards = {k: cfg["work"] / "cards" / f"{k}_{cfg['style']}.png" for k in cfg["roles"]}
    base = {**SLOW, **cfg.get("params", {})}
    jobs, outs = [], {}
    for i in cfg["edit"]:
        for seed in [cfg.get("reroll", {}).get(str(i))] if str(i) in cfg.get("reroll", {}) else [base["seed"]]:
            j = pipeline.plan_job(cfg["video"], S[i], cfg["roles"], cards, cfg["style"], cfg["out"], f"r{seed}", {**base, "seed": seed}, face=S[i]["cast"]["framing"] != "wide")
            outs[i] = j["name"]
            jobs.append({k: v for k, v in j.items() if not k.startswith("_")})
    st = pod.up()
    pod.sync_src(st)
    pod.queue(st, jobs)
    names = [j["name"] for j in jobs]
    res = pod.wait_jobs(st, names)
    for n in names:
        if res[n] == "ok":
            pod.fetch(st, n, cfg["out"] / f"{n}.mp4")
    (cfg["out"] / "edit.json").write_text(json.dumps({str(i): n for i, n in outs.items()}))
    if a.down:
        pod.down()
    print({n: v[:80] for n, v in res.items()})


def cmd_voice(a):
    cloud.load_env()
    ref = Path(a.out) / f"{a.name}_ref.wav"
    spans = voice.pick_solo_spans(a.audio, a.speaker)
    voice.build_reference(a.audio, spans, ref)
    vid = voice.clone(ref)
    Path(a.out, f"{a.name}_voice.json").write_text(json.dumps({"voice_id": vid, "spans": spans}))
    print(vid)


def cmd_speak(a):
    """Line -> cloned voice -> fight-sounding (exertion tags + band-limit/room/breath chain)."""
    from . import fx
    cloud.load_env()
    vid = json.loads(Path(a.voice).read_text())["voice_id"]
    raw = Path(a.out).with_suffix(".raw.mp3")
    voice.speak(vid, fx.exertion_text(a.text, a.exertion), raw, emotion=a.emotion, speed=1.0 + 0.15 * a.exertion)
    print(fx.fight_voice(raw, a.out, a.exertion))


def cmd_assemble(a):
    """Cut the edit together. relay projects use work/edit_results.json (identity-audited, shots under `min_identity` are left out);
    pass-per-shot projects use out/edit.json. Soundtrack = the original film audio per shot unless project.json has dialogue `lines`."""
    cfg = load(a.project)
    data = json.loads((cfg["work"] / "shots.json").read_text())
    S = {s["id"] if "id" in s else str(s["index"]): s for s in data["shots"]}
    res_path = cfg["work"] / "edit_results.json"
    if res_path.exists():
        res = json.loads(res_path.read_text())
        floor = cfg.get("min_identity", 5.0)
        order = [sid for sid in cfg["edit"] if sid in res and res[sid]["file"] != "None" and res[sid]["worst"] >= floor]
        skipped = [sid for sid in cfg["edit"] if sid not in order]
        files = {sid: Path(res[sid]["file"]) for sid in order}
        print(f"{len(order)} shots kept, {len(skipped)} below identity {floor}: {skipped}")
    else:
        edit = json.loads((cfg["out"] / "edit.json").read_text())
        order = [str(i) for i in cfg["edit"]]
        files = {sid: cfg["out"] / f"{edit[sid]}.mp4" for sid in order}
    clips = [files[sid] for sid in order]
    video = assemble.concat_video(clips, cfg["out"] / "silent.mp4", size=tuple(cfg["size"]) if cfg.get("size") else None)
    starts, t = {}, 0.0
    for sid, c in zip(order, clips):
        starts[sid] = t
        t += assemble.dur(c)
    bed = assemble.source_audio(cfg["video"], [(S[sid]["start"], assemble.dur(c)) for sid, c in zip(order, clips)], cfg["out"] / "bed.wav")
    lines = json.loads((cfg["_base"] / cfg["lines"]).read_text()) if cfg.get("lines") else []
    if lines:
        mixed = assemble.mix(bed, [(cfg["_base"] / Path(cfg["lines"]).parent / l["file"], starts[str(l["shot"])] + l["at"]) for l in lines], cfg["out"] / "mix.wav")
    else:  # original soundtrack untouched
        mixed = bed
    print(assemble.mux(video, mixed, cfg["out"] / "final.mp4"))


def main():
    p = argparse.ArgumentParser(prog="fightswap")
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("shots"); s.add_argument("video"); s.add_argument("--start", type=float, default=0); s.add_argument("--end", type=float)
    s.add_argument("--out", default="work"); s.add_argument("--threshold", type=float, default=0.18); s.set_defaults(fn=cmd_shots)
    for name, fn in (("detect", cmd_detect), ("cards", cmd_cards), ("assemble", cmd_assemble)):
        x = sub.add_parser(name); x.add_argument("project"); x.set_defaults(fn=fn)
    r = sub.add_parser("run"); r.add_argument("project"); r.add_argument("--down", action="store_true", help="delete the pod when finished"); r.set_defaults(fn=cmd_run)
    v = sub.add_parser("voice"); v.add_argument("audio"); v.add_argument("--speaker", required=True); v.add_argument("--name", required=True)
    v.add_argument("--out", default="."); v.set_defaults(fn=cmd_voice)
    k = sub.add_parser("speak"); k.add_argument("voice"); k.add_argument("text"); k.add_argument("out"); k.add_argument("--exertion", type=float, default=0.6)
    k.add_argument("--emotion", default="neutral"); k.set_defaults(fn=cmd_speak)
    d = sub.add_parser("pod"); d.add_argument("action", choices=["up", "down", "sync", "log"]); d.set_defaults(fn=lambda a: {
        "up": lambda: print(pod.up()), "down": pod.down, "sync": lambda: pod.sync_src(pod.state()), "log": lambda: print(pod.log_tail(pod.state(), n=40))}[a.action]())
    a = p.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
