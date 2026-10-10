cd /opt/ComfyUI
nohup python3 main.py --listen 127.0.0.1 --port 8188 --use-ck-attention > /tmp/pub/probe_comfy.log 2>&1 &
for i in $(seq 1 120); do curl -s localhost:8188/system_stats >/dev/null && break; sleep 2; done
python3 - <<'PY'
import json,urllib.request
d=json.load(urllib.request.urlopen("http://localhost:8188/object_info"))
for k in ("MiniMaxH3VAEDecodeFast","H3SLAAttention","MiniMaxH3X2DetailedUpscale"):
    print(k, json.dumps(d[k]["input"])[:1500])
PY
pkill -f "main.py --listen"; echo OI_DONE
