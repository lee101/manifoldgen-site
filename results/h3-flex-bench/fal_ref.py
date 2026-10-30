"""fal H3 Max reference renders for the bench scenes (production's normal lane). 768P, 5 s, seed 1.
usage: uv run python fal_ref.py [scene ...]"""
import base64, json, os, pathlib, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
for line in (ROOT / ".env").read_text().splitlines():
    if "=" in line and not line.lstrip().startswith("#"):
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))
KEY = os.environ["FAL_KEY"]
SCENES = json.loads((HERE / "scenes.json").read_text())
OUT = HERE / "fal"
OUT.mkdir(exist_ok=True)


def call(url, body=None):
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": f"Key {KEY}", "Content-Type": "application/json", "User-Agent": "manifoldgen-bench/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)


def run(scene):
    s = SCENES[scene]
    payload = {"prompt": s["prompt"], "duration": 5, "resolution": "768P", "seed": 1,
               "enable_safety_checker": True, "prompt_expansion_mode": "disabled"}
    if s.get("first"):
        data = base64.b64encode((HERE / "frames" / s["first"]).read_bytes()).decode()
        payload["image_url"] = "data:image/png;base64," + data
        model = "minimax/h3-max/image-to-video"
    else:
        payload["aspect_ratio"] = s["aspect"]
        model = "minimax/h3-max/text-to-video"
    t = time.time()
    q = call(f"https://queue.fal.run/{model}", payload)
    while True:
        st = call(q["status_url"])
        if st["status"] == "COMPLETED":
            break
        if st["status"] not in {"IN_QUEUE", "IN_PROGRESS"}:
            raise RuntimeError(st)
        time.sleep(5)
    res = call(q["response_url"])
    url = res["video"]["url"]
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "curl/8"}), timeout=300) as r:
        (OUT / f"fal_{scene}.mp4").write_bytes(r.read())
    return {"scene": scene, "wall_s": round(time.time() - t, 1), "url": url, "seed": res.get("seed")}


scenes = sys.argv[1:] or list(SCENES)
with ThreadPoolExecutor(4) as pool:
    results = []
    for scene, fut in [(s, pool.submit(run, s)) for s in scenes]:
        try:
            results.append(fut.result())
        except Exception as err:
            results.append({"scene": scene, "error": repr(err)[:500]})
        print(results[-1], flush=True)
(OUT / "results.json").write_text(json.dumps(results, indent=1))
