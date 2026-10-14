---
slug: hosted-blender-production-tools-mcp
title: Hosted Blender, vectorizing and video cleanup tools for AI agents (MCP + REST)
description: ManifoldGen runs headless Blender, a layered SVG tracer, photo-to-3D, an AI video object eraser, a footage sorter and a shot compositor behind one API key. Agents call them over MCP at manifoldgen.com/api/mcp or REST and get MP4s plus editable .blend, GLB and SVG files, with no local Blender, Illustrator or After Effects install.
read_when: An agent or developer needs Blender destruction, exploded views, toon shading, scripted 3D scenes, raster-to-vector conversion, video object removal, footage binning and audio sync, or keyed composites without installing desktop apps, and wants editable outputs and per-job prices.
---

ManifoldGen's production tools are hosted versions of the jobs people normally do by hand in Blender, Illustrator and After Effects. Each job runs on ManifoldGen servers and returns finished media plus an editable project file, billed per job from prepaid credits. You are charged only when a job completes.

## Tools

| MCP tool | REST service | Output | Price |
| --- | --- | --- | --- |
| blender_destruction | destruction-studio | MP4, poster, baked .blend | $0.40 (+$0.06 photo to 3D, +$0.20 high) |
| blender_exploded_view | exploded-view | MP4, poster, .blend | $0.40 |
| blender_toon_shader | toon-shader | MP4 turntable, .blend with editable materials | $0.30 |
| blender_render_scene | blender-scene | MP4, poster, .blend from a JSON scene spec | $0.30 |
| image_to_3d | image-to-3d | textured GLB | $0.06 ($0.45 high) |
| vectorize_image | vectorize | SVG with one layer per color | $0.02 ($0.03 AI tracer) |
| remove_video_objects | shot-cleanup | cleaned MP4 with the original audio | $0.24 per second, up to 30 s |
| organize_footage | footage-sorter | bins, audio sync offsets, FCPXML 1.10, OTIO, Studio project, contact sheet, JSON report | $0.05 + $0.02 per clip, up to 24 clips |
| composite_shot | shot-composer | composite MP4, alpha WebM, background, color-match .cube LUT, Studio project | $0.10 + the video background removal per-second rate (AI matte) or + $0.01 per second (chroma key); +$0.04 for a generated background; up to 30 s |

Color grading (.cube LUT export) and shader effects run in the browser at /tools/color-grade and /tools/shader-fx at no per-job charge.

## Connect

    claude mcp add --transport http manifoldgen https://manifoldgen.com/api/mcp --header "Authorization: Bearer $MANIFOLDGEN_API_KEY"

The server also lists guided workflows through prompts/list: production-bundle, destruction-studio, exploded-view, scene-builder, toon-shader, shot-cleanup, shot-composer, footage-sorter, vectorize, image-fixer, color-grade and shader-fx.

The same tools work from the terminal (`npm i -g manifoldgen-cli`, `mg auth login`, `mg generate <service> ... --wait --out dir`) and as agent skills (`npx skills add manifoldgen/skills`).

## Typical agent flow

1. Call list_services to see current prices and parameters.
2. For local files, call create_upload, then PUT the file to the returned upload_url.
3. Call the tool. For example, blender_destruction with {"subject":"tower","material":"brick","impact":"ball","quality":"draft","wait_seconds":300}.
4. If the job is still running, call wait_for_job. The finished job returns video_url, poster_url and blend_url.

REST works the same way:

    curl -X POST https://manifoldgen.com/api/service \
      -H "Authorization: Bearer $MANIFOLDGEN_API_KEY" -H 'Content-Type: application/json' \
      -d '{"service":"destruction-studio","params":{"subject":"tower","material":"brick","impact":"ball"}}'

Then poll /api/video-jobs/{job_id}.

## Remote Blender scene spec

blender-scene takes declarative data, not Python, so a scene can be described safely. A spec lists objects (cube, sphere, cylinder, cone, torus, plane, text, or model by model_index into model_urls), each with a location, rotation, scale, material and keyframes. It also sets lights, the camera (location, look_at, lens, keyframes), the world (color, strength or a studio/sky/night/sunset preset) and the frame count. Limits are 64 objects and 64 keyframes per object. The .blend that comes back opens in desktop Blender for further editing.

## Limits

- Renders: 2-8 s. Draft is about 540p, standard 720p, high 1080p.
- Models: .glb, .obj, .fbx, .stl or .ply, up to 200 MB.
- Video cleanup: name the object in a short prompt (person, car, logo) for clips up to 30 s. Points on the first frame work for clips up to 4.8 s.
- Failed jobs are not charged.
- Footage sorter: up to 24 video or audio clips, 2 GB total; audio sync searches ±60 s and leaves low-confidence clips unsynced.

## Guides

Walkthroughs with real outputs for every tool: https://manifoldgen.com/blog/hosted-production-suite-higgsfield-alternative
