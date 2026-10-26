"""R2 staging + RunPod swap endpoint client."""
from __future__ import annotations

import json
import os
import subprocess
import time
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SWAP_ENDPOINT = "vwsukvlfhbtqon"


def load_env():
    for line in (ROOT / ".env").read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"'))


def _aws(*args):
    env = {**os.environ, "AWS_ACCESS_KEY_ID": os.environ["CLOUDFLARE_R2_ACCESS_KEY_ID"],
           "AWS_SECRET_ACCESS_KEY": os.environ["CLOUDFLARE_R2_SECRET_ACCESS_KEY"], "AWS_DEFAULT_REGION": "auto"}
    return subprocess.run(["aws", "s3", *args, "--endpoint-url", f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com"],
                          env=env, capture_output=True, text=True, check=True)


def stage(path, prefix="fightswap-tmp"):
    """Upload a local file to R2 and return its public URL."""
    load_env()
    key = f"{prefix}/{uuid.uuid4().hex[:8]}-{Path(path).name}"
    _aws("cp", str(path), f"s3://{os.environ['R2_BUCKET']}/{key}", "--only-show-errors")
    return f"https://{os.environ['R2_PUBLIC_HOST']}/{key}"


def unstage(url):
    load_env()
    key = url.split("/", 3)[3]
    _aws("rm", f"s3://{os.environ['R2_BUCKET']}/{key}", "--only-show-errors")


def _call(endpoint, path, payload=None, method="GET"):
    req = urllib.request.Request(
        f"https://api.runpod.ai/v2/{endpoint}{path}", method=method,
        data=json.dumps(payload).encode() if payload is not None else None,
        headers={"Authorization": "Bearer " + os.environ["H3_RUNPOD_API_KEY"], "Content-Type": "application/json", "User-Agent": "curl/8.10"})
    return json.load(urllib.request.urlopen(req, timeout=60))


def submit(inp, endpoint=SWAP_ENDPOINT):
    load_env()
    return _call(endpoint, "/run", {"input": inp}, "POST")["id"]


def wait(job, endpoint=SWAP_ENDPOINT, poll=5, log=print):
    t0, last = time.time(), None
    while True:
        st = _call(endpoint, "/status/" + job)
        if st["status"] != last:
            log(f"  [{job[:8]}] {round(time.time() - t0)}s {st['status']}")
            last = st["status"]
        if st["status"] in ("COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"):
            return st
        time.sleep(poll)


def result_to_file(st, out):
    import base64
    outs = (st.get("output") or {}).get("outputs") or []
    if not outs:
        raise RuntimeError(f"no output: {json.dumps(st)[:600]}")
    art = outs[0]
    if art.get("data"):
        Path(out).write_bytes(base64.b64decode(art["data"]))
    else:
        url = art.get("url") or art.get("public_url")
        req = urllib.request.Request(url, headers={"User-Agent": "curl/8.10"})
        Path(out).write_bytes(urllib.request.urlopen(req, timeout=300).read())
    return Path(out)


def run_swap(video, board, prompt, out, steps=20, extra=None, log=print):
    """Stage a clip and board, run one swap job, save the result. Returns (path, metrics)."""
    v, b = stage(video), stage(board)
    try:
        inp = {"video_url": v, "image_urls": [b], "prompt": prompt, "steps": steps, **(extra or {})}
        job = submit(inp)
        st = wait(job, log=log)
        if st["status"] != "COMPLETED" or (st.get("output") or {}).get("error"):
            raise RuntimeError(f"swap {st['status']}: {json.dumps(st)[:800]}")
        path = result_to_file(st, out)
        return path, (st.get("output") or {}).get("metrics") or {}
    finally:
        unstage(v); unstage(b)


def scale(workers_max, endpoint=SWAP_ENDPOINT):
    """Set the endpoint's workersMax (the site keeps idle endpoints at 0; raise for a session, restore to 0 after)."""
    load_env()
    req = urllib.request.Request(
        f"https://rest.runpod.io/v1/endpoints/{endpoint}", method="PATCH", data=json.dumps({"workersMax": workers_max}).encode(),
        headers={"Authorization": "Bearer " + os.environ["H3_RUNPOD_API_KEY"], "Content-Type": "application/json", "User-Agent": "manifoldgen-ops/1.0"})
    out = json.load(urllib.request.urlopen(req, timeout=60)).get("workersMax")
    time.sleep(10)  # /run keeps answering ENDPOINT_PAUSED for a few seconds after the change
    return out
