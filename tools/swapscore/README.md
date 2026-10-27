# swapscore

Objective scorer for character-swap video: swapped output vs source video vs reference photos. Works on full videos and on short per-clip calls.

```bash
uv run tools/swapscore/swapscore.py --source S.mp4 --output O.mp4 --ref left.jpg --ref right.jpg \
  [--json out.json] [--sheet out.png] [--device cuda|cpu] [--lipsync syncnet|proxy|off]
```

`--ref` is repeated once per identity, ordered left to right as they appear in the source. Without `--ref` the identity metric uses the source's own faces as references (self-test mode). stdout is the one-line verdict (`PASS|WARN|FAIL <overall>: issues`), progress goes to stderr.

First run installs a pinned env (torch 2.8 cu128, onnxruntime-gpu 1.22, ultralytics, insightface, transformers) and downloads weights into `tools/swapscore/.cache` (YOLOv8m-pose, insightface buffalo_l, SyncNet v2 54 MB) and `.cache/hf` (dinov2-small). Needs ffmpeg/ffprobe on PATH. VRAM about 2-3 GB.

Both videos are resampled to 25 fps, truncated to the shorter duration and compared frame by frame. Shots come from ffmpeg `scene > 0.18` on the source (cuts closer than 0.4 s are merged).

## Metrics

All sub-scores are 0-100, higher is better.

- pose: YOLOv8m-pose, persons matched to left-to-right slots (slot x positions come from the source). Joint error = mean distance of shoulders/elbows/wrists/nose/hips after centering on the mid-shoulder and dividing by torso length (shoulder-hip; 1.3x shoulder width when hips are out of frame). Left/right joint labels may be swapped when either person is seen from behind. `score = 100*exp(-err/0.4)`. Independent of framing.
- framing: per frame, person bbox IoU, union (group) bbox IoU, height ratio error, center offset, back/front agreement. `frame = (0.45 iou + 0.25 group_iou + 0.15 exp(-scale_err/0.3) + 0.15 exp(-center_off/0.1)) * (1 - 0.5 view_mismatch)`. View is front if a face is detected (score >= 0.6, or pose keypoints agree) else back, median-smoothed over 7 frames; mismatch = source and output disagree (`back_to_front_rate` is the source-back/output-face case). `view_mismatch_segments` lists the time ranges.
- identity: insightface ArcFace (buffalo_l w600k_r50) cosine between output faces and reference photos, faces assigned to slots by position. `score = 100*clip((cos-0.1)/0.45)`; frames where a face is expected (source or output has one) but the output has none score 0 and count in `no_face_frac`. Same-identity photo-vs-video cosine is typically 0.35-0.6.
- lipsync: SyncNet v2 (syncnet_python weights, Oxford VGG) on face tracks of the output plus its audio, offset search +-15 frames, LSE-D and LSE-C pooled over windows. The same measurement on the source is the ceiling: `score = 100*clip(lse_c_out / max(lse_c_src, 1.5))`. Per-shot values need >= 25 windows (1 s of tracked face). `--lipsync proxy` instead correlates the mouth opening (insightface 106 landmarks, lips height/width) with audio RMS over +-4 frames, ceiling = same on the source. `method` in the JSON says which ran. No audio in either file means lipsync is null.
- background: mean CIE Lab distance between output and source over pixels outside every person box (15% margin) in both videos. `score = 100*exp(-drift/20)`.
- jumps: count of output frame diffs > 18 (mean abs gray diff at 160x90) with source diff < 9 within +-0.25 s.
- repeat_composition: for shot pairs, mean of `max(0, sim_out - sim_src)` where sim is a person-box layout similarity (`exp(-dist/0.35)`) and a mean-centered DINOv2 CLS cosine. High means output shots look alike where source shots differ. `score = 100*clip(1 - v/0.5)`. Needs >= 3 shots; null for single-shot clips.
- overall: weighted mean of available sub-scores, weights pose .20, framing .28, identity .22, lipsync .08, background .05, repeat .10, jumps .07. Verdict grade: PASS >= 70, WARN >= 50, FAIL below; PASS drops to WARN if pose/framing/identity/lipsync is below 35. Thresholds are uncalibrated heuristics.

## JSON

`overall, scores{}, pose{joint_err_torso, per_shot[]}, framing{bbox_iou_mean, group_iou_mean, scale_ratio_err, center_off_mean, area_ratio_gm, view_mismatch_rate, view_mismatch_segments, back_to_front_rate, person_count_mismatch_rate, per_shot[]}, identity{cos_mean, per_character[], per_shot[]}, lipsync{score, method, clip, source, per_shot[]}, background{color_drift}, jumps, jump_times, repeat_composition, repeat_detail{pairs[]}, per_shot[{start,end,pose,framing,identity,lipsync,score}], timeline (5 Hz), verdict, meta{timing, runtime_s}`.

## Contact sheet

`--sheet` writes source row over output row, one frame per shot (middle frame), person boxes in green/blue per slot, face boxes yellow, caption per shot colored green/amber/red by shot score.

## Speed

RTX 3090 Ti: about 52 s for a 30 s 720p pair, about 12 s for a 5 s clip pair (warm).
