---
name: image-fixer
description: Repair and finish images with ManifoldGen. Fix artifacts, hands, faces or text with targeted edits, remove backgrounds, relight, outpaint, resize for placements and upscale, delivered as separate PNG layers. Use when the user wants an image fixed, retouched, cleaned up, extended, resized for ads/socials or prepared for print.
---

# Image Fixer

A workflow over existing services (canonical names: service table in the `manifoldgen` skill): `image-edit`, `remove-background`, `relight`, `extend-image`, `smart-resize`, `upscale-image`. For precise masked fixes use https://manifoldgen.com/tools/inpaint.

## Ask first
- What is wrong (hands, face, text, artifact, background, lighting, crop) and what must not change.
- Target sizes/aspect ratios, final resolution, transparent background needed?
- Output: flattened PNG or separate layers (cutout, background, fixes) to assemble in Photoshop/Figma.

## Run (price each step with `mg pricing <service>`; total before starting)
```bash
mg generate image-edit --image in.png --prompt "fix the hands: natural five fingers, same pose, change nothing else" --out out/fix
mg generate remove-background --image out/fix/<fixed>.png --out out/layers
mg generate relight --image in.png --prompt "soft window light from left" --out out/fix
mg generate extend-image --image in.png --expand-left 0.25 --expand-right 0.25 --out out/fix
mg generate smart-resize --image in.png --target-sizes '["1080x1920","1200x628"]' --out out/sizes
mg generate upscale-image --image out/fix/<fixed>.png --out out/final
```
MCP: `generate_media {"service":"image-edit","image_url":"...","prompt":"..."}`.

## Deliver
- Keep every intermediate PNG in `out/` and list them as layers: original, fixed, cutout (transparent), upscaled. Mention that generative edits can change fine details and text; ask the user to review before publishing.
