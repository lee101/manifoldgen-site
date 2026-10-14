#!/bin/bash
set -u
K=$(cd "$(dirname "$0")" && pwd)
OUT=${OUT:-/tmp/prodkit-test}
TD=$K/testdata
FFPROBE=${FFPROBE:-/usr/bin/ffprobe}
rm -rf "$OUT"; mkdir -p "$OUT"
blender -b --factory-startup -P "$K/make_testdata.py" 2>&1 | grep "testdata ready" || { echo "testdata failed"; exit 1; }
pass=0; fail=0

run() {
  local name=$1 recipe=$2 params=$3 inputs=${4:-'{}'} expect=${5:-ok}
  local d=$OUT/$name
  mkdir -p "$d"
  printf '{"recipe":"%s","out":"%s","params":%s,"inputs":%s}' "$recipe" "$d" "$params" "$inputs" > "$d.json"
  local t0=$(date +%s)
  blender -b --factory-startup -P "$K/run_blender.py" -- "$d.json" > "$d.log" 2>&1
  local code=$? dt=$(( $(date +%s) - t0 ))
  local res
  res=$(python3 - "$d" "$code" "$expect" "$FFPROBE" <<'EOF'
import json, os, subprocess, sys
d, code, expect, ffprobe = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]
try:
    m = json.load(open(os.path.join(d, "manifest.json")))
except Exception as e:
    print("FAIL no manifest"); sys.exit()
if expect == "fail":
    print("PASS" if (not m.get("ok") and code != 0 and m.get("error")) else "FAIL expected failure"); sys.exit()
if not m.get("ok") or code != 0:
    print("FAIL", m.get("error")); sys.exit()
for k in ("video", "poster", "blend"):
    if not os.path.getsize(os.path.join(d, m[k])):
        print("FAIL missing", k); sys.exit()
p = subprocess.run([ffprobe, "-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=width,height,nb_read_frames", "-of", "json", os.path.join(d, m["video"])], capture_output=True, text=True)
s = json.loads(p.stdout)["streams"][0]
ok = s["width"] == m["width"] and s["height"] == m["height"] and int(s["nb_read_frames"]) == m["frames"]
print(("PASS" if ok else "FAIL probe") + f' {m["width"]}x{m["height"]} {m["frames"]}f {m["device"]} render={m["render_seconds"]}s blend={m["stats"].get("blend_mb")}MB glb={m.get("glb")}')
EOF
)
  case $res in PASS*) pass=$((pass+1));; *) fail=$((fail+1));; esac
  printf '%-22s %4ss  %s\n' "$name" "$dt" "$res"
}

D='"quality":"draft","duration":2'
run destruction_tower destruction "{$D,\"subject\":\"tower\",\"impact\":\"ball\"}"
run destruction_duck destruction "{$D,\"impact\":\"explosion\",\"pieces\":40}" "{\"model_path\":\"$TD/Duck.glb\"}"
run destruction_obj destruction "{$D,\"impact\":\"quake\",\"material\":\"marble\"}" "{\"model_path\":\"$TD/bunny_open.obj\"}"
run destruction_slice destruction "{$D,\"subject\":\"pillar\",\"impact\":\"slice\",\"slowmo\":true,\"aspect\":\"9:16\"}"
run exploded_demo exploded_view "{$D,\"demo\":\"camera\"}"
run exploded_glb exploded_view "{$D,\"axis\":\"vertical\",\"aspect\":\"1:1\"}" "{\"model_path\":\"$TD/watch_parts.glb\"}"
run exploded_helmet exploded_view "{$D,\"mode\":\"explode\"}" "{\"model_path\":\"$TD/DamagedHelmet.glb\"}"
run toon_helmet toon_shader "{$D,\"style\":\"anime\"}" "{\"model_path\":\"$TD/DamagedHelmet.glb\"}"
run toon_demo toon_shader "{$D,\"style\":\"comic\",\"palette\":[\"#ff595e\",\"#1982c4\"]}"
run scene_spec scene "{$D,\"spec\":{\"objects\":[{\"type\":\"cube\",\"location\":[0,0,0.5],\"keyframes\":[{\"frame\":1,\"rotation\":[0,0,0]},{\"frame\":48,\"rotation\":[0,0,90]}]},{\"type\":\"model\",\"model_index\":0,\"location\":[1.5,0,0.5]},{\"type\":\"text\",\"text\":\"Hi\",\"location\":[-1.5,0,0.5],\"rotation\":[90,0,0],\"material\":{\"color\":\"#ff0066\",\"toon\":true}}]}}" "{\"model_paths\":[\"$TD/Duck.glb\"]}"
run bad_recipe nope '{}' '{}' fail
run bad_model destruction "{$D}" '{"model_path":"/nonexistent.glb"}' fail
echo "pass=$pass fail=$fail out=$OUT"
[ $fail -eq 0 ]
