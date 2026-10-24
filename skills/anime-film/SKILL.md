---
name: anime-film
description: Produce a consistent-character anime or comic short end to end - concept art (Qwen Image / Qwen Edit, Google restyle) with an LLM art-director review loop at 800px webp, FLUX 3 Max video, animefx anime/comic/GenAI effect layers (surprise shader, speed lines, screentone, onomatopoeia, glass drops, on-twos), generated SFX/foley, YuE music. Use for anime shorts, comic-style edits, trailers that must keep character designs locked, or when an agent needs the filmkit tools.
---

# Anime film production (filmkit)

Source: `tools/filmkit` in the manifoldgen-site repo (`uv run filmkit tools`, `uv run animefx list`). The same tools are served to agents over MCP: `uv run --project tools/filmkit filmkit mcp` (stdio). Worked example: `testvids/physical` (PHYSICAL, 3:00).

## Pipeline (do it in this order)
1. **Bible**: one locked style paragraph + one locked description per character + a lock checklist per character (hair, eyes, clothes, props). Reuse the wording verbatim in every prompt.
2. **Sheets and plates** (`art_generate`): character sheets (front / three-quarter / face) and one background plate per location, no people. Qwen Image 2.1 on omniserve-native (`RA2_URL`, default :8792; one image at a time, serialised by a file lock). Each take is scored by DeepSeek vision; the loop re-rolls with the reviewer's `fix_prompt` appended; if Qwen cannot reach the bar it hands the best take plus the sheets to Google (`gemini-3-pro-image`). Masters are PNG; every review image is a <=800px webp.
3. **Shot keyframes**: `art_generate` with `ref` = a board (`filmkit.images.board`) of `[character sheets..., location plate]` so Qwen Edit carries identity and place. Review against the checklist. Use `art_restyle` (Google) for style transfer or when a different camera angle is needed.
4. **Video**: `video_generate` (FLUX 3 Max image-to-video, 5-20 s, 720p). Describe motion only; the first frame carries the design. Gen length >= cut length; trim in assembly.
5. **Look**: `animefx_preview` on a keyframe, then `animefx_video`. Order: `on_twos`, `line_boil`, `ink_edges`, grade, beat effects, bloom, chromatic, vignette, grain, fades. Aim effects with `art_locate` (eyes, faces, hit points).
6. **Sound**: `sfx_mix` cues (synth: servo_whir, metal_click, whoosh, impact_thud, anime_hit, sparkle_chime, heartbeat, surprise_sting, rain_bed, chair_creak; or `gen:<prompt>` foley, cached). Speech with `speech`; check it with `audio_review`.
7. **Music**: `mg generate music` (YuE backend when configured). No lyrics = instrumental. For a spoken track that must become a song, generate speech first, then run it through lyrics-to-song / voice swap.

## animefx effects (all deterministic per seed and frame)
- finish: grain, bloom, chromatic, vignette, grade, letterbox, fade
- camera: handheld, push_in
- anime: on_twos, line_boil, ink_edges, cel
- comic: screentone, comic_panels, speed_lines, impact_burst, flash (white/black/invert/negative impact frame), onomatopoeia, sparkle, sweatdrop
- genai: surprise (the surprise shader), doki (heartbeat), glitch, eye_glow
- atmosphere: rain, glass_drops, bokeh, light_leak

Layer = `{"fx", "at", "dur", "ease", "mix", ...params}`; `ease` is hold | in_out | decay | pop | fade_in | fade_out | pulse. `mix` scales the layer, so 0.5 is a restrained version of any effect.

## Rules that kept the film consistent
- Never describe a character differently between shots; paste the lock text.
- Reviewer threshold 0.78-0.8; always show the reviewer the sheets as identity refs.
- Keep comic/anime emphasis to the 2-4 emotional beats; everything else is quiet finishing.
- Render FX per shot in parallel (`render_batch`), then concat; do not re-encode the master more than once.
