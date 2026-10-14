---
name: color-grade
description: Grade images and footage to a look (film emulation, teal-orange, bleach bypass, match a reference) with ManifoldGen's browser color-grade tool and export a .cube LUT usable in Resolve, Premiere, Final Cut, OBS or ffmpeg. Use when the user asks for a color grade, LUT, look, or to match colors between shots.
---

# Color Grade

Client-side tool at https://manifoldgen.com/tools/color-grade (canonical status: service table in the `manifoldgen` skill). Runs in the browser, no credits, no API job.

## Ask first
- Source frames or clips, target look or reference image, delivery color space (Rec.709 SDR unless told otherwise), and where the LUT will be used.

## Run
1. Open https://manifoldgen.com/tools/color-grade, load a representative frame or clip and the reference.
2. Adjust (or ask the user to adjust) exposure, contrast, white balance, curves and saturation; compare against the reference.
3. Export the `.cube` LUT.
4. Apply locally and verify:
```bash
ffmpeg -i in.mp4 -vf lut3d=look.cube -c:a copy graded.mp4
```

For a stylized grade on generated media, render first (`mg generate ... --out out/`) then grade. Effects beyond color (glow, grain, halftone, glitch) belong in `shader-fx`.

## Deliver
- The `.cube` file (non-destructive, reusable on every shot), a graded preview, and the ffmpeg or NLE steps to apply it. Keep ungraded originals.
