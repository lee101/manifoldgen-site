set -e
R=/vfast/data/code/manifoldgen-site/results/h3-flex-bench
D=/vfast/data/code/vsrbench/clips
mkdir -p $D/gt $D/lr2 $D/lr4 $D/real
for n in dancer tram; do
  ffmpeg -y -v error -i $R/out-run7-hires/pika6_hd_$n.webm -t 3 -vf "fps=24,scale=1920:1088:flags=lanczos" -c:v libx264 -crf 10 -pix_fmt yuv420p $D/gt/$n.mp4
  ffmpeg -y -v error -i $D/gt/$n.mp4 -vf "scale=960:544:flags=bicubic" -c:v libx264 -crf 22 -pix_fmt yuv420p $D/lr2/$n.mp4
  ffmpeg -y -v error -i $D/gt/$n.mp4 -vf "scale=480:272:flags=bicubic" -c:v libx264 -crf 22 -pix_fmt yuv420p $D/lr4/$n.mp4
done
for f in $R/fal/fal_*.mp4; do cp $f $D/real/$(basename $f .mp4 | sed s/fal_//).mp4; done
for f in $D/*/*.mp4; do ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,nb_frames -of csv=p=0 $f | sed "s|^|$f,|"; done
