"""Art lane with a reviewer in the loop and a Google fallback.

generate_art() tries Qwen (generate or board-edit) with the reviewer's fix appended on each
re-roll; when Qwen cannot reach the threshold it hands the best take plus the identity refs to
Google (Gemini image edit) to repair identity / reframe, then reviews that too. The winner is
kept as the full-size master PNG and a <=800px webp preview (the preview is what LLMs saw).
"""
from __future__ import annotations

import json
from pathlib import Path

from .common import lightweight, sidecar
from .images import gemini_edit, qwen_edit, qwen_generate
from .review import art_director, review_image

NEGATIVE = ("photo, photorealistic, 3d render, cgi, text, watermark, logo, signature, deformed hands, extra fingers, "
            "extra limbs, blurry, low detail, jpeg artifacts, western cartoon, chibi")


def generate_art(prompt: str, out: Path, brief: str, checklist: list[str], *, ref: Path | None = None,
                 identity_refs: list[Path] | None = None, size=(1344, 768), aspect="16:9", seed: int = 1,
                 qwen_tries: int = 3, google_tries: int = 2, threshold: float = 0.8, steps: int = 30) -> dict:
    """ref: board/image Qwen edits from (None = text-to-image). identity_refs: sheets shown to the reviewer + Gemini."""
    out = Path(out)
    if out.exists() and out.with_suffix(out.suffix + ".json").exists():
        return json.loads(out.with_suffix(out.suffix + ".json").read_text())

    def qwen(p: str, path: Path, s: int) -> dict:
        if ref:
            return qwen_edit(p, ref, path, size=size, seed=s, steps=steps)
        return qwen_generate(p, path, size=size, seed=s, steps=steps, negative=NEGATIVE)

    try:
        result = art_director(qwen, prompt, out, brief, checklist, refs=identity_refs, tries=qwen_tries,
                              threshold=threshold, seed=seed)
    except Exception as exc:  # the local lane is down or busy: go straight to Google
        result = {"output": str(out), "score": 0.0, "pass": False, "history": [], "qwen_error": str(exc)[:300]}
        google_tries = max(google_tries, 3)
    result["lane"] = "qwen"
    if not result["pass"] and google_tries:
        best_fix = result["history"][-1]["fix_prompt"] if result["history"] else ""
        cands = []
        for i in range(google_tries):
            cand = out.with_name(f"{out.stem}.g{i}{out.suffix}")
            seed_refs = ([out] if out.exists() else ([ref] if ref else [])) + list(identity_refs or [])
            gemini_edit(f"{prompt} FIX: {best_fix} Match the identity of every character reference exactly; draw a single "
                        f"full-frame shot, not a sheet.", seed_refs, cand, aspect)
            v = review_image(cand, brief, checklist, refs=identity_refs, threshold=threshold)
            cands.append((v["score"], cand, v))
            if v["pass"]:
                break
            best_fix = v["fix_prompt"] or best_fix
        score, cand, v = max(cands, key=lambda c: c[0])
        if score > result["score"] or not out.exists():
            cand.replace(out)
            result.update(score=score, **{"pass": v["pass"]}, lane="gemini")
        for stale in out.parent.glob(f"{out.stem}.g*"):
            stale.unlink(missing_ok=True)
    lightweight(out, out.with_suffix(".webp") if out.suffix != ".webp" else out.with_name(out.stem + ".preview.webp"))
    sidecar(out, result)
    return result
