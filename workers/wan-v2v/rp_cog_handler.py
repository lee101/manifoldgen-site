"""RunPod Serverless adapter for the Wan video-to-video Cog."""

import base64
import mimetypes
import os
import subprocess
import time

import requests
import runpod


COG_URL = "http://127.0.0.1:5000"
_cog_started = False


def _start_cog():
    global _cog_started
    if _cog_started:
        return
    command = os.environ.get("COG_CMD", "python -m cog.server.http")
    subprocess.Popen(command, shell=True, cwd=os.environ.get("COG_DIR", "/src"))
    _cog_started = True


def _wait_for_cog():
    deadline = time.time() + 1800
    while time.time() < deadline:
        try:
            response = requests.get(COG_URL + "/health-check", timeout=5)
            if response.ok and "READY" in response.text.upper():
                return
        except requests.RequestException:
            pass
        try:
            if requests.get(COG_URL + "/openapi.json", timeout=5).ok:
                return
        except requests.RequestException:
            pass
        time.sleep(2)
    raise RuntimeError("Cog server never became ready")


def _serverless_output(output):
    if not isinstance(output, str) or not output.startswith("file://"):
        return output
    path = output[7:]
    content_type = mimetypes.guess_type(path)[0] or "application/octet-stream"
    with open(path, "rb") as generated:
        data = base64.b64encode(generated.read()).decode("ascii")
    return {
        "outputs": [{
            "filename": os.path.basename(path),
            "content_type": content_type,
            "data": data,
        }]
    }


def handler(job):
    _start_cog()
    _wait_for_cog()
    inputs = job.get("input") or {}
    # Tolerate the legacy double envelope while app.nz clients migrate.
    inputs = inputs.get("input", inputs)
    response = requests.post(
        COG_URL + "/predictions",
        json={"input": inputs},
        timeout=3600,
    )
    response.raise_for_status()
    prediction = response.json()
    if str(prediction.get("status", "")).lower() == "failed":
        raise RuntimeError(prediction.get("error") or "prediction failed")
    return _serverless_output(prediction.get("output"))


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
