#!/usr/bin/env python3
"""Shot plan: cut the song at audio keypoints, assign images, write prompts.

Every shot boundary is an onset keypoint, shot lengths are integer 24fps frame
counts, and the shot frames sum exactly to the song length so the recomposed
video lines up with the master audio with zero drift. Each shot asks H3 for a
longer generation than it keeps (the tail is discarded), and the driving audio
chunk is the song under the *generated* window, so consecutive chunks overlap.
"""
from __future__ import annotations

import argparse
import json
import random
import re
from pathlib import Path

from common import FPS, aligned_frames, grid_seconds_at_least

RA1 = Path("/home/lee/code/netwrck/netwrck/migrations/prod_art_generators/out/"
           "prod_art_20260818T081319Z/ra1")
TORENDER = Path("/home/lee/code/netwrck/netwrck/migrations/torender.txt")

CAMERAS = [
    "slow push in",
    "gentle handheld drift to the left",
    "slow orbit to the right",
    "subtle crane up",
    "locked-off frame with living ambience",
    "slow pull back",
]
SINGING = [
    "sings the line straight down the lens, lips and jaw moving in time with the vocal, "
    "breath between phrases, eyes holding the camera",
    "belts the chorus, head tilting back on the long notes, throat and shoulders moving with the phrasing",
    "mouths the lyric quietly at first then opens up, small nods on the beat, expression building",
]
DANCING = [
    "sways and steps to the beat, weight shifting, shoulders and hips rolling with the rhythm",
    "turns and dances slowly through the space, cloth and hair trailing the movement",
    "moves in a loose rhythmic groove, hands rising with the music, head nodding on the downbeat",
]
AMBIENT = "environment alive around them, drifting particles, cloth and hair moving, cinematic lighting"


def load_images() -> list[dict]:
    wanted, seen = [], set()
    for line in TORENDER.read_text().split():
        key = line.strip()
        if not key or key in seen:
            continue
        seen.add(key)
        wanted.append(key)
    images = []
    for key in wanted:
        matches = sorted(RA1.glob(f"{key}_*_film.webp"))
        if not matches:
            raise SystemExit(f"no film render for {key}")
        meta = json.loads(matches[0].with_suffix(".json").read_text())
        images.append({"id": key, "path": str(matches[0]), "prompt": meta["prompt"],
                       "width": meta["width"], "height": meta["height"]})
    return images


def subject_of(prompt: str) -> str:
    head = prompt.split(",")[0].strip()
    return re.sub(r"\s+", " ", head)


def build_prompt(image: dict, singing: bool, index: int) -> str:
    subject = subject_of(image["prompt"])
    action = (SINGING if singing else DANCING)[index % 3]
    camera = CAMERAS[index % len(CAMERAS)]
    return (f"The {subject} {action}. Camera: {camera}. {AMBIENT}. "
            "Performance music video shot, consistent character identity, no text or captions.")


def keypoint_frames(keypoints: list[float], total_frames: int) -> list[int]:
    frames = sorted({min(total_frames, max(0, int(round(t * FPS)))) for t in keypoints})
    if frames[0] != 0:
        frames.insert(0, 0)
    if frames[-1] != total_frames:
        frames.append(total_frames)
    return frames


def vocal_mean(scores: list[float], hop: float, start_s: float, end_s: float) -> float:
    low = max(0, int(start_s / hop))
    high = min(len(scores), max(low + 1, int(end_s / hop)))
    window = scores[low:high]
    return sum(window) / len(window) if window else 0.0


def plan_shots(args, keys: dict) -> list[dict]:
    total_frames = keys["total_frames"]
    boundaries = keypoint_frames(keys["keypoints"], total_frames)
    strength = {int(round(t * FPS)): s for t, s in zip(keys["keypoints"], keys["strengths"])}
    scores, hop = keys["vocal_score"], keys["vocal_hop_seconds"]

    short_min, short_max = int(args.min_shot * FPS), int(args.max_shot * FPS)
    long_min, long_max = int(args.min_long * FPS), int(args.max_long_shot * FPS)
    target = int(args.target_shot * FPS)

    shots: list[dict] = []
    cursor = 0
    longs_left = args.long_shots
    last_long = None
    while cursor < total_frames:
        remaining = total_frames - cursor
        if remaining <= short_max:
            end = total_frames
        else:
            long_pick = None
            spaced = (last_long is None or len(shots) - last_long >= args.long_spacing)
            if longs_left > 0 and len(shots) >= args.long_earliest and spaced:
                span = [b for b in boundaries if long_min <= b - cursor <= long_max]
                # A long take only earns its cost over a calm stretch: few onsets per second.
                calm = [b for b in span
                        if len([x for x in boundaries if cursor < x < b]) / ((b - cursor) / FPS) <= args.calm_density]
                if calm:
                    long_pick = max(calm)
            if long_pick is not None:
                end = long_pick
                longs_left -= 1
                last_long = len(shots)
            else:
                span = [b for b in boundaries if short_min <= b - cursor <= short_max]
                if not span:
                    end = min(cursor + target, total_frames)
                else:
                    end = min(span, key=lambda b: (abs(b - cursor - target) - 6 * FPS * strength.get(b, 0.0)))
        if total_frames - end and total_frames - end < int(args.min_shot * FPS):
            end = total_frames
        use_frames = end - cursor
        start_s = cursor / FPS
        use_s = use_frames / FPS
        chunk_s = grid_seconds_at_least(use_s + args.tail)
        gen_frames = aligned_frames(chunk_s)
        shots.append({
            "index": len(shots),
            "start_frame": cursor,
            "use_frames": use_frames,
            "start_seconds": round(start_s, 4),
            "use_seconds": round(use_s, 4),
            "chunk_seconds": round(chunk_s, 4),
            "chunk_end_seconds": round(min(start_s + chunk_s, keys["duration"]), 4),
            "gen_frames": gen_frames,
            "gen_seconds": round(gen_frames / FPS, 4),
            "discard_seconds": round(gen_frames / FPS - use_s, 4),
            "boundary_strength": round(strength.get(end, 0.0), 4),
            "vocal": round(vocal_mean(scores, hop, start_s, start_s + use_s), 4),
            "long": use_s >= args.min_long,
        })
        cursor = end
    return shots


def assign_images(shots: list[dict], images: list[dict], seed: int) -> None:
    order = list(images)
    random.Random(seed).shuffle(order)
    pool = list(order)
    for shot in shots:
        if not pool:
            pool = [image for image in order if image["id"] != shots[-1]["image_id"]]
        image = pool.pop(0)
        if len(shots) > 1 and shot["index"] and image["id"] == shots[shot["index"] - 1]["image_id"] and pool:
            pool.append(image)
            image = pool.pop(0)
        shot["image_id"] = image["id"]
        shot["image_path"] = image["path"]
        shot["image_prompt"] = image["prompt"]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--keys", type=Path, default=Path("work/keypoints.json"))
    parser.add_argument("--out", type=Path, default=Path("work/plan.json"))
    parser.add_argument("--prompts", type=Path, default=Path("prompts"))
    parser.add_argument("--min-shot", type=float, default=3.0)
    parser.add_argument("--max-shot", type=float, default=5.0)
    parser.add_argument("--target-shot", type=float, default=4.0)
    parser.add_argument("--min-long", type=float, default=6.0)
    parser.add_argument("--max-long-shot", type=float, default=9.0)
    parser.add_argument("--long-shots", type=int, default=2)
    parser.add_argument("--long-earliest", type=int, default=6,
                        help="no long take before this shot index")
    parser.add_argument("--long-spacing", type=int, default=10,
                        help="minimum shots between two long takes")
    parser.add_argument("--calm-density", type=float, default=0.85,
                        help="max onset keypoints per second for a stretch to qualify as a long take")
    parser.add_argument("--tail", type=float, default=0.9,
                        help="minimum generated seconds discarded off the end of every shot")
    parser.add_argument("--vocal-threshold", type=float, default=0.25)
    parser.add_argument("--seed", type=int, default=20260819)
    args = parser.parse_args()

    keys = json.loads(args.keys.read_text())
    images = load_images()
    shots = plan_shots(args, keys)
    assign_images(shots, images, args.seed)

    args.prompts.mkdir(parents=True, exist_ok=True)
    for shot in shots:
        shot["singing"] = shot["vocal"] >= args.vocal_threshold
        shot["prompt"] = build_prompt(
            {"prompt": shot["image_prompt"]}, shot["singing"], shot["index"])
        (args.prompts / f"{shot['index']:03d}_{shot['image_id']}.txt").write_text(shot["prompt"] + "\n")

    used = sum(shot["use_frames"] for shot in shots)
    assert used == keys["total_frames"], (used, keys["total_frames"])
    plan = {
        "audio": keys["audio"],
        "duration": keys["duration"],
        "total_frames": keys["total_frames"],
        "fps": FPS,
        "settings": vars(args) | {"keys": str(args.keys), "out": str(args.out), "prompts": str(args.prompts)},
        "shots": shots,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(plan, indent=1, default=str))
    singing = sum(1 for shot in shots if shot["singing"])
    longs = sum(1 for shot in shots if shot["long"])
    print(f"{args.out}: {len(shots)} shots, {used} frames = {used / FPS:.3f}s "
          f"(audio {keys['duration']:.3f}s), {singing} singing / {len(shots) - singing} dancing, "
          f"{longs} long takes, images used {len({s['image_id'] for s in shots})}/{len(images)}, "
          f"generated seconds {sum(s['gen_seconds'] for s in shots):.1f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
