"""Plan swap jobs for chosen shots: cut clip, order the cast board by who stands where, build the prompt, stage on R2."""
from __future__ import annotations

import json
from pathlib import Path

from . import cast, cloud, shots

POS = {2: ["left", "right"], 3: ["left", "middle", "right"], 1: ["only"]}
FAST = {"turbo": "ref2v8", "steps": 6, "megapixels": 0.66, "sampler": "er_sde", "scheduler": "normal", "seed": 7}


GHIBLI_STYLE = (" Render the ENTIRE video as a hand-painted Studio Ghibli anime film (Miyazaki): painterly watercolor background plates with soft "
                "gouache night sky and glowing lamps, flat cel-shaded characters with clean ink outlines and anime faces and eyes, anime colour palette; "
                "absolutely no photorealism, no live action, no film grain. Keep the characters' white and black outfits and the red boxing gloves.")


def plan_job(video, shot, roles, cards, style, work: Path, tag, params=None, cast_order=None, face=False):
    """roles: {key: Role}; cards: {key: Path} for this style. Returns a pod job dict (inputs staged on R2)."""
    order = cast_order or shot["cast"]["order"]
    name = f"{tag}_{style}_s{shot.get('id') or format(shot['index'], '02d')}"
    clip = shots.cut_clip(video, shot["start"], shot["duration"], work / f"{name}_src.mp4", keep_audio=False)
    board = cast.board_for([cards[k] for k in order], work / f"{name}_board.jpg", face=face)
    pw = POS[len(order)]
    if len(order) == 1:  # one person on screen: the LoRA's trained "replace the selected person" form
        prompt = single_prompt(roles[order[0]].look, roles[order[0]].new_name, "everything else", "real")
    else:
        prompt = cast.swap_prompt([(roles[k].look, f"{roles[k].new_name} ({pw[i]} character in Picture 1)") for i, k in enumerate(order)], pw)
    if style == "ghibli":
        prompt += GHIBLI_STYLE
    return {"name": name, "video_url": cloud.stage(clip), "image_urls": [cloud.stage(board)], "prompt": prompt,
            "params": {**FAST, **(params or {})}, "_clip": str(clip), "_order": order}


def single_prompt(look, name, others, style):
    p = (f"Replace the {look} in <Video 1> with the character in <Picture 1> ({name}). Keep the reference character's face and hair and the source video's "
         f"clothing. Follow the source performance's pose, gaze, expression, fight choreography and movement exactly. Preserve the scene, camera and "
         f"{others}.")
    return p + (GHIBLI_STYLE if style == "ghibli" else "")


def plan_chain(video, shot, roles, cards, style, work: Path, tag, params=None, cast_order=None, face=True):
    """One pass per person (the LoRA is trained to replace one selected person), each reading the previous pass's output on the pod."""
    order = cast_order or shot["cast"]["order"]
    name0 = f"{tag}_{style}_s{shot['index']:02d}"
    clip = shots.cut_clip(video, shot["start"], shot["duration"], work / f"{name0}_src.mp4", keep_audio=False)
    jobs, prev = [], None
    for i, k in enumerate(order):
        board = cast.board_for([cards[k]], work / f"{name0}_p{i}_board.jpg", face=face)
        others = "the other person" if len(order) > 1 else "everything else"
        job = {"name": f"{name0}_p{i}", "image_urls": [cloud.stage(board)],
               "prompt": single_prompt(roles[k].look, roles[k].new_name, others, style), "params": {**FAST, **(params or {})}}
        if prev:
            job["video_from"] = prev
            job["video_url"] = ""
        else:
            job["video_url"] = cloud.stage(clip)
        jobs.append(job)
        prev = job["name"]
    return jobs


def plan_edit(video, raw_shots, roles_look, window, log=print, workers=6):
    """Detect cast per shot in `window` (seconds), split shots whose ordered cast changes, return child shots with cast info."""
    from concurrent.futures import ThreadPoolExecutor

    from . import detect
    todo = [s for s in raw_shots if window[0] <= s["start"] and s["end"] <= window[1] + 0.5]

    def one(s):
        try:
            c = detect.detect_shot(video, s["start"], s["end"], roles_look)
        except Exception as exc:  # a failed frame read or model error should not drop the shot silently
            return [{**s, "cast": {"error": str(exc)[:80], "order": [], "stable": True, "framing": "medium"}}]
        if c["stable"] or s["duration"] < 1.2:
            return [{**s, "cast": c}]
        out = []
        for a, b, order in detect.detect_segments(video, s["start"], s["end"], roles_look):
            if b - a >= 0.5:
                out.append({**s, "start": round(a, 3), "end": round(b, 3), "duration": round(b - a, 3), "parent": s["index"],
                            "cast": {**c, "order": order, "stable": True}})
        return out or [{**s, "cast": c}]
    with ThreadPoolExecutor(workers) as ex:
        groups = list(ex.map(one, todo))
    out = []
    for g in groups:
        for k, s in enumerate(g):
            s["id"] = f"{s['index']:02d}" + (chr(97 + k) if len(g) > 1 else "")
            out.append(s)
    log(f"{len(todo)} shots -> {len(out)} segments")
    return out


def eligible(s, min_len=0.8):
    c = s["cast"]
    return not s["has_subtitle"] and not c.get("subtitles") and c["order"] and s["duration"] >= min_len


RELAY_PROMPT = ("Replace the selected person with the reference character. Keep the reference character's face and hair; keep the source clothing. "
                "Preserve the source performance, motion, scene and audio timing.")
RELAY = {"steps": 8, "resolution": "768", "expansion_px": 64}


def plan_relay(video, shot, roles, cards, work: Path, tag, params=None, face=True, subject=None):
    """Masked edits, one pass per person on screen (the mask keeps the other person untouched, so passes chain safely)."""
    order = shot["cast"]["order"]
    name0 = f"{tag}_s{shot.get('id') or format(shot['index'], '02d')}"
    clip = shots.cut_clip(video, shot["start"], shot["duration"], work / f"{name0}_src.mp4", keep_audio=False)
    jobs, prev = [], None
    for i, k in enumerate(order):
        board = cast.board_for([cards[k]], work / f"{name0}_p{i}_board.jpg", face=face)
        job = {"name": f"{name0}_p{i}", "image_urls": [cloud.stage(board)], "prompt": RELAY_PROMPT, "relay": {"subject": subject or ("person" if len(order) == 1 else roles[k].look)},
               "params": {**RELAY, **(params or {})}, "video_url": "" if prev else cloud.stage(clip)}
        if prev:
            job["video_from"] = prev
        jobs.append(job)
        prev = job["name"]
    return jobs


def plan_relay_pass(video_or_clip, shot, role_key, roles, card, work: Path, name, params=None, subject=None, n_people=1, anchor=True):
    """One masked-edit job for one person: stage the clip, the card and (optionally) a Gemini-swapped first frame."""
    from . import anchor as anchors
    clip = Path(video_or_clip)
    if shot is not None:  # raw source video: cut the shot first
        clip = shots.cut_clip(video_or_clip, shot["start"], shot["duration"], work / f"{name}_src.mp4", keep_audio=False)
    job = {"name": name, "video_url": cloud.stage(clip), "image_urls": [cloud.stage(card)], "prompt": RELAY_PROMPT,
           "relay": {"subject": subject or ("person" if n_people == 1 else roles[role_key].look)}, "params": {**RELAY, **(params or {})}}
    if anchor:
        frame = anchors.first_frame(clip, work / f"{name}_f0.png")
        swapped = anchors.swap_frame(frame, card, roles[role_key].look, roles[role_key].new_name, work / f"{name}_anchor.png")
        job["anchor_url"] = cloud.stage(swapped)
    job["_clip"] = str(clip)
    return job


def run_relay_edit(cfg, shot_ids, cards, photos, seed=7, min_identity=6.0, log=print, params=None, retry=True):
    """Orchestrate a whole edit on the warm pod: stage-0 passes (first person per shot) -> stage-1 passes (second person, from stage-0 output)
    -> Gemini identity audit -> one re-roll (new seed) for failures. Returns {shot_id: {"file": Path, "audit": {...}}}."""
    from . import anchor as anchors, pod, verify
    S = {s["id"]: s for s in json.loads((cfg["work"] / "shots.json").read_text())["shots"]}
    st = pod.state()
    out = cfg["out"]
    base = {**RELAY, **(params or {})}
    names = {k: r.new_name for k, r in cfg["roles"].items()}
    results = {}

    def run_stage(jobs, label):
        pod.queue(st, [{k: v for k, v in j.items() if not k.startswith("_")} for j in jobs])
        res = pod.wait_jobs(st, [j["name"] for j in jobs], poll=15, log=lambda m: None, timeout=3600)
        for j in jobs:
            if res[j["name"]] == "ok":
                pod.fetch(st, j["name"], out / f"{j['name']}.mp4")
            else:
                log(f"  {label} {j['name']} FAILED {res[j['name']][:120]}")
        return {j["name"]: res[j["name"]] == "ok" for j in jobs}

    def attempt(tag, sid, sd):
        s = S[sid]; order = s["cast"]["order"]; n = len(order)
        j0 = plan_relay_pass(cfg["video"], s, order[0], cfg["roles"], cards[order[0]], out, f"{tag}_s{sid}_p0", {**base, "seed": sd}, n_people=n)
        return j0, order, s

    # stage 0
    pending = {}
    jobs0 = []
    for sid in shot_ids:
        j0, order, s = attempt("a", sid, seed)
        jobs0.append(j0); pending[sid] = (order, s)
    ok0 = run_stage(jobs0, "stage0")
    # stage 1 (two-person shots)
    jobs1 = []
    for sid, (order, s) in pending.items():
        if len(order) == 2 and ok0.get(f"a_s{sid}_p0"):
            prev = out / f"a_s{sid}_p0.mp4"
            jobs1.append(plan_relay_pass(prev, None, order[1], cfg["roles"], cards[order[1]], out, f"a_s{sid}_p1", {**base, "seed": seed + 1}, n_people=2))
    ok1 = run_stage(jobs1, "stage1") if jobs1 else {}

    def final_file(tag, sid):
        order = pending[sid][0]
        f = out / f"{tag}_s{sid}_p{len(order) - 1}.mp4"
        return f if f.exists() else None

    def audit(tag, sid):
        f = final_file(tag, sid)
        if not f:
            return None
        order = pending[sid][0]
        return verify.identity_score(f, {names[k]: photos[k] for k in order})

    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(6) as ex:
        audits = dict(zip(pending, ex.map(lambda sid: audit("a", sid), pending)))
    for sid, a in audits.items():
        worst = min([v for v in (a or {}).get("scores", {}).values() if v is not None] or [0])
        log(f"  shot {sid}: identity {a['scores'] if a else None} worst {worst:.1f}")
        results[sid] = {"file": final_file("a", sid), "audit": a, "worst": worst, "attempts": 1}
    # one re-roll for failures (new seed)
    bad = [sid for sid, r in results.items() if r["worst"] < min_identity]
    if retry and bad:
        log(f"re-rolling {bad}")
        jobsr = []
        for sid in bad:
            order, s = pending[sid]
            jobsr.append(plan_relay_pass(cfg["video"], s, order[0], cfg["roles"], cards[order[0]], out, f"b_s{sid}_p0", {**base, "seed": seed + 100}, n_people=len(order)))
        okr = run_stage(jobsr, "reroll0")
        jobsr1 = []
        for sid in bad:
            order, s = pending[sid]
            if len(order) == 2 and okr.get(f"b_s{sid}_p0"):
                jobsr1.append(plan_relay_pass(out / f"b_s{sid}_p0.mp4", None, order[1], cfg["roles"], cards[order[1]], out, f"b_s{sid}_p1", {**base, "seed": seed + 101}, n_people=2))
        if jobsr1:
            run_stage(jobsr1, "reroll1")
        for sid in bad:
            a = audit("b", sid)
            if a:
                worst = min([v for v in a["scores"].values() if v is not None] or [0])
                log(f"  shot {sid} re-roll: {a['scores']} worst {worst:.1f}")
                if worst > results[sid]["worst"]:
                    results[sid] = {"file": final_file("b", sid), "audit": a, "worst": worst, "attempts": 2}
    return results
