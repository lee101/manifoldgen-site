"""Merge shisei + generated poses into manifest.json (one record per pose); convert generated PNGs to webp."""
import json
from pathlib import Path

from PIL import Image

NAMES = {"stand": "standing", "relaxed": "relaxed standing", "walk": "walking", "run": "running", "sit on floor": "sitting",
         "sit on chair": "sitting on a chair", "kneel": "kneeling", "crouch": "crouching", "jump": "jumping",
         "fighting stance": "fighting stance", "sword two-hand hold": "weapon grip", "casting a spell with one arm extended": "spellcasting"}
CATEGORY = {"stand": "Standing", "relaxed": "Standing", "walk": "Walking", "run": "Running", "sit on floor": "Sitting",
            "sit on chair": "Sitting", "kneel": "Kneeling", "crouch": "Crouching", "jump": "Jumping",
            "fighting stance": "Action", "sword two-hand hold": "Action", "casting a spell with one arm extended": "Action"}
VIEW_KEY = {"front": "front", "34left": "diag", "side": "side", "highangle": "above", "lowangle": "below"}
KINDS = ("skeleton", "depth", "mesh")


def to_webp(out: Path, rel: str) -> str:
    src = out / "images" / rel
    dst = src.with_suffix(".webp")
    if src.exists():
        Image.open(src).save(dst, quality=86 if "mesh" in rel else 90)
        src.unlink()
    return rel[:-4] + ".webp"


def gen_records(out: Path) -> list[dict]:
    raw = json.loads((out / "gen-raw.json").read_text())
    recs = []
    for e in raw:
        figs = e["figures"]
        views, depth, skel = {}, {}, {}
        for vname, files in e["views"].items():
            key = VIEW_KEY.get(vname.replace("/", "").replace(" ", ""), vname)
            views[key] = to_webp(out, files["mesh"])
            depth[key] = to_webp(out, files["depth"])
            skel[key] = to_webp(out, files["skeleton"])
        bodies = [f["body"] for f in figs]
        people = len(figs)
        if people == 1:
            f = figs[0]
            name = f["description"].split(",")[0].capitalize() + (f", {f['description'].split(',')[1].strip()}" if "," in f["description"] else "")
            category = CATEGORY.get(f["base"], "Other")
            text = f"{f['description']} | {NAMES.get(f['base'], f['base'])} | {f['body']} | {category}"
        else:
            parts = [f"{f['body']} {f['description']}" for f in figs]
            name = f"{'Duo' if people == 2 else 'Trio'}: " + " + ".join(NAMES.get(f["base"], f["base"]) for f in figs)
            category = "Duo" if people == 2 else "Trio"
            text = f"{people} people | " + " | ".join(parts)
        recs.append({
            "id": e["id"], "source": "generated", "series": "gen", "name": name, "category": category,
            "description": "; ".join(f["description"] for f in figs), "bodies": bodies, "people": people,
            "framing": "full", "nsfw": False, "views": views, "depth": depth, "skeleton": skel,
            "pose": e["pose"], "w": e["w"], "h": e["h"], "search_text": text, "license": "CC0-1.0", "credit": "ManifoldGen",
        })
    return recs


def build(out: Path):
    recs = json.loads((out / "shisei.json").read_text())
    if (out / "gen-raw.json").exists():
        recs += gen_records(out)
    (out / "manifest.json").write_text(json.dumps(recs, ensure_ascii=False, separators=(",", ":")))
    print(f"manifest: {len(recs)} poses, {sum(len(r['views']) for r in recs)} views")
