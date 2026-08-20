"""Shared helpers: env, R2 presign/upload, RunPod H3 client, ffmpeg."""
from __future__ import annotations

import datetime as dt
import hashlib
import hmac
import json
import os
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SITE = ROOT.parent
FPS = 24
GRID = [f for f in range(5, 400) if f % 17 == 5]


def load_env(path: Path | None = None) -> None:
    path = path or (SITE / ".env")
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def required(*names: str) -> str:
    for name in names:
        if value := os.environ.get(name):
            return value
    raise RuntimeError(f"missing env: {' or '.join(names)}")


def aligned_frames(seconds: float) -> int:
    frames = max(5, round(float(seconds) * FPS))
    while frames % 17 != 5:
        frames += 1
    return frames


def grid_seconds_at_least(seconds: float) -> float:
    """Smallest H3 grid length (seconds) >= seconds, clamped to the 4..15s single-shot window."""
    target = max(4.0, min(15.0, seconds))
    for frames in GRID:
        if frames / FPS >= target - 1e-6 and 4.0 <= frames / FPS <= 15.09:
            return frames / FPS
    return GRID[-1] / FPS


# ---------------------------------------------------------------- R2

def _hmac(key: bytes, value: str) -> bytes:
    return hmac.new(key, value.encode(), hashlib.sha256).digest()


def _canonical_query(values: dict[str, str]) -> str:
    quote = lambda value: urllib.parse.quote(value, safe="-_.~")
    return "&".join(f"{quote(key)}={quote(values[key])}" for key in sorted(values))


def presign_put(key: str, expires: int = 21600) -> str:
    account = required("R2_ACCOUNT_ID")
    bucket = required("R2_BUCKET")
    access = required("R2_ACCESS_KEY_ID", "CLOUDFLARE_R2_ACCESS_KEY_ID")
    secret = required("R2_SECRET_ACCESS_KEY", "CLOUDFLARE_R2_SECRET_ACCESS_KEY")
    host = f"{account}.r2.cloudflarestorage.com"
    now = dt.datetime.now(dt.timezone.utc)
    date_stamp = now.strftime("%Y%m%d")
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    scope = f"{date_stamp}/auto/s3/aws4_request"
    query = {
        "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
        "X-Amz-Credential": f"{access}/{scope}",
        "X-Amz-Date": amz_date,
        "X-Amz-Expires": str(expires),
        "X-Amz-SignedHeaders": "host",
    }
    escaped = "/".join(urllib.parse.quote(part, safe="-_.~") for part in key.split("/"))
    uri = f"/{urllib.parse.quote(bucket, safe='-_.~')}/{escaped}"
    request = "\n".join(["PUT", uri, _canonical_query(query), f"host:{host}\n", "host", "UNSIGNED-PAYLOAD"])
    to_sign = "\n".join([
        "AWS4-HMAC-SHA256", amz_date, scope, hashlib.sha256(request.encode()).hexdigest(),
    ])
    k_date = _hmac(("AWS4" + secret).encode(), date_stamp)
    k_signing = _hmac(_hmac(_hmac(k_date, "auto"), "s3"), "aws4_request")
    query["X-Amz-Signature"] = hmac.new(k_signing, to_sign.encode(), hashlib.sha256).hexdigest()
    return f"https://{host}{uri}?{_canonical_query(query)}"


def public_url(key: str) -> str:
    host = required("R2_PUBLIC_HOST")
    escaped = "/".join(urllib.parse.quote(part, safe="-_.~") for part in key.split("/"))
    return f"https://{host}/{escaped}"


CONTENT_TYPES = {
    ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".wav": "audio/wav", ".opus": "audio/ogg", ".ogg": "audio/ogg", ".mp3": "audio/mpeg",
    ".webm": "video/webm", ".mp4": "video/mp4", ".json": "application/json",
}


def upload(path: Path, key: str) -> str:
    url = presign_put(key)
    data = path.read_bytes()
    request = urllib.request.Request(url, data=data, method="PUT")
    request.add_header("Content-Type", CONTENT_TYPES.get(path.suffix.lower(), "application/octet-stream"))
    request.add_header("Content-Length", str(len(data)))
    with urllib.request.urlopen(request, timeout=300) as response:
        if response.status >= 300:
            raise RuntimeError(f"R2 upload {key} -> {response.status}")
    return public_url(key)


USER_AGENT = "audio-images-to-vid/1.0 (+manifoldgen)"


def download(url: str, destination: Path, attempts: int = 5) -> Path:
    # The R2 public host sits behind Cloudflare, which rejects the default
    # urllib User-Agent with a 403, and briefly 404s a freshly written key.
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(request, timeout=600) as response:
                destination.write_bytes(response.read())
            return destination
        except urllib.error.HTTPError as error:
            if attempt == attempts - 1 or error.code not in (403, 404, 429, 500, 502, 503):
                raise
            time.sleep(3 * (attempt + 1))
    return destination


# ------------------------------------------------------------ RunPod

def runpod_config() -> dict:
    return json.loads((SITE / "config/runpod-h3.json").read_text())


def api(url: str, payload: dict | None = None, *, method: str | None = None, timeout: int = 60) -> dict:
    key = required("RUNPOD_API_KEY", "H3_RUNPOD_API_KEY")
    data = json.dumps(payload).encode() if payload is not None else None
    request = urllib.request.Request(url, data=data, method=method)
    request.add_header("Authorization", f"Bearer {key}")
    if data is not None:
        request.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.load(response)


ACTIVATION = {"workersMax": 2, "workersMin": 0, "scalerType": "REQUEST_COUNT", "scalerValue": 1}
TERMINAL = {"COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"}


def endpoint_workers_max(endpoint: str) -> int:
    return int(api(f"https://rest.runpod.io/v1/endpoints/{endpoint}").get("workersMax") or 0)


def activate(endpoint: str, workers_max: int = 2) -> None:
    api(f"https://rest.runpod.io/v1/endpoints/{endpoint}",
        {**ACTIVATION, "workersMax": workers_max}, method="PATCH")


def scale_to_zero_if_idle(endpoint: str) -> None:
    health = api(f"https://api.runpod.ai/v2/{endpoint}/health")
    jobs = health.get("jobs") or {}
    if int(jobs.get("inProgress") or 0) + int(jobs.get("inQueue") or 0) == 0:
        api(f"https://rest.runpod.io/v1/endpoints/{endpoint}", {"workersMax": 0}, method="PATCH")


def submit(endpoint: str, payload: dict, attempts: int = 7) -> str:
    base = f"https://api.runpod.ai/v2/{endpoint}"
    for attempt in range(attempts):
        try:
            return api(base + "/run", payload)["id"]
        except urllib.error.HTTPError as exc:
            detail = exc.read(2048).decode(errors="replace")
            if exc.code != 409 or "ENDPOINT_PAUSED" not in detail or attempt == attempts - 1:
                raise RuntimeError(f"RunPod submit HTTP {exc.code}: {detail}") from exc
            activate(endpoint)
            time.sleep(5)
    raise RuntimeError("unreachable")


def wait(endpoint: str, job_id: str, timeout: int = 3600, poll: int = 5, log=print) -> dict:
    base = f"https://api.runpod.ai/v2/{endpoint}"
    deadline = time.monotonic() + timeout
    state: dict = {"status": "QUEUED"}
    last = ""
    while state.get("status") not in TERMINAL:
        if time.monotonic() >= deadline:
            raise TimeoutError(f"job {job_id} exceeded {timeout}s")
        time.sleep(poll)
        state = api(base + "/status/" + urllib.parse.quote(job_id, safe=""))
        status = str(state.get("status"))
        if status != last:
            log(f"  {job_id} {status}")
            last = status
    return state


# ------------------------------------------------------------ ffmpeg

def run(cmd: list[str]) -> None:
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"{cmd[0]} failed: {proc.stderr[-2000:]}")


def probe_duration(path: Path) -> float:
    proc = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)],
        capture_output=True, text=True, check=True)
    return float(proc.stdout.strip())
