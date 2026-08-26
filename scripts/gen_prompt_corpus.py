#!/usr/bin/env python3
"""Deterministic combinatorial prompt corpus for the gallery farm.

Emits JSONL rows compatible with scripts/generate_gallery_art.py:
  {"prompt", "category", "slug", "seed", "width", "height"}

Rows are deduplicated against every existing scripts/prompts/*.jsonl file and
an optional --exclude file of already-indexed prompts (one per line).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

DIMENSIONS = (
    (1024, 1024),
    (768, 1344),
    (1344, 768),
    (768, 1024),
    (1024, 768),
)

TAIL = "no text, no logo, no watermark"

BANKS: dict[str, dict[str, list[str]]] = {
    "landscape": {
        "subject": [
            "a glacial valley under a rising morning mist", "terraced rice fields after monsoon rain",
            "a lone birch grove on a frost-covered plain", "red rock canyons cut by a silver river",
            "a volcanic black-sand coastline at low tide", "alpine meadows ringing a turquoise lake",
            "sandstone buttes under a migrating storm", "a boreal forest wrapped in low fog",
            "limestone karsts rising from a still bay", "rolling lavender fields at last light",
            "a frozen waterfall mid-thaw in early spring", "dune sea rippling under a full moon",
            "a moss-covered ravine with a chain of small falls", "salt flats mirroring a pastel dusk",
            "a highland pass between snow-streaked peaks", "wetland marshes streaked with morning gold",
        ],
        "setting": [
            "shot from a ridge trail at first light", "seen across the water from a gravel shore",
            "framed by weathered granite in the foreground", "under a sky washing from peach to slate",
            "with storm light breaking over the far ridge", "in the blue hush before sunrise",
            "after rain with every surface gleaming", "in thin arctic air with long blue shadows",
        ],
        "style": [
            "large-format landscape photography", "romantic era landscape painting",
            "modern editorial travel photography", "tonalist oil painting",
            "drone aerial photography", "analog medium format film",
        ],
        "composition": [
            "deep layered perspective, careful horizon placement", "symmetrical reflection composition",
            "leading lines drawing toward the light", "vast negative space, small focal detail",
            "framed natural vignette, atmospheric depth",
        ],
        "palette": [
            "slate blue and warm amber", "moss green and pearl", "dusty rose and deep teal",
            "iron grey and gold", "glacier blue and bone", "umber and cream",
        ],
    },
    "architecture": {
        "subject": [
            "a brutalist library washed in afternoon light", "a glass conservatory in a quiet botanical garden",
            "a spiral staircase in a renovated lighthouse", "a mud-brick desert hotel with deep arcades",
            "a timber boathouse on a mirror-still lake", "a tiled Moroccan courtyard with a dry fountain",
            "a cantilevered cabin over a forest ravine", "a neoclassical station hall with iron vaults",
            "a cliffside monastery reached by stone steps", "a subterranean gallery with a single skylight",
            "a latticed wooden mosque ceiling", "a mid-century desert house with a empty pool",
            "a floating market hall on concrete pontoons", "a hillside amphitheater overgrown with grass",
        ],
        "setting": [
            "golden hour raking across the facade", "overcast light with soft even shadows",
            "blue hour with warm interior glow", "harsh noon sun and crisp geometry",
            "fog softening the surrounding rooftops", "dusk with a single lit window",
        ],
        "style": [
            "architectural digest photography", "precise architectural line illustration",
            "documentary architecture photography", "isometric cutaway illustration",
            "large format tilt-shift photography", "watercolor architectural rendering",
        ],
        "composition": [
            "one-point perspective down the central axis", "strong diagonal shadow play",
            "symmetrical frontal elevation", "frame-within-frame through an archway",
            "low angle emphasizing mass and shadow",
        ],
        "palette": [
            "concrete grey and olive", "sand beige and copper", "ink black and brass",
            "chalk white and sky blue", "terracotta and sage",
        ],
    },
    "animal": {
        "subject": [
            "a snow leopard pausing on a rocky ledge", "a heron striking at silver minnows",
            "a red fox curled in fresh powder", "a herd of elephants crossing a dry riverbed",
            "a hummingbird frozen at a fuchsia bloom", "an octopus spreading through a sunlit reef",
            "a mare and foal in tall summer grass", "a puffin holding a beakful of sand eels",
            "a chameleon mid-step on a branch", "a wolf watching from a snowy treeline",
            "a manta ray gliding over a sand channel", "a tree frog on a rain-beaded leaf",
            "a lioness stretching at first light", "a puff of pollen around a hovering bee",
        ],
        "setting": [
            "in soft directional morning light", "backlit by low golden sun",
            "in the green shade of a forest canopy", "against a clean muted background",
            "in shallow water with perfect reflections", "in drifting snow or dust",
        ],
        "style": [
            "wildlife telephoto photography", "national geographic documentary still",
            "naturalist watercolor illustration", "macro nature photography",
            "cinematic wildlife film still",
        ],
        "composition": [
            "tight portrait with catchlight in the eye", "wide habitat shot with small subject",
            "motion frozen at 1/2000 shutter", "eye-level intimate framing",
            "negative space emphasizing silhouette",
        ],
        "palette": [
            "earth tones and soft cream", "deep jungle green and gold", "arctic blue and white",
            "warm savanna ochre", "reef turquoise and coral",
        ],
    },
    "food": {
        "subject": [
            "a rustic sourdough loaf torn open", "a bowl of ramen with a jammy egg",
            "heirloom tomatoes on a butcher board", "a stack of blueberry pancakes with dripping syrup",
            "fresh pasta dusted with semolina", "a charcutine board with figs and honeycomb",
            "street tacos on a steel tray", "a slice of lemon tart with torched meringue",
            "stone fruit spilling from a market crate", "espresso pouring into a glass cup",
            "grilled peaches with burrata and basil", "a copper pot of mussels in white wine",
        ],
        "setting": [
            "on a weathered oak table by a window", "on cool marble with a linen napkin",
            "in a busy kitchen with steam rising", "on a picnic blanket in dappled light",
            "against a dark moody backdrop", "on enamel plates at a camp table",
        ],
        "style": [
            "editorial food photography", "rustic overhead food flat lay",
            "moody chiaroscuro food still life", "bright airy cookbook photography",
            "45-degree restaurant menu shot",
        ],
        "composition": [
            "shallow depth of field with crisp foreground", "perfect overhead symmetry",
            "negative space for copy on the left", "hands entering frame mid-serve",
            "close macro texture on the crust",
        ],
        "palette": [
            "warm bread tones and sage", "berry red and cream", "charcoal and gold",
            "fresh green and white ceramic", "honey amber and walnut",
        ],
    },
    "product": {
        "subject": [
            "a matte ceramic pour-over set", "a titanium field watch on a stone slab",
            "minimal white sneakers on a seamless curve", "a glass perfume bottle with a heavy cap",
            "over-ear headphones floating mid-air", "a linen apron on a wooden hanger",
            "a brass desk lamp switched on", "a stack of notebooks with foil edges",
            "a bicycle saddle in oiled leather", "a skincare bottle with water droplets",
            "a cast iron skillet fresh from the oven", "a mechanical keyboard with pastel keycaps",
        ],
        "setting": [
            "on a seamless studio backdrop", "on wet slate with drifting mist",
            "on a plinth in a sunlit empty room", "in a splash of frozen water",
            "on raw concrete with a hard shadow", "in a beam of window light on a table",
        ],
        "style": [
            "high-end product photography", "commercial advertising still",
            "minimalist catalog photography", "dramatic hero product shot",
            "soft gradient background render",
        ],
        "composition": [
            "centered hero with soft reflection", "three-quarter angle with crisp specular highlights",
            "levitating product with dynamic shadow", "macro on material texture and stitching",
            "wide negative space for headline copy",
        ],
        "palette": [
            "studio grey and one accent", "warm sand and black", "ice white and chrome",
            "deep navy and brass", "blush and graphite",
        ],
    },
    "scifi": {
        "subject": [
            "a generation ship passing a ringed gas giant", "a terraforming tower on a red desert planet",
            "a derelict station drifting through nebula gas", "a solar farm mirroring a binary sunrise",
            "a cargo loader docking at a lunar port", "a biodome city under an alien aurora",
            "a pilot silhouetted against a cockpit of lights", "an orbital elevator climbing through cloud deck",
            "a salvage crew cutting into a whale-like hull", "a monorail crossing a methane sea",
            "a cryo bay with rows of frosted pods", "a drone swarm assembling a bridge",
        ],
        "setting": [
            "lit by engine glow and warning strobes", "under a sky of two setting suns",
            "in the silence of a damaged corridor", "with dust motes drifting through volumetric beams",
            "against the black and a field of stars", "in storm light on a landing pad",
        ],
        "style": [
            "cinematic sci-fi film still", "70s science fiction paperback cover art",
            "hard sci-fi concept art", "retro futurist airbrush illustration",
            "photoreal render with film grain",
        ],
        "composition": [
            "epic scale with tiny human figure", "cockpit-framed over-the-shoulder shot",
            "symmetrical corridor one-point perspective", "wide establishing shot with dramatic scale",
            "dutch angle during a critical moment",
        ],
        "palette": [
            "teal and engine orange", "monochrome steel with red alerts", "violet nebula and gold",
            "sand planet ochre and sky white", "deep space blue and signal green",
        ],
    },
    "fantasy": {
        "subject": [
            "a floating monastery chained to a mountain spire", "a market of lantern-sellers in a fog-bound city",
            "a moss-covered golem with wildflowers in its cracks", "a lighthouse keeper feeding a sea serpent",
            "a library where books fly between shelves", "an ancient tree whose roots hold a village",
            "a knight resting beside an armored elk", "a witch's greenhouse glowing at the forest edge",
            "a bridge of whales' bones over a dark strait", "a desert caravan under a giant moon",
            "a sunken cathedral with fish through the windows", "a storm giant striding above cloud cover",
        ],
        "setting": [
            "in god rays through cathedral mist", "under a sky streaked with impossible colors",
            "with fireflies mapping the air", "in the blue dark before a storm",
            "with lanterns reflecting on wet cobblestone", "in falling cherry petals",
        ],
        "style": [
            "classical fantasy oil painting", "storybook illustration with ink linework",
            "cinematic concept art", "romanticist painting with sublime scale",
            "studio ghibli inspired background art",
        ],
        "composition": [
            "hero low angle against the sky", "deep establishing vista with layered planes",
            "intimate character moment in a large world", "centered iconic silhouette",
            "over-the-shoulder reveal",
        ],
        "palette": [
            "emerald and candle gold", "dusk purple and ember orange", "sea grey and pearl",
            "autumn russet and deep green", "moonlit blue and silver",
        ],
    },
    "interior": {
        "subject": [
            "a reading nook under a sloped attic ceiling", "a sunlit kitchen with open copper shelves",
            "a recording studio with warm wood panels", "a plant-filled bathroom with a clawfoot tub",
            "a bookshop cafe with mismatched chairs", "a minimal bedroom with one large window",
            "a pottery studio dusted in clay", "a corner barbershop with chrome and leather",
            "an artist's studio in a converted warehouse", "a mountain cabin around a stone hearth",
        ],
        "setting": [
            "morning light through linen curtains", "lamps glowing against blue dusk",
            "rain streaking the tall windows", "afternoon sun striping the floor",
            "candlelight on textured plaster walls", "overcast soft box daylight",
        ],
        "style": [
            "interior design editorial photography", "cozy lifestyle photography",
            "architectural digest interior spread", "film photography with natural flash",
            "matte painting for a quiet drama",
        ],
        "composition": [
            "wide room reveal from the doorway", "cozy corner vignette",
            "leading lines along the floor boards", "layered foreground through furniture",
            "symmetry around a central table",
        ],
        "palette": [
            "warm oak and cream", "sage green and brass", "charcoal and amber",
            "chalk white and rattan", "denim blue and walnut",
        ],
    },
    "street": {
        "subject": [
            "a noodle vendor mid-steam at a night market", "commuters crossing a rain-glossed intersection",
            "a barber reading between customers", "skateboarders under a concrete overpass",
            "a flower stall being unloaded at dawn", "kids chalking a hopscotch grid",
            "a tram sliding through a narrow european lane", "a fisherman mending nets by his boat",
            "a book stall under a green awning", "a courier weaving through gridlocked traffic",
            "an old pair playing chess in a park", "a street musician lit by a shop window",
        ],
        "setting": [
            "neon signs doubling in wet pavement", "in the gold slant of late afternoon",
            "under a sky heavy with coming rain", "in the blue hour shop-light glow",
            "in drifting steam from street grates", "in dust and long shadows",
        ],
        "style": [
            "street documentary photography", "cinematic film still with anamorphic flare",
            "35mm reportage black and white", "kodachrome travel photography",
            "contemporary photorealistic illustration",
        ],
        "composition": [
            "layered foreground with a decisive moment", "reflection composition in a puddle",
            "frame within a shop window", "long lens compression through the crowd",
            "silhouette against a bright storefront",
        ],
        "palette": [
            "neon magenta and asphalt", "warm tungsten and night blue", "monochrome silver",
            "market colors and steam white", "sodium orange and shadow",
        ],
    },
    "abstract": {
        "subject": [
            "silk fabric frozen mid-swirl", "ink blooming through water", "shattered glass reassembling as a bloom",
            "oil bubbles on a dark plane", "long-exposure light threads through fog",
            "folded paper in raking light", "ferrofluid spiking toward a magnet",
            "sand patterns after wind", "concentric ripples on black water",
            "smoke curling through a laser sheet", "marbled paint under glass",
            "prism splits through a crystal",
        ],
        "setting": [
            "on a seamless dark field", "against a soft gradient backdrop",
            "in a beam of hard light", "in zero gravity stillness",
            "with subtle film grain", "with mirrored floor reflection",
        ],
        "style": [
            "abstract fine art photography", "generative minimal poster art",
            "bauhaus geometric composition", "liquid light show photography",
            "editorial abstract 3d render",
        ],
        "composition": [
            "off-center balance with generous negative space", "full-bleed texture wall",
            "perfect radial symmetry", "diagonal tension across the frame",
            "rule-of-thirds focal bloom",
        ],
        "palette": [
            "ink black and single gold accent", "pastel gradient wash", "deep teal and coral",
            "monochrome graphite", "sunset gradient on matte",
        ],
    },
    "aerial": {
        "subject": [
            "a highway interchange like a circuit board", "salt evaporation ponds in pastel squares",
            "a container port in strict rows", "a forest river braiding through autumn trees",
            "a hot air balloon rally from above", "rice paddies in mirror tiers",
            "a ski resort carving through conifers", "a desert crossroads with one truck",
            "a coastal town wrapping a curved bay", "wind farms marching into the sea",
            "a ship cutting a turquoise wake", "a quarry amphitheater in terraces",
        ],
        "setting": [
            "at golden hour with long shadows", "under a thin morning haze",
            "at true noon with hard geometry", "in autumn color at peak",
            "with low fog pooling in hollows", "under broken cloud light",
        ],
        "style": [
            "drone aerial photography", "satellite imagery aesthetic",
            "aerial fine art photography", "top-down editorial drone shot",
            "oblique aerial survey photography",
        ],
        "composition": [
            "perfect top-down nadir framing", "diagonal composition across the frame",
            "pattern repetition filling the frame", "single subject isolated in pattern",
            "horizon placed low with vast sky",
        ],
        "palette": [
            "earth ochre and asphalt grey", "pastel pond pink and mint", "harvest gold and green",
            "ocean teal and white foam", "industrial blue and rust",
        ],
    },
}


def dimensions(digest: str) -> tuple[int, int]:
    return DIMENSIONS[int(digest[:8], 16) % len(DIMENSIONS)]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--per-category", type=int, default=6000)
    parser.add_argument("--seed", type=int, default=20260826)
    parser.add_argument("--out", type=Path, default=ROOT / "scripts" / "prompts" / "manifold-gallery-expansion-v2.jsonl")
    parser.add_argument("--exclude", type=Path, action="append", default=[])
    args = parser.parse_args()

    seen: set[str] = set()
    for path in sorted((ROOT / "scripts" / "prompts").glob("*.jsonl")):
        for line in path.read_text(errors="ignore").splitlines():
            try:
                value = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(value, dict) and isinstance(value.get("prompt"), str):
                seen.add(value["prompt"].strip())
    for path in args.exclude:
        for line in path.read_text(errors="ignore").splitlines():
            prompt = line.strip()
            if prompt:
                seen.add(prompt)
    indexed_before = len(seen)

    rng = random.Random(args.seed)
    out = args.out
    out.parent.mkdir(parents=True, exist_ok=True)
    written = 0
    with out.open("w") as handle:
        for category, slots in BANKS.items():
            subjects, settings, styles, compositions, palettes = (
                slots["subject"], slots["setting"], slots["style"], slots["composition"], slots["palette"],
            )
            attempts = 0
            made = 0
            while made < args.per_category and attempts < args.per_category * 30:
                attempts += 1
                prompt = ", ".join((
                    rng.choice(subjects), rng.choice(settings), rng.choice(styles),
                    rng.choice(compositions), f"{rng.choice(palettes)} palette", TAIL,
                ))
                prompt = prompt[0].upper() + prompt[1:]
                if prompt.lower() in seen or not 12 <= len(prompt) <= 900:
                    continue
                seen.add(prompt.lower())
                digest = hashlib.sha256(prompt.encode()).hexdigest()
                width, height = dimensions(digest)
                row = {
                    "prompt": prompt,
                    "category": category,
                    "slug": f"{category}-{digest[:12]}",
                    "seed": int(digest[:8], 16) % (2**31),
                    "width": width,
                    "height": height,
                }
                handle.write(json.dumps(row) + "\n")
                made += 1
                written += 1
    print(f"wrote {written} new prompts to {out} (excluded {indexed_before} existing)")


if __name__ == "__main__":
    main()
