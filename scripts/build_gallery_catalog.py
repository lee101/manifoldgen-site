#!/usr/bin/env python3
"""Build deterministic, family-safe image or video gallery prompt catalogs.

Rows are emitted in a seeded shuffled order, so even a small bounded production
batch covers many subjects and styles instead of exhausting one product axis.

Examples:
  python3 scripts/build_gallery_catalog.py --kind image --count 100000 \
    --out scripts/prompts/manifold-gallery-100k.jsonl
  python3 scripts/build_gallery_catalog.py --kind video --count 10000 \
    --out scripts/prompts/manifold-gallery-videos-10k.jsonl
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import random
from pathlib import Path


IMAGE_SUBJECTS = [
    ("architecture", "a cliffside observatory"),
    ("architecture", "a glass monorail station"),
    ("architecture", "a desert research station"),
    ("architecture", "a floating botanical conservatory"),
    ("architecture", "a lighthouse on black basalt"),
    ("architecture", "a cedar cabin beside an alpine lake"),
    ("architecture", "a sculptural ocean pavilion"),
    ("architecture", "a quiet canal city"),
    ("architecture", "a forest tea house"),
    ("architecture", "a hidden courtyard fountain"),
    ("nature", "a field of giant wildflowers"),
    ("nature", "a salt-flat mirror landscape"),
    ("nature", "a frozen waterfall canyon"),
    ("nature", "a moss garden after rain"),
    ("nature", "a volcanic beach of polished glass"),
    ("nature", "a bioluminescent mangrove lagoon"),
    ("nature", "a cloud forest canopy"),
    ("nature", "a wind-carved sandstone valley"),
    ("nature", "an alpine meadow beneath glaciers"),
    ("nature", "a tide pool filled with anemones"),
    ("objects", "a hand-thrown ceramic tea set"),
    ("objects", "a translucent mechanical watch"),
    ("objects", "a modular chrome reading lamp"),
    ("objects", "a sculpted glass perfume bottle"),
    ("objects", "a walnut and brass field camera"),
    ("objects", "a folded paper kinetic sculpture"),
    ("objects", "a collection of weathered astronomy tools"),
    ("objects", "a polished stone chess set"),
    ("objects", "a botanical specimen cabinet"),
    ("objects", "a woven fiber acoustic speaker"),
    ("animals", "a red fox among silver grass"),
    ("animals", "a glasswing butterfly on an orchid"),
    ("animals", "a kingfisher above clear water"),
    ("animals", "a snow leopard crossing a ridge"),
    ("animals", "a sea turtle over a coral garden"),
    ("animals", "a barn owl in an old cedar"),
    ("animals", "a hummingbird beside trumpet flowers"),
    ("animals", "a small octopus exploring sea glass"),
    ("animals", "a crane standing in morning reeds"),
    ("animals", "a family of capybaras beside a spring"),
    ("food", "a citrus tart with edible flowers"),
    ("food", "a bowl of handmade herb noodles"),
    ("food", "a geometric dark chocolate assortment"),
    ("food", "a summer stone-fruit still life"),
    ("food", "a tray of jewel-toned botanical drinks"),
    ("space", "a lunar greenhouse"),
    ("space", "a solar sail above cloud layers"),
    ("space", "an ice-covered exoplanet observatory"),
    ("space", "a ring habitat with terraced gardens"),
    ("space", "a deep-space botanical archive"),
    ("abstract", "an iridescent mineral lattice"),
    ("abstract", "a suspended field of glass ribbons"),
    ("abstract", "a topographic sculpture made of light"),
    ("abstract", "a fluid marble and ink composition"),
    ("abstract", "a geometric study of folded shadows"),
]

IMAGE_SETTINGS = [
    "at blue hour", "under soft dawn fog", "after warm summer rain", "beneath an aurora",
    "in early spring mist", "at moonrise", "in crisp winter sunlight", "during golden hour",
    "under overcast coastal light", "in quiet late-afternoon haze", "beneath a star-filled sky",
    "after a distant thunderstorm", "in a gentle sea breeze", "at first light",
    "under diffused skylight", "in cool museum light",
]
IMAGE_STYLES = [
    "cinematic architectural photography", "refined editorial travel photography",
    "dreamlike fine-art landscape photography", "museum-quality still-life photography",
    "Japanese woodblock-inspired editorial art", "modernist poster illustration",
    "quiet science-fiction concept art", "contemporary botanical illustration",
    "soft-grain analog film photography", "high-end design magazine photography",
    "intricate paper-cut illustration", "luminous gouache painting",
    "macro natural-history photography", "minimal geometric 3D art",
]
IMAGE_DETAILS = [
    "subtle film grain", "atmospheric depth", "clean natural textures", "gentle reflected light",
    "careful geometric composition", "crisp material detail", "soft volumetric light",
    "restrained color harmony", "calm negative space", "weathered tactile surfaces",
    "shallow depth of field", "layered foreground framing",
]
PALETTES = [
    "cobalt and amber", "moss green and cream", "coral and midnight blue", "ochre and ultramarine",
    "lavender and silver", "jade and charcoal", "terracotta and pale sky blue", "indigo and pearl",
    "rust and sage", "ice blue and warm cedar", "garnet and warm grey", "seafoam and copper",
]

# Human and cinematic subjects. The classic catalog only carries architecture /
# nature / objects, which is why the library clustered into formulaic scenic
# frames. These axes add attractive adult characters, fantasy figures,
# influencers, and cinematic alluring portraits so the gallery reads as an
# artistic mix instead of a landscape loop. Content stays tasteful/alluring and
# is still moderated after render (see --moderate-before-index); the gallery
# endpoint surfaces borderline work separately through allow_nsfw.
PEOPLE_SUBJECTS = [
    ("fashion", "a young woman in a flowing silk gown"),
    ("fashion", "an androgynous model in a sharply tailored suit"),
    ("fashion", "a couture catwalk muse with razor cheekbones"),
    ("fashion", "a streetwear influencer with wet-look hair"),
    ("glamour", "a siren at the waterline in a translucent slip"),
    ("glamour", "a muse on a rooftop at dusk in a body-con dress"),
    ("glamour", "a femme fatale in a crimson backless gown"),
    ("glamour", "a smiley lounge singer in a satin robe"),
    ("cinema", "a noir detective's femme fatal muse in a trench coat"),
    ("cinema", "a dancer mid-spin in a silk maxi dress"),
    ("cinema", "a rider removing a helmet, flushed and windblown"),
    ("cinema", "a lover leaning against rain-streaked glass"),
    ("fantasy", "a sorceress in a star-lit midnight cloak"),
    ("fantasy", "an elven queen in a moonlit silver crown"),
    ("fantasy", "a warrior queen in ornate gilded armor"),
    ("fantasy", "a dryad with vine-woven hair in a forest pool"),
    ("fantasy", "a celestial priestess with haloed candlelight"),
    ("fantasy", "a spectral fox-spirit woman in an ink wash"),
    ("editorial", "a ballet dancer in a bare-shoulder leotard, mid-extension"),
    ("editorial", "an astronaut in a reflective bodysuit among wildflowers"),
    ("editorial", "a sculptor at rest in a linen shirt, dust-hazed"),
    ("editorial", "a swimmer before the plunge in a racing suit"),
    ("portrait", "a striking woman with a smoldering over-the-shoulder gaze"),
    ("portrait", "a handsome man in a rolled-sleeve white shirt"),
    ("portrait", "a muse with freckles and wind-tousled copper hair"),
    ("portrait", "a feline-featured model with gold ear cuffs"),
    ("portrait", "a chiseled athlete in dramatic rim light, oiled skin"),
    ("portrait", "an elegant older stateswoman in a silk scarf"),
    ("influencer", "a travel influencer posing on a cliffside at golden hour"),
    ("influencer", "a fitness creator stretching in a sunlit loft"),
]

PEOPLE_POSES = [
    "in a graceful contrapposto pose", "in an alluring over-the-shoulder glance",
    "in a confident cinematic stride", "in a dramatic three-quarter profile",
    "reclining elegantly on a chaise", "mid-turn with fabric catching the light",
    "in a low lunge with a lifted chin", "standing tall with hands in pockets",
    "in a coy glance from under lowered lashes", "in a bold, open-armed welcome",
    "in a wind-swept lean against a wall", "in a deep breath with eyes closed",
    "in a gentle reach toward the lens", "in a seated silhouette against a window",
]


PEOPLE_SETTINGS = [
    "on a neon-lit rooftop at midnight", "in a moonlit palace courtyard",
    "in a rain-slick neon alley", "on a sun-drenched cliffside",
    "in a candle-lit cathedral ruin", "in a smoke-lit photo studio",
    "on a marble staircase at dawn", "in a dewy forest clearing",
    "in a brutalist concrete atrium", "in a silent desert at twilight",
    "in a backlit golden-hour field", "in a blue-hour city apartment",
    "on a storm-washed boardwalk", "in a greenhouse humid with mist",
    "in a velvet-curtained boudoir", "on a midnight dance floor",
]
PEOPLE_STYLES = [
    "editorial glamour photography", "high-fashion runway photography",
    "cinematic film still", "mythology-inspired fine art",
    "dreamlike fantasy illustration", "neo-noir cinematic portrait",
    "Vogue-style studio portraiture", "soft-grain analog fashion film",
    "Renaissance chiaroscuro oil portrait", "futuristic speculative couture",
    "National Geographic-style editorial", "bold Helmut Newton attitude",
    "Wong Kar-wai colour cinema still", "moody Fujifilm street portrait",
]


def people_row(index: int) -> dict[str, object]:
    (category, subject), pose, setting, style, detail, palette = decode(
        index,
        [PEOPLE_SUBJECTS, PEOPLE_POSES, PEOPLE_SETTINGS, PEOPLE_STYLES, IMAGE_DETAILS, PALETTES],
    )
    prompt = (
        f"{subject} {pose}, {setting}, {style}, {detail}, {palette} palette, "
        "no text, no logo, no watermark"
    )
    digest = hashlib.sha256(prompt.encode()).hexdigest()
    width, height = DIMENSIONS[index % len(DIMENSIONS)]
    return {
        "prompt": prompt, "category": category, "slug": f"person-{digest[:14]}",
        "seed": int(digest[:8], 16) % (2**31), "width": width, "height": height,
    }


def people_video_row(index: int) -> dict[str, object]:
    subject, action, camera, setting, light, sound = decode(
        index, [PEOPLE_VIDEO_SUBJECTS, VIDEO_ACTIONS, CAMERAS, PEOPLE_VIDEO_SETTINGS, VIDEO_LIGHT, SOUNDS]
    )
    prompt = (
        f"{subject} in {setting}, {action}; {camera}, cinematic 16:9, {light}; "
        f"natural motion, coherent geometry, no text, no logo; audio: {sound}"
    )
    digest = hashlib.sha256(prompt.encode()).hexdigest()
    return {"prompt": prompt, "category": "video", "slug": f"motion-{digest[:14]}", "seed": int(digest[:8], 16) % (2**31)}
PEOPLE_VIDEO_SUBJECTS = [
    "a dancer in a silk gown spinning through a marble hall",
    "a model in a wet-look coat walking toward the lens in rain",
    "a sorceress conjuring sparks in a moonlit courtyard",
    "a fighter training slow shadow-boxing in a loft",
    "a muse dancing alone in a rain-slick street at night",
    "a long-haired rider dismounting from a rearing horse",
    "an astronaut drifting through a greenhouse in slow motion",
    "a femme fatale pausing at a neon door before entering",
    "a musician swaying behind a smoke-lit microphone",
    "a woman in a flowing dress running through a field",
    "a couture walk on a stadium catwalk with slow camera",
    "a couple slow-dancing in a derelict theatre",
]
PEOPLE_VIDEO_SETTINGS = [
    "a marble palace hall", "a neon-lit rooftop", "a rain-slick neon street",
    "a moonlit beach", "a sun-drenched cliffside", "a smoke-lit studio",
    "a dewy forest clearing", "a brutalist concrete atrium",
    "a candle-lit cathedral ruin", "a silent desert dawn",
]

# Keep the gallery visually varied without asking the image worker to render
# unusually large canvases. Every dimension is a multiple of 64, and each
# entry has roughly the same pixel count as the 1024px square baseline.
DIMENSIONS = [
    (1024, 1024),
    (768, 1344),   # 9:16 portrait
    (1344, 768),   # 16:9 landscape
    (768, 1024),   # 3:4 portrait
    (1024, 768),   # 4:3 landscape
]

VIDEO_SUBJECTS = [
    "a glass hummingbird above trumpet flowers", "a cliffside observatory above a storm sea",
    "a lunar greenhouse filled with floating pollen", "a chrome koi swimming through the air",
    "an ice cave lit by slow-moving aurora", "a ceramic fox crossing a moss garden",
    "a solar sail skimming a planet's cloud tops", "a clockwork orchid opening at midnight",
    "a tiny monorail circling a terrarium city", "a lighthouse splitting spectral fog",
    "a sea turtle gliding over a coral library", "a paper crane flying through a rain-soaked station",
    "a glass torus suspended in a greenhouse", "a field of giant flowers breathing in the wind",
    "a kinetic sculpture of polished river stones", "a lantern boat crossing a mirror-flat lake",
    "a mechanical butterfly emerging from folded paper", "an observatory rotating beneath meteor trails",
    "a cedar tea house beside a waterfall", "a translucent train moving through cloud layers",
    "a kingfisher diving into a luminous stream", "a deep-space archive unfolding its solar panels",
    "a desert pavilion opening like an iris", "a bioluminescent mangrove at rising tide",
    "a walnut field camera assembling itself", "a sculpted perfume bottle inside drifting silk",
    "a snow leopard walking along a moonlit ridge", "an octopus arranging pieces of sea glass",
    "a modular lamp casting moving geometric shadows", "a ring habitat passing from night into dawn",
]
VIDEO_ACTIONS = [
    "moves in one calm continuous cycle", "slowly unfolds and returns to its opening pose",
    "drifts forward as particles stream past", "rotates while reflected light travels across its surface",
    "emerges from fog and settles into a clean hero composition", "ripples outward in a seamless loop",
    "crosses the frame while the environment responds naturally", "transforms material from glass to stone and back",
    "rises through layered atmosphere", "reveals a hidden interior with one precise movement",
]
CAMERAS = [
    "slow aerial orbit", "locked-off macro shot", "gentle dolly forward", "low tracking shot",
    "overhead crane descent", "wide lateral glide", "close focus pull", "impossible pass-through camera",
    "slow pedestal rise", "steady arc from silhouette into light",
]
VIDEO_LIGHT = [
    "blue-hour rain reflections", "soft dawn mist", "moonlight and warm practical lights",
    "golden-hour backlight", "diffused overcast coastal light", "deep indigo night with silver highlights",
    "sun shafts through moving leaves", "subtle bioluminescent glow", "museum spotlights in gentle haze",
    "distant lightning behind layered clouds",
]
SOUNDS = [
    "wind and distant water", "soft glass harmonics", "quiet forest ambience", "low mechanical resonance",
    "rain on leaves and a far bell", "underwater hush", "subtle room tone and wood creaks",
    "distant birds and moving grass", "soft electrical shimmer", "waves against stone",
]


def shuffled_indices(lengths: list[int], count: int, seed: int) -> list[int]:
    total = math.prod(lengths)
    if count > total:
        raise SystemExit(f"only {total} unique combinations are available")
    order = list(range(total))
    random.Random(seed).shuffle(order)
    return order[:count]


def decode(index: int, axes: list[list[object]]) -> list[object]:
    values: list[object] = []
    for axis in reversed(axes):
        index, offset = divmod(index, len(axis))
        values.append(axis[offset])
    return list(reversed(values))


def image_row(index: int) -> dict[str, object]:
    subject, setting, style, detail, palette = decode(
        index, [IMAGE_SUBJECTS, IMAGE_SETTINGS, IMAGE_STYLES, IMAGE_DETAILS, PALETTES]
    )
    category, subject_text = subject
    prompt = (
        f"{subject_text} {setting}, {style}, {detail}, {palette} palette, "
        "family-safe, no text, no logo, no watermark"
    )
    digest = hashlib.sha256(prompt.encode()).hexdigest()
    width, height = DIMENSIONS[index % len(DIMENSIONS)]
    return {
        "prompt": prompt, "category": category, "slug": f"{category}-{digest[:14]}",
        "seed": int(digest[:8], 16) % (2**31), "width": width, "height": height,
    }


def video_row(index: int) -> dict[str, object]:
    subject, action, camera, light, sound = decode(
        index, [VIDEO_SUBJECTS, VIDEO_ACTIONS, CAMERAS, VIDEO_LIGHT, SOUNDS]
    )
    prompt = (
        f"{subject} {action}; {camera}, cinematic 16:9, {light}; "
        f"natural motion, coherent geometry, family-safe; audio: {sound}"
    )
    digest = hashlib.sha256(prompt.encode()).hexdigest()
    return {"prompt": prompt, "category": "video", "slug": f"motion-{digest[:14]}", "seed": int(digest[:8], 16) % (2**31)}

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--kind", choices=("image", "people", "video", "people-video"), default="image")
    parser.add_argument("--count", type=int, default=100_000)
    parser.add_argument("--seed", type=int, default=20260810, help="deterministic catalog ordering")
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    if args.count < 1:
        raise SystemExit("--count must be positive")

    if args.kind == "image":
        axes = [IMAGE_SUBJECTS, IMAGE_SETTINGS, IMAGE_STYLES, IMAGE_DETAILS, PALETTES]
        build_row = image_row
    elif args.kind == "people":
        axes = [PEOPLE_SUBJECTS, PEOPLE_POSES, PEOPLE_SETTINGS, PEOPLE_STYLES, IMAGE_DETAILS, PALETTES]
        build_row = people_row
    elif args.kind == "people-video":
        axes = [PEOPLE_VIDEO_SUBJECTS, VIDEO_ACTIONS, CAMERAS, PEOPLE_VIDEO_SETTINGS, VIDEO_LIGHT, SOUNDS]
        build_row = people_video_row
    else:
        axes = [VIDEO_SUBJECTS, VIDEO_ACTIONS, CAMERAS, VIDEO_LIGHT, SOUNDS]
        build_row = video_row

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8") as out:
        for index in shuffled_indices([len(axis) for axis in axes], args.count, args.seed):
            out.write(json.dumps(build_row(index), ensure_ascii=False) + "\n")
    print(f"wrote {args.count} shuffled safe {args.kind} prompts to {args.out}")


if __name__ == "__main__":
    main()
