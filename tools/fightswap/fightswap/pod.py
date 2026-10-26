"""One scratch H100 pod for a whole session: start it, queue every job through the warm daemon, fetch results, stop it."""
from __future__ import annotations

import json
import os
import secrets
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from . import cloud

ROOT = cloud.ROOT
STATE = Path(os.environ.get("FIGHTSWAP_POD_FILE", "/tmp/fightswap_pod.json"))
BOOT = r'''
mkdir -p /tmp/pub /tmp/queue; cd /tmp/pub
(python3 -m http.server 8000 --directory /tmp/pub >/dev/null 2>&1 &)
cat > /tmp/execsrv.py <<'PY'
import http.server, os, subprocess
T = os.environ["EXEC_TOKEN"]
class H(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        if not self.path.startswith("/run/" + T):
            self.send_response(404); self.end_headers(); return
        name = self.path.split("name=")[-1] if "name=" in self.path else "exec"
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        open("/tmp/%s.sh" % name, "wb").write(body)
        subprocess.Popen("bash /tmp/%s.sh > /tmp/pub/%s.log 2>&1; echo EXIT:$? >> /tmp/pub/%s.log" % (name, name, name), shell=True)
        self.send_response(202); self.end_headers(); self.wfile.write(b"started")
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(("0.0.0.0", 8001), H).serve_forever()
PY
exec python3 /tmp/execsrv.py
'''


def _probe():
    sys.path.insert(0, str(ROOT / "scripts"))
    o = urllib.request.build_opener(); o.addheaders = [("User-Agent", "curl/8.10")]; urllib.request.install_opener(o)
    import h3_upscale_gpu_probe as p
    return p


def state():
    return json.loads(STATE.read_text()) if STATE.exists() else None


GPU_ORDER = ["NVIDIA H100 80GB HBM3", "NVIDIA H100 PCIe", "NVIDIA H100 NVL", "NVIDIA H200", "NVIDIA RTX PRO 6000 Blackwell Server Edition", "NVIDIA A100-SXM4-80GB", "NVIDIA A100 80GB PCIe"]


BUDGET = Path(os.environ.get("FIGHTSWAP_BUDGET", str(Path(__file__).resolve().parents[1] / ".budget.json")))
DAILY_CAP_MIN = int(os.environ.get("FIGHTSWAP_DAILY_MINUTES", "240"))


def _budget(add):
    """Per-day pod-minute cap (openkernels/rp.py pattern); raise FIGHTSWAP_DAILY_MINUTES deliberately."""
    import datetime
    data = json.loads(BUDGET.read_text()) if BUDGET.exists() else {}
    day = datetime.date.today().isoformat()
    if data.get(day, 0) + add > DAILY_CAP_MIN:
        raise RuntimeError(f"pod budget: {data.get(day, 0)} + {add} > {DAILY_CAP_MIN} min today")
    data[day] = data.get(day, 0) + add
    BUDGET.write_text(json.dumps(data))


def up(gpus=None, log=print, minutes=150):
    """Create the pod (or reuse the one in the state file) and start the daemon. Returns the state dict."""
    st = state()
    if st:
        log(f"reusing pod {st['id']}")
        return st
    _budget(minutes)
    cloud.load_env()
    p = _probe()
    swap_cfg = json.loads((ROOT / "config/runpod-h3-swap.json").read_text())
    token = secrets.token_hex(8)
    env = {**swap_cfg["env"], "EXEC_TOKEN": token, "H3_INCLUDE_REF2VA": "1"}
    pod = None
    for cloud_type in ("SECURE", "COMMUNITY"):
        for gpu in gpus or GPU_ORDER:
            try:
                pod = p.call("/pods", "POST", {"name": "fightswap-session", "imageName": swap_cfg["image"], "containerRegistryAuthId": p.registry_auth_id(p.H3_CONFIG),
                    "gpuTypeIds": [gpu], "gpuCount": 1, "cloudType": cloud_type, "containerDiskInGb": 150, "volumeInGb": 0, "allowedCudaVersions": ["13.0"],
                    "dockerEntrypoint": ["bash", "-lc", BOOT], "dockerStartCmd": [], "ports": ["8000/http", "8001/http"], "env": env})
                log(f"got {gpu} ({cloud_type})")
                break
            except urllib.error.HTTPError as exc:
                log(f"  {gpu} {cloud_type}: {exc.code} {exc.read()[:80]!r}")
        if pod:
            break
    if not pod:
        raise RuntimeError("no GPU available")
    ttl = time.time() + minutes * 60
    st = {"id": pod["id"], "token": token, "cost_per_hr": pod.get("costPerHr"), "started": time.time(), "ttl": ttl, "gpu": gpu}
    STATE.write_text(json.dumps(st))
    import subprocess
    subprocess.Popen([sys.executable, "-m", "fightswap.watchdog", pod["id"], str(ttl)], start_new_session=True, cwd=str(Path(__file__).resolve().parents[1]),
                     stdout=open("/tmp/fightswap_watchdog.log", "a"), stderr=subprocess.STDOUT)
    log(f"pod {pod['id']} ${pod.get('costPerHr')}/hr")
    for _ in range(120):
        try:
            urllib.request.urlopen(urllib.request.Request(f"https://{st['id']}-8000.proxy.runpod.net/", headers={"User-Agent": "curl/8.10"}), timeout=10)
            break
        except Exception:
            time.sleep(10)
    daemon = (Path(__file__).parent / "daemon.py").read_text()
    exec_script(st, "daemon", f"cat > /tmp/daemon.py <<'PYEOF'\n{daemon}\nPYEOF\ncd /src && exec python3 -u /tmp/daemon.py")
    return st


def exec_script(st, name, script):
    req = urllib.request.Request(f"https://{st['id']}-8001.proxy.runpod.net/run/{st['token']}?name={name}", data=script.encode(), method="POST",
                                 headers={"User-Agent": "curl/8.10"})
    return urllib.request.urlopen(req, timeout=60).read()


def pub(st, name):
    return f"https://{st['id']}-8000.proxy.runpod.net/{name}"


def _get(url):
    try:
        return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "curl/8.10"}), timeout=60).read()
    except Exception:
        return None


def log_tail(st, name="daemon", n=15):
    data = _get(pub(st, name + ".log"))
    return "\n".join((data or b"").decode(errors="replace").splitlines()[-n:])


def queue(st, jobs):
    """Stage inputs on R2 (already URLs) and drop job files into the pod's queue in one exec."""
    parts = [f"rm -f /tmp/pub/{j['name']}.err /tmp/pub/{j['name']}.json /tmp/pub/{j['name']}.mp4" for j in jobs]
    for i, j in enumerate(jobs):
        parts.append(f"cat > /tmp/queue/{int(time.time())}-{i:03d}-{j['name']}.json <<'JEOF'\n{json.dumps(j)}\nJEOF")
    exec_script(st, f"q{int(time.time())}", "\n".join(parts))


def wait_jobs(st, names, poll=15, log=print, timeout=3 * 3600):
    """Block until every named job has produced .mp4 or .err on the pod. Returns {name: 'ok'|error text}."""
    done, t0 = {}, time.time()
    while len(done) < len(names) and time.time() - t0 < timeout:
        for n in names:
            if n in done:
                continue
            if _get(pub(st, n + ".json")) is not None:
                done[n] = "ok"; log(f"  done {n}")
            elif (err := _get(pub(st, n + ".err"))) is not None:
                done[n] = err.decode(); log(f"  FAIL {n}: {done[n][:200]}")
        if len(done) < len(names):
            time.sleep(poll)
    return done


def fetch(st, name, dest):
    Path(dest).write_bytes(urllib.request.urlopen(urllib.request.Request(pub(st, name + ".mp4"), headers={"User-Agent": "curl/8.10"}), timeout=300).read())
    return Path(dest)


def down(log=print):
    st = state()
    if not st:
        return
    cloud.load_env()
    p = _probe()
    log(p.call(f"/pods/{st['id']}", "DELETE"))
    STATE.unlink(missing_ok=True)


def sync_src(st, files=("swap_runtime.py", "swap_graph.py", "swap_weights.py", "swap_handler.py", "swap_relay.py"), restart=True):
    """Overlay the repo's current workers/h3-swap sources on the pod's /src (the pushed image can lag the repo) and restart the daemon."""
    import base64
    src = ROOT / "workers/h3-swap"
    parts = [f"base64 -d > /src/{f} <<'B64'\n{base64.b64encode((src / f).read_bytes()).decode()}\nB64" for f in files]
    if restart:
        daemon = (Path(__file__).parent / "daemon.py").read_text()
        parts += ["pkill -f /tmp/daemon.py; pkill -f 'main.py --listen'; sleep 3",
                  f"cat > /tmp/daemon.py <<'PYEOF'\n{daemon}\nPYEOF",
                  "cd /src && nohup python3 -u /tmp/daemon.py > /tmp/pub/daemon.log 2>&1 &"]
    exec_script(st, f"sync{int(time.time())}", "\n".join(parts))
