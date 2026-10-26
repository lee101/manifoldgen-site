"""LLM art review. Every image is re-encoded to <= 800px webp before an LLM sees it.

review_image() scores one still against a brief + checklist and returns concrete fixes.
art_director() wraps any generator in a generate -> review -> amend-prompt loop and keeps
the best take. Reviewer models are OpenRouter ids; the default is DeepSeek vision with a
Gemini fallback.
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Callable

from .common import env, http_json, sidecar, webp_data_uri

REVIEW_MODELS = [m for m in os.environ.get(
    "FILMKIT_REVIEW_MODELS", "deepseek:deepseek-flash,gemini:gemini-3.5-flash").split(",") if m]
# provider:model -> (chat endpoint, key env). Bare ids go through OpenRouter.
PROVIDERS = {
    "deepseek": ("https://api.deepseek.com/chat/completions", "DEEPSEEK_API_KEY"),
    "gemini": ("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", "GEMINI_API_KEY"),
    "openrouter": ("https://openrouter.ai/api/v1/chat/completions", "OPENROUTER_API_KEY"),
}

SYSTEM = (
    "You are the art director of an anime feature. You review ONE frame (or a board of frames) against the "
    "brief and the character/location lock. Be strict about identity drift, anatomy (hands, faces, eyes), "
    "unwanted text/watermarks, wrong clothing, wrong time of day, muddy composition. Reply with JSON only: "
    '{"score": 0-1, "pass": bool, "issues": [short strings], "fix_prompt": "one sentence to append to the '
    'generation prompt that fixes the worst issues", "keep": [what is working]}'
)


def _parse(text: str) -> dict:
    text = text.strip()
    match = re.search(r"\{.*\}", text, re.S)
    data = json.loads(match.group(0) if match else text)
    data["score"] = float(data.get("score", 0))
    data["pass"] = bool(data.get("pass", data["score"] >= 0.8))
    data.setdefault("issues", [])
    data.setdefault("fix_prompt", "")
    return data


def review_image(path: str | Path, brief: str, checklist: list[str] | None = None, *,
                 refs: list[str | Path] | None = None, models: list[str] | None = None,
                 threshold: float = 0.8, effort: str = "max") -> dict:
    """Score `path` against `brief`. `refs` (character sheets) are shown first, as identity locks."""
    content: list[dict] = []
    for ref in refs or []:
        content.append({"type": "text", "text": "REFERENCE (identity lock, do not grade it):"})
        content.append({"type": "image_url", "image_url": {"url": webp_data_uri(ref)}})
    content.append({"type": "text", "text": "FRAME TO REVIEW:"})
    content.append({"type": "image_url", "image_url": {"url": webp_data_uri(path)}})
    lock = "\n".join(f"- {c}" for c in checklist or [])
    content.append({"type": "text", "text": f"BRIEF: {brief}\nCHECKLIST:\n{lock}\nPass threshold {threshold}."})
    last = ""
    for model in models or REVIEW_MODELS:
        try:
            provider, _, name = model.partition(":")
            if not name:
                provider, name = "openrouter", model
            url, key = PROVIDERS[provider]
            body = {"model": name, "temperature": 0.2, "max_tokens": 4000,
                    "response_format": {"type": "json_object"},
                    "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": content}]}
            if provider == "deepseek":
                body["reasoning_effort"] = effort
            res = http_json("POST", url, body, {"Authorization": f"Bearer {env(key)}"}, timeout=240)
            verdict = _parse(res["choices"][0]["message"]["content"])
            verdict["pass"] = verdict["pass"] and verdict["score"] >= threshold
            verdict["model"] = model
            return verdict
        except Exception as exc:
            last += f" | {model}: {str(exc)[:200]}"
    raise RuntimeError(f"all reviewers failed: {last}")


def art_director(generate: Callable[[str, Path, int], dict], prompt: str, out: Path, brief: str,
                 checklist: list[str] | None = None, *, refs: list[str | Path] | None = None,
                 tries: int = 3, threshold: float = 0.8, seed: int = 1) -> dict:
    """generate(prompt, path, seed) -> meta. Re-rolls with the reviewer's fix appended; keeps the best."""
    out = Path(out)
    best: dict | None = None
    history = []
    amended = prompt
    for attempt in range(tries):
        cand = out.with_name(f"{out.stem}.cand{attempt}{out.suffix}")
        generate(amended, cand, seed + attempt)
        verdict = review_image(cand, brief, checklist, refs=refs, threshold=threshold)
        history.append({"attempt": attempt, "seed": seed + attempt, "prompt": amended, **verdict})
        if best is None or verdict["score"] > best["score"]:
            best = {**verdict, "path": cand}
        if verdict["pass"]:
            break
        if verdict["fix_prompt"]:
            amended = f"{prompt} {verdict['fix_prompt']}"
    assert best is not None
    Path(best["path"]).replace(out)
    for stale in out.parent.glob(f"{out.stem}.cand*"):
        stale.unlink(missing_ok=True)
    result = {"output": str(out), "score": best["score"], "pass": best["pass"], "history": history}
    sidecar(out, {"kind": "art_director", **result})
    return result


def locate(path: str | Path, what: str, *, model: str = "gemini:gemini-3.5-flash") -> list[list[float]]:
    """Ask a vision model for normalized [x, y] points of `what` (e.g. "both of Rei's eyes").

    Feeds animefx params that need coordinates (eye_glow points, impact_burst cx/cy, sparkle regions).
    Returns [] when the subject is not visible.
    """
    provider, _, name = model.partition(":")
    url, key = PROVIDERS[provider]
    res = http_json("POST", url, {
        "model": name, "temperature": 0, "response_format": {"type": "json_object"},
        "messages": [{"role": "user", "content": [
            {"type": "text", "text": f"Locate: {what}. Reply JSON only: {{\"points\": [[y, x], ...]}} with y,x as integers "
                                     f"0-1000 from the top-left of the image, one point per instance (eye centre, impact point...). "
                                     f"Empty list if not visible."},
            {"type": "image_url", "image_url": {"url": webp_data_uri(path)}}]}],
    }, {"Authorization": f"Bearer {env(key)}"}, timeout=120)
    pts = json.loads(re.search(r"\{.*\}", res["choices"][0]["message"]["content"], re.S).group(0)).get("points", [])
    return [[round(float(x) / 1000, 3), round(float(y) / 1000, 3)] for y, x in pts]


def review_audio(path: str | Path, question: str, *, model: str = "gemini:gemini-3.5-flash") -> str:
    """Ask an audio-capable model about a clip (voice age/emotion, score mood, glitches). Returns its answer."""
    import base64
    provider, _, name = model.partition(":")
    url, key = PROVIDERS[provider]
    fmt = Path(path).suffix.lstrip(".").lower() or "mp3"
    data = base64.b64encode(Path(path).read_bytes()).decode()
    res = http_json("POST", url, {"model": name, "messages": [{"role": "user", "content": [
        {"type": "text", "text": question}, {"type": "input_audio", "input_audio": {"data": data, "format": fmt}}]}]},
        {"Authorization": f"Bearer {env(key)}"}, timeout=240)
    return res["choices"][0]["message"]["content"]
