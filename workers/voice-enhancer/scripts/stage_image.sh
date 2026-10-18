#!/usr/bin/env bash
# Stage the docker build context: worker code, Seed-VC (with its checkpoints) and
# every model weight the pipeline loads, so the image never downloads at cold start.
#   scripts/stage_image.sh /path/to/context && docker build -t IMAGE /path/to/context
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:?context dir}"
HF="${HF_HOME:-/vfast/data/.cache/huggingface}/hub"
SEP="${VE_SEPARATOR_DIR:-$HOME/.cache/audio-separator}"
rm -rf "$OUT" && mkdir -p "$OUT/app" "$OUT/models/hf/hub" "$OUT/models/separator" "$OUT/models/torch/hub/checkpoints"
cp "$HERE"/{Dockerfile,requirements.txt,constraints.txt,requirements-seedvc.txt} "$OUT/"
cp "$HERE"/{enhance,grid,handler,lyrics,lyrics_tts,mix,quality,svc,vocal,yue_render}.py "$OUT/app/"
rsync -a --exclude .venv --exclude .git --exclude examples --exclude assets "$HERE/tools/seed-vc/" "$OUT/seed-vc/"
# torchaudio 2.10 (the base image's) saves through torchcodec, which is not installed.
python3 - "$OUT/seed-vc/inference.py" <<'PY'
import sys
path = sys.argv[1]
src = open(path).read()
old = "torchaudio.save(os.path.join(args.output, f\"vc_{source_name}_{target_name}_{length_adjust}_{diffusion_steps}_{inference_cfg_rate}.wav\"), vc_wave.cpu(), sr)"
new = "__import__('soundfile').write(os.path.join(args.output, f\"vc_{source_name}_{target_name}_{length_adjust}_{diffusion_steps}_{inference_cfg_rate}.wav\"), vc_wave.cpu().numpy().T, sr)"
assert old in src, "seed-vc save call moved"
open(path, "w").write(src.replace(old, new))
PY
# One snapshot per model, dereferenced (the shared cache links blobs into a
# deduplicated store outside the repo dir). YuE revisions match yue_render.py.
for spec in models--m-a-p--YuE2-3B@14fc6c6f146441b1dd6363fcb2e01e82a6914cb7 \
            models--m-a-p--YuE2-Vae@9a94e1d0ea9f8087e98f77fa88df4a4068104d2a \
            models--Systran--faster-whisper-large-v3@main models--facebook--audiobox-aesthetics@main; do
  repo="${spec%@*}"; rev="${spec#*@}"
  src="$HF/$repo"; [ -d "$src" ] || src="$HOME/.cache/huggingface/hub/$repo"
  [ "$rev" = main ] && rev="$(cat "$src/refs/main")"
  mkdir -p "$OUT/models/hf/hub/$repo/refs" "$OUT/models/hf/hub/$repo/snapshots"
  echo -n "$rev" > "$OUT/models/hf/hub/$repo/refs/main"
  cp -rL "$src/snapshots/$rev" "$OUT/models/hf/hub/$repo/snapshots/"
done
for f in vocals_mel_band_roformer.ckpt vocals_mel_band_roformer.yaml denoise_mel_band_roformer_aufr33_sdr_27.9959.ckpt \
         denoise_mel_band_roformer_aufr33_sdr_27.9959_config.yaml download_checks.json; do
  cp "$SEP/$f" "$OUT/models/separator/"
done
cp "$HOME/.cache/torch/hub/checkpoints/beat_this-final0.ckpt" "$OUT/models/torch/hub/checkpoints/"
du -sh "$OUT"
