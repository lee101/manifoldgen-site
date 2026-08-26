#!/usr/bin/env python3
"""Conservatively stop repeatedly idle RunPod capacity from staying pinned.

The guard is intentionally narrow: it only watches ManifoldGen H3 and Music3
Serverless endpoints and requires repeated idle observations before changing
capacity. It never deletes endpoints or production Pods; only allowlisted
scratch probes can be cleaned up after exceeding a separate age budget for two
checks. Dry-run is the default.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import pathlib
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

REST_BASE = "https://rest.runpod.io/v1"
QUEUE_BASE = "https://api.runpod.ai/v2"
DEFAULT_PREFIXES = ("cog-manifold-h3", "omniserve-minimax-music3")
SCRATCH_PREFIXES = ("h3upscale-probe-",)


def load_env(path: pathlib.Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def request_json(
    url: str,
    api_key: str,
    method: str = "GET",
    payload: dict[str, Any] | None = None,
    *,
    raw_auth: bool = False,
) -> Any:
    data = json.dumps(payload).encode() if payload is not None else None
    request = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": api_key if raw_auth else f"Bearer {api_key}",
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "manifoldgen-runpod-cost-guard/1.0",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read()
    except urllib.error.HTTPError as error:
        detail = error.read().decode(errors="replace")
        raise RuntimeError(f"RunPod {method} {url} returned {error.code}: {detail}") from error
    return json.loads(body) if body else {}


def managed_endpoint(name: str, prefixes: tuple[str, ...]) -> bool:
    return any(name.startswith(prefix) for prefix in prefixes)


def active_jobs(health: dict[str, Any]) -> int:
    jobs = health.get("jobs") or {}
    return int(jobs.get("inProgress") or 0) + int(jobs.get("inQueue") or 0)


def live_workers(health: dict[str, Any]) -> int:
    # RunPod's `ready` signal overlaps lifecycle signals such as `idle` and
    # `running`; summing them double-counts one worker. The largest signal is a
    # conservative estimate and, most importantly for the guard, preserves the
    # zero/non-zero distinction.
    return max((int(value or 0) for value in (health.get("workers") or {}).values()), default=0)


def consecutive(previous: int, condition: bool) -> int:
    return previous + 1 if condition else 0


def pod_age_hours(pod: dict[str, Any], now: dt.datetime) -> float:
    raw = str(pod.get("createdAt") or "").strip()
    if not raw:
        return 0.0
    try:
        created = dt.datetime.strptime(raw[:19], "%Y-%m-%d %H:%M:%S").replace(tzinfo=dt.timezone.utc)
    except ValueError:
        try:
            created = dt.datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            return 0.0
    if created.tzinfo is None:
        created = created.replace(tzinfo=dt.timezone.utc)
    return max(0.0, (now - created).total_seconds() / 3600)


def normalize_list(response: Any) -> list[dict[str, Any]]:
    if isinstance(response, list):
        return [item for item in response if isinstance(item, dict)]
    if isinstance(response, dict):
        for key in ("data", "items", "endpoints", "pods"):
            value = response.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
    raise RuntimeError("RunPod returned an unexpected list response")


def read_state(path: pathlib.Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text())
        return value if isinstance(value, dict) else {}
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return {}


def write_state(path: pathlib.Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as handle:
            json.dump(value, handle, indent=2, sort_keys=True)
            handle.write("\n")
        os.replace(temporary, path)
    finally:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass


def queue_health(endpoint_id: str, api_key: str) -> dict[str, Any]:
    value = request_json(
        f"{QUEUE_BASE}/{urllib.parse.quote(endpoint_id)}/health",
        api_key,
        raw_auth=True,
    )
    if not isinstance(value, dict):
        raise RuntimeError(f"invalid health response for endpoint {endpoint_id}")
    return value


def patch_endpoint(endpoint_id: str, api_key: str, payload: dict[str, Any]) -> None:
    request_json(
        f"{REST_BASE}/endpoints/{urllib.parse.quote(endpoint_id)}",
        api_key,
        "PATCH",
        payload,
    )


def run(api_key: str, state_path: pathlib.Path, threshold: int, apply: bool) -> dict[str, Any]:
    prefixes = tuple(
        value.strip()
        for value in os.environ.get(
            "RUNPOD_COST_GUARD_PREFIXES", ",".join(DEFAULT_PREFIXES)
        ).split(",")
        if value.strip()
    )
    old = read_state(state_path)
    old_counts = old.get("counts") if isinstance(old.get("counts"), dict) else {}
    old_pod_counts = old.get("pod_counts") if isinstance(old.get("pod_counts"), dict) else {}
    endpoints = normalize_list(request_json(f"{REST_BASE}/endpoints", api_key))
    report: dict[str, Any] = {
        "checked_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "mode": "apply" if apply else "dry-run",
        "threshold_checks": threshold,
        "status": "ok",
        "counts": {},
        "pod_counts": {},
        "endpoints": [],
        "direct_pods": [],
        "pod_alerts": [],
        "actions": [],
        "errors": [],
    }

    for endpoint in endpoints:
        name = str(endpoint.get("name") or "")
        if not managed_endpoint(name, prefixes):
            continue
        endpoint_id = str(endpoint.get("id") or "")
        if not endpoint_id:
            continue
        previous = old_counts.get(endpoint_id)
        if not isinstance(previous, dict):
            previous = {}
        try:
            health = queue_health(endpoint_id, api_key)
        except Exception as error:  # keep checking unrelated endpoints
            report["errors"].append({"endpoint": name, "error": str(error)})
            continue

        jobs = active_jobs(health)
        workers = live_workers(health)
        workers_min = int(endpoint.get("workersMin") or 0)
        pinned_count = consecutive(int(previous.get("pinned_min") or 0), workers_min > 0 and jobs == 0)
        idle_count = consecutive(
            int(previous.get("idle_live") or 0),
            workers_min == 0 and jobs == 0 and workers > 0,
        )
        counts = {"pinned_min": pinned_count, "idle_live": idle_count}
        report["counts"][endpoint_id] = counts
        item = {
            "id": endpoint_id,
            "name": name,
            "jobs": jobs,
            "live_workers": workers,
            "workers_min": workers_min,
            "workers_max": int(endpoint.get("workersMax") or 0),
            "unhealthy_workers": int((health.get("workers") or {}).get("unhealthy") or 0),
            "consecutive": counts,
        }
        report["endpoints"].append(item)

        action: dict[str, Any] | None = None
        if pinned_count >= threshold:
            action = {
                "endpoint": name,
                "reason": "minimum worker remained pinned with no jobs",
                "patch": {
                    "workersMin": 0,
                    "idleTimeout": max(5, min(int(endpoint.get("idleTimeout") or 30), 30)),
                },
            }
        elif idle_count >= threshold:
            action = {
                "endpoint": name,
                "reason": "live worker remained idle despite workersMin=0",
                "patch": {"workersMax": 0},
            }

        if action is not None:
            action["applied"] = False
            if apply:
                # Recheck immediately so a newly queued job always wins the race.
                fresh = queue_health(endpoint_id, api_key)
                still_idle = active_jobs(fresh) == 0
                if "workersMax" in action["patch"]:
                    still_idle = still_idle and live_workers(fresh) > 0
                if still_idle:
                    patch_endpoint(endpoint_id, api_key, action["patch"])
                    action["applied"] = True
                    report["counts"][endpoint_id] = {"pinned_min": 0, "idle_live": 0}
                else:
                    action["skipped"] = "job or worker state changed during safety recheck"
            report["actions"].append(action)

    # Direct scratch Pods do not inherit template registry credentials. Alert
    # on auth failures immediately. An allowlisted scratch probe may be
    # terminated only after it has exceeded its three-hour budget for two
    # consecutive checks; normal Pods and Serverless workers are never deleted.
    try:
        pods = normalize_list(request_json(f"{REST_BASE}/pods", api_key))
        now = dt.datetime.now(dt.timezone.utc)
        max_scratch_hours = max(
            2.0, float(os.environ.get("RUNPOD_COST_GUARD_SCRATCH_MAX_HOURS", "3"))
        )
        for pod in pods:
            pod_id = str(pod.get("id") or "")
            name = str(pod.get("name") or "")
            image = str(pod.get("imageName") or "")
            running = str(pod.get("desiredStatus") or "").upper() == "RUNNING"
            scratch = running and any(name.startswith(prefix) for prefix in SCRATCH_PREFIXES)
            age_hours = pod_age_hours(pod, now)
            stale_count = consecutive(
                int(old_pod_counts.get(pod_id) or 0),
                scratch and age_hours >= max_scratch_hours,
            )
            if pod_id:
                report["pod_counts"][pod_id] = stale_count
            if scratch:
                report["direct_pods"].append(
                    {
                        "id": pod_id,
                        "name": name,
                        "age_hours": round(age_hours, 2),
                        "cost_per_hour": pod.get("costPerHr"),
                        "registry_auth_configured": bool(pod.get("containerRegistryAuthId")),
                        "stale_checks": stale_count,
                    }
                )
                if image.startswith("ghcr.io/") and not pod.get("containerRegistryAuthId"):
                    report["pod_alerts"].append(
                        {"id": pod_id, "name": name, "status": "private GHCR image has no registry auth"}
                    )
                if stale_count >= 2:
                    action = {
                        "pod": name,
                        "reason": f"scratch probe exceeded {max_scratch_hours:g} hours for two checks",
                        "delete": pod_id,
                        "applied": False,
                    }
                    if apply and pod_id:
                        request_json(
                            f"{REST_BASE}/pods/{urllib.parse.quote(pod_id)}",
                            api_key,
                            "DELETE",
                        )
                        action["applied"] = True
                        report["pod_counts"][pod_id] = 0
                    report["actions"].append(action)
            status_text = " ".join(
                str(pod.get(key) or "")
                for key in ("lastStatusChange", "status", "desiredStatus")
            )
            if "IMAGE_AUTH_ERROR" in status_text.upper():
                report["pod_alerts"].append(
                    {"id": pod.get("id"), "name": pod.get("name"), "status": status_text}
                )
    except Exception as error:
        report["errors"].append({"scope": "pods", "error": str(error)})

    if report["errors"]:
        report["status"] = "error"
    elif report["pod_alerts"] or report["actions"] or any(
        item["unhealthy_workers"] or item["consecutive"]["pinned_min"] or item["consecutive"]["idle_live"]
        for item in report["endpoints"]
    ):
        report["status"] = "warning"
    if any(action.get("applied") for action in report["actions"]):
        report["status"] = "remediated"
    write_state(state_path, report)
    return report


def main() -> int:
    root = pathlib.Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--state",
        type=pathlib.Path,
        default=pathlib.Path(os.environ.get("RUNPOD_COST_GUARD_STATE", "/var/lib/manifoldgen-runpod-guard/state.json")),
    )
    parser.add_argument("--threshold", type=int, default=6, help="consecutive checks before remediation")
    parser.add_argument("--apply", action="store_true", help="apply safe capacity reductions")
    args = parser.parse_args()
    if args.threshold < 2:
        parser.error("--threshold must be at least 2")
    if not (os.environ.get("RUNPOD_API_KEY") or os.environ.get("H3_RUNPOD_API_KEY")):
        load_env(root / ".env")
    api_key = os.environ.get("RUNPOD_API_KEY") or os.environ.get("H3_RUNPOD_API_KEY")
    if not api_key:
        parser.error("RUNPOD_API_KEY or H3_RUNPOD_API_KEY is required")
    report = run(api_key, args.state, args.threshold, args.apply)
    print(json.dumps(report, indent=2, sort_keys=True))
    return 1 if report["status"] == "error" else 0


if __name__ == "__main__":
    raise SystemExit(main())
