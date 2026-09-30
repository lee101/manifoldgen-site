import json, pathlib, sys, urllib.request
ROOT = pathlib.Path(__file__).resolve().parents[2]
B = ROOT / "results/ltx-vs-pinkcherry/bench"
o = urllib.request.build_opener(); o.addheaders = [("User-Agent", "curl/8")]
pods = json.load(open(B / "pods.json"))
state = {}
for g, v in pods.items():
    u = f"https://{v['id']}-8000.proxy.runpod.net/"
    try:
        b = json.loads(o.open(u + "bench.json", timeout=10).read())
        (B / (g.replace(" ", "_") + ".json")).write_text(json.dumps({**b, "cost_per_hr": v["cost"], "pod": v["id"]}, indent=1))
        state[g] = "done" if b.get("done") or b.get("fatal") else f"{len(b['runs'])} runs"
    except Exception:
        try:
            t = o.open(u + "boot.log", timeout=10).read().decode().splitlines()
            state[g] = "boot: " + (t[-1][:60] if t else "")
        except Exception:
            state[g] = "not up"
print(json.dumps(state, indent=1))
sys.exit(0 if all(s == "done" for s in state.values()) else 1)
