#!/usr/bin/env python3
"""Download licensed prompt sources and build a conservative gallery queue.

The downloaded corpora are prompt text only. Source rows are filtered before
they can reach an image worker, and every emitted row is still moderated after
rendering. Keep the manifest limited to sources whose prompt license permits
the intended use; do not point this at an arbitrary web scrape.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import re
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = ROOT / "scripts" / "prompts" / "prompt-sources.json"
BLOCKED = re.compile(
    r"(?ix)\b(?:child(?:ren)?|kid(?:s)?|baby|infant|toddler|underage|minor|loli|shota|"
    r"nude|nudity|naked|nsfw|porn(?:ographic)?|explicit|sexual|sexually|fetish|"
    r"genital(?:s)?|breast(?:s)?|boob(?:s)?|nipples?|lingerie|xxx|rape|gore|"
    r"decapitat|dismember|bloodbath)\b"
)
TECHNICAL_NOISE = re.compile(r"(?i)\b(?:watermark|logo|brand(?:ed)?|trademark|copyright)\b")


def download(url: str, destination: Path, force: bool) -> None:
    if destination.exists() and not force:
        return
    destination.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"User-Agent": "manifoldgen-prompt-import/1.0"})
    with urllib.request.urlopen(request, timeout=60) as response, destination.open("wb") as out:
        while chunk := response.read(1 << 20):
            out.write(chunk)


def candidate_texts(path: Path):
    if path.suffix.lower() in {".jsonl", ".json"}:
        for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
            try:
                value = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if isinstance(value, dict):
                for key in ("prompt", "text", "caption", "description"):
                    if value.get(key):
                        yield str(value[key])
                        break
            elif isinstance(value, str):
                yield value
        return
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        line = re.sub(r"^[-*+]\s+", "", line)
        line = re.sub(r"^\d+[.)]\s+", "", line)
        if line and not line.startswith("#") and not line.startswith("```"):
            yield line


def safe_prompt(raw: str) -> str | None:
    prompt = re.sub(r"\s+", " ", raw).strip(" \t\r\n`\"'")
    if not 20 <= len(prompt) <= 700 or BLOCKED.search(prompt):
        return None
    if TECHNICAL_NOISE.search(prompt) or "http://" in prompt.lower() or "https://" in prompt.lower():
        return None
    return f"{prompt}, family-safe, no text, no logo, no watermark"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--cache-dir", type=Path, default=ROOT / "scripts" / "prompts" / "sources")
    parser.add_argument("--out", type=Path, default=ROOT / "scripts" / "prompts" / "manifold-gallery-augmented.jsonl")
    parser.add_argument("--limit", type=int, default=100_000)
    parser.add_argument("--seed", type=int, default=20260813)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    rows: dict[str, dict[str, object]] = {}
    source_counts: dict[str, int] = {}
    for source in manifest:
        name = str(source["name"])
        filename = Path(str(source.get("filename", name + ".data"))).name
        local_path = args.cache_dir / filename
        download(str(source["url"]), local_path, args.force)
        accepted = 0
        for raw in candidate_texts(local_path):
            prompt = safe_prompt(raw)
            if not prompt:
                continue
            digest = hashlib.sha256(prompt.encode()).hexdigest()
            rows.setdefault(digest, {"prompt": prompt, "source": name, "license": source["license"], "seed": int(digest[:8], 16) % (2**31)})
            accepted += 1
        source_counts[name] = accepted

    ordered = list(rows.values())
    random.Random(args.seed).shuffle(ordered)
    ordered = ordered[: args.limit]
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8") as out:
        for row in ordered:
            out.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(json.dumps({"output": str(args.out), "rows": len(ordered), "sources": source_counts}, sort_keys=True))


if __name__ == "__main__":
    main()
