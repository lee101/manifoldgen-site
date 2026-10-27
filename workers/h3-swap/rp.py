#!/usr/bin/env -S uv run --script
"""Minimal RunPod REST helper: rp.py METHOD /path [json-body]. Prints the response with env values redacted."""
import json, os, sys, urllib.error, urllib.request

key = os.environ.get("RUNPOD_API_KEY") or os.environ.get("H3_RUNPOD_API_KEY") or sys.exit("RUNPOD_API_KEY is not set")
method, path = sys.argv[1], sys.argv[2]
body = sys.argv[3] if len(sys.argv) > 3 else None
request = urllib.request.Request("https://rest.runpod.io/v1" + path, method=method, data=body.encode() if body else None,
                                 headers={"Authorization": "Bearer " + key, "Content-Type": "application/json", "User-Agent": "curl/8.10"})
try:
    raw = urllib.request.urlopen(request, timeout=60).read()
    data = json.loads(raw) if raw.strip() else {"ok": True}
except urllib.error.HTTPError as error:
    sys.exit(f"{error.code} {error.read()[:600].decode()}")


def redact(value):
    if isinstance(value, dict):
        return {k: ("<redacted>" if k == "env" else redact(v)) for k, v in value.items()}
    if isinstance(value, list):
        return [redact(v) for v in value]
    return value


print(json.dumps(redact(data), indent=1))
