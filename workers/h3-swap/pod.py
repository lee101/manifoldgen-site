import json, os, pathlib, secrets, sys, urllib.request

KEY = os.environ.get("RUNPOD_API_KEY") or os.environ["H3_RUNPOD_API_KEY"]
CFG = json.loads((pathlib.Path(__file__).resolve().parents[2] / "config/runpod-h3-swap.json").read_text())


def call(path, method="GET", payload=None):
    req = urllib.request.Request("https://rest.runpod.io/v1" + path, method=method, data=json.dumps(payload).encode() if payload is not None else None,
                                 headers={"Authorization": "Bearer " + KEY, "Content-Type": "application/json", "User-Agent": "curl/8.10"})
    try:
        return json.load(urllib.request.urlopen(req, timeout=60))
    except urllib.error.HTTPError as error:
        sys.exit(f"{error.code} {error.read()[:400].decode()}")


image = os.environ.get("POD_IMAGE") or CFG["image"]
gpu = sys.argv[1] if len(sys.argv) > 1 else "NVIDIA H100 80GB HBM3"
cloud = sys.argv[2] if len(sys.argv) > 2 else "SECURE"
token = secrets.token_hex(8)
script = r'''
mkdir -p /tmp/pub /tmp/bench; cd /tmp/pub
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
        subprocess.Popen("cd /tmp/bench && bash -x /tmp/%s.sh > /tmp/pub/%s.log 2>&1; echo EXIT:$? >> /tmp/pub/%s.log" % (name, name, name), shell=True)
        self.send_response(202); self.end_headers(); self.wfile.write(b"started")
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(("0.0.0.0", 8001), H).serve_forever()
PY
exec python3 /tmp/execsrv.py
'''
auth = call("/templates/jm5rc2f10w").get("containerRegistryAuthId")
env = {**CFG["env"], "EXEC_TOKEN": token}
pod = call("/pods", "POST", {"name": "h3-swap-bench", "imageName": image, "containerRegistryAuthId": auth, "gpuTypeIds": [gpu], "gpuCount": 1,
    "cloudType": cloud, "containerDiskInGb": 150, "volumeInGb": 0, **({"allowedCudaVersions": os.environ["ALLOWED_CUDA"].split(",")} if os.environ.get("ALLOWED_CUDA") else {}), "dockerEntrypoint": ["bash", "-lc", script],
    "dockerStartCmd": [], "ports": ["8000/http", "8001/http"], "env": env})
print(pod["id"], pod.get("costPerHr"), token)
pathlib.Path(os.environ.get("POD_FILE", "/tmp/h3swap_pod")).write_text(json.dumps({"id": pod["id"], "token": token}))
