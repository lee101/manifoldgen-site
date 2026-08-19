#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_FREQUENCIES = ROOT.parent / "netwrck" / "static" / "data" / "word-frequencies.json"
DEFAULT_OUTPUT = ROOT / "scripts" / "prompts" / "h3-popular-concepts-v1.jsonl"
TOKEN = re.compile(r"^[a-z][a-z-]{2,23}$")

STOP = {
    "about", "above", "after", "again", "against", "all", "also", "among", "and", "any", "are",
    "around", "back", "been", "before", "behind", "below", "between", "both", "but", "can", "could",
    "create", "does", "down", "each", "for", "from", "have", "her", "here", "high", "his", "how",
    "image", "into", "its", "just", "like", "made", "many", "more", "most", "new", "not", "one",
    "only", "other", "out", "over", "should", "some", "such", "than", "that", "the", "their", "there",
    "these", "they", "this", "through", "under", "very", "was", "were", "what", "when", "where", "which",
    "while", "who", "with", "would", "you", "your", "undefined",
}

QUALITY = {
    "aesthetic", "award", "best", "cgsociety", "concept", "definition", "detail", "detailed", "details",
    "focus", "hd", "hdr", "highly", "hyper", "hyperdetailed", "insanely", "intricate", "masterpiece",
    "octane", "perfect", "professional", "quality", "render", "rendered", "rendering", "resolution", "sharp",
    "smooth", "stunning", "trending", "uhd", "ultra", "unreal", "winning", "wow",
}

UNSAFE = {
    "adult", "bikini", "blood", "bloody", "boy", "child", "children", "corpse", "dead", "death", "erotic",
    "girl", "gore", "gory", "hentai", "infant", "kid", "kids", "killing", "naked", "nude", "nudity",
    "porn", "sexy", "teen", "teenage", "teenager", "underage", "violence", "violent", "young",
}

COMPOUNDS = [
    "anime woman", "realistic woman", "fantasy woman", "anime man", "realistic man", "fantasy warrior",
    "anime warrior", "medieval knight", "cyberpunk city", "fantasy city", "ancient temple", "magic forest",
    "dark forest", "sunset beach", "neon street", "space station", "cozy cabin", "snow mountain",
    "futuristic robot", "cute cat", "realistic dog", "flying dragon", "gothic castle", "ocean waves",
    "flower field", "desert landscape", "samurai warrior", "steampunk city", "alien planet", "moonlit garden",
    "cinematic portrait", "anime portrait",
]


def split_for(concept: str) -> str:
    bucket = int(hashlib.sha256(concept.encode()).hexdigest()[:8], 16) % 10
    if bucket == 0:
        return "test"
    if bucket == 1:
        return "validation"
    return "train"


def safe_concepts(frequencies: dict[str, int], limit: int) -> list[tuple[str, int]]:
    rows: list[tuple[str, int]] = []
    seen: set[str] = set()
    for compound in COMPOUNDS:
        score = min(int(frequencies.get(part, 0)) for part in compound.split())
        rows.append((compound, score))
        seen.add(compound)
    ranked = sorted(frequencies.items(), key=lambda item: (-int(item[1]), item[0]))
    for raw, count in ranked:
        concept = raw.strip().lower()
        if len(rows) >= limit:
            break
        unsafe_forms = {concept, concept.removesuffix("s"), concept.removesuffix("es")}
        if concept in seen or concept in STOP or concept in QUALITY or unsafe_forms & UNSAFE:
            continue
        if not TOKEN.fullmatch(concept) or int(count) < 2:
            continue
        seen.add(concept)
        rows.append((concept, int(count)))
    return rows[:limit]


def motion_prompt(concept: str) -> str:
    return (
        f"A cinematic five-second study centered on {concept}. Clear subject motion and deliberate camera movement, "
        "stable anatomy and spatial coherence, rich environmental detail, family-safe composition, no text or watermark. "
        "Natural synchronized ambience and expressive sound effects."
    )


def build_catalog(
    frequencies: dict[str, int],
    count: int,
    seeds_per_concept: int,
    base_seed: int,
    calibration_concepts: int = 0,
    calibration_seeds: int = 1,
) -> list[dict]:
    concepts = safe_concepts(frequencies, count)
    rows = []
    for rank, (concept, frequency) in enumerate(concepts, 1):
        seed_count = calibration_seeds if rank <= calibration_concepts else seeds_per_concept
        for seed_index in range(seed_count):
            digest = hashlib.sha256(f"{concept}:{seed_index}".encode()).hexdigest()[:12]
            rows.append(
                {
                    "schema_version": 1,
                    "rank": rank,
                    "concept": concept,
                    "frequency": frequency,
                    "prompt": motion_prompt(concept),
                    "slug": f"trajectory-{digest}",
                    "seed": base_seed + seed_index,
                    "seed_index": seed_index,
                    "split": split_for(concept),
                    "source": "netwrck-word-frequencies",
                }
            )
            if len(rows) >= count:
                return rows
    return rows


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--frequencies", type=Path, default=DEFAULT_FREQUENCIES)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--count", type=int, default=1000)
    parser.add_argument("--seeds-per-concept", type=int, default=1)
    parser.add_argument("--calibration-concepts", type=int, default=32)
    parser.add_argument("--calibration-seeds", type=int, default=2)
    parser.add_argument("--base-seed", type=int, default=42000)
    args = parser.parse_args()
    if not 1 <= args.count <= 5000:
        raise SystemExit("--count must be between 1 and 5000")
    if not 1 <= args.seeds_per_concept <= 8:
        raise SystemExit("--seeds-per-concept must be between 1 and 8")
    if not 0 <= args.calibration_concepts <= args.count or not 1 <= args.calibration_seeds <= 8:
        raise SystemExit("invalid calibration concept or seed count")
    frequencies = json.loads(args.frequencies.read_text(encoding="utf-8"))
    if not isinstance(frequencies, dict):
        raise SystemExit("frequency source must be a JSON object")
    rows = build_catalog(
        frequencies,
        args.count,
        args.seeds_per_concept,
        args.base_seed,
        args.calibration_concepts,
        args.calibration_seeds,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as target:
        for row in rows:
            target.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")
    print(json.dumps({"output": str(args.output), "rows": len(rows), "concepts": len({r['concept'] for r in rows})}))


if __name__ == "__main__":
    main()
