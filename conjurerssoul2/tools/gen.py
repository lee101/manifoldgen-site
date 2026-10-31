# /// script
# requires-python = ">=3.10"
# dependencies = ["requests"]
# ///
"""Conjurer's Soul 2 trailer driver. Free stages: plan, prompts, review, assemble. Paid: clips --go.

  uv run tools/gen.py plan [score]      snap 28 cuts to the score with audiokp, write out/plan.json
  uv run tools/gen.py prompts           compose H3 prompts from locks + style2 -> out/prompts.json
  uv run tools/gen.py clips [--go] [--only 3,7] [--seed N]   fal minimax/h3-max, I2V when out/stills/NN.png exists
  uv run tools/gen.py review [--outdir draft1]   frames + per-character contact sheets for the vision passes
  uv run tools/gen.py assemble [--outdir draft1] trim clips to the plan, concat, mux the score
"""
import base64, json, math, os, re, subprocess, sys, time
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "out"
CHARS = ROOT.parent / "conjurerssoul" / "characters"
AUDIOKP = ROOT / "tools/audiokp/target/release/audiokp"
PRICE_PER_S = 0.40  # fal minimax/h3-max list price, 768P
RES = "768P"
UA = {"User-Agent": "manifoldgen-conjurer/1.0"}
KIDS = {"ORIN_9", "VESPER_12", "TOMAS_PROLOGUE"}


def shots():
    return json.loads((ROOT / "trailer/shots.json").read_text())


def lock_block(md: str, heading: str = "## LOCK") -> str:
    m = re.search(re.escape(heading) + r"\s*```\n(.*?)\n```", md, re.S)
    if not m:
        raise SystemExit(f"no {heading} block")
    return m.group(1).strip()


def locks() -> dict:
    out = {}
    for f in CHARS.glob("*.md"):
        if f.stem.startswith("_"):
            continue
        out[f.stem.split("-")[-1] if f.stem.startswith(("brother", "lady")) else f.stem.split("-")[0]] = lock_block(f.read_text())  # aldren, veyra, orin, ...
    # H3 reads "dull red undertone" literally (burgundy hair in draft 1); keep the bible, fix the render
    out["vesper"] = out["vesper"].replace("black hair with a dull red undertone only visible in firelight", "jet-black hair, a faint warm highlight only where firelight hits it")
    kids = (ROOT / "bible/kids.md").read_text()
    for k in KIDS:
        out[k] = lock_block(kids, f"## {k}")
    return out


def style() -> str:
    return lock_block((ROOT / "bible/style2.md").read_text(), "# STYLE2 (gritty lock; replaces STYLE in ../conjurerssoul/production.md for this trailer)")


def plan_cmd(score):
    score = score or str(OUT / "score.opus")
    n = len(shots())
    res = subprocess.run([str(AUDIOKP), "plan", score, str(n), "6", "14"], capture_output=True, text=True)
    if res.returncode:
        raise SystemExit(res.stderr)
    plan = [dict(zip(("id", "start", "end", "dur"), (int(a), float(b), float(c), float(d)))) for a, b, c, d in (l.split() for l in res.stdout.splitlines())]
    (OUT / "plan.json").write_text(json.dumps(plan, indent=1))
    print(subprocess.run([str(AUDIOKP), "kp", score], capture_output=True, text=True).stdout)
    print(f"{n} cuts planned, total {plan[-1]['end']:.1f}s, H3 estimate ${sum(math.ceil(p['dur']) for p in plan) * PRICE_PER_S:.0f}")


def prompt_for(s, L, dur):
    cast = "\n".join(f"{k.split('_')[0].upper()}: {L[k]}" for k in s["chars"])
    say = " ".join(f'{w.split("_")[0].upper()} ({d}): "{t}"' for w, d, t in s["lines"])
    parts = [style(), f"SETTING: {s['setting']}.", f"ACTION: {s['action']}.", cast]
    if say:
        parts.append(f"Spoken on camera with precise lip sync and native room tone, no narrator: {say}")
    else:
        parts.append("No dialogue; natural ambience only.")
    parts.append(f"{dur} seconds, 16:9, handheld, hold a beat after the last line.")
    return "\n".join(parts)


def prompts_cmd():
    plan = json.loads((OUT / "plan.json").read_text()) if (OUT / "plan.json").exists() else None
    L, res = locks(), []
    for s in shots():
        dur = math.ceil(plan[s["id"] - 1]["dur"]) if plan else round(s["want"] * 270 / 300)
        dur = max(5, min(15, dur))
        res.append({"id": s["id"], "duration": dur, "prompt": prompt_for(s, L, dur)})
    (OUT / "prompts.json").write_text(json.dumps(res, indent=1))
    print(f"{len(res)} prompts, longest {max(len(r['prompt']) for r in res)} chars")


def fal(method, url, **kw):
    r = requests.request(method, url, headers={"Authorization": f"Key {os.environ['FAL_KEY']}", **UA}, timeout=120, **kw)
    r.raise_for_status()
    return r.json()


def clips_cmd(args):
    go = "--go" in args
    only = {int(x) for x in args[args.index("--only") + 1].split(",")} if "--only" in args else None
    seed = int(args[args.index("--seed") + 1]) if "--seed" in args else None
    ps = [p for p in json.loads((OUT / "prompts.json").read_text()) if not only or p["id"] in only]
    cost = sum(p["duration"] for p in ps) * PRICE_PER_S
    print(f"{len(ps)} clips, {sum(p['duration'] for p in ps)} s, estimated ${cost:.2f} at {RES}")
    if not go:
        print("dry run; add --go to spend")
        return
    (OUT / "clips").mkdir(exist_ok=True)
    jobs = {}
    for p in ps:
        still = OUT / "stills" / f"{p['id']:02d}.png"
        body = {"prompt": p["prompt"], "duration": p["duration"], "resolution": RES, "enable_safety_checker": False, "prompt_expansion_mode": "disabled"}
        if seed:
            body["seed"] = seed + p["id"]
        if still.exists():
            model = "minimax/h3-max/image-to-video"
            body["image_url"] = "data:image/png;base64," + base64.b64encode(still.read_bytes()).decode()
        else:
            model = "minimax/h3-max/text-to-video"
            body["aspect_ratio"] = "16:9"
        q = fal("POST", f"https://queue.fal.run/{model}", json=body)
        jobs[p["id"]] = q
        print(f"submitted {p['id']:02d} {model.split('/')[-1]}")
    while jobs:
        time.sleep(15)
        for i, q in list(jobs.items()):
            st = fal("GET", q["status_url"])
            if st["status"] == "COMPLETED":
                url = fal("GET", q["response_url"])["video"]["url"]
                (OUT / "clips" / f"{i:02d}.mp4").write_bytes(requests.get(url, headers=UA, timeout=300).content)
                print(f"done {i:02d}")
                del jobs[i]
            elif st["status"] not in ("IN_QUEUE", "IN_PROGRESS"):
                print(f"FAILED {i:02d}: {st}")
                del jobs[i]


def review_cmd(args):
    """Free pass 1: 3 frames per clip, then a contact sheet per character so identity drift is visible at a glance."""
    fr = OUT / "review"
    fr.mkdir(exist_ok=True)
    shot_map = {s["id"]: s for s in shots()}
    for mp4 in sorted((OUT / str(args[args.index("--outdir") + 1])).glob("*.mp4")) if "--outdir" in args else sorted((OUT / "clips").glob("*.mp4")):
        i = int(mp4.stem)
        for k, pos in enumerate(("0.1", "0.5", "0.9")):
            dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp4]))
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(dur * float(pos)), "-i", mp4, "-frames:v", "1", "-vf", "scale=480:270:force_original_aspect_ratio=decrease,pad=480:270:(ow-iw)/2:(oh-ih)/2:color=black", fr / f"{i:02d}_{k}.jpg"], check=True)
    for c in {c for s in shots() for c in s["chars"]}:
        ids = [i for i, s in shot_map.items() if c in s["chars"] and (fr / f"{i:02d}_1.jpg").exists()]
        if ids:
            subprocess.run(["ffmpeg", "-v", "error", "-y", *sum([["-i", fr / f"{i:02d}_1.jpg"] for i in ids], []), "-filter_complex", f"hstack=inputs={len(ids)}" if len(ids) > 1 else "null", "-frames:v", "1", fr / f"sheet_{c}.jpg"], check=True)
            print(f"sheet_{c}.jpg shots {ids}")


def assemble_cmd(args):
    clips = OUT / str(args[args.index("--outdir") + 1]) if "--outdir" in args else OUT / "clips"
    plan = json.loads((OUT / "plan.json").read_text())
    tmp = OUT / "trim"
    tmp.mkdir(exist_ok=True)
    lst = []
    for p in plan:
        src, dst = clips / f"{p['id']:02d}.mp4", tmp / f"{p['id']:02d}.mp4"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-t", f"{p['dur']:.3f}", "-vf", "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=24", "-c:v", "libx264", "-crf", "16", "-c:a", "aac", "-ar", "48000", "-ac", "2", dst], check=True)
        lst.append(f"file '{dst}'")
    (tmp / "list.txt").write_text("\n".join(lst))
    # dialogue (clip audio) rides over the score, which ducks 8 dB under speech via sidechain
    score = next(OUT.glob("score.*"))
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", tmp / "list.txt", "-i", score, "-filter_complex",
                    "[1:a]volume=0.9[m];[0:a][m]sidechaincompress=threshold=0.04:ratio=6:attack=20:release=400[d];[m][0:a]amix=inputs=2:duration=first:normalize=0[a]",
                    "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", OUT / "trailer.mp4"], check=True)
    print(OUT / "trailer.mp4")


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    cmd, rest = (sys.argv[1] if len(sys.argv) > 1 else ""), sys.argv[2:]
    {"plan": lambda: plan_cmd(rest[0] if rest else None), "prompts": prompts_cmd, "clips": lambda: clips_cmd(rest), "review": lambda: review_cmd(rest), "assemble": lambda: assemble_cmd(rest)}.get(cmd, lambda: print(__doc__))()
