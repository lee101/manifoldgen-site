"""Cast cards and per-shot reference boards.

The swap LoRA replaces people left to right in the order they appear in the reference image, so a shot where the
performer in white is on the right needs the board flipped. `Cast` holds one card per replacement identity (a
costume-matched portrait generated from the person's photo) and `board_for` lays them out in a shot's order.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from filmkit.images import gemini_edit
from PIL import Image


@dataclass
class Role:
    """One performer in the source: who they are on screen and who replaces them."""
    key: str            # e.g. "jackie"
    look: str           # costume / hair description of the source performer, used to detect them per shot
    new_name: str       # replacement identity name
    photo: str          # path to a clear face photo of the replacement
    costume: str        # what the replacement wears (matches the source costume)
    strip: str = ""     # features to remove, e.g. "no glasses"


def card_prompt(role: Role, style: str, bust: bool = False) -> str:
    pose = ("head-and-shoulders close-up portrait, face large and sharp filling most of the frame, facing the camera at a slight 3/4 angle" if bust else
            "waist-up, standing facing the camera at a slight 3/4 angle, neutral relaxed pose with hands down")
    base = (f"Character reference card of the person in the photo: {pose}, wearing {role.costume}. Plain mid-grey studio background, soft even light, "
            f"sharp face, exact likeness, identity and hairstyle of the photographed person. No text, labels, captions, logos or writing anywhere in the image.")
    if role.strip:
        base += f" {role.strip}."
    if style == "ghibli":
        base += (" Redraw as a Studio Ghibli hand-painted anime character (Miyazaki style): soft watercolor shading, clean ink lines, "
                 "large expressive eyes, still unmistakably the same person.")
    else:
        base += " Photorealistic, natural skin texture."
    return base


def make_card(role: Role, out: Path, style: str = "real", model: str | None = None, bust: bool = False) -> Path:
    out = Path(out)
    if not out.exists():
        gemini_edit(card_prompt(role, style, bust), [role.photo], out, aspect="1:1" if bust else "3:4", model=model)
    return out


def board_for(cards: list[Path], out: Path, height: int = 768, gap: int = 24, bg=(128, 128, 128), face: bool = False) -> Path:
    """Cards left to right on a flat grey canvas. face=True crops each card to head and shoulders (close-up shots need big reference faces)."""
    ims = []
    for c in cards:
        im = Image.open(c).convert("RGB")
        if face:
            im = im.crop((0, 0, im.width, round(im.height * 0.5)))
        ims.append(im.resize((round(im.width * height / im.height), height), Image.LANCZOS))
    w = sum(i.width for i in ims) + gap * (len(ims) + 1)
    canvas = Image.new("RGB", (w, height + 2 * gap), bg)
    x = gap
    for im in ims:
        canvas.paste(im, (x, gap))
        x += im.width + gap
    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out, quality=95)
    return out


def swap_prompt(order: list[tuple[str, str]], position_words: list[str], keep: str = "") -> str:
    """order: [(source_look, new_name)] left to right in the shot."""
    lines = []
    for (look, name), pos in zip(order, position_words):
        lines.append(f"the {pos} person ({look}) becomes {name}")
    body = "Replace the people in <Video 1> with the characters in <Picture 1>: " + "; ".join(lines) + ". "
    body += ("Keep each replacement's face, hair and identity from <Picture 1> and the source video's clothing, camera, background, lighting, "
             "motion, fight choreography and timing exactly. Match each person's position, scale, pose and movement. "
             "Do not show the reference image or its background.")
    return body + (" " + keep if keep else "")
