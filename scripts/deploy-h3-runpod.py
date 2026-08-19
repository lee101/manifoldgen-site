#!/usr/bin/env python3
"""Safely apply config/runpod-h3.json to existing RunPod endpoints.

Dry-run is the default. Passing --apply verifies that both queues are empty,
drains every worker, updates the templates, and leaves the endpoints paused for
the app's request-time scaler. Draining matters because RunPod does not replace
an already warm worker when its template version changes.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


REST_BASE = "https://rest.runpod.io/v1"
QUEUE_BASE = "https://api.runpod.ai/v2"
TEMPLATE_FIELDS = (
    "name",
    "imageName",
    "dockerStartCmd",
    "containerDiskInGb",
    "containerRegistryAuthId",
    "volumeMountPath",
    "env",
    "readme",
)


def request_json(
    method: str,
    url: str,
    api_key: str,
    payload: dict[str, Any] | None = None,
    *,
    bearer: bool = True,
) -> dict[str, Any]:
    data = None if payload is None else json.dumps(payload).encode()
    headers = {
        "Authorization": f"Bearer {api_key}" if bearer else api_key,
        "Accept": "application/json",
    }
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")
        raise RuntimeError(f"RunPod {method} {url} returned {exc.code}: {detail}") from exc


def validate_config(config: dict[str, Any]) -> None:
    if not config.get("image"):
        raise ValueError("config image is required")
    endpoints = config.get("endpoints")
    if not isinstance(endpoints, list) or not endpoints:
        raise ValueError("config endpoints must be a non-empty array")
    ids: set[str] = set()
    for endpoint in endpoints:
        for key in ("id", "templateId", "name", "workersMax", "gpuTypeIds"):
            if key not in endpoint:
                raise ValueError(f"endpoint is missing {key}")
        if endpoint["id"] in ids:
            raise ValueError(f"duplicate endpoint id {endpoint['id']}")
        ids.add(endpoint["id"])
        if endpoint["workersMax"] < 1:
            raise ValueError(f"{endpoint['name']} workersMax must be positive")
        if not endpoint["gpuTypeIds"]:
            raise ValueError(f"{endpoint['name']} needs at least one GPU type")


def template_payload(
    current: dict[str, Any], config: dict[str, Any], endpoint: dict[str, Any]
) -> dict[str, Any]:
    payload = {key: current.get(key) for key in TEMPLATE_FIELDS}
    payload["imageName"] = config["image"]
    payload["dockerStartCmd"] = config["dockerStartCmd"]
    env = dict(current.get("env") or {})
    env.update(config.get("env") or {})
    env.update(endpoint.get("env") or {})
    for key in endpoint.get("unsetEnv", []):
        env.pop(key, None)
    payload["env"] = env
    return payload


def endpoint_payload(config: dict[str, Any], endpoint: dict[str, Any]) -> dict[str, Any]:
    return {
        "workersMin": config["workersMin"],
        "workersMax": endpoint["workersMax"],
        "idleTimeout": config["idleTimeout"],
        "executionTimeoutMs": config["executionTimeoutMs"],
        "flashboot": config["flashboot"],
        "scalerType": config["scalerType"],
        "scalerValue": config["scalerValue"],
        "gpuTypeIds": endpoint["gpuTypeIds"],
    }


def worker_count(health: dict[str, Any]) -> int:
    return sum(int(value) for value in health.get("workers", {}).values())


def active_job_count(health: dict[str, Any]) -> int:
    jobs = health.get("jobs", {})
    return int(jobs.get("inProgress", 0)) + int(jobs.get("inQueue", 0))


def health(endpoint_id: str, api_key: str) -> dict[str, Any]:
    return request_json(
        "GET", f"{QUEUE_BASE}/{endpoint_id}/health", api_key, bearer=False
    )


def apply(config: dict[str, Any], api_key: str, drain_timeout: int) -> None:
    endpoints = config["endpoints"]
    snapshots: dict[str, dict[str, Any]] = {}

    for endpoint in endpoints:
        endpoint_id = endpoint["id"]
        state = health(endpoint_id, api_key)
        if active_job_count(state):
            raise RuntimeError(f"{endpoint['name']} has queued or running jobs; try later")
        snapshots[endpoint_id] = request_json(
            "GET", f"{REST_BASE}/endpoints/{endpoint_id}", api_key
        )

    drained = False
    try:
        for endpoint in endpoints:
            request_json(
                "PATCH",
                f"{REST_BASE}/endpoints/{endpoint['id']}",
                api_key,
                {"workersMax": 0},
            )
            print(f"draining {endpoint['name']}")
        drained = True

        deadline = time.monotonic() + drain_timeout
        while True:
            counts = {
                endpoint["name"]: worker_count(health(endpoint["id"], api_key))
                for endpoint in endpoints
            }
            print("workers " + ", ".join(f"{name}={count}" for name, count in counts.items()))
            if not any(counts.values()):
                break
            if time.monotonic() >= deadline:
                raise TimeoutError(f"workers did not drain within {drain_timeout}s")
            time.sleep(5)

        for endpoint in endpoints:
            template_id = endpoint["templateId"]
            current = request_json(
                "GET", f"{REST_BASE}/templates/{template_id}", api_key
            )
            request_json(
                "POST",
                f"{REST_BASE}/templates/{template_id}/update",
                api_key,
                template_payload(current, config, endpoint),
            )
            print(f"updated template {template_id} to {config['image']}")

        for endpoint in endpoints:
            staged = endpoint_payload(config, endpoint)
            staged["workersMax"] = 0
            request_json(
                "PATCH",
                f"{REST_BASE}/endpoints/{endpoint['id']}",
                api_key,
                staged,
            )
            print(
                f"staged {endpoint['name']} paused burst-max={endpoint['workersMax']} "
                f"gpus={','.join(endpoint['gpuTypeIds'])}"
            )
    except Exception:
        if drained:
            for endpoint in endpoints:
                old = snapshots[endpoint["id"]]
                try:
                    request_json(
                        "PATCH",
                        f"{REST_BASE}/endpoints/{endpoint['id']}",
                        api_key,
                        {
                            "workersMax": old["workersMax"],
                            "gpuTypeIds": old["gpuTypeIds"],
                        },
                    )
                except Exception as restore_error:
                    print(
                        f"WARNING: could not restore {endpoint['name']}: {restore_error}",
                        file=sys.stderr,
                    )
        raise


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, default=root / "config/runpod-h3.json")
    parser.add_argument("--apply", action="store_true", help="perform the deployment")
    parser.add_argument("--drain-timeout", type=int, default=300)
    args = parser.parse_args()

    config = json.loads(args.config.read_text())
    validate_config(config)
    if not args.apply:
        print(f"dry-run: image={config['image']}")
        for endpoint in config["endpoints"]:
            print(
                f"  {endpoint['name']}: drain, template={endpoint['templateId']}, "
                f"max={endpoint['workersMax']}, gpus={','.join(endpoint['gpuTypeIds'])}"
            )
        print("pass --apply to update RunPod")
        return 0

    api_key = os.environ.get("RUNPOD_API_KEY")
    if not api_key:
        parser.error("RUNPOD_API_KEY is required with --apply")
    apply(config, api_key, args.drain_timeout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
