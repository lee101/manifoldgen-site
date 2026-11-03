#!/usr/bin/env python3
"""Adapt each RunPod Serverless endpoint's idleTimeout to its recent traffic.

Quiet endpoints scale down after a few seconds; busy ones keep workers warm
longer so bursts do not pay repeated cold starts. The rate is an exponentially
weighted jobs/minute estimate from the queue health counters (time constant
RUNPOD_ADAPTIVE_IDLE_TAU_MIN, 15). Raising the timeout applies immediately;
lowering it needs RUNPOD_ADAPTIVE_IDLE_DOWN_CHECKS (3) consecutive lower
targets. Endpoints with workersMax=0 are left alone.

RUNPOD_ADAPTIVE_IDLE_BOUNDS: JSON {"name-prefix": [min_s, max_s]} overrides.
RUNPOD_ADAPTIVE_IDLE_EXCLUDE: comma-separated name prefixes never touched.
Dry-run is the default.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import os
import pathlib
from typing import Any

from runpod_cost_guard import REST_BASE, load_env, normalize_list, patch_endpoint, queue_health, read_state, request_json, write_state

TIERS = ((10.0, 120), (3.0, 60), (1.0, 30), (0.5, 15), (0.0, 5))
DEFAULT_BOUNDS = (5, 120)
BUSY_FLOOR = 30


def tier(rate: float) -> int:
    return next(idle for floor, idle in TIERS if rate >= floor)


def bounds(name: str, overrides: dict[str, list[int]]) -> tuple[int, int]:
    best = max((prefix for prefix in overrides if name.startswith(prefix)), key=len, default=None)
    if best is None:
        return DEFAULT_BOUNDS
    low, high = overrides[best]
    return int(low), int(high)


def update_rate(prev: dict[str, Any], done: int, now: float, tau_min: float) -> float:
    rate = float(prev.get("rate") or 0.0)
    last_done, last_at = prev.get("done"), prev.get("at")
    if not isinstance(last_done, int) or not isinstance(last_at, (int, float)) or now <= last_at or done < last_done:
        return rate
    minutes = (now - last_at) / 60
    weight = 1 - math.exp(-minutes / tau_min)
    return rate + weight * ((done - last_done) / minutes - rate)


def decide(endpoint: dict[str, Any], health: dict[str, Any], prev: dict[str, Any], now: float, env: dict[str, Any]) -> tuple[dict[str, Any], int | None]:
    jobs = health["jobs"]
    done = int(jobs["completed"]) + int(jobs["failed"])
    rate = update_rate(prev, done, now, env["tau"])
    target = tier(rate)
    if int(jobs.get("inQueue") or 0) > 0:
        target = max(target, BUSY_FLOOR)
    low, high = bounds(str(endpoint.get("name") or ""), env["bounds"])
    target = min(max(target, low), high)
    current = int(endpoint.get("idleTimeout") or 0)
    down = int(prev.get("down") or 0) + 1 if target < current else 0
    patch = target if target > current or (target < current and down >= env["down_checks"]) else None
    return {"done": done, "at": now, "rate": round(rate, 4), "target": target, "down": 0 if patch else down}, patch


def run(api_key: str, state_path: pathlib.Path, apply: bool) -> dict[str, Any]:
    env = {
        "tau": float(os.environ.get("RUNPOD_ADAPTIVE_IDLE_TAU_MIN", "15")),
        "down_checks": max(1, int(os.environ.get("RUNPOD_ADAPTIVE_IDLE_DOWN_CHECKS", "3"))),
        "bounds": json.loads(os.environ.get("RUNPOD_ADAPTIVE_IDLE_BOUNDS") or "{}"),
    }
    exclude = tuple(p.strip() for p in os.environ.get("RUNPOD_ADAPTIVE_IDLE_EXCLUDE", "").split(",") if p.strip())
    old = read_state(state_path).get("endpoints") or {}
    now = dt.datetime.now(dt.timezone.utc).timestamp()
    report: dict[str, Any] = {"endpoints": {}, "changes": [], "errors": []}
    for endpoint in normalize_list(request_json(f"{REST_BASE}/endpoints", api_key)):
        endpoint_id, name = str(endpoint.get("id") or ""), str(endpoint.get("name") or "")
        if not endpoint_id or int(endpoint.get("workersMax") or 0) <= 0 or (exclude and name.startswith(exclude)):
            continue
        try:
            entry, patch = decide(endpoint, queue_health(endpoint_id, api_key), old.get(endpoint_id) or {}, now, env)
            if patch is not None:
                change = {"endpoint": name, "id": endpoint_id, "from": endpoint.get("idleTimeout"), "to": patch, "rate_per_min": entry["rate"], "applied": False}
                if apply:
                    patch_endpoint(endpoint_id, api_key, {"idleTimeout": patch})
                    change["applied"] = True
                report["changes"].append(change)
            report["endpoints"][endpoint_id] = entry
        except Exception as error:
            report["errors"].append({"endpoint": name, "error": str(error)})
            if endpoint_id in old:
                report["endpoints"][endpoint_id] = old[endpoint_id]
    write_state(state_path, report)
    return report


def main() -> int:
    root = pathlib.Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--state", type=pathlib.Path, default=pathlib.Path(os.environ.get("RUNPOD_ADAPTIVE_IDLE_STATE", "/var/lib/manifoldgen-runpod-guard/adaptive-idle.json")))
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    if not (os.environ.get("RUNPOD_API_KEY") or os.environ.get("H3_RUNPOD_API_KEY")):
        load_env(root / ".env")
    api_key = os.environ.get("RUNPOD_API_KEY") or os.environ.get("H3_RUNPOD_API_KEY")
    if not api_key:
        parser.error("RUNPOD_API_KEY or H3_RUNPOD_API_KEY is required")
    report = run(api_key, args.state, args.apply)
    print(json.dumps({"changes": report["changes"], "errors": report["errors"]}, sort_keys=True))
    return 1 if report["errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
