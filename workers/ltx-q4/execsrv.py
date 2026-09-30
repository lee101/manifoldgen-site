import http.server, os, subprocess, sys
TOKEN = os.environ["EXEC_TOKEN"]
class H(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/run/" + TOKEN:
            self.send_response(404); self.end_headers(); return
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        open("/tmp/exec_job.py", "wb").write(body)
        subprocess.Popen("cd /tmp/bench && python3 -u /tmp/exec_job.py > /tmp/pub/exec.log 2>&1", shell=True)
        self.send_response(202); self.end_headers(); self.wfile.write(b"started")
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(("0.0.0.0", 8001), H).serve_forever()
