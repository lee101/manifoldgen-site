#!/usr/bin/env bash
# Local H3 LoRA A/B via sd.cpp (sdmaster-h3opt). Arms: "name:loraprompt" pairs; scenes from SCENES file (key<TAB>prompt).
# usage: h3_lora_ab.sh OUT [arms...]   env W H F STEPS SEEDS SCENES CLI
# default arms: base (turbo only), enh06, enh10 (turbo + MiniMaxH3 face enhancer)
set -u
OUT=$1; shift
WD=/home/lee/h3-bench-weights
CLI=${CLI:-/vfast/data/code/sdmaster-h3opt/build/bin/sd-cli}
W=${W:-640}; H=${H:-384}; F=${F:-25}; STEPS=${STEPS:-4}; SEEDS=${SEEDS:-42}
SCENES=${SCENES:-$(dirname "$0")/h3_face_scenes.tsv}
ARMS=("$@"); [ ${#ARMS[@]} -eq 0 ] && ARMS=("base:<lora:h3turbo4:1>" "enh06:<lora:h3turbo4:1><lora:h3face_enhancer:0.6>" "enh10:<lora:h3turbo4:1><lora:h3face_enhancer:1>")
mkdir -p "$OUT"
while IFS=$'\t' read -r key prompt; do
  [ -z "$key" ] && continue
  for seed in $SEEDS; do for arm in "${ARMS[@]}"; do
    name=${arm%%:*}; lp=${arm#*:}; d="$OUT/frames/${name}_${key}_s$seed"
    [ -f "$OUT/${name}_${key}_s$seed.mp4" ] && continue
    mkdir -p "$d"; t0=$(date +%s.%N)
    "$CLI" -M vid_gen --diffusion-model $WD/minimax_h3_fl2va_pruned-Q4_K_M.gguf --vae $WD/minimax_h3_video_vae_fp16.safetensors \
      --audio-vae $WD/minimax_h3_audio_vae_fp32.safetensors --llm $WD/qwen3vl_32b_minimax_h3-Q2_K_M.gguf --lora-model-dir $WD/loras \
      -p "$prompt $lp" --cfg-scale 1.0 -W $W -H $H --video-frames $F --steps $STEPS --seed $seed --rng cpu --fps 24 \
      --diffusion-fa --offload-to-cpu --mmap -v -o "$d/f_%03d.png" > "$d/log.txt" 2>&1 || { echo "FAIL $name $key $seed"; tail -3 "$d/log.txt"; continue; }
    ffmpeg -loglevel error -y -framerate 24 -i "$d/f_%03d.png" -c:v libx264 -crf 16 -pix_fmt yuv420p "$OUT/${name}_${key}_s$seed.mp4"
    echo "{\"arm\":\"$name\",\"scene\":\"$key\",\"seed\":$seed,\"wall\":$(echo "$(date +%s.%N) - $t0" | bc)}" >> "$OUT/runs.jsonl"
    echo "$name $key s$seed $(rg -o 'sampling completed.*' "$d/log.txt" | head -1)"
  done; done
done < "$SCENES"
echo "H3 AB DONE"
