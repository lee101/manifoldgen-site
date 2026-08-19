#!/usr/bin/env python3
"""Render planned shots on the production RunPod H3 endpoint.

Per shot: cut the overlapping driving-audio chunk, upload it and the still to
R2, submit an audio-driven (Ref2VA) image-to-video job, then pull the clip back
to work/clips. Re-running skips shots that already have a clip.
"""
from __future__ import annotations

import argparse
import concurrent.futures as futures
import json
import threading
import time
import uuid
from pathlib import Path

import common
from common import FPS

PRINT_LOCK = threading.Lock()


def log(message: str) -> None:
    with PRINT_LOCK:
        print(message, flush=True)


RETRYABLE = (
    "CUDA-capable device(s) is/are busy or unavailable",
    "ComfyUI exited during startup",
    "CUDA error",
    "out of memory",
    "worker exited",
)


def failure_summary(state: dict) -> str:
    return str(state.get("error") or (state.get("output") or {}).get("error") or state.get("status"))[:300]


def retryable(state: dict) -> bool:
    if state.get("status") in {"FAILED", "TIMED_OUT"}:
        detail = json.dumps(state.get("error") or "") + json.dumps(state.get("output") or {})
        return any(marker in detail for marker in RETRYABLE)
    return False


def cut_chunk(audio: Path, start: float, seconds: float, destination: Path) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    common.run([
        "ffmpeg", "-y", "-v", "error", "-ss", f"{start:.4f}", "-i", str(audio),
        "-t", f"{seconds:.4f}", "-af", "apad", "-t", f"{seconds:.4f}",
        "-ac", "2", "-ar", "32000", "-c:a", "pcm_s16le", str(destination),
    ])
    return destination


def render_shot(shot: dict, args, plan: dict, run_prefix: str) -> dict:
    index = shot["index"]
    clip = args.clips / f"{index:03d}_{shot['image_id']}.webm"
    record_path = args.jobs / f"{index:03d}.json"
    if clip.exists() and record_path.exists() and not args.force:
        log(f"[{index:03d}] cached {clip.name}")
        return json.loads(record_path.read_text())

    audio = Path(plan["audio"])
    chunk = cut_chunk(audio, shot["start_seconds"], shot["chunk_seconds"],
                      args.chunks / f"{index:03d}.wav")
    measured = common.probe_duration(chunk)
    expected = common.aligned_frames(measured)
    if expected != shot["gen_frames"]:
        log(f"[{index:03d}] chunk {measured:.3f}s snaps to {expected} frames, plan expected {shot['gen_frames']}")

    image = Path(shot["image_path"])
    if args.dry_run:
        log(f"[{index:03d}] dry-run {shot['chunk_seconds']:.2f}s chunk -> {expected} frames, "
            f"keeps {shot['use_seconds']:.2f}s, still {image.name}")
        return {"index": index, "dry_run": True}
    image_url = common.upload(image, f"{run_prefix}/stills/{index:03d}{image.suffix}")
    audio_url = common.upload(chunk, f"{run_prefix}/chunks/{index:03d}.wav")
    output_key = f"{run_prefix}/clips/{index:03d}-{uuid.uuid4().hex}.webm"
    payload = {"input": {
        "prompt": shot["prompt"],
        "first_frame": image_url,
        "audio": audio_url,
        "aspect_ratio": args.aspect,
        "size": args.size,
        "steps": args.steps,
        "seed": args.seed + index,
        "structured_prompt": True,
        "include_audio": True,
        "output_codec": "webm-av1",
        "encode_quality": args.quality,
        "_output_upload_url": common.presign_put(output_key),
        "_output_public_url": common.public_url(output_key),
    }}
    started = time.time()
    attempts = 0
    while True:
        attempts += 1
        job_id = common.submit(args.endpoint, payload)
        log(f"[{index:03d}] submitted {job_id} ({shot['use_seconds']:.2f}s kept of "
            f"{shot['gen_seconds']:.2f}s, attempt {attempts})")
        state = common.wait(args.endpoint, job_id, timeout=args.timeout, log=log)
        if state.get("status") == "COMPLETED" or attempts > args.retries:
            break
        if not retryable(state):
            break
        log(f"[{index:03d}] infrastructure failure, retrying: {failure_summary(state)}")
        time.sleep(args.retry_delay)
    output = state.get("output") or {}
    record = {
        "index": index,
        "job_id": job_id,
        "attempts": attempts,
        "status": state.get("status"),
        "delay_ms": state.get("delayTime"),
        "execution_ms": state.get("executionTime"),
        "wall_seconds": round(time.time() - started, 2),
        "image_url": image_url,
        "audio_url": audio_url,
        "prompt": shot["prompt"],
        "moderation": output.get("moderation"),
        "metrics": output.get("metrics"),
        "error": state.get("error"),
    }
    artifacts = output.get("outputs") or []
    if state.get("status") != "COMPLETED" or not artifacts:
        record["clip"] = None
        args.jobs.mkdir(parents=True, exist_ok=True)
        record_path.write_text(json.dumps(record, indent=1))
        log(f"[{index:03d}] FAILED {state.get('status')} {record['moderation'] or record['error']}")
        return record
    args.clips.mkdir(parents=True, exist_ok=True)
    args.jobs.mkdir(parents=True, exist_ok=True)
    record["artifact_url"] = artifacts[0].get("url")
    record_path.write_text(json.dumps(record, indent=1))
    common.download(artifacts[0]["url"], clip)
    record["clip"] = str(clip)
    record["clip_seconds"] = common.probe_duration(clip)
    record["artifact"] = {key: artifacts[0].get(key) for key in ("url", "bytes", "sha256")}
    args.jobs.mkdir(parents=True, exist_ok=True)
    record_path.write_text(json.dumps(record, indent=1))
    log(f"[{index:03d}] done {record['clip_seconds']:.2f}s in {record['wall_seconds']:.0f}s -> {clip.name}")
    return record


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--plan", type=Path, default=Path("work/plan.json"))
    parser.add_argument("--clips", type=Path, default=Path("work/clips"))
    parser.add_argument("--chunks", type=Path, default=Path("work/chunks"))
    parser.add_argument("--jobs", type=Path, default=Path("work/jobs"))
    parser.add_argument("--shots", default="", help="comma/dash list of shot indices, default all")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--endpoint", default="")
    parser.add_argument("--size", default="balanced", choices=["preview", "balanced", "native"])
    parser.add_argument("--aspect", default="16:9")
    parser.add_argument("--steps", type=int, default=20)
    parser.add_argument("--quality", type=int, default=24)
    parser.add_argument("--seed", type=int, default=20260819)
    parser.add_argument("--concurrency", type=int, default=1)
    parser.add_argument("--workers-max", type=int, default=2)
    parser.add_argument("--timeout", type=int, default=3600)
    parser.add_argument("--retries", type=int, default=3,
                        help="resubmits allowed when a worker fails for infrastructure reasons")
    parser.add_argument("--retry-delay", type=int, default=20)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--keep-warm", action="store_true", help="leave the endpoint scaled up on exit")
    parser.add_argument("--run-id", default="", help="R2 prefix suffix, defaults to the plan audio stem")
    args = parser.parse_args()

    common.load_env()
    config = common.runpod_config()
    args.endpoint = args.endpoint or config["endpoints"][0]["id"]
    plan = json.loads(args.plan.read_text())
    shots = plan["shots"]
    if args.shots:
        wanted: set[int] = set()
        for part in args.shots.split(","):
            if "-" in part:
                low, high = part.split("-")
                wanted.update(range(int(low), int(high) + 1))
            elif part.strip():
                wanted.add(int(part))
        shots = [shot for shot in shots if shot["index"] in wanted]
    if args.limit:
        shots = shots[:args.limit]
    if not shots:
        raise SystemExit("no shots selected")

    run_id = args.run_id or Path(plan["audio"]).stem
    prefix = f"{common.required('R2_PATH_PREFIX').strip('/')}/audio-images-to-vid/{run_id}"

    previous_max = 0
    if not args.dry_run:
        previous_max = common.endpoint_workers_max(args.endpoint)
        if previous_max < args.workers_max:
            common.activate(args.endpoint, args.workers_max)
            log(f"endpoint {args.endpoint} scaled to {args.workers_max} workers (was {previous_max})")

    records = []
    try:
        if args.concurrency > 1:
            with futures.ThreadPoolExecutor(max_workers=args.concurrency) as pool:
                records = list(pool.map(lambda shot: render_shot(shot, args, plan, prefix), shots))
        else:
            records = [render_shot(shot, args, plan, prefix) for shot in shots]
    finally:
        if not args.dry_run and previous_max == 0 and not args.keep_warm:
            try:
                common.scale_to_zero_if_idle(args.endpoint)
                log(f"endpoint {args.endpoint} released back to zero workers")
            except Exception as error:  # noqa: BLE001
                log(f"endpoint release failed: {error}")

    ok = [record for record in records if record.get("clip")]
    log(f"rendered {len(ok)}/{len(records)} shots into {args.clips}")
    total = sum(record.get("wall_seconds", 0) for record in records)
    if total:
        log(f"wall {total:.0f}s, mean {total / max(1, len(records)):.0f}s per shot at {FPS}fps")
    return 0 if len(ok) == len(records) else 1


if __name__ == "__main__":
    raise SystemExit(main())
