import base64, json, os, sys, time, urllib.request
ROOT = os.path.dirname(os.path.abspath(__file__)) + "/../.."
for line in open(ROOT + "/.env").read().splitlines():
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1); os.environ.setdefault(k, v.strip().strip('"'))
ep = json.load(open("/tmp/swap_endpoint.json"))["endpoint"]
def call(path, payload=None, method="GET"):
    req = urllib.request.Request(f"https://api.runpod.ai/v2/{ep}{path}", data=json.dumps(payload).encode() if payload is not None else None, method=method,
        headers={"Authorization": "Bearer " + os.environ["H3_RUNPOD_API_KEY"], "Content-Type": "application/json", "User-Agent": "curl/8.10"})
    return json.load(urllib.request.urlopen(req, timeout=60))
P = "Replace both men in <Video 1> with the two characters in <Picture 1>: the man on the left becomes the suited man, the man on the right becomes the white and black humanoid robot. Keep each replacement character's identity, outfit, and look from <Picture 1>. Preserve the source video's camera, background, lighting and objects. Match each person's position, scale, pose, and movement. Do not show the reference image or its background."
inp = {"video_url": os.environ.get("SWAP_TEST_VIDEO", "https://manifoldgenstatic.manifoldgen.com/static/tools/character-swap/rapvid-source.mp4"),
       "image_urls": [os.environ.get("SWAP_TEST_IMAGE", "https://manifoldgenstatic.manifoldgen.com/static/tools/character-swap/rapvid-swapped.png")], "prompt": P, "steps": int(sys.argv[1]) if len(sys.argv) > 1 else 8, "seed": 7}
inp.update(json.loads(sys.argv[2]) if len(sys.argv) > 2 else {})
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
    data = art.get("data")
    if data:
        open("/tmp/endpoint_out.mp4", "wb").write(base64.b64decode(data)); print("saved /tmp/endpoint_out.mp4", len(data))
    else:
        print("artifact", art)
