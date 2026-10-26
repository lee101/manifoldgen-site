"""Anchor frames: the clip's first frame with ONE person already swapped by an image editor (Gemini), so H3 only has to carry the identity
through the motion instead of inventing a face the source's pose/occlusion gives it no reason to change."""
from __future__ import annotations

import subprocess
from pathlib import Path

from filmkit.images import gemini_edit


def first_frame(video, out, t=0.0):
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", f"{t:.3f}", "-i", str(video), "-frames:v", "1", str(out)], check=True)
    return Path(out)


def swap_frame(frame, card, role_look, name, out, aspect="21:9"):
    """Replace the `role_look` person in the frame with the person on the card. Everything else must stay."""
    prompt = (f"Image 1 is a film frame; image 2 is a reference portrait of {name}. Replace ONLY the {role_look} in image 1 with {name}: use the face, hair "
              f"and head of the person in image 2 (exact likeness). Keep the body pose, head angle, expression direction, motion blur, clothing, other "
              f"people, background, framing, camera and lighting of image 1 exactly. Do not add text. Output the full frame.")
    return Path(gemini_edit(prompt, [frame, card], Path(out), aspect=aspect)["output"])
