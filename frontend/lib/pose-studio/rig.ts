import { Matrix4, Quaternion, Vector3 } from 'three';

export interface Props { headsTall: number; height: number; shoulder: number; hip: number; limb: number }

export const DEFAULT_PROPS: Props = { headsTall: 7.5, height: 1.7, shoulder: 1, hip: 1, limb: 1 };
export const PROP_LIMITS: Record<keyof Props, [number, number]> = {
  headsTall: [6.5, 9], height: [1.2, 2.1], shoulder: [0.7, 1.4], hip: [0.7, 1.4], limb: [0.8, 1.25],
};

export function sanitizeProps(p?: Partial<Props>): Props {
  const out = { ...DEFAULT_PROPS };
  if (!p) return out;
  for (const k of Object.keys(PROP_LIMITS) as (keyof Props)[]) {
    const v = p[k];
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.min(PROP_LIMITS[k][1], Math.max(PROP_LIMITS[k][0], v));
  }
  return out;
}

export const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'] as const;
export const JOINT_NAMES: string[] = [];
export const PARENT: number[] = [];
export const SIDE: number[] = [];
export const J: Record<string, number> = {};
export const MIRROR: number[] = [];

function add(name: string, parent: string | null, side: number) {
  J[name] = JOINT_NAMES.length;
  JOINT_NAMES.push(name);
  PARENT.push(parent === null ? -1 : J[parent]);
  SIDE.push(side);
}

add('pelvis', null, 0);
add('spine1', 'pelvis', 0);
add('spine2', 'spine1', 0);
add('spine3', 'spine2', 0);
add('neck', 'spine3', 0);
add('head', 'neck', 0);
for (const [S, side] of [['L', 1], ['R', 2]] as const) {
  add(`clav${S}`, 'spine3', side);
  add(`shoulder${S}`, `clav${S}`, side);
  add(`elbow${S}`, `shoulder${S}`, side);
  add(`wrist${S}`, `elbow${S}`, side);
  for (const f of FINGERS) {
    add(`${f}1${S}`, `wrist${S}`, side);
    add(`${f}2${S}`, `${f}1${S}`, side);
    add(`${f}3${S}`, `${f}2${S}`, side);
  }
  add(`hip${S}`, 'pelvis', side);
  add(`knee${S}`, `hip${S}`, side);
  add(`ankle${S}`, `knee${S}`, side);
  add(`toe${S}`, `ankle${S}`, side);
}
export const N = JOINT_NAMES.length;
for (let i = 0; i < N; i++) {
  const nm = JOINT_NAMES[i];
  MIRROR.push(SIDE[i] === 0 ? i : J[nm.slice(0, -1) + (SIDE[i] === 1 ? 'R' : 'L')]);
}

export const isFingerJoint = (j: number) => /^(thumb|index|middle|ring|pinky)\d/.test(JOINT_NAMES[j]);

export type Hinge = { kind: 'hinge'; F: Quaternion; Fi: Quaternion; lo: number; hi: number; t0: number; t1: number; mirrored: boolean; axis: Vector3 };
export type Ball = { kind: 'ball'; F: Quaternion; Fi: Quaternion; p1: number; n1: number; p2: number; n2: number; t0: number; t1: number; mirrored: boolean; zs: number };
export type Free = { kind: 'free' };
export type Limit = Hinge | Ball | Free;

export interface Rig {
  props: Props;
  h: number;
  off: Vector3[];
  len: number[];
  rest: Vector3[];
  dir: Vector3[];
  tip: (Vector3 | null)[];
  limits: Limit[];
  ankleY: number;
  legLen: number;
  hipHalf: number;
  shoulderHalf: number;
}

const D = Math.PI / 180;
const UP = new Vector3(0, 1, 0);
const FWD = new Vector3(0, 0, 1);
const OUT = new Vector3(1, 0, 0);

const FINGER_LAYOUT: Record<string, { x: number; z: number; fan: number; len: [number, number, number]; r: number }> = {
  thumb: { x: 0.1, z: 0.1, fan: 42, len: [0.2, 0.16, 0.13], r: 0.05 },
  index: { x: 0.46, z: 0.13, fan: 4, len: [0.17, 0.1, 0.082], r: 0.04 },
  middle: { x: 0.47, z: 0.04, fan: 0, len: [0.19, 0.115, 0.088], r: 0.042 },
  ring: { x: 0.45, z: -0.05, fan: -4, len: [0.175, 0.105, 0.082], r: 0.039 },
  pinky: { x: 0.41, z: -0.135, fan: -10, len: [0.14, 0.08, 0.072], r: 0.034 },
};
export const FINGER_RADIUS: Record<string, number> = Object.fromEntries(Object.entries(FINGER_LAYOUT).map(([k, v]) => [k, v.r]));

function frameQ(a1: Vector3, b: Vector3) {
  const y = b.clone().normalize();
  const x = a1.clone().addScaledVector(y, -a1.dot(y)).normalize();
  const z = new Vector3().crossVectors(x, y);
  return { q: new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z)), x, y, z };
}

function ballLimit(a1: Vector3, a2: Vector3, b: Vector3, p1: number, n1: number, pa2: number, na2: number, t0: number, t1: number, mirrored: boolean): Ball {
  const fr = frameQ(a1, b);
  const swap = fr.z.dot(a2) < 0;
  const F = fr.q;
  return { kind: 'ball', F, Fi: F.clone().invert(), p1: p1 * D, n1: n1 * D, p2: (swap ? na2 : pa2) * D, n2: (swap ? pa2 : na2) * D, t0: t0 * D, t1: t1 * D, mirrored, zs: swap ? -1 : 1 };
}

function hingeLimit(axis: Vector3, b: Vector3, lo: number, hi: number, t0: number, t1: number, mirrored: boolean): Hinge {
  const fr = frameQ(axis, b);
  return { kind: 'hinge', F: fr.q, Fi: fr.q.clone().invert(), lo: lo * D, hi: hi * D, t0: t0 * D, t1: t1 * D, mirrored, axis: fr.x };
}

export function buildRig(propsIn?: Partial<Props>): Rig {
  const props = sanitizeProps(propsIn);
  const Nh = props.headsTall;
  const k = props.limb;
  const h = props.height / (0.34 + 3.65 + (Nh - 3.99) * k);
  const legLen = (Nh - 3.99) * h * k;
  const ankleY = 0.34 * h;
  const hipHalf = 0.4 * h * props.hip;
  const shoulderHalf = 0.82 * h * props.shoulder;
  const off = JOINT_NAMES.map(() => new Vector3());
  const tip: (Vector3 | null)[] = JOINT_NAMES.map(() => null);
  const set = (n: string, x: number, y: number, z: number) => off[J[n]].set(x, y, z);

  set('pelvis', 0, ankleY + legLen + 0.2 * h, 0);
  set('spine1', 0, 0.45 * h, 0);
  set('spine2', 0, 0.55 * h, 0);
  set('spine3', 0, 0.55 * h, 0);
  set('neck', 0, 0.55 * h, 0);
  set('head', 0, 0.4 * h, 0.01 * h);
  tip[J.head] = new Vector3(0, 0.95 * h, 0);

  for (const [S, s] of [['L', 1], ['R', -1]] as const) {
    set(`clav${S}`, s * 0.12 * h, 0.5 * h, 0.06 * h);
    set(`shoulder${S}`, s * (shoulderHalf - 0.12 * h), -0.1 * h, -0.04 * h);
    set(`elbow${S}`, s * 1.4 * h * k, 0, 0);
    set(`wrist${S}`, s * 1.12 * h * k, 0, 0);
    for (const f of FINGERS) {
      const L = FINGER_LAYOUT[f];
      const a = L.fan * D;
      const dx = Math.cos(a);
      const dz = Math.sin(a);
      set(`${f}1${S}`, s * L.x * h, 0, L.z * h);
      set(`${f}2${S}`, s * dx * L.len[0] * h, 0, dz * L.len[0] * h);
      set(`${f}3${S}`, s * dx * L.len[1] * h, 0, dz * L.len[1] * h);
      tip[J[`${f}3${S}`]] = new Vector3(s * dx * L.len[2] * h, 0, dz * L.len[2] * h);
    }
    set(`hip${S}`, s * hipHalf, -0.2 * h, 0);
    set(`knee${S}`, 0, -0.53 * legLen, 0);
    set(`ankle${S}`, 0, -0.47 * legLen, 0);
    set(`toe${S}`, 0, -0.22 * h, 0.55 * h);
    tip[J[`toe${S}`]] = new Vector3(0, -0.04 * h, 0.33 * h);
  }

  const len = off.map((o, i) => (i === 0 ? 0 : o.length()));
  const rest = off.map(() => new Vector3());
  for (let i = 0; i < N; i++) {
    rest[i].copy(off[i]);
    if (PARENT[i] >= 0) rest[i].add(rest[PARENT[i]]);
  }

  const dir = JOINT_NAMES.map(() => new Vector3(0, 1, 0));
  const primary = (n: string, c: string | null) => {
    const v = c ? off[J[c]] : tip[J[n]];
    if (v && v.lengthSq() > 0) dir[J[n]].copy(v).normalize();
  };
  primary('pelvis', 'spine1'); primary('spine1', 'spine2'); primary('spine2', 'spine3'); primary('spine3', 'neck'); primary('neck', 'head'); primary('head', null);
  for (const S of ['L', 'R']) {
    primary(`clav${S}`, `shoulder${S}`); primary(`shoulder${S}`, `elbow${S}`); primary(`elbow${S}`, `wrist${S}`); primary(`wrist${S}`, `middle1${S}`);
    for (const f of FINGERS) { primary(`${f}1${S}`, `${f}2${S}`); primary(`${f}2${S}`, `${f}3${S}`); primary(`${f}3${S}`, null); }
    primary(`hip${S}`, `knee${S}`); primary(`knee${S}`, `ankle${S}`); primary(`ankle${S}`, `toe${S}`); primary(`toe${S}`, null);
  }

  const limits: Limit[] = JOINT_NAMES.map(() => ({ kind: 'free' }) as Limit);
  const down = new Vector3(0, -1, 0);
  const spineLimit = (n: string, f: number, bk: number, sd: number, tw: number) => { limits[J[n]] = ballLimit(FWD, OUT, UP, f, bk, sd, sd, -tw, tw, false); };
  spineLimit('spine1', 28, 15, 15, 15);
  spineLimit('spine2', 25, 15, 15, 15);
  spineLimit('spine3', 25, 15, 15, 15);
  spineLimit('neck', 35, 40, 30, 45);
  spineLimit('head', 25, 30, 20, 40);

  for (const S of ['L', 'R']) {
    const m = S === 'R';
    const dl = (n: string) => {
      const d = dir[J[n + S]].clone();
      return m ? d.set(-d.x, d.y, d.z) : d;
    };
    const put = (n: string, lim: Limit) => { limits[J[n + S]] = lim; };
    put('clav', ballLimit(UP, FWD, dl('clav'), 22, 12, 20, 15, -10, 10, m));
    put('shoulder', ballLimit(UP, FWD, dl('shoulder'), 115, 105, 130, 50, -85, 85, m));
    put('elbow', hingeLimit(new Vector3(0, -1, 0), dl('elbow'), 0, 150, -130, 15, m));
    put('wrist', ballLimit(UP, FWD, dl('wrist'), 65, 75, 20, 35, -15, 15, m));
    for (const f of FINGERS) {
      const d1 = dl(`${f}1`);
      const d2 = dl(`${f}2`);
      const d3 = dl(`${f}3`);
      const hx = (d: Vector3) => new Vector3().crossVectors(d, down);
      if (f === 'thumb') {
        put(`${f}1`, ballLimit(UP, new Vector3().crossVectors(UP, d1), d1, 20, 50, 35, 35, -25, 25, m));
        put(`${f}2`, hingeLimit(hx(d2), d2, -5, 65, -4, 4, m));
        put(`${f}3`, hingeLimit(hx(d3), d3, -10, 85, -3, 3, m));
      } else {
        put(`${f}1`, ballLimit(UP, new Vector3().crossVectors(UP, d1), d1, 25, 95, 15, 15, -6, 6, m));
        put(`${f}2`, hingeLimit(hx(d2), d2, 0, 110, -3, 3, m));
        put(`${f}3`, hingeLimit(hx(d3), d3, 0, 85, -3, 3, m));
      }
    }
    put('hip', ballLimit(FWD, OUT, dl('hip'), 125, 30, 55, 35, -45, 40, m));
    put('knee', hingeLimit(OUT, dl('knee'), 0, 150, -10, 10, m));
    put('ankle', ballLimit(UP, OUT, dl('ankle'), 25, 50, 15, 15, -22, 22, m));
    put('toe', hingeLimit(new Vector3(-1, 0, 0), dl('toe'), -40, 65, 0, 0, m));
  }
  return { props, h, off, len, rest, dir, tip, limits, ankleY, legLen, hipHalf, shoulderHalf };
}

const _a = new Quaternion();
const _b = new Quaternion();
const _c = new Quaternion();

export interface Decomp { t: number; sx: number; sz: number }

export function decompose(F: Quaternion, Fi: Quaternion, q: Quaternion, mirrored: boolean, out: Decomp = { t: 0, sx: 0, sz: 0 }): Decomp {
  _a.copy(q);
  if (mirrored) _a.set(q.x, -q.y, -q.z, q.w);
  _a.premultiply(Fi).multiply(F);
  const n = Math.hypot(_a.y, _a.w);
  let t = 0;
  if (n > 1e-9) t = 2 * Math.atan2(_a.y, _a.w);
  if (t > Math.PI) t -= 2 * Math.PI;
  if (t < -Math.PI) t += 2 * Math.PI;
  _b.set(0, -Math.sin(t / 2), 0, Math.cos(t / 2));
  _c.copy(_a).multiply(_b);
  if (_c.w < 0) _c.set(-_c.x, -_c.y, -_c.z, -_c.w);
  const w = Math.min(1, _c.w);
  const ang = 2 * Math.acos(w);
  const s = Math.sin(ang / 2);
  out.t = t;
  if (s < 1e-9) { out.sx = 0; out.sz = 0; } else { out.sx = (_c.x / s) * ang; out.sz = (_c.z / s) * ang; }
  return out;
}

const _d: Decomp = { t: 0, sx: 0, sz: 0 };

function compose(F: Quaternion, Fi: Quaternion, sx: number, sz: number, t: number, mirrored: boolean, out: Quaternion) {
  const ang = Math.hypot(sx, sz);
  if (ang < 1e-12) out.set(0, 0, 0, 1);
  else { const s = Math.sin(ang / 2) / ang; out.set(sx * s, 0, sz * s, Math.cos(ang / 2)); }
  _b.set(0, Math.sin(t / 2), 0, Math.cos(t / 2));
  out.multiply(_b);
  out.premultiply(F).multiply(Fi);
  if (mirrored) out.set(out.x, -out.y, -out.z, out.w);
  return out.normalize();
}

function ellipse(L: Ball, sx: number, sz: number) {
  const ax = sx >= 0 ? L.p2 : L.n2;
  const az = sz >= 0 ? L.n1 : L.p1;
  return (sx / ax) ** 2 + (sz / az) ** 2;
}

export function jointViolation(rig: Rig, j: number, q: Quaternion): number {
  const L = rig.limits[j];
  if (L.kind === 'free') return 0;
  decompose(L.F, L.Fi, q, L.mirrored, _d);
  const tv = Math.max(0, L.t0 - _d.t, _d.t - L.t1);
  if (L.kind === 'hinge') return Math.max(tv, Math.abs(_d.sz), Math.max(0, L.lo - _d.sx, _d.sx - L.hi));
  const e = ellipse(L, _d.sx, _d.sz);
  return Math.max(tv, e > 1 ? (Math.sqrt(e) - 1) * Math.hypot(_d.sx, _d.sz) : 0);
}

export function clampJoint(rig: Rig, j: number, q: Quaternion): Quaternion {
  const L = rig.limits[j];
  if (L.kind === 'free') return q.normalize();
  decompose(L.F, L.Fi, q, L.mirrored, _d);
  let { sx, sz, t } = _d;
  t = Math.min(L.t1, Math.max(L.t0, t));
  if (L.kind === 'hinge') { sx = Math.min(L.hi, Math.max(L.lo, sx)); sz = 0; }
  else {
    const e = ellipse(L, sx, sz);
    if (e > 1) { const f = 1 / Math.sqrt(e); sx *= f; sz *= f; }
  }
  return compose(L.F, L.Fi, sx, sz, t, L.mirrored, q);
}

export function hingeAxisRest(rig: Rig, j: number): Vector3 {
  const L = rig.limits[j] as Hinge;
  const a = L.axis.clone();
  return L.mirrored ? a.set(a.x, -a.y, -a.z) : a;
}

export function hingeTwist(rig: Rig, j: number, q: Quaternion) {
  const L = rig.limits[j];
  if (L.kind === 'free') return 0;
  decompose(L.F, L.Fi, q, L.mirrored, _d);
  return _d.t;
}

export function composeHinge(rig: Rig, j: number, flex: number, twist: number, out: Quaternion) {
  const L = rig.limits[j] as Hinge;
  return compose(L.F, L.Fi, flex, 0, twist, L.mirrored, out);
}

export function composeBall(rig: Rig, j: number, sx: number, sz: number, twist: number, out: Quaternion) {
  const L = rig.limits[j] as Ball;
  return compose(L.F, L.Fi, sx, sz, twist, L.mirrored, out);
}

export function tiltBall(rig: Rig, j: number, toA1: number, toA2: number, twist: number, out: Quaternion) {
  const L = rig.limits[j];
  if (L.kind !== 'ball') return out.set(0, 0, 0, 1);
  const zs = (L as Ball).zs;
  return compose(L.F, L.Fi, zs * toA2 * D, -toA1 * D, twist * D, L.mirrored, out);
}

export function mirrorQuat(q: Quaternion, out: Quaternion = q) {
  return out.set(q.x, -q.y, -q.z, q.w);
}

export interface Pin { p: Vector3; q: Quaternion }
export const PIN_KEYS = ['footL', 'footR', 'handL', 'handR'] as const;
export type PinKey = (typeof PIN_KEYS)[number];

export class Body {
  rig: Rig;
  q: Quaternion[];
  rootP: Vector3;
  rootQ = new Quaternion();
  wp: Vector3[];
  wq: Quaternion[];
  pins: Record<PinKey, Pin | null> = { footL: null, footR: null, handL: null, handR: null };

  constructor(props?: Partial<Props>) {
    this.rig = buildRig(props);
    this.q = this.rig.off.map(() => new Quaternion());
    this.wp = this.rig.off.map(() => new Vector3());
    this.wq = this.rig.off.map(() => new Quaternion());
    this.rootP = this.rig.rest[0].clone();
    this.fk();
  }

  lowestY() {
    let m = Infinity;
    for (const n of ['ankleL', 'ankleR', 'toeL', 'toeR']) m = Math.min(m, this.wp[J[n]].y);
    return m;
  }

  setProps(props: Partial<Props>) {
    this.fk();
    const y0 = this.lowestY();
    this.rig = buildRig({ ...this.rig.props, ...props });
    this.fk();
    this.rootP.y += y0 - this.lowestY();
    for (const k of PIN_KEYS) this.pins[k] = null;
    this.fk();
  }

  fk(from = 0) {
    const { off } = this.rig;
    if (from === 0) {
      this.wq[0].copy(this.rootQ);
      this.wp[0].copy(this.rootP);
      from = 1;
    }
    for (let i = from; i < N; i++) {
      const p = PARENT[i];
      this.wq[i].multiplyQuaternions(this.wq[p], this.q[i]);
      this.wp[i].copy(off[i]).applyQuaternion(this.wq[p]).add(this.wp[p]);
    }
  }

  clone() {
    const b = new Body(this.rig.props);
    b.rig = this.rig;
    b.copyFrom(this);
    return b;
  }

  copyFrom(o: Body) {
    this.rig = o.rig;
    for (let i = 0; i < N; i++) this.q[i].copy(o.q[i]);
    this.rootP.copy(o.rootP);
    this.rootQ.copy(o.rootQ);
    for (const k of PIN_KEYS) { const p = o.pins[k]; this.pins[k] = p ? { p: p.p.clone(), q: p.q.clone() } : null; }
    this.fk();
  }

  jointWorld(name: string) { return this.wp[J[name]]; }
}

export function sampleJoint(rig: Rig, j: number, rnd: () => number, out: Quaternion) {
  const L = rig.limits[j];
  if (L.kind === 'free') return out.set(0, 0, 0, 1);
  const t = L.t0 + rnd() * (L.t1 - L.t0);
  if (L.kind === 'hinge') return compose(L.F, L.Fi, L.lo + rnd() * (L.hi - L.lo), 0, t, L.mirrored, out);
  const th = rnd() * Math.PI * 2;
  const r = Math.sqrt(rnd());
  const c = Math.cos(th);
  const s = Math.sin(th);
  const sx = r * c * (c >= 0 ? L.p2 : L.n2);
  const sz = r * s * (s >= 0 ? L.n1 : L.p1);
  return compose(L.F, L.Fi, sx, sz, t, L.mirrored, out);
}
