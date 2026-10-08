#!/usr/bin/env bash
# usage: sheets.sh out-hbm3 -> out-hbm3/sheet_<scene>.jpg, rows = arms, cols = frames 12/36/60/84/108
set -euo pipefail
d=$1; cd "$d"
for scene in rooftop apartment beach; do
  rows=()
  for f in $(ls *_"$scene".webm | grep -v '^warmup_'); do
    ffmpeg -loglevel error -y -i "$f" -vf "select='eq(n\,12)+eq(n\,36)+eq(n\,60)+eq(n\,84)+eq(n\,108)',scale=384:-2,drawtext=text='${f%%_*}':x=8:y=8:fontcolor=white:fontsize=20:box=1:boxcolor=black@0.6,tile=5x1" -frames:v 1 "row_$f.jpg"
    rows+=(-i "row_$f.jpg")
  done
  n=$(( ${#rows[@]} / 2 ))
  ffmpeg -loglevel error -y "${rows[@]}" -filter_complex "vstack=inputs=$n" "sheet_$scene.jpg"
  rm -f row_*.jpg
done
