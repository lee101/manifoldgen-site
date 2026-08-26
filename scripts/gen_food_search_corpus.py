#!/usr/bin/env python3
"""Build the food & drink curated-search corpus.

Emits two JSONL prompt queues plus the exact query list used by the
frontend search pages:

  manifold-gallery-food-search-core.json    one compact query per future
                                            /search/<slug> page (>=130 per family)
  manifold-gallery-food-search-expand.jsonl long-tail descriptive prompts that
                                            enrich semantic results for every
                                            page in a family without becoming
                                            pages themselves

Core queries follow the existing curated-page convention: 3-8 lowercase words,
rendered verbatim by z-image turbo, slugified into the page URL. Expansion rows
are richer sentences in the house style of scripts/prompts/manifold-gallery*.jsonl.
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Accent props shared by the expansion grammars below.
# ---------------------------------------------------------------------------
RAMEN_ACCENTS = [
    "chopsticks resting across the rim",
    "condensation beading on the bowl",
    "ceramic spoon alongside",
    "folded napkin and finger bowl",
    "steam curling into the rafters",
    "pickles on a side dish",
]
ESPRESSO_ACCENTS = [
    "a demitasse spoon resting on the saucer",
    "sugar cubes within reach",
    "a biscotti propped beside",
    "crema swirling as it settles",
    "a folded newspaper nearby",
    "grounds dusting the tamping mat",
]
MARKET_ACCENTS = [
    "an awning stripe overhead",
    "a woven tote half filled",
    "rain beading on crate slats",
    "a hand truck stacked behind",
    "sunhat shading the till",
    "twine-topped bundles",
]
PATISSERIE_ACCENTS = [
    "gold leaf accents",
    "piped cream rosettes",
    "fresh berries tucked between",
    "a dusting of icing sugar",
    "mirrored tray reflection",
    "ribbon-tied pastry box open",
]
BBQ_ACCENTS = [
    "pickle spears and slaw alongside",
    "white bread stack waiting",
    "charred jalapenos on the board",
    "a thermometer resting in the bark",
    "tongs set down mid-trim",
    "sauce bottles out of focus",
]
OMAKASE_ACCENTS = [
    "shiso leaf tucked under",
    "fresh wasabi knuckle beside",
    "a daikon nest beneath",
    "hand-thrown glaze pooling",
    "tea cup steaming at the edge",
    "single orchid stem in frame",
]
PICNIC_ACCENTS = [
    "woven napkins weighted by stones",
    "an ice bucket sweating",
    "a paperback splayed open",
    "a bicycle leaning in the background",
    "bare feet just in frame",
    "a straw tote tipping fruit",
]
CHOCOLATE_ACCENTS = [
    "sea salt flakes catching light",
    "toasted hazelnut crunch scattered",
    "orange zest ribbons curling",
    "cocoa powder drifting down",
    "a copper spatula mid-swipe",
    "edible gold dust shimmer",
]
import argparse
import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "scripts" / "prompts"

# ---------------------------------------------------------------------------
# Family vocabularies. Every fragment is hand-written; composition below only
# ever concatenates fragments that read naturally together.
# ---------------------------------------------------------------------------

RAMEN_BROTHS = [
    "tonkotsu", "shoyu", "miso", "shio", "black garlic", "spicy tantanmen",
    "yuzu shio", "curry", "kotteri rich", "assari clear", "dipping tsukemen",
    "brothless abura soba",
]
RAMEN_TOPPINGS = [
    "chashu pork", "soft egg ajitama", "nori", "scallion", "sweetcorn butter",
    "bamboo menma", "chili oil swirl", "wood ear mushrooms", "garlic chips",
    "wontons", "narutomaki", "sesame", "pork belly slab", "soft egg and chashu",
]
RAMEN_SETTINGS = [
    "midnight diner counter", "lantern street stall", "izakaya booth",
    "rain-streaked window seat", "open kitchen steam", "noodle bar counter",
    "dark wooden table", "brass rail counter", "paper lantern glow",
    "steamed-up glass",
]
RAMEN_LIGHT = [
    "backlit steam", "moody dark backdrop", "warm pendant light",
    "neon sign reflections", "overhead flat lay", "candlelit shadows",
]

RAMEN_SUBJECTS = [
    "ramen bowl", "tonkotsu ramen", "shoyu ramen", "miso ramen", "shio ramen",
    "tsukemen dipping noodles", "tantanmen noodles", "yuzu shio ramen",
    "black garlic ramen", "curry ramen", "abura soba noodles",
    "noodle pull chopstick lift", "ramen egg halves", "chashu slice fan",
    "pork bone broth simmer", "noodle strainer toss",
]


def compose_ramen(rng: random.Random) -> str:
    kind = rng.randrange(4)
    if kind == 0:
        return f"{rng.choice(RAMEN_BROTHS)} ramen {rng.choice(RAMEN_TOPPINGS)} {rng.choice(RAMEN_SETTINGS)}"
    if kind == 1:
        return f"{rng.choice(RAMEN_SUBJECTS)} {rng.choice(RAMEN_LIGHT)}"
    if kind == 2:
        return f"{rng.choice(RAMEN_SUBJECTS)} {rng.choice(RAMEN_TOPPINGS)} {rng.choice(RAMEN_LIGHT)}"
    return f"{rng.choice(RAMEN_BROTHS)} ramen {rng.choice(RAMEN_SETTINGS)} {rng.choice(RAMEN_LIGHT)}"


def expand_ramen(rng: random.Random) -> str:
    return (
        f"a steaming bowl of {rng.choice(RAMEN_BROTHS)} ramen topped with "
        f"{rng.choice(RAMEN_TOPPINGS)}, set on {rng.choice(RAMEN_SETTINGS)}, "
        f"{rng.choice(RAMEN_ACCENTS)}, {rng.choice(RAMEN_LIGHT)}, "
        f"appetizing food photography, no text"
    )


ESPRESSO_DRINKS = [
    "ristretto", "doppio espresso", "lungo", "cortado", "macchiato",
    "flat white", "cappuccino", "affogato", "espresso tonic", "single origin espresso",
]
ESPRESSO_ACTIONS = [
    "bottomless portafilter drip", "crema tiger stripes", "milk pour rosetta",
    "steam wand hiss", "first drip extraction", "puck knock out",
    "bean grind cascade", "cup warming rack",
]
ESPRESSO_SETTINGS = [
    "marble cafe bar", "dark wood counter", "morning window light",
    "copper machine chrome", "tiled bistro top", "linen-draped counter",
    "matte grinder side", "sugar-dusted marble",
]
ESPRESSO_BREWED = [d for d in ESPRESSO_DRINKS if d not in {"affogato", "espresso tonic"}]
ESPRESSO_LIGHT = [
    "crema macro", "high gloss reflection", "warm morning glow",
    "moody low key", "overhead flat lay", "shallow depth of field bokeh",
]


def compose_espresso(rng: random.Random) -> str:
    kind = rng.randrange(4)
    if kind == 0:
        return f"{rng.choice(ESPRESSO_DRINKS)} {rng.choice(ESPRESSO_ACTIONS)}"
    if kind == 1:
        return f"{rng.choice(ESPRESSO_DRINKS)} {rng.choice(ESPRESSO_SETTINGS)} {rng.choice(ESPRESSO_LIGHT)}"
    if kind == 2:
        return f"espresso {rng.choice(ESPRESSO_ACTIONS)} {rng.choice(ESPRESSO_LIGHT)}"
    return f"{rng.choice(ESPRESSO_DRINKS)} cup {rng.choice(ESPRESSO_LIGHT)}"


def expand_espresso(rng: random.Random) -> str:
    return (
        f"a bottomless portafilter brewing {rng.choice(ESPRESSO_BREWED)}, "
        f"{rng.choice(ESPRESSO_ACTIONS)} in close view, on a {rng.choice(ESPRESSO_SETTINGS)}, "
        f"{rng.choice(ESPRESSO_ACCENTS)}, {rng.choice(ESPRESSO_LIGHT)}, "
        f"specialty coffee photography, no text"
    )


MARKET_PRODUCE = [
    "heirloom tomatoes", "stone fruit crates", "leafy green bundles",
    "root vegetable piles", "berry pints", "squash stacks", "herb bunches",
    "pepper medley", "citrus crates", "mushroom baskets", "egg cartons",
    "flower bouquets", "radish bunches", "grape clusters", "corn husks",
    "cabbage heads", "fig punnets", "melon halves",
]
MARKET_SETTINGS = [
    "farmers market crates", "canvas awning stall", "wooden crate display",
    "hanging scale", "kraft paper bags", "woven baskets", "morning stall row",
    "cobblestone square", "truck tailgate display", "string canopy shade",
]
MARKET_LIGHT = [
    "early morning light", "golden hour glow", "soft overcast light",
    "dew droplets", "long shadow morning", "dappled canopy light",
]


def compose_market(rng: random.Random) -> str:
    kind = rng.randrange(4)
    if kind == 0:
        return f"{rng.choice(MARKET_PRODUCE)} {rng.choice(MARKET_SETTINGS)}"
    if kind == 1:
        return f"{rng.choice(MARKET_SETTINGS)} {rng.choice(MARKET_LIGHT)}"
    if kind == 2:
        return f"{rng.choice(MARKET_PRODUCE)} {rng.choice(MARKET_LIGHT)}"
    return f"{rng.choice(MARKET_PRODUCE)} crates {rng.choice(MARKET_SETTINGS)} {rng.choice(MARKET_LIGHT)}"


def expand_market(rng: random.Random) -> str:
    return (
        f"fresh {rng.choice(MARKET_PRODUCE)} arranged in {rng.choice(MARKET_SETTINGS)} "
        f"in {rng.choice(MARKET_LIGHT)}, {rng.choice(MARKET_ACCENTS)}, "
        f"bustling farmers market photography, no text"
    )


PATISSERIE_ITEMS = [
    "macaron tower", "pastel macarons", "salted caramel eclairs",
    "glossy fruit tarts", "laminated croissants", "mille-feuille slices",
    "opera cake layers", "madeleines", "caneles", "choux buns",
    "mirror glaze entremet", "praline paris-brest", "pistachio religieuse",
    "lemon meringue tart", "raspberry tartlets", "chocolate bonbons",
    "danish pastries", "almond croissants",
]
PATISSERIE_SETTINGS = [
    "patisserie display case", "marble counter", "glass dome cloche",
    "tiered pastry stand", "bakery window shelf", "doily lined tray",
    "pastel backdrop", "tongs and tissue", "ribboned gift box",
]
PATISSERIE_LIGHT = [
    "pastel color palette", "soft daylight", "bakery morning glow",
    "bright airy styling", "gentle gradient backdrop",
]


def compose_patisserie(rng: random.Random) -> str:
    kind = rng.randrange(4)
    if kind == 0:
        return f"{rng.choice(PATISSERIE_ITEMS)} {rng.choice(PATISSERIE_SETTINGS)}"
    if kind == 1:
        return f"{rng.choice(PATISSERIE_ITEMS)} {rng.choice(PATISSERIE_LIGHT)}"
    if kind == 2:
        return f"{rng.choice(PATISSERIE_ITEMS)} display {rng.choice(PATISSERIE_LIGHT)}"
    return f"{rng.choice(PATISSERIE_SETTINGS)} {rng.choice(PATISSERIE_LIGHT)}"


def expand_patisserie(rng: random.Random) -> str:
    return (
        f"{rng.choice(PATISSERIE_ITEMS).capitalize()} arranged in a "
        f"{rng.choice(PATISSERIE_SETTINGS)} with a {rng.choice(PATISSERIE_LIGHT)}, "
        f"{rng.choice(PATISSERIE_ACCENTS)}, french patisserie photography, no text"
    )


BBQ_CUTS = [
    "smoked brisket", "brisket bark slices", "burnt ends", "beef ribs",
    "pulled pork shoulder", "smoked sausage links", "pork belly burnt ends",
    "smoked chuck roast", "whole packer brisket", "baby back ribs",
]
BBQ_ELEMENTS = [
    "smoke ring reveal", "offset smoker firebox", "post-oak log pile",
    "butcher paper unwrap", "rub crusted bark", "rendered fat cap",
    "bbq sauce glaze", "pit room embers", "chimney smoke plume",
    "slice board resting juices",
]
BBQ_SCENES = [
    "low and slow smokeout", "smokehouse dusk", "tailgate rig",
    "picnic table spread", "butcher shop case", "pitmaster cutting board",
    "steel prep counter",
]


def compose_bbq(rng: random.Random) -> str:
    kind = rng.randrange(4)
    if kind == 0:
        return f"{rng.choice(BBQ_CUTS)} {rng.choice(BBQ_ELEMENTS)}"
    if kind == 1:
        return f"{rng.choice(BBQ_CUTS)} {rng.choice(BBQ_SCENES)}"
    if kind == 2:
        return f"barbecue {rng.choice(BBQ_ELEMENTS)} {rng.choice(BBQ_SCENES)}"
    return f"{rng.choice(BBQ_CUTS)} sliced {rng.choice(BBQ_SCENES)} {rng.choice(['amber hour', 'backlit smoke', 'ember glow'])}"


def expand_bbq(rng: random.Random) -> str:
    return (
        f"{rng.choice(BBQ_CUTS).capitalize()} with {rng.choice(BBQ_ELEMENTS)} at a "
        f"{rng.choice(BBQ_SCENES)}, {rng.choice(BBQ_ACCENTS)}, drifting hickory smoke, "
        f"american barbecue photography, no text"
    )


OMAKASE_PIECES = [
    "nigiri selection", "otoro nigiri", "uni gunkan", "ikura salmon roe",
    "seared scallop nigiri", "cured saba mackerel", "tamago slice",
    "hamachi yellowtail", "salmon roe gunkan", "tiger prawn nigiri",
    "negitoro handroll", "wagyu sear nigiri", "squid silk cut",
    "anago eel fillet", "hoe sashimi platter",
]
OMAKASE_SETTINGS = [
    "hinoki counter", "lacquer serving board", "ceramic slate plate",
    "bamboo leaf garnish", "stone dishware", "cedar box serve",
    "chef plating tweezers", "wasabi grater beside", "minimal negative space",
    "tokonoma alcove backdrop",
]


def compose_omakase(rng: random.Random) -> str:
    kind = rng.randrange(4)
    if kind == 0:
        return f"{rng.choice(OMAKASE_PIECES)} {rng.choice(OMAKASE_SETTINGS)}"
    if kind == 1:
        return f"omakase {rng.choice(OMAKASE_PIECES)} minimal plating"
    if kind == 2:
        return f"{rng.choice(OMAKASE_PIECES)} {rng.choice(['soft window light', 'counter spot light', 'matte ceramic mood'])}"
    return f"sushi {rng.choice(OMAKASE_SETTINGS)} minimal"

def expand_omakase(rng: random.Random) -> str:
    return (
        f"{rng.choice(OMAKASE_PIECES).capitalize()} plated on a "
        f"{rng.choice(OMAKASE_SETTINGS)}, {rng.choice(OMAKASE_ACCENTS)}, "
        f"quiet edomae minimalism, precise japanese sushi photography, no text"
    )


PICNIC_ITEMS = [
    "wicker basket spread", "gingham blanket layout", "lemonade pitcher",
    "strawberry tartlets", "baguette and brie", "grape and cheese board",
    "straw hat detail", "wildflower posy", "cider bottles", "lattice pie",
    "jam jars and spoons", "sandwich stack wrap", "watermelon wedges",
    "thermos and enamel cups", "cherry punnet spill",
]
PICNIC_SCENES = [
    "orchard blanket", "meadow afternoon", "riverbank shade", "vineyard edge",
    "apple grove hammock nearby", "hilltop vista cloth", "birch grove clearing",
    "lavender field margin",
]
PICNIC_LIGHT = [
    "summer afternoon light", "string light dusk", "sun-dappled shade",
    "warm backlight through grass", "blue sky picnic brightness",
]


def compose_picnic(rng: random.Random) -> str:
    kind = rng.randrange(4)
    if kind == 0:
        return f"{rng.choice(PICNIC_ITEMS)} {rng.choice(PICNIC_SCENES)}"
    if kind == 1:
        return f"summer picnic {rng.choice(PICNIC_ITEMS)} {rng.choice(PICNIC_LIGHT)}"
    if kind == 2:
        return f"{rng.choice(PICNIC_SCENES)} {rng.choice(PICNIC_LIGHT)}"
    return f"{rng.choice(PICNIC_ITEMS)} {rng.choice(PICNIC_LIGHT)}"

def expand_picnic(rng: random.Random) -> str:
    return (
        f"a summer picnic spread with {rng.choice(PICNIC_ITEMS)} laid across an "
        f"{rng.choice(PICNIC_SCENES)} in {rng.choice(PICNIC_LIGHT)}, "
        f"{rng.choice(PICNIC_ACCENTS)}, relaxed outdoor entertaining photography, no text"
    )


CHOCOLATE_STATES = [
    "melted chocolate pouring", "chocolate swirl fold", "ganache ribbon drip",
    "tempered marble sheen", "molten lava center", "cocoa dusted truffles",
    "chocolate bark shards", "fondue slow dip", "brownie fudge squares",
    "praline cut rows", "whipped chocolate mousse peak", "cacao nib scatter",
    "drizzled whisk lift", "chocolate curl shavings",
]
CHOCOLATE_BACKDROPS = [
    "dark slate backdrop", "copper saucepan", "marble slab", "matte black bowl",
    "parchment lined tray", "gold flake finish", "deep burgundy velvet",
    "confectionery cooling rack",
]


def compose_chocolate(rng: random.Random) -> str:
    kind = rng.randrange(4)
    if kind == 0:
        return f"{rng.choice(CHOCOLATE_STATES)} swirl"
    if kind == 1:
        return f"{rng.choice(CHOCOLATE_STATES)} on {rng.choice(CHOCOLATE_BACKDROPS)}"
    if kind == 2:
        return f"chocolate {rng.choice(['pouring', 'swirl', 'drip'])} {rng.choice(['macro detail', 'slow motion feel', 'gloss highlight'])}"
    return f"{rng.choice(CHOCOLATE_STATES)} {rng.choice(['dark moody light', 'specular gloss light', 'warm studio glow'])}"

def expand_chocolate(rng: random.Random) -> str:
    return (
        f"{rng.choice(CHOCOLATE_STATES).capitalize()} over a "
        f"{rng.choice(CHOCOLATE_BACKDROPS)}, glossy ribbons catching studio light, "
        f"{rng.choice(CHOCOLATE_ACCENTS)}, indulgent dessert macro photography, no text"
    )


# ---------------------------------------------------------------------------
# Family registry
# ---------------------------------------------------------------------------

FAMILIES: list[dict] = [
    {"key": "ramen", "seed": "ramen bowl steam dark backdrop", "compose": compose_ramen, "expand": expand_ramen},
    {"key": "espresso", "seed": "espresso pour crema macro", "compose": compose_espresso, "expand": expand_espresso},
    {"key": "market", "seed": "farmers market produce crates morning", "compose": compose_market, "expand": expand_market},
    {"key": "patisserie", "seed": "patisserie display macarons pastel", "compose": compose_patisserie, "expand": expand_patisserie},
    {"key": "bbq", "seed": "brisket smoke low and slow", "compose": compose_bbq, "expand": expand_bbq},
    {"key": "omakase", "seed": "omakase sushi plating minimal", "compose": compose_omakase, "expand": expand_omakase},
    {"key": "picnic", "seed": "summer picnic spread orchard blanket", "compose": compose_picnic, "expand": expand_picnic},
    {"key": "chocolate", "seed": "melted chocolate pouring swirl", "compose": compose_chocolate, "expand": expand_chocolate},
]

BAD_WORDS = ["text", "logo", "watermark", "price tag"]


def sanitize(query: str) -> str | None:
    q = " ".join(query.lower().split())
    if not 12 <= len(q) <= 90:
        return None
    word_count = len(q.split())
    if not 3 <= word_count <= 8:
        return None
    if any(b in q for b in BAD_WORDS):
        return None
    return q


def build_core(per_family: int) -> dict[str, list[str]]:
    groups: dict[str, list[str]] = {}
    seen: set[str] = set()
    for family in FAMILIES:
        rng = random.Random(hash(family["key"]) & 0xFFFF)
        queries: list[str] = [family["seed"]]
        seen.add(family["seed"])
        attempts = 0
        while len(queries) < per_family and attempts < per_family * 200:
            attempts += 1
            q = sanitize(family["compose"](rng))
            if q is None or q in seen:
                continue
            seen.add(q)
            queries.append(q)
        groups[family["key"]] = queries
    return groups


def build_expand(per_family: int) -> dict[str, list[str]]:
    pools: dict[str, list[str]] = {}
    seen: set[str] = set()
    for family in FAMILIES:
        rng = random.Random((hash(family["key"]) * 7919) & 0xFFFF)
        rows: list[str] = []
        attempts = 0
        while len(rows) < per_family and attempts < per_family * 60:
            attempts += 1
            p = family["expand"](rng)
            p = " ".join(p.split())
            if len(p) > 320 or p in seen:
                continue
            seen.add(p)
            rows.append(p)
        pools[family["key"]] = rows
    return pools


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--per-family-core", type=int, default=140)
    parser.add_argument("--per-family-expand", type=int, default=3600)
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    groups = build_core(args.per_family_core)
    core_path = OUT_DIR / "food-search-core.json"
    core_path.write_text(json.dumps(groups, indent=1), encoding="utf-8")

    pools = build_expand(args.per_family_expand)
    expand_path = OUT_DIR / "manifold-gallery-food-search-expand.jsonl"
    with expand_path.open("w", encoding="utf-8") as out:
        for family in FAMILIES:
            for prompt in pools[family["key"]]:
                out.write(json.dumps({"prompt": prompt}) + "\n")

    stats = {k: len(v) for k, v in groups.items()}
    print(json.dumps({
        "core": stats,
        "core_total": sum(stats.values()),
        "core_path": str(core_path),
        "expand_total": sum(len(v) for v in pools.values()),
        "expand_path": str(expand_path),
    }, indent=1))


if __name__ == "__main__":
    main()
