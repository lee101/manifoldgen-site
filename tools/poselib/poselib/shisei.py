"""Import the CC0 shisei mannequin pose library (github.com/wquguru/shisei)."""
import json
import shutil
from pathlib import Path

VIEW_LABEL = {"front": "front view", "diag": "three-quarter view", "side": "side view",
              "above": "high angle from above", "below": "low angle from below"}
SERIES_LABEL = {"std": "full body", "upper": "upper body", "sexy": "full body glamour", "duo": "two people"}


def import_shisei(repo: Path, out: Path, tier: str = "w600") -> list[dict]:
    catalog = json.loads((repo / "data" / "catalog.json").read_text())
    img_out = out / "images" / "shisei"
    img_out.mkdir(parents=True, exist_ok=True)
    entries = []
    for p in catalog:
        views = {}
        for view, fn in (p.get("views") or {}).items():
            if not fn:
                continue
            src = repo / "images" / "line" / tier / fn
            if not src.exists():
                continue
            shutil.copyfile(src, img_out / fn)
            views[view] = f"shisei/{fn}"
        if not views:
            continue
        photos = {}
        for view, fn in (p.get("photos") or {}).items():
            src = repo / "images" / "photo" / tier / fn if fn else None
            if src and src.exists():
                dst = f"photo_{fn}"
                shutil.copyfile(src, img_out / dst)
                photos[view] = f"shisei/{dst}"
        desc = p.get("desc_en") or p["name_en"]
        text = " | ".join([p["name_en"], p["class_en"], SERIES_LABEL[p["series"]], desc,
                           p.get("name_jp", ""), p.get("name_cn", "")])
        entries.append({
            "id": f"shisei-{p['id']}", "source": "shisei", "series": p["series"],
            "name": p["name_en"], "category": p["class_en"], "description": desc,
            "names": {"ja": p.get("name_jp"), "zh": p.get("name_cn"), "ko": p.get("name_kr")},
            "nsfw": p["rating"] != "general", "people": 2 if p["series"] == "duo" else 1,
            "framing": "upper" if p["series"] == "upper" else "full",
            "views": views, "photos": photos, "search_text": text,
            "license": "CC0-1.0", "credit": "shisei (wquguru)",
        })
    return entries
