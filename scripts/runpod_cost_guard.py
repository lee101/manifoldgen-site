#!/usr/bin/env python3
"""Conservatively stop repeatedly idle RunPod capacity from staying pinned.

The guard is intentionally narrow: it only watches ManifoldGen H3 and Music3
Serverless endpoints and requires repeated idle observations before changing
capacity. Account-wide direct pods and persistent volumes are inventoried so
storage charges and failed non-scratch workloads remain visible. It never deletes endpoints or production Pods; only allowlisted
scratch probes can be cleaned up after exceeding a separate age budget for two
checks. Dry-run is the default.

Daily spend caps come from the RunPod billing API (bucketSize=day, UTC). A
ManifoldGen-owned endpoint over its cap, or any spending owned endpoint while
the account is over the global cap, for two consecutive checks gets
workersMax=0; the prior value is kept in state and restored once the day's
spend is back under the cap. Endpoints that other services own are alert-only.
Capped endpoint IDs are also written to a world-readable cap file so the site
does not scale them back up on demand.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import pathlib
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

REST_BASE = "https://rest.runpod.io/v1"
QUEUE_BASE = "https://api.runpod.ai/v2"
DEFAULT_PREFIXES = ("cog-manifold-h3", "omniserve-minimax-music3", "omniserve-yue2-")
ALERT_ONLY_PREFIXES = ("omniserve-ra2-", "cog-qwen-image-", "pixal3d")
IDLE_ALERT_ONLY_PREFIXES = ("omniserve-ra2-",)
SCRATCH_PREFIXES = ("h3upscale-probe-",)
DAILY_CAP_RULES = (
    ("omniserve-minimax-music3", "RUNPOD_COST_GUARD_MUSIC3_DAILY_USD", 40.0),
    ("cog-manifold-h3", "RUNPOD_COST_GUARD_H3_DAILY_USD", 60.0),
    ("omniserve-yue2-", "RUNPOD_COST_GUARD_CHEAP_DAILY_USD", 15.0),
    ("omniserve-ra2-", "RUNPOD_COST_GUARD_CHEAP_DAILY_USD", 15.0),
    ("cog-qwen-image-", "RUNPOD_COST_GUARD_CHEAP_DAILY_USD", 15.0),
    ("pixal3d", "RUNPOD_COST_GUARD_CHEAP_DAILY_USD", 15.0),
)
GLOBAL_DAILY_CAP_ENV = "RUNPOD_COST_GUARD_GLOBAL_DAILY_USD"
GLOBAL_DAILY_CAP_USD = 120.0
SPEND_CAP_CHECKS = 2


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
    jobs = health.get("jobs")
    if not isinstance(jobs, dict) or any(name not in jobs for name in ("inProgress", "inQueue")):
        raise ValueError("incomplete queue health; refusing to infer that endpoint is idle")
    return int(jobs["inProgress"]) + int(jobs["inQueue"])


def live_workers(health: dict[str, Any]) -> int:
    # RunPod's `ready` signal overlaps lifecycle signals such as `idle` and
    # `running`; summing them double-counts one worker. The largest signal is a
    # conservative estimate and, most importantly for the guard, preserves the
    # zero/non-zero distinction. `throttled` is demand RunPod could not admit,
    # not capacity we hold, and must never read as a live worker.
    return max(
        (
            int(value or 0)
            for key, value in (health.get("workers") or {}).items()
            if key != "throttled"
        ),
        default=0,
    )


def standby_workers(endpoint: dict[str, Any]) -> int:
    # FlashBoot keeps stopped workers as paused snapshots. They hold no GPU and
    # are not billed, but they still appear in the queue health worker signals.
    return int(endpoint.get("workersStandby") or 0)



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


def env_prefixes(key: str, default: tuple[str, ...]) -> tuple[str, ...]:
    return tuple(value.strip() for value in os.environ.get(key, ",".join(default)).split(",") if value.strip())


def env_usd(key: str, default: float) -> float:
    try:
        value = float(os.environ.get(key, ""))
    except ValueError:
        return default
    return value if value > 0 else default


def daily_cap_usd(name: str) -> float | None:
    for prefix, key, default in DAILY_CAP_RULES:
        if name.startswith(prefix):
            return env_usd(key, default)
    return None


def daily_spend(rows: list[dict[str, Any]], day: str) -> dict[str, float]:
    spend: dict[str, float] = {}
    for row in rows:
        endpoint_id = str(row.get("endpointId") or "")
        if endpoint_id and str(row.get("time") or "").startswith(day):
            spend[endpoint_id] = spend.get(endpoint_id, 0.0) + float(row.get("amount") or 0)
    return spend


def fetch_daily_spend(api_key: str, now: dt.datetime) -> dict[str, float]:
    day = now.strftime("%Y-%m-%d")
    query = urllib.parse.urlencode({"bucketSize": "day", "startTime": f"{day}T00:00:00Z", "endTime": (now + dt.timedelta(days=1)).strftime("%Y-%m-%dT00:00:00Z")})
    rows = request_json(f"{REST_BASE}/billing/endpoints?{query}", api_key)
    return daily_spend(normalize_list(rows), day)


def send_alert(status: str, detail: str) -> dict[str, Any]:
    alerts_dir = os.environ.get("RUNPOD_COST_GUARD_ALERTS_DIR", "/nvme0n1-disk/code/app-site/monitoring")
    try:
        if alerts_dir not in sys.path:
            sys.path.insert(0, alerts_dir)
        from alerts import record_alert  # type: ignore

        return record_alert("manifoldgen-runpod-cost-guard", status, detail, "runpod_cost_guard", email_detail=detail)
    except Exception as error:  # alerting must never break the guard
        print(f"ALERT {status}: {detail} (alert delivery failed: {error})", file=sys.stderr)
        return {"emailed": False, "error": str(error)}


def archived_endpoint_ids() -> set[str]:
    return {value.strip() for value in os.environ.get("RUNPOD_ARCHIVED_ENDPOINT_IDS", "").split(",") if value.strip()}


def archive_guard(report: dict[str, Any], endpoints: list[dict[str, Any]], api_key: str, apply: bool) -> list[str]:
    """Archived endpoints have no model volume; any capacity just burns GPU."""
    archived = archived_endpoint_ids()
    messages: list[str] = []
    for endpoint in endpoints:
        endpoint_id = str(endpoint.get("id") or "")
        workers_max = int(endpoint.get("workersMax") or 0)
        workers_min = int(endpoint.get("workersMin") or 0)
        if endpoint_id not in archived or (workers_max == 0 and workers_min == 0):
            continue
        name = str(endpoint.get("name") or endpoint_id)
        action = {"endpoint": name, "reason": "archived endpoint (no model volume) had capacity", "patch": {"workersMin": 0, "workersMax": 0}, "prior_workers_max": workers_max, "applied": False}
        if apply:
            patch_endpoint(endpoint_id, api_key, action["patch"])
            action["applied"] = True
        report["actions"].append(action)
        messages.append(f"{name} ({endpoint_id}) is archived but had workersMin={workers_min} workersMax={workers_max}; set to 0 ({'applied' if apply else 'dry-run'})")
    return messages


def write_cap_file(path: pathlib.Path, capped: dict[str, Any], now: dt.datetime) -> None:
    write_state(path, {"updated_at": now.isoformat(), "capped": capped})
    path.chmod(0o644)


def spend_guard(
    report: dict[str, Any],
    endpoints: list[dict[str, Any]],
    old: dict[str, Any],
    api_key: str,
    apply: bool,
    now: dt.datetime,
    enforce_prefixes: tuple[str, ...],
    alert_prefixes: tuple[str, ...],
) -> list[str]:
    spend = fetch_daily_spend(api_key, now)
    global_cap = env_usd(GLOBAL_DAILY_CAP_ENV, GLOBAL_DAILY_CAP_USD)
    total = round(sum(spend.values()), 4)
    old_counts = old.get("spend_counts") if isinstance(old.get("spend_counts"), dict) else {}
    capped = dict(old.get("capped") or {}) if isinstance(old.get("capped"), dict) else {}
    global_count = consecutive(int(old.get("global_spend_over") or 0), total >= global_cap)
    report["global_spend_over"] = global_count
    report["spend"] = {"day": now.strftime("%Y-%m-%d"), "total_usd": total, "global_cap_usd": global_cap, "endpoints": []}
    messages: list[str] = []
    if global_count >= SPEND_CAP_CHECKS:
        messages.append(f"account RunPod spend today ${total:.2f} >= global cap ${global_cap:.2f}")
    by_id = {str(endpoint.get("id") or ""): endpoint for endpoint in endpoints}
    for endpoint_id, endpoint in by_id.items():
        name = str(endpoint.get("name") or "")
        enforce = managed_endpoint(name, enforce_prefixes)
        if not endpoint_id or not (enforce or managed_endpoint(name, alert_prefixes)):
            continue
        cap = daily_cap_usd(name)
        amount = round(spend.get(endpoint_id, 0.0), 4)
        previous = old_counts.get(endpoint_id) if isinstance(old_counts.get(endpoint_id), dict) else {}
        over = cap is not None and amount >= cap
        counts = {
            "over": consecutive(int(previous.get("over") or 0), over),
            "under": consecutive(int(previous.get("under") or 0), not over and global_count == 0),
        }
        report["spend_counts"][endpoint_id] = counts
        workers_max = int(endpoint.get("workersMax") or 0)
        report["spend"]["endpoints"].append({"id": endpoint_id, "name": name, "spend_usd": amount, "cap_usd": cap, "enforced": enforce, "workers_max": workers_max, "consecutive": counts, "capped": endpoint_id in capped})
        trip = counts["over"] >= SPEND_CAP_CHECKS or (global_count >= SPEND_CAP_CHECKS and amount > 0)
        reason = f"daily spend ${amount:.2f} >= cap ${cap:.2f}" if counts["over"] >= SPEND_CAP_CHECKS else f"global spend ${total:.2f} >= ${global_cap:.2f}"
        if trip and not enforce and counts["over"] >= SPEND_CAP_CHECKS:
            messages.append(f"{name} ({endpoint_id}) {reason}; alert-only, not owned by ManifoldGen")
        if trip and enforce and endpoint_id not in capped:
            action = {"endpoint": name, "reason": f"spend cap: {reason}", "patch": {"workersMax": 0}, "prior_workers_max": workers_max, "applied": False}
            if apply:
                if workers_max > 0:
                    patch_endpoint(endpoint_id, api_key, {"workersMax": 0})
                capped[endpoint_id] = {"name": name, "prior_workers_max": workers_max, "capped_at": now.isoformat(), "reason": reason}
                action["applied"] = True
            report["actions"].append(action)
            messages.append(f"{name} ({endpoint_id}) {reason}; workersMax {workers_max} -> 0 ({'applied' if apply else 'dry-run'})")
        elif trip and enforce and workers_max > 0:
            action = {"endpoint": name, "reason": f"spend cap still exceeded and capacity was raised: {reason}", "patch": {"workersMax": 0}, "applied": False}
            if apply:
                patch_endpoint(endpoint_id, api_key, {"workersMax": 0})
                action["applied"] = True
            report["actions"].append(action)
        elif endpoint_id in capped and endpoint_id not in archived_endpoint_ids() and counts["under"] >= SPEND_CAP_CHECKS and os.environ.get("RUNPOD_COST_GUARD_AUTO_RESTORE", "1") != "0":
            prior = int(capped[endpoint_id].get("prior_workers_max") or 0)
            action = {"endpoint": name, "reason": "spend back under cap; restoring prior capacity", "patch": {"workersMax": prior}, "applied": False}
            if apply:
                if workers_max == 0 and prior > 0:
                    patch_endpoint(endpoint_id, api_key, {"workersMax": prior})
                capped.pop(endpoint_id, None)
                action["applied"] = True
            report["actions"].append(action)
    report["capped"] = capped
    return messages


def restore_endpoint(api_key: str, state_path: pathlib.Path, cap_path: pathlib.Path, endpoint_id: str) -> dict[str, Any]:
    state = read_state(state_path)
    capped = state.get("capped") if isinstance(state.get("capped"), dict) else {}
    entry = capped.pop(endpoint_id, None)
    if entry is None:
        raise SystemExit(f"{endpoint_id} is not capped")
    prior = int(entry.get("prior_workers_max") or 0)
    if prior > 0:
        patch_endpoint(endpoint_id, api_key, {"workersMax": prior})
    state["capped"] = capped
    counts = state.get("spend_counts") if isinstance(state.get("spend_counts"), dict) else {}
    counts[endpoint_id] = {"over": 0, "under": 0}
    state["spend_counts"] = counts
    write_state(state_path, state)
    write_cap_file(cap_path, capped, dt.datetime.now(dt.timezone.utc))
    return {"restored": endpoint_id, "workersMax": prior}


def run(api_key: str, state_path: pathlib.Path, threshold: int, apply: bool, cap_path: pathlib.Path | None = None) -> dict[str, Any]:
    prefixes = env_prefixes("RUNPOD_COST_GUARD_PREFIXES", DEFAULT_PREFIXES)
    alert_prefixes = env_prefixes("RUNPOD_COST_GUARD_ALERT_ONLY_PREFIXES", ALERT_ONLY_PREFIXES)
    idle_alert_prefixes = env_prefixes("RUNPOD_COST_GUARD_IDLE_ALERT_ONLY_PREFIXES", IDLE_ALERT_ONLY_PREFIXES)
    cap_path = cap_path or state_path.parent / "spend-caps.json"
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
        "spend_counts": {},
        "capped": old.get("capped") if isinstance(old.get("capped"), dict) else {},
        "alerts": [],
        "idle_alerts": [],
        "endpoints": [],
        "direct_pods": [],
        "network_volumes": [],
        "allocated_storage_gb": 0,
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

        try:
            jobs = active_jobs(health)
            workers = live_workers(health)
        except (TypeError, ValueError) as error:
            report["errors"].append({"endpoint": name, "error": str(error)})
            continue
        standby = standby_workers(endpoint)
        active_workers = max(0, workers - standby)
        workers_min = int(endpoint.get("workersMin") or 0)
        pinned_count = consecutive(int(previous.get("pinned_min") or 0), workers_min > 0 and jobs == 0)
        idle_count = consecutive(
            int(previous.get("idle_live") or 0),
            workers_min == 0 and jobs == 0 and active_workers > 0,
        )
        counts = {"pinned_min": pinned_count, "idle_live": idle_count}
        report["counts"][endpoint_id] = counts
        item = {
            "id": endpoint_id,
            "name": name,
            "jobs": jobs,
            "live_workers": workers,
            "standby_workers": standby,
            "active_workers": active_workers,
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
        elif idle_count >= threshold and managed_endpoint(name, idle_alert_prefixes):
            report["idle_alerts"].append(f"{name} ({endpoint_id}) live worker idle for {idle_count} checks with workersMin=0; alert-only per RUNPOD_COST_GUARD_IDLE_ALERT_ONLY_PREFIXES")
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

    spend_messages: list[str] = []
    try:
        spend_messages = spend_guard(report, endpoints, old, api_key, apply, dt.datetime.now(dt.timezone.utc), prefixes, alert_prefixes)
        if apply:
            write_cap_file(cap_path, report["capped"], dt.datetime.now(dt.timezone.utc))
    except Exception as error:
        report["errors"].append({"scope": "spend", "error": str(error)})
        report["spend_counts"] = old.get("spend_counts") if isinstance(old.get("spend_counts"), dict) else {}
        report["global_spend_over"] = int(old.get("global_spend_over") or 0)

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
            if running and not scratch and age_hours >= 24:
                report["pod_alerts"].append({"id": pod_id, "name": name, "status": "direct pod running over 24 hours; verify owner and active jobs", "cost_per_hour": pod.get("costPerHr")})
            if running:
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
                if scratch and image.startswith("ghcr.io/") and not pod.get("containerRegistryAuthId"):
                    report["pod_alerts"].append(
                        {"id": pod_id, "name": name, "status": "private GHCR image has no registry auth"}
                    )
                if scratch and stale_count >= 2:
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

    # Allocated network storage keeps billing with zero workers. Inventory it
    # explicitly; never delete data just because its endpoint is currently idle.
    try:
        volumes = normalize_list(request_json(f"{REST_BASE}/networkvolumes", api_key))
        for volume in volumes:
            size = int(volume.get("size") or 0)
            report["allocated_storage_gb"] += size
            report["network_volumes"].append({"id": volume.get("id"), "name": volume.get("name"), "size_gb": size, "data_center": volume.get("dataCenterId")})
    except Exception as error:
        report["errors"].append({"scope": "network_volumes", "error": str(error)})

    if report["errors"]:
        report["status"] = "error"
    elif report["pod_alerts"] or report["actions"] or any(
        item["unhealthy_workers"] or item["consecutive"]["pinned_min"] or item["consecutive"]["idle_live"]
        for item in report["endpoints"]
    ):
        report["status"] = "warning"
    try:
        spend_messages += archive_guard(report, endpoints, api_key, apply)
    except Exception as error:
        report["errors"].append({"scope": "archive", "error": str(error)})
    alert_status = "spend_cap" if spend_messages else "idle_worker"
    spend_messages += report["idle_alerts"]
    if spend_messages:
        report["alerts"] = spend_messages
        if report["status"] == "ok":
            report["status"] = "warning"
    if report["errors"]:
        report["status"] = "error"
    elif any(action.get("applied") for action in report["actions"]):
        report["status"] = "remediated"
    if spend_messages and apply:
        report["alert_delivery"] = send_alert(alert_status, "\n".join(spend_messages))
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
    parser.add_argument("--cap-file", type=pathlib.Path, default=None, help="world-readable list of spend-capped endpoints")
    parser.add_argument("--restore", metavar="ENDPOINT_ID", help="restore a spend-capped endpoint's prior workersMax")
    args = parser.parse_args()
    if args.threshold < 2:
        parser.error("--threshold must be at least 2")
    if not (os.environ.get("RUNPOD_API_KEY") or os.environ.get("H3_RUNPOD_API_KEY")):
        load_env(root / ".env")
    api_key = os.environ.get("RUNPOD_API_KEY") or os.environ.get("H3_RUNPOD_API_KEY")
    if not api_key:
        parser.error("RUNPOD_API_KEY or H3_RUNPOD_API_KEY is required")
    cap_path = args.cap_file or pathlib.Path(os.environ.get("RUNPOD_COST_GUARD_CAP_FILE", args.state.parent / "spend-caps.json"))
    if args.restore:
        print(json.dumps(restore_endpoint(api_key, args.state, cap_path, args.restore), indent=2))
        return 0
    report = run(api_key, args.state, args.threshold, args.apply, cap_path)
    print(json.dumps(report, indent=2, sort_keys=True))
    return 1 if report["status"] == "error" else 0


if __name__ == "__main__":
    raise SystemExit(main())
