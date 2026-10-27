#!/usr/bin/env python3
"""Helpers for the exact-motion character swap lane.

track      : per-frame person boxes (YOLOv8n-pose), stable left-to-right ids
boxout     : hide every person except one behind a background-coloured box
crops      : cut one reference crop per person out of the swapped frame
composite  : paste each pass's replaced person back onto the original footage
posecheck  : joint error between two videos in torso units
shotinfo   : person boxes and face visibility of one still
shotcheck  : compare a swapped keyframe against its source frame (people, order, framing, face views)
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


def cmd_blurfaces(a):
    m = model()
    probe = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', a.src], capture_output=True, text=True).stdout.strip().split(',')
    w, h = int(probe[0]), int(probe[1])
    F = read_frames(a.src, w, h)
    out = writer(a.out, w, h)
    hidden = 0
    for f in F:
        g = f.copy()
        r = m.predict(f, verbose=False, conf=0.25)[0]
        if r.keypoints is not None and r.keypoints.xy is not None:
            kps = r.keypoints.xy.cpu().numpy(); kcs = r.keypoints.conf.cpu().numpy() if r.keypoints.conf is not None else None
            boxes = r.boxes.xyxy.cpu().numpy() if r.boxes is not None else []
            for i, kp in enumerate(kps):
                pts = [kp[j] for j in range(5) if kcs is None or kcs[i][j] > 0.3]
                if len(pts) < 2:
                    if i < len(boxes):
                        x0, y0, x1, y1 = boxes[i]; bh = y1 - y0
                        pts = [(x0 + (x1 - x0) * 0.3, y0), (x1 - (x1 - x0) * 0.3, y0 + bh * 0.18)]
                    else:
                        continue
                pts = np.array(pts)
                cx, cy = pts[:, 0].mean(), pts[:, 1].mean()
                span = max(np.ptp(pts[:, 0]), np.ptp(pts[:, 1]), 20) * 1.9
                x0, x1 = int(max(0, cx - span)), int(min(w, cx + span)); y0, y1 = int(max(0, cy - span * 1.2)), int(min(h, cy + span * 1.1))
                if x1 - x0 < 4 or y1 - y0 < 4:
                    continue
                roi = g[y0:y1, x0:x1]
                small = cv2.resize(roi, (max(1, (x1 - x0) // 14), max(1, (y1 - y0) // 14)), interpolation=cv2.INTER_LINEAR)
                g[y0:y1, x0:x1] = cv2.resize(small, (x1 - x0, y1 - y0), interpolation=cv2.INTER_NEAREST)
                hidden += 1
        out.stdin.write(g.tobytes())
    out.stdin.close(); out.wait()
    print(json.dumps({'frames': len(F), 'faces': hidden}))


def cmd_personcrops(a):
    m = model()
    img = cv2.imread(a.image)
    if img is None:
        sys.exit('cannot read image')
    H, W = img.shape[:2]
    people = detect(m, img, conf=0.25)
    people = sorted(people, key=lambda p: -(p['box'][2] - p['box'][0]) * (p['box'][3] - p['box'][1]))[:a.max_people]
    people.sort(key=lambda p: (p['box'][0] + p['box'][2]) / 2)
    out = []
    for k, p in enumerate(people):
        x0, y0, x1, y1 = p['box']; bw, bh = x1 - x0, y1 - y0
        bx0, bx1 = int(max(0, x0 - 0.12 * bw)), int(min(W, x1 + 0.12 * bw)); by0, by1 = int(max(0, y0 - 0.06 * bh)), int(min(H, y1 + 0.04 * bh))
        body = f'{a.out_dir}/person-{k}-body.png'; cv2.imwrite(body, img[by0:by1, bx0:bx1])
        pts = []
        if p['kp'] is not None and p['kc'] is not None:
            pts = [(p['kp'][j][0] * W, p['kp'][j][1] * H) for j in range(5) if p['kc'][j] > 0.3]
        if len(pts) >= 2:
            pts = np.array(pts); cx, cy = pts[:, 0].mean(), pts[:, 1].mean()
            span = max(np.ptp(pts[:, 0]), np.ptp(pts[:, 1]), 0.08 * bw) * 2.4
        else:
            cx, cy, span = (x0 + x1) / 2, y0 + 0.12 * bh, 0.22 * bh
        fx0, fx1 = int(max(0, cx - span)), int(min(W, cx + span)); fy0, fy1 = int(max(0, cy - span * 1.15)), int(min(H, cy + span * 1.25))
        face = f'{a.out_dir}/person-{k}-face.png'
        if fx1 - fx0 > 16 and fy1 - fy0 > 16:
            cv2.imwrite(face, img[fy0:fy1, fx0:fx1])
        else:
            face = None
        out.append({'body': body, 'face': face})
    print(json.dumps({'people': out}))


def cmd_align(a):
    m = model()
    A = read_frames(a.ref, 640, 360); B = read_frames(a.out, 640, 360)
    step = 2
    def kps(F):
        res = []
        for i in range(0, len(F), step):
            ps = [p for p in detect(m, F[i]) if p['kc'] is not None and (p['kc'] > 0.3).sum() >= 6]
            ps.sort(key=lambda p: (p['box'][0] + p['box'][2]) / 2)
            res.append(ps)
        return res
    ka, kb = kps(A), kps(B)
    def err(x, y):
        if not x or len(x) != len(y):
            return None
        d = []
        for p, q in zip(x, y):
            mm = (p['kc'] > 0.3) & (q['kc'] > 0.3)
            if mm.sum() >= 4:
                d.append(float(np.mean(np.linalg.norm(p['kp'][mm] - q['kp'][mm], axis=1))))
        return float(np.mean(d)) if d else None
    best, best_lag, zero = None, 0, None
    max_lag = int(a.max_lag * FPS / step)
    for lag in range(-max_lag, max_lag + 1):
        es = [err(ka[i], kb[i + lag]) for i in range(len(ka)) if 0 <= i + lag < len(kb)]
        es = [e for e in es if e is not None]
        if len(es) < max(6, len(ka) // 3):
            continue
        v = float(np.mean(es))
        if lag == 0:
            zero = v
        if best is None or v < best - 1e-4:
            best, best_lag = v, lag
    lag_s = best_lag * step / FPS
    if zero is not None and best is not None and zero - best < 0.004:
        lag_s = 0.0
    print(json.dumps({'lag_seconds': round(lag_s, 4), 'error_at_zero': zero, 'best_error': best}))


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


def still_people(m, img, min_height=0.04):
    H, W = img.shape[:2]
    out = []
    for p in detect(m, img, conf=0.25):
        x0, y0, x1, y1 = p['box']
        if (y1 - y0) / H < min_height:
            continue
        face = False
        if p['kc'] is not None:
            kc = p['kc']
            face = bool(kc[0] > 0.5 and (kc[1] > 0.5 or kc[2] > 0.5))
        out.append({'box': [x0 / W, y0 / H, x1 / W, y1 / H], 'face': face})
    out.sort(key=lambda q: (q['box'][0] + q['box'][2]) / 2)
    return out


def box_iou(a, b):
    ix = max(0.0, min(a[2], b[2]) - max(a[0], b[0])); iy = max(0.0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / union if union > 0 else 0.0


def compare_stills(sp, op, min_iou=0.45, scale_lo=0.7, scale_hi=1.43):
    reasons = []
    res = {'src_people': len(sp), 'out_people': len(op), 'src_faces': sum(q['face'] for q in sp), 'out_faces': sum(q['face'] for q in op),
           'mean_iou': 0.0, 'scale_ratio': 1.0}
    if len(sp) != len(op):
        reasons.append(f'people {len(op)} vs source {len(sp)}')
    else:
        ious, ratios = [], []
        for i, (a, b) in enumerate(zip(sp, op)):
            ious.append(box_iou(a['box'], b['box']))
            ratios.append((b['box'][3] - b['box'][1]) / max(a['box'][3] - a['box'][1], 1e-6))
            if a['face'] != b['face']:
                reasons.append(f"person {i + 1} {'face' if b['face'] else 'back'} view differs from source")
        if ious:
            res['mean_iou'] = round(float(np.mean(ious)), 4)
            res['scale_ratio'] = round(float(np.exp(np.mean(np.log(np.clip(ratios, 1e-3, 1e3))))), 4)
            if res['mean_iou'] < min_iou:
                reasons.append(f"framing iou {res['mean_iou']:.2f} < {min_iou}")
            if not scale_lo <= res['scale_ratio'] <= scale_hi:
                reasons.append(f"scale ratio {res['scale_ratio']:.2f}")
    res['ok'] = not reasons
    res['reasons'] = reasons
    return res


def lab_of(bgr):
    px = np.uint8([[bgr]])
    l = cv2.cvtColor(px, cv2.COLOR_BGR2LAB).astype(np.float32)[0, 0]
    return [float(l[0] * 100 / 255), float(l[1] - 128), float(l[2] - 128)]


def color_name(bgr):
    import colorsys
    r, g, b = [c / 255 for c in (bgr[2], bgr[1], bgr[0])]
    h, sat, v = colorsys.rgb_to_hsv(r, g, b)
    if v < 0.16:
        return 'black'
    if sat < 0.12:
        return 'white' if v > 0.85 else ('light grey' if v > 0.55 else ('grey' if v > 0.3 else 'dark grey'))
    deg = h * 360
    names = [(15, 'red'), (40, 'orange'), (68, 'yellow'), (165, 'green'), (200, 'cyan'), (255, 'blue'), (290, 'purple'), (335, 'pink'), (361, 'red')]
    base = next(n for lim, n in names if deg < lim)
    if base == 'orange' and deg > 30 and sat > 0.5:
        base = 'amber orange'
    if v < 0.4:
        return 'dark ' + base
    if sat > 0.6 and v > 0.6:
        return 'bright ' + base
    if sat < 0.35:
        return 'pale ' + base
    return base


def background_of(img, people, dilate=0.15):
    H, W = img.shape[:2]
    w = 320
    h = max(1, int(round(w * H / W)))
    small = cv2.resize(img, (w, h), interpolation=cv2.INTER_AREA)
    keep = np.ones((h, w), bool)
    for q in people:
        x0, y0, x1, y1 = q['box']
        bw, bh = x1 - x0, y1 - y0
        keep[int(max(0, (y0 - dilate * bh) * h)):int(min(h, (y1 + dilate * bh) * h + 1)), int(max(0, (x0 - dilate * bw) * w)):int(min(w, (x1 + dilate * bw) * w + 1))] = False
    if keep.mean() < 0.05:
        return None
    bgr = [int(v) for v in np.median(small[keep].reshape(-1, 3), axis=0)]
    return {'hex': '#%02X%02X%02X' % (bgr[2], bgr[1], bgr[0]), 'name': color_name(bgr), 'lab': lab_of(bgr), 'coverage': round(float(keep.mean()), 3)}


def background_de(a, b):
    if not a or not b:
        return None
    return float(np.linalg.norm(np.array(a['lab']) - np.array(b['lab'])))


def cmd_shotinfo(a):
    img = cv2.imread(a.image)
    if img is None:
        sys.exit('cannot read image')
    people = still_people(model(), img)
    print(json.dumps({'people': people, 'background': background_of(img, people)}))


def cmd_shotcheck(a):
    m = model()
    s, o = cv2.imread(a.src), cv2.imread(a.out)
    if s is None or o is None:
        sys.exit('cannot read image')
    if o.shape[:2] != s.shape[:2]:
        o = cv2.resize(o, (s.shape[1], s.shape[0]))
    sp, op = still_people(m, s), still_people(m, o)
    res = compare_stills(sp, op, a.min_iou)
    sb, ob = background_of(s, sp), background_of(o, op)
    de = background_de(sb, ob)
    res['bg_src'] = sb['hex'] if sb else None
    res['bg_out'] = ob['hex'] if ob else None
    res['bg_name'] = sb['name'] if sb else None
    res['bg_de'] = round(de, 2) if de is not None else None
    if de is not None and de > a.max_bg_de:
        res['reasons'].append(f"background colour drift dE {de:.0f} ({ob['name']} {ob['hex']} instead of {sb['name']} {sb['hex']})")
        res['ok'] = False
    print(json.dumps(res))


def main():
    p = argparse.ArgumentParser(); s = p.add_subparsers(dest='cmd', required=True)
    t = s.add_parser('track'); t.add_argument('--src', required=True); t.add_argument('--out', required=True); t.add_argument('--width', type=int, default=1280); t.add_argument('--height', type=int, default=720); t.add_argument('--max-people', type=int, default=3); t.set_defaults(f=cmd_track)
    b = s.add_parser('boxout'); b.add_argument('--src', required=True); b.add_argument('--boxes', required=True); b.add_argument('--keep', type=int, required=True); b.add_argument('--out', required=True); b.add_argument('--start', type=float, default=0.0); b.add_argument('--end', type=float, default=None); b.set_defaults(f=cmd_boxout)
    c = s.add_parser('crops'); c.add_argument('--image', required=True); c.add_argument('--boxes', required=True); c.add_argument('--frame-index', type=int, default=0); c.add_argument('--out-dir', required=True); c.set_defaults(f=cmd_crops)
    k = s.add_parser('composite'); k.add_argument('--src', required=True); k.add_argument('--boxes', required=True); k.add_argument('--out', required=True); k.add_argument('--pair', action='append', required=True); k.set_defaults(f=cmd_composite)
    f = s.add_parser('blurfaces'); f.add_argument('--src', required=True); f.add_argument('--out', required=True); f.set_defaults(f=cmd_blurfaces)
    pc = s.add_parser('personcrops'); pc.add_argument('--image', required=True); pc.add_argument('--out-dir', required=True); pc.add_argument('--max-people', type=int, default=3); pc.set_defaults(f=cmd_personcrops)
    g = s.add_parser('align'); g.add_argument('--ref', required=True); g.add_argument('--out', required=True); g.add_argument('--max-lag', type=float, default=0.75); g.set_defaults(f=cmd_align)
    q = s.add_parser('posecheck'); q.add_argument('--src', required=True); q.add_argument('--out', required=True); q.set_defaults(f=cmd_posecheck)
    si = s.add_parser('shotinfo'); si.add_argument('--image', required=True); si.set_defaults(f=cmd_shotinfo)
    sc = s.add_parser('shotcheck'); sc.add_argument('--src', required=True); sc.add_argument('--out', required=True); sc.add_argument('--min-iou', type=float, default=0.45); sc.add_argument('--max-bg-de', type=float, default=18.0); sc.set_defaults(f=cmd_shotcheck)
    a = p.parse_args(); a.f(a)


if __name__ == '__main__':
    main()
