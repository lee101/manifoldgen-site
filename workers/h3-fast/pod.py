import json, os, pathlib, secrets, sys, urllib.request
ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
o = urllib.request.build_opener(); o.addheaders = [("User-Agent", "curl/8.10")]; urllib.request.install_opener(o)
import h3_upscale_gpu_probe as p
import music3_bench as bench
bench.load_env(ROOT / ".env")
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
env = {**p.H3_CONFIG["env"], "EXEC_TOKEN": token, "H3_INCLUDE_REF2VA": "1", "HF_HOME": "/runpod-volume/huggingface-cache", "HF_HUB_DISABLE_XET": "1", "HF_TOKEN": os.environ.get("HF_TOKEN", "")}
body = {"name": "h3-fast", "imageName": image, "containerRegistryAuthId": p.registry_auth_id(p.H3_CONFIG),
    "gpuTypeIds": [gpu], "gpuCount": 1, "cloudType": "SECURE", "containerDiskInGb": 100, "dataCenterIds": ["EU-NL-1"],
    "networkVolumeId": "65aknc5k8g", "volumeMountPath": "/runpod-volume",
    "dockerEntrypoint": ["bash", "-lc", script], "dockerStartCmd": [], "ports": ["8000/http", "8001/http"], "env": env}
pod = p.call("/pods", "POST", body)
print(pod["id"], pod.get("costPerHr"), token)
pathlib.Path(os.environ.get("POD_FILE", "/tmp/h3fast_pod")).write_text(json.dumps({"id": pod["id"], "token": token}))
