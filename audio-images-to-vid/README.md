# audio-images-to-vid

Turn a finished song plus a set of approved stills into a music video whose cuts
land on the music and whose total length matches the master audio exactly.

Pipeline (four small steps, each resumable):

1. `audiokeys.py` — spectral-flux onset detection over the song, adaptive peak
   picking, then gap filling so no two keypoints are more than `--max-gap`
   (default 2.0s) apart. A separated vocal stem (`--vocal-stem`, demucs via the
   local `appnz-vocal-separator` image) gives per-frame vocal presence; without
   one it falls back to a centre-channel band-energy proxy.
2. `plan.py` — cuts the song into shots on those keypoints. Shot lengths are
   integer 24fps frame counts in the 3–5s band, plus up to `--long-shots` long
   takes of 6–9s over calm stretches (spaced, never at the very start). Shot
   frames sum to exactly `round(duration * 24)`, so the recomposition cannot
   drift. Each shot gets a still, a prompt (singing when vocals are present,
   dancing when not) written to `work/prompts/`, and a driving-audio window that
   is longer than the kept shot — consecutive windows therefore overlap.
3. `render.py` — cuts each driving chunk, uploads chunk and still to R2, and
   submits an audio-driven (Ref2VA) H3 job to the production RunPod endpoint
   from `config/runpod-h3.json`. The chunk length sets the generated length
   (H3 snaps to its `17k+5` frame grid), so ~1–1.5s of every generation is
   deliberately thrown away at the cut.
4. `compose.py` — trims each clip to its planned frame count, concatenates,
   and muxes the original song back as audio track 0 with H3's own generated
   audio kept as track 1. Writes `finalresult/<song>-video.mp4`.

## Run

```sh
cd audio-images-to-vid
SONG=../createdmusic/risingsun-structured.opus

# optional but recommended: real vocal stem for singing detection
docker run -d --rm --gpus all -p 5599:5000 --name aiv-vocsep appnz-vocal-separator:local
python3 - <<'PY'
import base64, json, pathlib, urllib.request
src = pathlib.Path('../createdmusic/risingsun-structured.opus')
uri = 'data:audio/ogg;base64,' + base64.b64encode(src.read_bytes()).decode()
req = urllib.request.Request('http://localhost:5599/predictions',
    data=json.dumps({"input": {"audio": uri, "stems": "two"}}).encode(),
    headers={'Content-Type': 'application/json'})
out = json.load(urllib.request.urlopen(req, timeout=1800))['output']
for name, value in out.items():
    pathlib.Path(f'work/stem_{name}.mp3').write_bytes(base64.b64decode(value.split(',', 1)[1]))
PY
docker stop aiv-vocsep

python3 audiokeys.py --audio $SONG --out work/keypoints.json --vocal-stem work/stem_vocals.mp3
python3 plan.py
python3 render.py --shots 0            # one shot to review
python3 render.py --concurrency 2      # the rest; cached shots are skipped
python3 compose.py
```

Inputs are the ra1 film stills listed in
`netwrck/migrations/torender.txt` (allowlist of image ids) under
`netwrck/migrations/prod_art_generators/out/prod_art_*/ra1/`. Prompts are
derived from each still's own generation prompt plus a performance action.

## Notes

- Credentials come from `../.env` (R2 + `H3_RUNPOD_API_KEY`); H3 only accepts
  public HTTPS inputs, so stills and chunks are uploaded to R2 first.
- `render.py` scales the endpoint up on entry and back to zero on exit unless
  `--keep-warm` is passed. Failed or moderation-blocked shots are recorded in
  `work/jobs/NNN.json` and simply re-run next invocation.
- `compose.py --allow-missing` holds the still for any shot without a clip
  rather than failing, so a partial render still produces a full-length cut.
