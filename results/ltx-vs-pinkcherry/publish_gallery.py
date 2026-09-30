import json, os, subprocess, sys, pathlib
from concurrent.futures import ThreadPoolExecutor
ROOT = pathlib.Path("/vfast/data/code/manifoldgen-site")
R = ROOT / "results/ltx-vs-pinkcherry"
S = pathlib.Path("/tmp/claude-1000/-vfast-data-code-manifoldgen-site/5b9213a4-e1b2-45eb-bd8d-c53f20e05158/scratchpad/out")
for line in (ROOT / ".env").read_text().splitlines():
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1); os.environ.setdefault(k, v.strip().strip('"'))
prompts = json.load(open(R / "prompts.json"))
USER = "2176d271-9e3b-4258-97dd-d58e21274e2d"
items = []
for scene in ("rooftop", "apartment", "beach"):
    items += [
        (f"kiss-{scene}-alt-fp8", R / f"ltx/fp8_{scene}.mp4", scene, "manifold-alt", "fp8_two_stage"),
        (f"kiss-{scene}-alt-q4", R / f"ltx/q4_{scene}.mp4", scene, "manifold-alt", "q4_two_stage"),
        (f"kiss-{scene}-adult-lane", R / f"pinkcherry/{scene}.webm", scene, "manifold-h3-adult", "h3_adult"),
    ]
items.append(("kiss-beach-alt-q4-single", S / "kiss3.mp4", "beach", "manifold-alt", "q4_single"))
env = dict(os.environ, AWS_ACCESS_KEY_ID=os.environ["CLOUDFLARE_R2_ACCESS_KEY_ID"], AWS_SECRET_ACCESS_KEY=os.environ["CLOUDFLARE_R2_SECRET_ACCESS_KEY"], AWS_DEFAULT_REGION="auto")
tmp = pathlib.Path("/tmp/gal"); tmp.mkdir(exist_ok=True)

def prep(it):
    slug, src, scene, prov, lane = it
    dst = tmp / f"{slug}.webm"
    if src.suffix == ".webm":
        dst.write_bytes(src.read_bytes())
    else:
        subprocess.check_call(["/usr/bin/ffmpeg", "-v", "error", "-y", "-i", str(src), "-c:v", "libaom-av1", "-crf", "30", "-b:v", "0", "-cpu-used", "6", "-row-mt", "1", "-pix_fmt", "yuv420p", "-c:a", "libopus", "-b:a", "96k", str(dst)])
    subprocess.check_call(["aws", "--endpoint-url", "https://f76d25b8b86cfa5638f43016510d8f77.r2.cloudflarestorage.com", "s3", "cp", str(dst), f"s3://manifoldgenstatic/gallery/videos/{slug}.webm", "--content-type", "video/webm", "--cache-control", "public, max-age=31536000, immutable", "--only-show-errors"], env=env)
    return slug

with ThreadPoolExecutor(6) as ex:
    done = list(ex.map(prep, items))
sql = []
for slug, src, scene, prov, lane in items:
    rj = json.dumps({"size": "720p", "codec": "av1", "quant": lane, "service": "h3_video", "featured": True, "provider": prov,
                     "video_url": f"https://manifoldgenstatic.manifoldgen.com/gallery/videos/{slug}.webm", "output_codec": "webm-av1", "encode_quality": 30}).replace("'", "''")
    sql.append(f"INSERT INTO video_jobs (id,user_id,provider_job_id,service,status,result_json,prompt,settled,created_at,updated_at) VALUES ('video_{slug.replace('-', '_')}','{USER}','video_{slug.replace('-', '_')}','h3_video','completed','{rj}'::jsonb,$q${prompts[scene]}$q$,TRUE,NOW(),NOW()) ON CONFLICT (id) DO UPDATE SET result_json=EXCLUDED.result_json,prompt=EXCLUDED.prompt,updated_at=NOW();")
(tmp / "ins.sql").write_text("\n".join(sql))
print("uploaded", len(done))
