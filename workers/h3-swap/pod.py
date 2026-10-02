import json, os, pathlib, secrets, sys, urllib.request
ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
o = urllib.request.build_opener(); o.addheaders = [("User-Agent", "curl/8.10")]; urllib.request.install_opener(o)
import h3_upscale_gpu_probe as p
for line in (ROOT / ".env").read_text().splitlines():
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1); os.environ.setdefault(k, v.strip().strip('"'))
image = os.environ.get("POD_IMAGE") or p.H3_CONFIG["image"]
gpu = sys.argv[1] if len(sys.argv) > 1 else "NVIDIA H100 80GB HBM3"
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
env = {**p.H3_CONFIG["env"], "EXEC_TOKEN": token, "H3_INCLUDE_REF2VA": "1"}
pod = p.call("/pods", "POST", {"name": "h3-swap", "imageName": image, "containerRegistryAuthId": p.registry_auth_id(p.H3_CONFIG),
    "gpuTypeIds": [gpu], "gpuCount": 1, "cloudType": "SECURE", "containerDiskInGb": 150, "volumeInGb": 0, "allowedCudaVersions": ["13.0"],
    "dockerEntrypoint": ["bash", "-lc", script], "dockerStartCmd": [], "ports": ["8000/http", "8001/http"], "env": env})
print(pod["id"], pod.get("costPerHr"), token)
pathlib.Path(os.environ.get("POD_FILE", "/tmp/h3swap_pod")).write_text(json.dumps({"id": pod["id"], "token": token}))
