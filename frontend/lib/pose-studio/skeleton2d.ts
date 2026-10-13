import { PerspectiveCamera, Vector3 } from 'three';
import { Body, FINGERS, J } from './rig';

export interface Kp { x: number; y: number; v: 0 | 1 | 2 }
export interface PersonKeypoints { id: number; body: Kp[]; feet: Kp[]; handL: Kp[]; handR: Kp[] }

export const COCO_NAMES = ['nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear', 'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow', 'left_wrist', 'right_wrist', 'left_hip', 'right_hip', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle'];
export const LIMBS_COCO: [number, number][] = [[5, 7], [7, 9], [6, 8], [8, 10], [11, 13], [13, 15], [12, 14], [14, 16], [5, 6], [11, 12], [5, 11], [6, 12], [0, 5], [0, 6]];
export const LIMB_COLOR: [number, number, number][] = [[255, 0, 0], [255, 128, 0], [255, 255, 0], [128, 255, 0], [0, 255, 0], [0, 255, 128], [0, 255, 255], [0, 128, 255], [0, 0, 255], [128, 0, 255], [255, 0, 255], [255, 0, 128], [180, 180, 180], [220, 220, 220]];
export const HAND_COLOR: [number, number, number] = [0, 255, 255];
export const SKELETON_PALETTE: [number, number, number][] = [...LIMB_COLOR, [255, 255, 255], HAND_COLOR, [0, 0, 0]];

interface Anchor { j: number; o: Vector3 }
const A = (j: number, x = 0, y = 0, z = 0): Anchor => ({ j, o: new Vector3(x, y, z) });
const _v = new Vector3();

function anchors(body: Body) {
  const h = body.rig.h;
  const hd = J.head;
  const coco: Anchor[] = [
    A(hd, 0, 0.39 * h, 0.53 * h), A(hd, 0.17 * h, 0.55 * h, 0.41 * h), A(hd, -0.17 * h, 0.55 * h, 0.41 * h), A(hd, 0.38 * h, 0.43 * h, 0.01 * h), A(hd, -0.38 * h, 0.43 * h, 0.01 * h),
    A(J.shoulderL), A(J.shoulderR), A(J.elbowL), A(J.elbowR), A(J.wristL), A(J.wristR), A(J.hipL), A(J.hipR), A(J.kneeL), A(J.kneeR), A(J.ankleL), A(J.ankleR),
  ];
  const feet: Anchor[] = [];
  for (const [S, s] of [['L', 1], ['R', -1]] as const) {
    const tp = body.rig.tip[J[`toe${S}`]]!;
    feet.push(A(J[`toe${S}`], -s * 0.07 * h, tp.y, tp.z), A(J[`toe${S}`], s * 0.12 * h, -0.05 * h, 0.2 * h), A(J[`ankle${S}`], 0, -0.21 * h, -0.27 * h));
  }
  const hand = (S: string) => {
    const out: Anchor[] = [A(J[`wrist${S}`])];
    for (const f of FINGERS) {
      out.push(A(J[`${f}1${S}`]), A(J[`${f}2${S}`]), A(J[`${f}3${S}`]));
      const t = body.rig.tip[J[`${f}3${S}`]]!;
      out.push(A(J[`${f}3${S}`], t.x, t.y, t.z));
    }
    return out;
  };
  return { coco, feet, handL: hand('L'), handR: hand('R') };
}

function project(body: Body, a: Anchor, cam: PerspectiveCamera): Kp {
  _v.copy(a.o).applyQuaternion(body.wq[a.j]).add(body.wp[a.j]).project(cam);
  const x = (_v.x + 1) / 2;
  const y = (1 - _v.y) / 2;
  if (_v.z > 1 || _v.z < -1) return { x, y, v: 0 };
  return { x, y, v: x >= 0 && x <= 1 && y >= 0 && y <= 1 ? 2 : 1 };
}

export function keypointsOf(body: Body, cam: PerspectiveCamera, id = 0): PersonKeypoints {
  body.fk();
  cam.updateMatrixWorld();
  const a = anchors(body);
  const map = (l: Anchor[]) => l.map((x) => project(body, x, cam));
  return { id, body: map(a.coco), feet: map(a.feet), handL: map(a.handL), handR: map(a.handR) };
}

export function worldKeypoints(body: Body) {
  body.fk();
  const a = anchors(body);
  const w = (l: Anchor[]) => l.map((x) => _v.copy(x.o).applyQuaternion(body.wq[x.j]).add(body.wp[x.j]).clone());
  return { coco: w(a.coco), feet: w(a.feet), handL: w(a.handL), handR: w(a.handR) };
}

export interface SkeletonOptions { hands?: boolean; face?: boolean; scale?: number }
export interface Raster { data: Uint8ClampedArray<ArrayBuffer>; width: number; height: number }

export function rasterSkeleton(people: PersonKeypoints[], width: number, height: number, opts: SkeletonOptions = {}): Raster {
  const hands = opts.hands ?? true;
  const face = opts.face ?? true;
  const sc = opts.scale ?? 1;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  const put = (x: number, y: number, c: readonly number[]) => {
    const k = (y * width + x) * 4;
    data[k] = c[0]; data[k + 1] = c[1]; data[k + 2] = c[2];
  };
  const disc = (cx: number, cy: number, r: number, c: readonly number[]) => {
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(width - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(height - 1, Math.ceil(cy + r));
    const r2 = r * r;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r2) put(x, y, c);
    }
  };
  const line = (ax: number, ay: number, bx: number, by: number, lw: number, c: readonly number[]) => {
    const rr = lw / 2;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - rr)), x1 = Math.min(width - 1, Math.ceil(Math.max(ax, bx) + rr));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by) - rr)), y1 = Math.min(height - 1, Math.ceil(Math.max(ay, by) + rr));
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy || 1e-9;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - ax, py = y + 0.5 - ay;
      const t = Math.max(0, Math.min(1, (px * dx + py * dy) / l2));
      const ex = px - t * dx, ey = py - t * dy;
      if (ex * ex + ey * ey <= rr * rr) put(x, y, c);
    }
  };
  const lw = Math.max(1, 2 * sc);
  const R3 = Math.max(1, 3 * sc), R2 = Math.max(1, 2 * sc);
  for (const p of people) {
    LIMBS_COCO.forEach(([a, b], i) => {
      const A = p.body[a], B = p.body[b];
      if (A.v === 0 || B.v === 0) return;
      line(A.x * width, A.y * height, B.x * width, B.y * height, lw, LIMB_COLOR[i % 14]);
    });
    p.body.forEach((k, i) => {
      if (k.v === 0 || (!face && i >= 1 && i <= 4)) return;
      disc(k.x * width, k.y * height, R3, [255, 255, 255]);
    });
    for (const k of p.feet) if (k.v !== 0) disc(k.x * width, k.y * height, R2, [255, 255, 255]);
    if (hands) for (const hd of [p.handL, p.handR]) for (const k of hd) if (k.v !== 0) disc(k.x * width, k.y * height, R2, HAND_COLOR);
  }
  return { data, width, height };
}
