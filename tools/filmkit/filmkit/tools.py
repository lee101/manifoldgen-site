"""The agent-facing tool table. One source of truth for the MCP server, `filmkit tools --json`, and the skill."""
from __future__ import annotations

import json
from pathlib import Path

LAYER = {"type": "object", "description": "One animefx layer: {fx, at?, dur?, ease?, mix?, ...effect params}. See animefx_list.",
         "properties": {"fx": {"type": "string"}, "at": {"type": "number"}, "dur": {"type": "number"},
                        "ease": {"type": "string", "enum": ["hold", "in_out", "decay", "pop", "fade_in", "fade_out", "pulse"]},
                        "mix": {"type": "number"}}, "required": ["fx"], "additionalProperties": True}
LAYERS = {"type": "array", "items": LAYER, "description": "Ordered effect layers (first applied first; put on_twos first)."}


def S(**props):
    required = [k for k, v in props.items() if v.pop("required", False)]
    return {"type": "object", "properties": props, "required": required}


def _p(path) -> Path:
    return Path(path).expanduser()


def t_animefx_list(a):
    from .animefx.fx import list_effects
    return list_effects()


def t_animefx_video(a):
    from .animefx.engine import render_video
    return render_video(_p(a["src"]), _p(a["dst"]), {"seed": a.get("seed", 1), "layers": a["layers"]}, crf=a.get("crf", 15))


def t_animefx_still(a):
    from .animefx.engine import render_still
    return {"output": str(render_still(_p(a["src"]), _p(a["dst"]), {"seed": a.get("seed", 1), "layers": a["layers"]}, a.get("t", 0.0)))}


def t_animefx_preview(a):
    from .animefx.cli import main
    argv = ["sheet", a["src"], a["dst"], "--recipe", json.dumps({"layers": a["layers"]}), "--times", a.get("times", "0,0.15,0.4,0.9")]
    main(argv)
    return {"output": a["dst"]}


def t_sfx_list(a):
    from .sfx import list_sfx
    return list_sfx()


def t_sfx_mix(a):
    from .sfx import mix_cues, write_wav
    out = _p(a["out"])
    write_wav(out, mix_cues(a["cues"], a["duration"], out.parent / "sfxcache"))
    return {"output": str(out)}


def t_art_generate(a):
    from .art import generate_art
    r = generate_art(a["prompt"], _p(a["out"]), a["brief"], a.get("checklist", []), ref=_p(a["ref"]) if a.get("ref") else None,
                     identity_refs=[_p(x) for x in a.get("identity_refs", [])], seed=a.get("seed", 1))
    return {k: r[k] for k in ("output", "score", "pass", "lane")}


def t_art_review(a):
    from .review import review_image
    return review_image(_p(a["image"]), a["brief"], a.get("checklist", []), refs=[_p(x) for x in a.get("identity_refs", [])])


def t_art_locate(a):
    from .review import locate
    return {"points": locate(_p(a["image"]), a["what"])}


def t_audio_review(a):
    from .review import review_audio
    return {"answer": review_audio(_p(a["audio"]), a["question"])}


def t_art_restyle(a):
    from .images import gemini_edit
    return gemini_edit(a["prompt"], [_p(x) for x in a["refs"]], _p(a["out"]), a.get("aspect", "16:9"))


def t_image_lightweight(a):
    from .common import lightweight
    return {"output": str(lightweight(_p(a["path"]), max_side=a.get("max_side", 800)))}


def t_video_generate(a):
    from .media import flux3_video
    return flux3_video(a["prompt"], _p(a["out"]), a.get("duration", 5), start=a.get("start"), end=a.get("end"),
                       keyframes=a.get("keyframes"), resolution=a.get("resolution", "720p"), aspect=a.get("aspect", "16:9"))


def t_speech(a):
    from .media import tts
    return tts(a["text"], _p(a["out"]), voice=a.get("voice", "Lively_Girl"), emotion=a.get("emotion", "neutral"), speed=a.get("speed", 1.0))


TOOLS = [
    ("animefx_list", "List every anime/comic/GenAI effect with parameters (surprise shader, speed lines, screentone, onomatopoeia, glass drops, eye glow, on-twos, line boil, ...).", S(), t_animefx_list),
    ("animefx_video", "Render an effect recipe over a video (H.264, audio kept). Layers are time-windowed; ease shapes intensity.",
     S(src={"type": "string", "required": True}, dst={"type": "string", "required": True}, layers={**LAYERS, "required": True}, seed={"type": "integer"}, crf={"type": "integer"}), t_animefx_video),
    ("animefx_still", "Apply a recipe to one image at time t (test a look or finish a still).",
     S(src={"type": "string", "required": True}, dst={"type": "string", "required": True}, layers={**LAYERS, "required": True}, t={"type": "number"}, seed={"type": "integer"}), t_animefx_still),
    ("animefx_preview", "Contact sheet of a recipe on a still at several times. Look at it before rendering video.",
     S(src={"type": "string", "required": True}, dst={"type": "string", "required": True}, layers={**LAYERS, "required": True}, times={"type": "string"}), t_animefx_preview),
    ("sfx_list", "List built-in synth SFX names (servo_whir, metal_click, whoosh, impact_thud, anime_hit, sparkle_chime, heartbeat, surprise_sting, rain_bed, room_tone, chair_creak) and the gen:<prompt> form.", S(), t_sfx_list),
    ("sfx_mix", "Place SFX cues on a timeline and write a stereo 48k wav. cues: [{t, sfx, gain_db?, pan?, dur?, loop?}].",
     S(out={"type": "string", "required": True}, duration={"type": "number", "required": True}, cues={"type": "array", "items": {"type": "object"}, "required": True}), t_sfx_mix),
    ("art_generate", "Concept art with an art-director loop: Qwen Image (text) or Qwen Edit (ref board) -> DeepSeek vision review at 800px webp -> re-roll with fixes -> Google fallback. Writes master PNG + 800px webp.",
     S(prompt={"type": "string", "required": True}, out={"type": "string", "required": True}, brief={"type": "string", "required": True}, checklist={"type": "array", "items": {"type": "string"}},
       ref={"type": "string"}, identity_refs={"type": "array", "items": {"type": "string"}}, seed={"type": "integer"}), t_art_generate),
    ("art_review", "Score one image against a brief and checklist with DeepSeek vision (images re-encoded to <=800px webp first). Returns score, issues, fix_prompt.",
     S(image={"type": "string", "required": True}, brief={"type": "string", "required": True}, checklist={"type": "array", "items": {"type": "string"}}, identity_refs={"type": "array", "items": {"type": "string"}}), t_art_review),
    ("art_locate", "Find normalized [x,y] points of something in an image (eyes, hit point) to aim effects.", S(image={"type": "string", "required": True}, what={"type": "string", "required": True}), t_art_locate),
    ("audio_review", "Ask an audio-capable model about a clip: voice age/emotion, score mood, artifacts. Use it to QA TTS lines and music.", S(audio={"type": "string", "required": True}, question={"type": "string", "required": True}), t_audio_review),
    ("art_restyle", "Google image edit for style transfer, re-angling or identity repair against reference stills.",
     S(prompt={"type": "string", "required": True}, refs={"type": "array", "items": {"type": "string"}, "required": True}, out={"type": "string", "required": True}, aspect={"type": "string"}), t_art_restyle),
    ("image_lightweight", "Re-encode an image as webp with the longest side capped at 800px (default) so it is cheap to show to LLMs and agents.", S(path={"type": "string", "required": True}, max_side={"type": "integer"}), t_image_lightweight),
    ("video_generate", "FLUX 3 Max video on fal: image-to-video (start[,end]) or keyframes-to-video ([{path, frame_index}]); 5-20 s, 720p/1080p.",
     S(prompt={"type": "string", "required": True}, out={"type": "string", "required": True}, duration={"type": "integer"}, start={"type": "string"}, end={"type": "string"},
       keyframes={"type": "array", "items": {"type": "object"}}, resolution={"type": "string"}, aspect={"type": "string"}), t_video_generate),
    ("speech", "Text to speech (MiniMax speech-02-hd on fal) for a character line.", S(text={"type": "string", "required": True}, out={"type": "string", "required": True}, voice={"type": "string"}, emotion={"type": "string"}, speed={"type": "number"}), t_speech),
]
BY_NAME = {n: (d, s, h) for n, d, s, h in TOOLS}


def manifest() -> list[dict]:
    return [{"name": n, "description": d, "inputSchema": s} for n, d, s, _ in TOOLS]
