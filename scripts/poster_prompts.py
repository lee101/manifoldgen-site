#!/usr/bin/env python3
"""Generate ~1000 varied, high-quality widescreen poster prompts for the native
Z-Image-Turbo gateway. Subjects: elegant/attractive/alluring women and men for
DJ / music-video / event poster art. Deterministic (seeded) so the set is stable.

Output: scripts/prompts/poster-prompts.jsonl (one prompt per line, plus optional
seed/size). scripts/prompts/ is gitignored.
"""
from __future__ import annotations

import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "scripts" / "prompts" / "poster-prompts.jsonl"
TARGET = 1000
SEED = 20260821

# --- Subject cores -----------------------------------------------------------
# Elegant / attractive people, deliberately varied gender, vibe, and fashion.
SUBJECTS = [
    # women
    "an elegant woman with sweeping jet-black hair and piercing emerald eyes",
    "a poised femme fatale with a razor-sharp platinum bob and cold silver gaze",
    "a statuesque woman in a liquid crimson gown, alabaster skin, smoky stare",
    "a regal dark-skinned woman crowned in braids of gold wire, high cheekbones",
    "a sleek woman with a shaved undercut and kohl-lined almond eyes",
    "a luminous goddess with silver-sequinned eyeshadow and a knowing half-smile",
    "a porcelain-skinned beauty with cherry-red lips and glassy violet eyes",
    "a fierce woman with copper afro halo, freckles, and a defiant chin-lift",
    "an androgynous beauty with sharp jawline, shaved temples, arched brow",
    "a sun-kissed surfer woman, salt-streaked hair, carefree crooked grin",
    "a mystic woman veiled in silk, shimmering golden pupils, serene face",
    "a high-fashion model with geometric ivory bob and sculpted bone structure",
    "a scarlet-haired vixen with a teasing sideways glance and parted lips",
    "an ice-queen in ivory fur, crystalline blue irises, glacial calm",
    "a noir lounge singer, wave-swept updo, smoky makeup, parted red lips",
    "a cyberpunk hacker queen with glowing circuit tattoos on temple and neck",
    "a warrior princess with braided crown, war-paint streaks, fierce amber eyes",
    "a celestial woman with star-flecked lavender hair and constellations in her eyes",
    "a bohemian dancer with tousled curls, golden hour glow on bare shoulders",
    "an elegant older woman with silver swept hair, sharp tailoring, quiet power",
    # men
    "a chiseled man with tousled dark hair, strong jaw, smoldering amber eyes",
    "a refined gentleman in a velvet blazer, sharp cheekbones, lazy smirk",
    "a tattooed man with shaved head, full sleeve ink, intense blue stare",
    "a brooding man with silver-streaked black hair and glacial grey eyes",
    "a sleek athlete with close-cropped hair, sweat-glazed skin, focused eyes",
    "a bohemian man with shoulder-length waves, linen shirt open at chest",
    "a dangerous man in a black suit, scar through one eyebrow, cold stare",
    "a luminous young man with golden curls, flawless skin, gentle upturned lips",
    "an androgynous man with winged eyeliner, sculpted cheekbones, silver chain",
    "a stoic royal in gilded armour, strong profile, steady ember eyes",
    "a cyberpunk mercenary with chrome jaw implant and sharp green stare",
    "a musician with slicked hair, chain necklace, magnetic crooked grin",
    "an elegant older man with greying temples, three-day stubble, knowing smile",
    "a fantasy prince with flowing white-blond hair and storm-grey eyes",
    "a scholarly rogue with round wire glasses, stubble, warm curious eyes",
    "a bare-chested gladiator with oiled bronze skin and a feral grin",
    "a celestial man with night-sky skin dotted in tiny constellations",
    "a suave magician in a long coat, scarred hands, hypnotic two-tone eyes",
    "a dj silhouetted against light haze, head down, headphones, immersive aura",
    "a wild rocker with ragged curtain of hair, eyeliner, and a snarl",
]

# --- Style / art direction --------------------------------------------------
STYLES = [
    "editorial fashion photography",
    "high-fashion magazine cover art",
    "cinematic key-art poster illustration",
    "hyper-detailed digital painting",
    "concept art for a fantasy film",
    "neo-noir cinematic still",
    "vaporwave dreamscape art",
    "art-deco poster illustration",
    "baroque oil-painting portraiture",
    "golden-age Hollywood glamour",
    "cyberpunk synthwave cover art",
    "dark fantasy key visual",
    "animated cinematic illustration",
    "slick 3d-render key art",
    "art-nouveau poster style",
    "graphic novel cover art",
    "photorealist surrealist portrait",
    "impressionist-lit glamour portrait",
    "silver-screen science-fiction poster",
    "psychedelic rock poster style",
]

# --- Lighting / atmosphere --------------------------------------------------
LIGHTING = [
    "harsh neon rim light cutting through midnight haze",
    "warm golden hour backlight flaring over soft dusk",
    "cold moonlight sculpting a single high-contrast face",
    "strobe-lit club atmosphere with shafts of magenta and cyan",
    "flickering candlelight and heavy velvet shadow",
    "volumetric godrays through smoke and dust",
    "electric teal-and-violet underglow",
    "soft ivory studio key light with a razor rim",
    "spotlight cone in a near-black void",
    "blazing festival strobes and crowd-haze glow",
    "dramatic chiaroscuro with deep umber shadows",
    "ethereal bioluminescent glow from below",
    "silver-blue winter light catching frost and breath",
    "shimmering disco-ball fragments scattered across the frame",
    "steely overcast light with a single warm accent",
]

# --- Mood / expression boosters ---------------------------------------------
MOODS = [
    "a confident, alluring direct gaze at the camera",
    "a teasing half-smile brimming with quiet confidence",
    "an enigmatic, flirtatious sidelong glance",
    "a magnetic, self-possessed stillness that draws the eye",
    "a smoldering intensity and effortless swagger",
    "an inviting, knowing look with parted lips",
    "a coolly defiant stare that owns the frame",
    "a radiant poise that feels both powerful and seductive",
    "a soft, dangerous charm wrapped in elegance",
    "a fearless, cocky energy that begs to be watched",
]

# --- Wardrobe / accessorize (style-specific dressing) -----------------------
WARDROBE = [
    "in a dripping metallic-gold gown",
    "in a tailored black power suit",
    "in shredded latex and chrome jewelry",
    "in a sheer midnight slip cut to the hip",
    "in a velvet suit with a bare chest",
    "draped in translucent silk that catches every light",
    "in a corseted crimson bodice and long gloves",
    "in a leather jacket worn over bare skin",
    "in a feather-trimmed showgirl corset",
    "in an oversized white shirt and nothing else",
    "in bespoke tailoring with a loosened tie",
    "in layered filigree gowns and emerald velvet",
    "in a neon-lit mesh top and silver chains",
    "in a flowing translucent chemise",
    "in sculpted high-fashion armor with gold inlay",
    "in a wet silk shirt clinging to the chest",
]

# --- Fantasy / sci-fi / artistic backdrop -----------------------------------
BACKDROPS = [
    "a rain-slicked neon city reflected in chrome and glass",
    "a colossal concert stage exploding with lasers and crowd silhouettes",
    "an impossible alien skyline under twin moons",
    "a candle-lit baroque palace hall with gilded mirrors",
    "a smoke-choked underground club in a forgotten alley",
    "a celestial observatory above swirling nebulas",
    "a sun-drenched rooftop at golden hour above a sprawling city",
    "a crystalline fantasy cavern glowing from within",
    "a lunar desert under a blood-red sky",
    "a derelict cyber-church lit by stained-glass projections",
    "a windswept coastline under a storm-green sky",
    "a grand art-deco ballroom flooded with violet light",
    "a zero-gravity chamber with drifting metal shards",
    "a neon aquarium wall of slow-swimming bioluminescent fish",
    "an ancient cathedral of bone and marble wrapped in vines",
    "a hyperloop terminal frozen in a lightning storm",
    "a monolithic rave inside a ruined concrete silo",
    "a sunlit orchard of impossible silver-leafed trees",
    "a rooftop helipad under a burning dusk sky",
    "a velvet-draped opium-den living room with projector light",
]

# --- Shared quality / poster boilerplate ------------------------------------
QUALITY = (
    "ultra-detailed, rich color grading, sharp focus, subtle film grain, "
    "widescreen cinematic 16:9 poster composition, dramatic negative space "
    "for title typography, festival poster key art, no text, no watermark"
)

NEGATIVE = (
    "text, watermark, logo, signature, blurry, low quality, deformed hands, "
    "extra fingers, bad anatomy, cropped head, distorted face"
)


def build(prompt_seed: int) -> str:
    rng = random.Random(prompt_seed)
    subject = rng.choice(SUBJECTS)
    style = rng.choice(STYLES)
    lighting = rng.choice(LIGHTING)
    mood = rng.choice(MOODS)
    wardrobe = rng.choice(WARDROBE)
    backdrop = rng.choice(BACKDROPS)
    return (
        f"striking festival poster art, {subject} {wardrobe}, {mood}, "
        f"{style}, {lighting}, set against {backdrop}, {QUALITY}"
    )


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    rng = random.Random(SEED)
    prompts: dict[str, int] = {}
    guard = 0
    # Draw combinations until we have TARGET unique prompts, with per-prompt
    # seeds for reproducible variation. Bounded loops avoid runaway.
    while len(prompts) < TARGET and guard < TARGET * 12:
        guard += 1
        prompt_seed = rng.randint(0, 2**31 - 1)
        prompt = build(prompt_seed)
        if prompt in prompts:
            continue
        prompts[prompt] = prompt_seed
        if len(prompts) >= TARGET:
            break
    assert len(prompts) >= TARGET, f"only generated {len(prompts)} unique prompts"
    lines = []
    # deterministic ordering by digest for stable mapping between seed and prompt
    for p, s in sorted(prompts.items(), key=lambda kv: kv[1]):
        lines.append(
            json.dumps(
                {"prompt": p, "seed": s, "width": 1152, "height": 640},
                ensure_ascii=False,
            )
        )
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {len(lines)} prompts to {OUT}")


if __name__ == "__main__":
    main()