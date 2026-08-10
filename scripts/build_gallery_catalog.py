#!/usr/bin/env python3
"""Build a deterministic, family-safe prompt catalog for the public gallery.

The catalog is intentionally generated from combinations rather than copied from
an arbitrary web prompt dump: it contains no people, sexual content, brands, or
text requests, and can be regenerated identically on another worker.

Example:
  python3 scripts/build_gallery_catalog.py --count 100000 \
    --out scripts/prompts/manifold-gallery-100k.jsonl
"""

from __future__ import annotations

import argparse
import itertools
import json
from pathlib import Path


SUBJECTS = [
    "a cliffside observatory", "a glass monorail", "a desert research station",
    "a floating botanical conservatory", "a lighthouse on black basalt", "a lunar greenhouse",
    "a cedar cabin beside an alpine lake", "a sculptural ocean pavilion",
    "a field of giant wildflowers", "a quiet canal city", "a mountain weather station",
    "an orchid greenhouse", "a salt-flat mirror landscape", "a ceramic studio",
    "an arctic listening post", "a forest tea house", "a coral reef library",
    "a rain-soaked railway platform", "a solar sail above cloud layers", "a hidden courtyard fountain",
]
SETTINGS = [
    "at blue hour", "under soft dawn fog", "after warm summer rain", "beneath an aurora",
    "in early spring mist", "at moonrise", "in crisp winter sunlight", "during golden hour",
    "under overcast coastal light", "in quiet late-afternoon haze", "beneath a star-filled sky",
    "after a distant thunderstorm", "in a gentle sea breeze", "at first light",
]
STYLES = [
    "cinematic architectural photography", "refined editorial travel photography",
    "dreamlike fine-art landscape photography", "museum-quality still-life photography",
    "Japanese woodblock-inspired editorial art", "modernist poster illustration",
    "quiet science-fiction concept art", "contemporary botanical illustration",
    "soft-grain analog film photography", "high-end design magazine photography",
]
DETAILS = [
    "subtle film grain", "atmospheric depth", "clean natural textures", "gentle reflected light",
    "careful geometric composition", "crisp material detail", "soft volumetric light",
    "restrained color harmony", "calm negative space", "weathered tactile surfaces",
]
PALETTES = [
    "cobalt and amber", "moss green and cream", "coral and midnight blue", "ochre and ultramarine",
    "lavender and silver", "jade and charcoal", "terracotta and pale sky blue", "indigo and pearl",
    "rust and sage", "ice blue and warm cedar",
]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=100_000)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    if args.count < 1:
        raise SystemExit("--count must be positive")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    seen: set[str] = set()
    with args.out.open("w", encoding="utf-8") as out:
        for parts in itertools.product(SUBJECTS, SETTINGS, STYLES, DETAILS, PALETTES):
            prompt = (
                f"{parts[0]} {parts[1]}, {parts[2]}, {parts[3]}, "
                f"{parts[4]} palette, no people, no text, no logo, no watermark"
            )
            if prompt in seen:
                continue
            seen.add(prompt)
            out.write(json.dumps({"prompt": prompt}, ensure_ascii=False) + "\n")
            if len(seen) == args.count:
                break
    if len(seen) != args.count:
        raise SystemExit(f"only generated {len(seen)} unique prompts")
    print(f"wrote {len(seen)} safe gallery prompts to {args.out}")


if __name__ == "__main__":
    main()
