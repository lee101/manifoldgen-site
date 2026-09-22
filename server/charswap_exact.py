#!/usr/bin/env python3
"""Helpers for the exact-motion character swap lane.

track      : per-frame person boxes (YOLOv8n-pose), stable left-to-right ids
boxout     : hide every person except one behind a background-coloured box
crops      : cut one reference crop per person out of the swapped frame
composite  : paste each pass's replaced person back onto the original footage
posecheck  : joint error between two videos in torso units
"""
import argparse, json, subprocess, sys
import numpy as np, cv2

FPS = 24


def read_frames(path, w, h, start=0.0, end=None):
    cmd = ['ffmpeg', '-loglevel', 'error']
    if start > 0:
        cmd += ['-ss', f'{start:.3f}']
    cmd += ['-i', path]
    if end is not None:
        cmd += ['-t', f'{max(0.0, end - start):.3f}']
    cmd += ['-vf', f'fps={FPS},scale={w}:{h}', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-']
    raw = subprocess.run(cmd, capture_output=True).stdout
    n = len(raw) // (w * h * 3)
    return np.frombuffer(raw, np.uint8)[:n * w * h * 3].reshape(n, h, w, 3)


def writer(path, w, h):
    return subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{w}x{h}',
                             '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p',
                             '-movflags', '+faststart', path], stdin=subprocess.PIPE)


def model():
    from ultralytics import YOLO
    return YOLO('yolov8n-pose.pt')


def detect(m, frame, conf=0.3):
    r = m.predict(frame, verbose=False, conf=conf)[0]
    people = []
    if r.boxes is not None and len(r.boxes):
        kp = r.keypoints.xyn.cpu().numpy() if r.keypoints is not None else None
        kc = r.keypoints.conf.cpu().numpy() if r.keypoints is not None and r.keypoints.conf is not None else None
        for i, (b, c) in enumerate(zip(r.boxes.xyxy.cpu().numpy(), r.boxes.conf.cpu().numpy())):
            if c < conf:
                continue
            people.append({'box': [float(v) for v in b], 'kp': kp[i] if kp is not None else None, 'kc': kc[i] if kc is not None else None})
    return people


def cmd_track(a):
    m = model()
    F = read_frames(a.src, a.width, a.height)
    per_frame = [detect(m, f) for f in F]
    counts = [len(p) for p in per_frame]
    n_people = int(np.bincount([min(c, 4) for c in counts]).argmax()) if counts else 0
    n_people = max(1, min(a.max_people, n_people))
    # frames with exactly n people define the left-to-right order; others are matched to the nearest id by centre x
    boxes = []
    for people in per_frame:
        people = sorted(people, key=lambda p: (p['box'][0] + p['box'][2]) / 2)
        if len(people) >= n_people:
            # keep the n largest, then order left to right
            people = sorted(sorted(people, key=lambda p: -(p['box'][2] - p['box'][0]) * (p['box'][3] - p['box'][1]))[:n_people],
                            key=lambda p: (p['box'][0] + p['box'][2]) / 2)
            boxes.append([p['box'] for p in people])
        else:
            boxes.append([p['box'] for p in people] + [None] * (n_people - len(people)))
    # fill gaps by carrying the last known box
    last = [None] * n_people
    for row in boxes:
        for k in range(n_people):
            if row[k] is None:
                row[k] = last[k]
            else:
                last[k] = row[k]
    nxt = [None] * n_people
    for row in reversed(boxes):
        for k in range(n_people):
            if row[k] is None:
                row[k] = nxt[k]
            else:
                nxt[k] = row[k]
    json.dump({'fps': FPS, 'width': a.width, 'height': a.height, 'frames': len(F), 'people': n_people, 'boxes': boxes}, open(a.out, 'w'))
    print(json.dumps({'frames': len(F), 'people': n_people}))


def box_fill(frame, box, w, h, pad_frac=0.08):
    x0, y0, x1, y1 = box
    pad = int(pad_frac * (x1 - x0) + 8)
    x0 = max(0, int(x0) - pad); x1 = min(w, int(x1) + pad); y0 = max(0, int(y0) - pad); y1 = min(h, int(y1) + pad)
    if x1 <= x0 or y1 <= y0:
        return frame
    sample = np.concatenate([frame[y0:y1, max(0, x0 - 40):x0].reshape(-1, 3), frame[y0:y1, x1:min(w, x1 + 40)].reshape(-1, 3)], 0)
    col = np.median(sample, 0) if len(sample) else np.median(frame.reshape(-1, 3), 0)
    mask = np.zeros((h, w), np.float32); mask[y0:y1, x0:x1] = 1
    mask = cv2.GaussianBlur(mask, (41, 41), 0)
    return (frame * (1 - mask[..., None]) + col * mask[..., None]).astype(np.uint8)


def cmd_boxout(a):
    meta = json.load(open(a.boxes))
    w, h = meta['width'], meta['height']
    F = read_frames(a.src, w, h, a.start, a.end)
    first = int(round(a.start * FPS))
    out = writer(a.out, w, h)
    for i, f in enumerate(F):
        row = meta['boxes'][min(first + i, len(meta['boxes']) - 1)]
        g = f
        for k, box in enumerate(row):
            if k != a.keep and box is not None:
                g = box_fill(g, box, w, h)
        out.stdin.write(g.tobytes())
    out.stdin.close(); out.wait()
    print(json.dumps({'frames': len(F)}))


def cmd_crops(a):
    meta = json.load(open(a.boxes))
    img = cv2.imread(a.image)
    if img is None:
        sys.exit('cannot read image')
    H, W = img.shape[:2]
    sx, sy = W / meta['width'], H / meta['height']
    row = meta['boxes'][min(a.frame_index, len(meta['boxes']) - 1)]
    paths = []
    for k, box in enumerate(row):
        if box is None:
            paths.append(None); continue
        x0, y0, x1, y1 = box
        cx, cy, bw, bh = (x0 + x1) / 2 * sx, (y0 + y1) / 2 * sy, (x1 - x0) * sx, (y1 - y0) * sy
        bw *= 1.35; bh *= 1.15
        X0, X1 = int(max(0, cx - bw / 2)), int(min(W, cx + bw / 2))
        Y0, Y1 = int(max(0, cy - bh / 2)), int(min(H, cy + bh / 2))
        crop = img[Y0:Y1, X0:X1]
        p = f'{a.out_dir}/crop-{k}.png'
        cv2.imwrite(p, crop); paths.append(p)
    print(json.dumps({'crops': paths}))


def diff_mask(ref, x, w, h):
    g = cv2.cvtColor(cv2.absdiff(x, ref), cv2.COLOR_BGR2GRAY); g = cv2.GaussianBlur(g, (31, 31), 0)
    m = (g > 9).astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((31, 31), np.uint8)); m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((15, 15), np.uint8))
    num, lab, stats, _ = cv2.connectedComponentsWithStats(m)
    if num > 1:
        keep = np.zeros_like(m)
        for i in range(1, num):
            if stats[i, cv2.CC_STAT_AREA] > 0.004 * w * h:
                keep[lab == i] = 255
        m = keep
    m = cv2.dilate(m, np.ones((17, 17), np.uint8))
    return cv2.GaussianBlur(m, (41, 41), 0).astype(np.float32) / 255.0


def cmd_composite(a):
    meta = json.load(open(a.boxes))
    w, h = meta['width'], meta['height']
    O = read_frames(a.src, w, h)
    pairs = []
    for spec in a.pair:
        boxed, generated = spec.split(':', 1)
        pairs.append((read_frames(boxed, w, h), read_frames(generated, w, h)))
    n = min([len(O)] + [min(len(x), len(y)) for x, y in pairs])
    out = writer(a.out, w, h)
    prev = [None] * len(pairs); cov = np.zeros(len(pairs))
    for i in range(n):
        f = O[i].astype(np.float32)
        for k, (B, G) in enumerate(pairs):
            m = diff_mask(B[i], G[i], w, h)
            if prev[k] is not None:
                m = 0.7 * m + 0.3 * prev[k]
            prev[k] = m; cov[k] += (m > 0.5).mean()
            f = f * (1 - m[..., None]) + G[i].astype(np.float32) * m[..., None]
        out.stdin.write(np.clip(f, 0, 255).astype(np.uint8).tobytes())
    out.stdin.close(); out.wait()
    print(json.dumps({'frames': n, 'coverage': [round(float(c / max(n, 1)), 4) for c in cov]}))


def cmd_posecheck(a):
    m = model()
    A = read_frames(a.src, 640, 360); B = read_frames(a.out, 640, 360)
    n = min(len(A), len(B)); step = max(1, FPS // 6)
    errs = []
    for i in range(0, n, step):
        pa = sorted([p for p in detect(m, A[i]) if p['kc'] is not None and (p['kc'] > 0.3).sum() >= 6], key=lambda p: (p['box'][0] + p['box'][2]) / 2)
        pb = sorted([p for p in detect(m, B[i]) if p['kc'] is not None and (p['kc'] > 0.3).sum() >= 6], key=lambda p: (p['box'][0] + p['box'][2]) / 2)
        if not pa or len(pa) != len(pb):
            continue
        d = []
        for x, y in zip(pa, pb):
            mask = (x['kc'] > 0.3) & (y['kc'] > 0.3)
            if mask.sum() < 4:
                continue
            torso = np.linalg.norm(x['kp'][5] - x['kp'][11]) if x['kc'][5] > 0.3 and x['kc'][11] > 0.3 else 0.2
            d.append(float(np.mean(np.linalg.norm(x['kp'][mask] - y['kp'][mask], axis=1)) / max(torso, 0.05)))
        if d:
            errs.append(float(np.mean(d)))
    errs = np.array(errs) if errs else np.array([9.0])
    print(json.dumps({'sampled': int(len(errs)), 'mean_joint_error': round(float(errs.mean()), 4), 'p90': round(float(np.percentile(errs, 90)), 4), 'bad_fraction': round(float((errs > 0.5).mean()), 4)}))


def main():
    p = argparse.ArgumentParser(); s = p.add_subparsers(dest='cmd', required=True)
    t = s.add_parser('track'); t.add_argument('--src', required=True); t.add_argument('--out', required=True); t.add_argument('--width', type=int, default=1280); t.add_argument('--height', type=int, default=720); t.add_argument('--max-people', type=int, default=3); t.set_defaults(f=cmd_track)
    b = s.add_parser('boxout'); b.add_argument('--src', required=True); b.add_argument('--boxes', required=True); b.add_argument('--keep', type=int, required=True); b.add_argument('--out', required=True); b.add_argument('--start', type=float, default=0.0); b.add_argument('--end', type=float, default=None); b.set_defaults(f=cmd_boxout)
    c = s.add_parser('crops'); c.add_argument('--image', required=True); c.add_argument('--boxes', required=True); c.add_argument('--frame-index', type=int, default=0); c.add_argument('--out-dir', required=True); c.set_defaults(f=cmd_crops)
    k = s.add_parser('composite'); k.add_argument('--src', required=True); k.add_argument('--boxes', required=True); k.add_argument('--out', required=True); k.add_argument('--pair', action='append', required=True); k.set_defaults(f=cmd_composite)
    q = s.add_parser('posecheck'); q.add_argument('--src', required=True); q.add_argument('--out', required=True); q.set_defaults(f=cmd_posecheck)
    a = p.parse_args(); a.f(a)


if __name__ == '__main__':
    main()
