#!/usr/bin/env python3
"""Compose once, then benchmark Music3 caption-detail ablations at a fixed seed."""

import argparse
import json
import os
import pathlib
import time
import urllib.request

import music3_bench as bench


ROOT = pathlib.Path(__file__).resolve().parents[1]
SYSTEM = """Write production-ready inputs for MiniMax Music 3. Return only JSON with title, tags, lyrics, global_metadata, vocal_details, arrangement. Every value must be a JSON string, never an array or nested object. Lyrics use section tags alone on lines and end with an [outro] plus closing lines; write enough lyrics for the requested duration. global_metadata must contain Basic Attributes (numeric bpm, key, major/minor, genre), Global Emotional Progression, Application Scenarios & Imagery, and Sonics & Production Profile. vocal_details must contain Vocal Gender & Timbre, Vocal Style, Harmony/Backing Vocals, and Vocal FX. arrangement must contain Instrument Lifecycle Description (Primary/Secondary Layering), Groove & Foundation Progression, and Embellishments, Textures & Spatial FX. Explicitly describe what enters, exits, or intensifies in every lyric section. Be concrete, coherent, and musical; total caption 250-400 words. Keep a continuous audible musical bed, stable full-range tonality, clear transients and centered intelligible vocals. Do not request dropouts, mutes, hard gates, abrupt level jumps, underwater filtering, pitch instability, tape damage, glitch cuts, extreme phase effects or masking reverb/delay unless explicitly requested. Never name or imitate real artists. Do not copy lyric lines into the caption."""


def compose(idea: str, duration: int) -> tuple[dict, float]:
    key = os.environ["OPENPATHS_API_KEY"]
    model = os.environ.get("MUSIC_COMPOSER_MODEL", "deepseek-v4-flash")
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": f"Song idea: {idea}\nTarget duration: {duration} seconds. The song has sung vocals."},
        ],
        "temperature": 0.75,
        "response_format": {"type": "json_object"},
        "thinking": {"type": "disabled"},
    }
    request = urllib.request.Request(
        os.environ.get("OPENPATHS_BASE_URL", "https://openpaths.io").rstrip("/") + "/v1/chat/completions",
        data=json.dumps(payload).encode(), method="POST",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json", "Accept": "application/json", "User-Agent": "manifoldgen-music-composer/1.0"},
    )
    started = time.monotonic()
    with urllib.request.urlopen(request, timeout=60) as response:
        answer = json.loads(response.read())
    elapsed = time.monotonic() - started
    content = answer["choices"][0]["message"]["content"]
    return json.loads(content[content.index("{"):content.rindex("}") + 1]), elapsed


def field_text(value) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, dict):
        return " ".join(f"{str(key).replace('_', ' ').title()}: {field_text(item)}" for key, item in value.items())
    if isinstance(value, list):
        return "\n".join(field_text(item) for item in value)
    return str(value)


def prepare_endpoint(endpoint: str, idle_timeout: int = 5) -> None:
    base = os.environ.get("H3_RUNPOD_CONTROL_URL", "https://rest.runpod.io/v1").rstrip("/")
    key = os.environ.get("RUNPOD_API_KEY") or os.environ["H3_RUNPOD_API_KEY"]
    payload = {"workersMax": 1, "idleTimeout": idle_timeout, "flashboot": True, "scalerType": "REQUEST_COUNT", "scalerValue": 1}
    request = urllib.request.Request(f"{base}/endpoints/{endpoint}", data=json.dumps(payload).encode(), method="PATCH",
                                     headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=30) as response:
        response.read()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--idea", default="A nocturnal synth-pop anthem about realizing that observing your own life changes it, intimate female verses opening into a huge bittersweet chorus, analog synths and live drums")
    parser.add_argument("--duration", type=int, default=45)
    parser.add_argument("--seed", type=int, default=20260828)
    parser.add_argument("--endpoint")
    parser.add_argument("--output-dir", type=pathlib.Path)
    args = parser.parse_args()
    bench.load_env(ROOT / ".env")
    bench.load_env(pathlib.Path("/vfast/data/code/omniserve-native/.runpod-music3.env"))
    endpoint = args.endpoint or os.environ["MUSIC3_RUNPOD_ENDPOINT_ID"]
    prepare_endpoint(endpoint)
    stamp = time.strftime("%Y-%m-%d-%H%M%S")
    output_dir = args.output_dir or ROOT / "experimentresults" / f"music3-prompt-expansion-{stamp}"
    output_dir.mkdir(parents=True, exist_ok=True)

    song, compose_seconds = compose(args.idea, args.duration)
    for field in ("title", "tags", "lyrics", "global_metadata", "vocal_details", "arrangement"):
        song[field] = field_text(song[field])
    variants = {
        "a-direct": args.idea,
        "b-metadata-vocals": "\n".join([song["global_metadata"], song["vocal_details"]]),
        "c-full-lifecycle": "\n".join([song["global_metadata"], song["vocal_details"], song["arrangement"]]),
    }
    manifest = {
        "hypothesis": "Training-shaped caption detail improves arrangement and vocal coherence without changing inference settings.",
        "controlled": {"endpoint": endpoint, "duration": args.duration, "seed": args.seed, "lyrics": song["lyrics"]},
        "idea": args.idea, "composition": song, "compose_seconds": round(compose_seconds, 3), "variants": variants,
    }
    (output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    summary = []
    old_out = bench.OUT
    bench.OUT = output_dir
    try:
        for name, caption in variants.items():
            upload, public, fetch = bench.presign(f"createdmusic/ablation-{name}-{int(time.time())}.wav")
            body = {"workload": "minimax-music3", "prompt": caption, "lyrics": song["lyrics"],
                    "duration_seconds": args.duration, "seed": args.seed,
                    "output_upload_url": upload, "output_public_url": public}
            state = bench.run(name, endpoint, body, poll=5)
            if state.get("status") != "COMPLETED":
                raise RuntimeError(f"{name} failed: {json.dumps(state)[:1000]}")
            bench.save(name, state, fetch)
            metrics = (state.get("output") or {}).get("metrics") or {}
            summary.append({"variant": name, "caption_chars": len(caption), "wall_seconds": state.get("_wall_seconds"),
                            "generation_seconds": metrics.get("generation_seconds"), "audio_seconds": metrics.get("duration_seconds"),
                            "realtime_factor": metrics.get("realtime_factor")})
    finally:
        bench.OUT = old_out
    (output_dir / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    rows = "\n".join(f"| {x['variant']} | {x['caption_chars']} | {x['generation_seconds']} | {x['realtime_factor']} | |" for x in summary)
    (output_dir / "README.md").write_text(
        "# MiniMax Music 3 prompt expansion ablation\n\nSame endpoint, seed, duration, and lyrics; only caption detail changes.\n\n"
        "| Variant | Caption chars | GPU generation seconds | Realtime factor | Listening notes |\n|---|---:|---:|---:|---|\n" + rows + "\n",
        encoding="utf-8",
    )
    print(output_dir)


if __name__ == "__main__":
    main()
