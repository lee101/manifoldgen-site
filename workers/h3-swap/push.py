import base64, json, pathlib, subprocess, sys
H = pathlib.Path(__file__).parent
# usage: push.py name cmd-file [file:dest ...]
name, cmd = sys.argv[1], sys.argv[2]
out = ["set -e"]
for spec in sys.argv[3:]:
    f, dest = spec.split(":")
    data = base64.b64encode(pathlib.Path(f).read_bytes()).decode()
    out.append(f"mkdir -p $(dirname {dest}); base64 -d > {dest} <<'B64EOF'\n{data}\nB64EOF")
out.append(pathlib.Path(cmd).read_text())
p = pathlib.Path(f"/tmp/push-{name}.sh"); p.write_text("\n".join(out))
print(subprocess.run([str(H / "run.sh"), name, str(p)], capture_output=True, text=True).stdout)
