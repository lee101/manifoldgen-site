cd /opt/ComfyUI/custom_nodes
Z=$(ls /tmp/hf/hub/models--speach1sdef178--MiniMax-H3-X2-Detail-VAE/snapshots/*/custom_node/*.zip)
python3 -c "import zipfile,sys;zipfile.ZipFile('$Z').extractall('/opt/ComfyUI/custom_nodes')"; ls /opt/ComfyUI/custom_nodes | grep -i x2
cd /opt/ComfyUI
nohup python3 main.py --listen 127.0.0.1 --port 8188 --use-ck-attention > /tmp/pub/probe_comfy.log 2>&1 &
for i in $(seq 1 120); do curl -s localhost:8188/system_stats >/dev/null && break; sleep 2; done
cat > /tmp/oi.py <<'PY'
import sys,json,urllib.request
d=json.load(urllib.request.urlopen("http://localhost:8188/object_info"))
for k,v in d.items():
    s=k+str(v.get("display_name"))
    if any(x in s for x in ("SLA","H3","MiniMax","Sparse","Sol","Spectrum","EasyCache")): print(k,"|",v.get("display_name"),"|",list(v["input"].get("required",{}).keys())[:12])
PY
python3 /tmp/oi.py
cd /opt/ComfyUI; git log -1 --format=%h; pkill -f "main.py --listen" ; echo PROBE_DONE
