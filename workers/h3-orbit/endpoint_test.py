import base64, json, os, sys, time, urllib.request
ROOT = os.path.dirname(os.path.abspath(__file__)) + "/../.."
for line in open(ROOT + "/.env").read().splitlines():
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1); os.environ.setdefault(k, v.strip().strip('"'))
ep = os.environ.get("ORBIT_ENDPOINT") or json.load(open("/tmp/orbit_endpoint.json"))["endpoint"]
def call(path, payload=None, method="GET"):
    req = urllib.request.Request(f"https://api.runpod.ai/v2/{ep}{path}", data=json.dumps(payload).encode() if payload is not None else None, method=method,
        headers={"Authorization": "Bearer " + os.environ["H3_RUNPOD_API_KEY"], "Content-Type": "application/json", "User-Agent": "curl/8.10"})
    return json.load(urllib.request.urlopen(req, timeout=60))
inp = {"image_url": os.environ.get("ORBIT_TEST_IMAGE", "https://manifoldgenstatic.manifoldgen.com/static/tools/orbit-video/witch-input.png"), "seed": 7}
inp.update(json.loads(sys.argv[1]) if len(sys.argv) > 1 else {})
out_path = sys.argv[2] if len(sys.argv) > 2 else "/tmp/orbit_out.mp4"
t0 = time.time(); job = call("/run", {"input": inp}, "POST"); print("queued", job, flush=True)
last = None
while True:
    st = call("/status/" + job["id"])
    if st["status"] != last:
        print(round(time.time() - t0), st["status"], st.get("delayTime"), st.get("executionTime"), flush=True); last = st["status"]
    if st["status"] in ("COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"):
        break
    time.sleep(5)
out = st.get("output") or {}
print(json.dumps({k: v for k, v in st.items() if k != "output"}))
print(json.dumps(out.get("metrics")), out.get("moderation"), st.get("error"))
for art in out.get("outputs") or []:
    if art.get("data"):
        open(out_path, "wb").write(base64.b64decode(art["data"])); print("saved", out_path)
    else:
        print("artifact", art)
