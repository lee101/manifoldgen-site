#!/usr/bin/env python3
import argparse
import json
import re
import sys
import urllib.error
import urllib.request

REST = "https://rest.runpod.io/v1"
ENV_FILE = "/opt/manifoldgen-site/.env"
REFERENCE_TEMPLATE = "1r7gukcsg9"


def api_key() -> str:
    for line in open(ENV_FILE):
        match = re.match(r"\s*(?:export\s+)?H3_RUNPOD_API_KEY\s*=\s*(.*)", line)
        if match:
            return match.group(1).strip().strip("\"'")
    raise SystemExit("H3_RUNPOD_API_KEY not found")


def call(method: str, path: str, key: str, payload=None):
    data = None if payload is None else json.dumps(payload).encode()
    headers = {"Authorization": f"Bearer {key}", "Accept": "application/json", "User-Agent": "curl/8.10 manifoldgen-deploy"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(REST + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            body = response.read()
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as error:
        raise SystemExit(f"{method} {path} -> {error.code}: {error.read().decode(errors='replace')[:600]}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True)
    parser.add_argument("--name", default="anime-control")
    parser.add_argument("--gpus", default="NVIDIA GeForce RTX 4090,NVIDIA L40S,NVIDIA L40,NVIDIA RTX 6000 Ada Generation")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    key = api_key()
    reference = call("GET", f"/templates/{REFERENCE_TEMPLATE}", key)
    existing = [e for e in call("GET", "/endpoints", key) if e.get("name") == args.name]
    template = {
        "name": args.name,
        "imageName": args.image,
        "containerDiskInGb": 60,
        "containerRegistryAuthId": reference["containerRegistryAuthId"],
        "isServerless": True,
        "isPublic": False,
        "env": {"NVIDIA_DRIVER_CAPABILITIES": "all", "OMNISERVE_ENFORCE_VRAM": "0"},
        "ports": [],
        "volumeInGb": 0,
    }
    endpoint = {
        "name": args.name,
        "gpuTypeIds": [item.strip() for item in args.gpus.split(",") if item.strip()],
        "gpuCount": 1,
        "workersMin": 0,
        "workersMax": 0,
        "idleTimeout": 60,
        "executionTimeoutMs": 900000,
        "flashboot": True,
        "scalerType": "REQUEST_COUNT",
        "scalerValue": 1,
        "allowedCudaVersions": ["12.8", "12.9", "13.0"],
    }
    print(json.dumps({"existing": [e.get("id") for e in existing], "template": {k: v for k, v in template.items() if k != "containerRegistryAuthId"}, "endpoint": endpoint}, indent=1))
    if not args.apply:
        return
    if existing:
        endpoint_id = existing[0]["id"]
        template_id = existing[0].get("templateId")
        call("PATCH", f"/templates/{template_id}", key, {"imageName": args.image, "env": template["env"]})
        print("updated template", template_id, "endpoint", endpoint_id)
        return
    created_template = call("POST", "/templates", key, template)
    created = call("POST", "/endpoints", key, {**endpoint, "templateId": created_template["id"]})
    print("template", created_template["id"], "endpoint", created["id"])


if __name__ == "__main__":
    main()
