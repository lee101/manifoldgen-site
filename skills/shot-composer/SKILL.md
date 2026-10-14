---
name: shot-composer
description: Composite a subject from one video onto a new background (image, video or generated plate) with an AI matte or chroma key, color matching, light wrap, shadow and grain, returning the composite MP4 plus editable layers and a Studio project. Use for VFX composites, green-screen replacement, putting a person or product into a new location, or After Effects-style shot compositing.
---

# Shot Composer

Service `shot-composer`, MCP `composite_shot` (canonical names: service table in the `manifoldgen` skill). Async job, max 30 s. AI matte: background-removal per-second rate + $0.10; chroma key: $0.10 + $0.01/s; +$0.04 for a generated background. Confirm with `list_services`.

## Ask first
- Subject clip, background (still, video, or a description to generate), green/blue screen or not, placement (`position`, `scale`), look (`match_color`, `light_wrap`, `grain`, `shadow`), keep audio.

## Run
```bash
mg generate shot-composer --video subject.mp4 --image plate.jpg --params '{"position":"bottom","scale":0.85,"light_wrap":0.4,"grain":0.25}' --wait --out out/comp
```
Green screen: add `"key":"chroma","key_color":"green"` (cheaper, no AI). Generated plate: `--prompt "misty glacier valley at sunrise"`.
MCP: `composite_shot {"video_url":"...","image_url":"...","position":"bottom","wait_seconds":300}`.

## Deliver
- `video_url` composite, `fg_alpha_url` (transparent WebM layer), `background_url`, `lut_url` (the color match as .cube) and the Studio project so layers stay editable; refine there with grade, keys and blend modes. For multi-shot sequences, assemble finished shots with the `timeline-edit` skill.
