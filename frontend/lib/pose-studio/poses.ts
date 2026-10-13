import { Euler, Quaternion, Vector3 } from 'three';
import { Body, FINGERS, J, composeBall, composeHinge, tiltBall, clampJoint } from './rig';
import { LIMBS, resetSwivel, solveLimb } from './ik';

type V3 = [number, number, number];
export type HandShape = 'open' | 'relaxed' | 'fist' | 'grip' | 'point' | 'spread';
export const HAND_SHAPES: HandShape[] = ['open', 'relaxed', 'fist', 'grip', 'point', 'spread'];

interface LimbSpec {
  t: V3;
  pole?: V3;
  twist?: number;
  wrist?: V3;
  hand?: HandShape;
  frame?: 'body' | 'floor';
  foot?: { pitch?: number; yaw?: number; roll?: number };
}

interface Spec {
  root?: { dy?: number; y?: number; yaw?: number; pitch?: number; roll?: number };
  spine?: V3;
  neck?: V3;
  head?: V3;
  armL?: LimbSpec;
  armR?: LimbSpec | 'mirror';
  legL?: LimbSpec;
  legR?: LimbSpec | 'mirror';
}

const r2d = Math.PI / 180;
const mir = (v: V3): V3 => [-v[0], v[1], v[2]];

const FINGER_SHAPE: Record<HandShape, { m: number; p: number; d: number; spread: number; thumb: [number, number, number] }> = {
  open: { m: 4, p: 4, d: 2, spread: 0, thumb: [4, 6, 4] },
  relaxed: { m: 16, p: 24, d: 14, spread: 0, thumb: [10, 12, 12] },
  fist: { m: 82, p: 98, d: 68, spread: 0, thumb: [28, 38, 42] },
  grip: { m: 62, p: 80, d: 52, spread: 0, thumb: [30, 30, 34] },
  point: { m: 4, p: 4, d: 2, spread: 0, thumb: [10, 14, 14] },
  spread: { m: 0, p: 2, d: 0, spread: 11, thumb: [4, 2, 2] },
};

export function applyHand(body: Body, S: 'L' | 'R', shape: HandShape) {
  const { rig } = body;
  const sh = FINGER_SHAPE[shape];
  FINGERS.forEach((f, fi) => {
    const j1 = J[`${f}1${S}`], j2 = J[`${f}2${S}`], j3 = J[`${f}3${S}`];
    if (f === 'thumb') {
      const [a, b, c] = sh.thumb;
      tiltBall(rig, j1, -a * 0.8, 0, 0, body.q[j1]);
      composeHinge(rig, j2, b * r2d, 0, body.q[j2]);
      composeHinge(rig, j3, c * r2d, 0, body.q[j3]);
      return;
    }
    const idx = fi - 2.5;
    let m = sh.m, p = sh.p, d = sh.d;
    if (shape === 'point' && f !== 'index') { m = 82; p = 98; d = 68; }
    if (shape === 'relaxed') { const k = 1 + (fi - 1) * 0.12; m *= k; p *= k; d *= k; }
    tiltBall(rig, j1, -m, -idx * sh.spread * 0.9, 0, body.q[j1]);
    composeHinge(rig, j2, p * r2d, 0, body.q[j2]);
    composeHinge(rig, j3, d * r2d, 0, body.q[j3]);
    for (const j of [j1, j2, j3]) clampJoint(rig, j, body.q[j]);
  });
  body.fk();
}

const STAND_ARM: LimbSpec = { t: [1.0, -0.45, 0.05], hand: 'relaxed' };

const SPECS: Record<string, Spec> = {
  stand: { armL: STAND_ARM, armR: 'mirror' },
  relaxed: {
    root: { dy: -0.05, yaw: 8, roll: 3 },
    spine: [3, -3, -4], neck: [4, 3, -4], head: [4, 0, -3],
    armL: { t: [0.95, -0.4, 0.18], hand: 'relaxed', wrist: [0, 0, 0] },
    armR: { t: [-0.8, -0.1, 0.55], hand: 'relaxed', twist: -20, pole: [-0.5, -0.6, -0.4] },
    legL: { t: [0.62, 0.34, 0.3], frame: 'floor', foot: { yaw: 12 } },
    legR: { t: [-0.34, 0.34, -0.2], frame: 'floor', foot: { yaw: -14 } },
  },
  walk: {
    root: { dy: -0.18, pitch: 4 },
    spine: [3, 0, 14], neck: [0, 0, -6], head: [2, 0, -5],
    armL: { t: [0.95, -0.75, -0.7], hand: 'relaxed', pole: [0.3, 0, -1] },
    armR: { t: [-0.95, -0.55, 0.9], hand: 'relaxed', pole: [-0.3, -0.6, -1] },
    legL: { t: [0.38, 0.5, 1.55], frame: 'floor', foot: { pitch: -18 } },
    legR: { t: [-0.38, 0.85, -1.5], frame: 'floor', foot: { pitch: 48 } },
  },
  run: {
    root: { dy: 0.1, pitch: 14 },
    spine: [4, 0, 18], neck: [-6, 0, -8], head: [-8, 0, -6],
    armL: { t: [0.85, 0.95, -0.4], hand: 'fist', pole: [0.4, -0.4, -1], wrist: [0, 0, 0] },
    armR: { t: [-0.6, 1.9, 1.05], hand: 'fist', pole: [-0.3, -1, 0] },
    legL: { t: [0.42, 1.55, 1.25], frame: 'floor', foot: { pitch: -8 } },
    legR: { t: [-0.42, 2.0, -2.1], frame: 'floor', foot: { pitch: 60 } },
  },
  'sit on floor': {
    root: { y: 0.52, pitch: -6 },
    spine: [8, 0, 0], neck: [4, 0, 0], head: [-4, 0, 0],
    armL: { t: [0.6, 0.1, 1.45], hand: 'relaxed', pole: [0.4, -0.4, -1], frame: 'body' },
    armR: 'mirror',
    legL: { t: [0.55, 0.34, 3.15], frame: 'floor', pole: [0.1, 1, 0.2], foot: { pitch: -20, yaw: 8 } },
    legR: 'mirror',
  },
  'sit on chair': {
    root: { y: 2.55, pitch: 3 },
    spine: [4, 0, 0], neck: [2, 0, 0], head: [-3, 0, 0],
    armL: { t: [0.62, 0.15, 1.15], hand: 'relaxed', pole: [0.5, -0.6, -1] },
    armR: 'mirror',
    legL: { t: [0.5, 0.34, 1.95], frame: 'floor', foot: { yaw: 6 } },
    legR: 'mirror',
  },
  kneel: {
    root: { y: 2.35, pitch: 6, yaw: -12 },
    spine: [4, 0, 8], neck: [4, 0, 0], head: [-2, 0, 0],
    armL: { t: [0.62, -0.5, 1.5], hand: 'relaxed', pole: [0.6, -0.8, -0.5] },
    armR: { t: [-0.75, -0.45, 0.35], hand: 'fist' },
    legL: { t: [0.5, 0.34, 2.0], frame: 'floor', pole: [0.3, 0.6, 1] },
    legR: { t: [-0.45, 0.34, -1.55], frame: 'floor', pole: [-0.1, 0.4, 1], foot: { pitch: 75 } },
  },
  crouch: {
    root: { y: 1.7, pitch: 24 },
    spine: [25, 0, 0], neck: [-12, 0, 0], head: [-18, 0, 0],
    armL: { t: [0.55, 0.2, 1.8], hand: 'relaxed', pole: [0.4, -1, -0.3] },
    armR: 'mirror',
    legL: { t: [0.8, 0.34, 0.6], frame: 'floor', pole: [0.9, 0.2, 1], foot: { yaw: 18 } },
    legR: 'mirror',
  },
  jump: {
    root: { y: 5.35, pitch: -4 },
    spine: [-4, 0, 0], neck: [-6, 0, 0], head: [-8, 0, 0],
    armL: { t: [1.7, 4.5, 0.3], hand: 'spread', pole: [0.5, -0.4, -1] },
    armR: 'mirror',
    legL: { t: [0.6, 1.75, -0.5], frame: 'floor', pole: [0.2, 0.1, 1], foot: { pitch: 40 } },
    legR: { t: [-0.45, 1.35, 0.55], frame: 'floor', pole: [-0.2, 0.1, 1], foot: { pitch: 30 } },
  },
  'arms raised': { armL: { t: [1.3, 4.5, 0.2], hand: 'open', pole: [0.4, -0.5, -1] }, armR: 'mirror', head: [-6, 0, 0] },
  'hands on hips': {
    armL: { t: [0.72, 0.1, 0.5], hand: 'relaxed', pole: [1, 0, -0.3], wrist: [-10, 0, 0], twist: -10 },
    armR: 'mirror',
  },
  'fighting stance': {
    root: { dy: -0.38, yaw: -35, pitch: 8 },
    spine: [6, 0, -10], neck: [8, 0, 10], head: [6, 0, 8],
    armL: { t: [0.5, 2.05, 1.4], hand: 'fist', pole: [0.2, -1, -0.2] },
    armR: { t: [-0.5, 2.25, 0.95], hand: 'fist', pole: [-0.3, -1, -0.2] },
    legL: { t: [0.55, 0.34, 1.35], frame: 'floor', pole: [0.3, 0.2, 1], foot: { yaw: -15 } },
    legR: { t: [-0.55, 0.34, -0.95], frame: 'floor', pole: [-0.3, 0.2, 1], foot: { yaw: -40 } },
  },
  'sword two-hand hold': {
    root: { dy: -0.22, yaw: -10 },
    spine: [3, 0, 0], neck: [3, 0, 0], head: [0, 0, 0],
    armL: { t: [0.14, 1.5, 1.3], hand: 'grip', pole: [0.8, -1, -0.3], wrist: [0, 0, 0] },
    armR: { t: [-0.1, 1.05, 1.2], hand: 'grip', pole: [-0.8, -1, -0.3] },
    legL: { t: [0.6, 0.34, 0.6], frame: 'floor', pole: [0.2, 0.2, 1], foot: { yaw: 10 } },
    legR: { t: [-0.5, 0.34, -0.55], frame: 'floor', pole: [-0.2, 0.2, 1], foot: { yaw: -20 } },
  },
  'casting a spell with one arm extended': {
    root: { dy: -0.15, yaw: -14, roll: 2 },
    spine: [0, 0, -12], neck: [-2, 0, 8], head: [0, 0, 10],
    armL: { t: [0.78, 1.3, 0.8], hand: 'fist', pole: [0.8, -1, -0.5] },
    armR: { t: [-0.55, 2.4, 2.3], hand: 'spread', pole: [-0.3, -1, 0], twist: -80, wrist: [30, 0, 0] },
    legL: { t: [0.62, 0.34, 0.9], frame: 'floor', pole: [0.1, 0.2, 1], foot: { yaw: 8 } },
    legR: { t: [-0.45, 0.34, -0.7], frame: 'floor', pole: [-0.1, 0.2, 1], foot: { yaw: -20 } },
  },
  'reaching up': {
    root: { dy: 0.08, pitch: -4 },
    spine: [-6, 0, 4], neck: [-14, 0, 0], head: [-22, 0, 0],
    armR: { t: [-0.45, 4.65, 0.5], hand: 'open', pole: [-0.3, -0.4, -1] },
    armL: { t: [1.0, -0.45, 0.05], hand: 'relaxed' },
    legL: { t: [0.4, 0.62, 0.0], frame: 'floor', foot: { pitch: 38 } },
    legR: 'mirror',
  },
  'lying down': {
    root: { y: 0.55, pitch: -90 },
    armL: { t: [1.05, -0.45, 0.08], hand: 'relaxed', twist: -10 },
    armR: 'mirror',
    legL: { t: [0.46, -3.62, 0.05], frame: 'body', foot: { yaw: 10 } },
    legR: 'mirror',
  },
  'A-pose': { armL: { t: [2.6, 0.15, 0.0], hand: 'open', twist: -20 }, armR: 'mirror' },
  'T-pose': { armL: { t: [3.7, 1.95, -0.04], hand: 'open', twist: 0 }, armR: 'mirror' },
};

export const PRESET_NAMES = Object.keys(SPECS);
export const DEFAULT_PRESET = 'stand';

export function presetKey(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
const KEYED: Record<string, string> = Object.fromEntries(PRESET_NAMES.map((n) => [presetKey(n), n]));
export function resolvePreset(name: string): string | null {
  return SPECS[name] ? name : KEYED[presetKey(name)] || null;
}

const mirrorLimb = (l: LimbSpec): LimbSpec => ({
  ...l,
  t: mir(l.t),
  pole: l.pole ? mir(l.pole) : undefined,
  foot: l.foot ? { ...l.foot, yaw: -(l.foot.yaw ?? 0), roll: -(l.foot.roll ?? 0) } : undefined,
});

export function buildSpec(body: Body, spec: Spec) {
  const { rig } = body;
  const h = rig.h;
  const kx = body.rootP.x, kz = body.rootP.z;
  for (const q of body.q) q.set(0, 0, 0, 1);
  body.pins = { footL: null, footR: null, handL: null, handR: null };
  const e = spec.root || {};
  body.rootQ.setFromEuler(new Euler((e.pitch ?? 0) * r2d, (e.yaw ?? 0) * r2d, (e.roll ?? 0) * r2d, 'YXZ'));
  const yawQ = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), (e.yaw ?? 0) * r2d);
  body.rootP.set(kx, e.y !== undefined ? e.y * h : rig.rest[0].y + (e.dy ?? 0) * h, kz);
  resetSwivel(body);
  body.fk();

  const dist = (names: number[], w: number[], v: V3 | undefined) => {
    if (!v) return;
    names.forEach((j, i) => tiltBall(rig, j, v[0] * w[i], v[1] * w[i], v[2] * w[i], body.q[j]));
  };
  dist([J.spine1, J.spine2, J.spine3], [0.3, 0.35, 0.35], spec.spine);
  dist([J.neck], [1], spec.neck);
  dist([J.head], [1], spec.head);
  body.fk();

  const toWorld = (v: V3, frame: 'body' | 'floor') => {
    if (frame === 'floor') {
      const p = new Vector3(v[0] * h, 0, v[2] * h).applyQuaternion(yawQ);
      return new Vector3(body.rootP.x + p.x, v[1] * h, body.rootP.z + p.z);
    }
    return new Vector3(v[0] * h, v[1] * h, v[2] * h).applyQuaternion(body.rootQ).add(body.rootP);
  };

  for (const S of ['L', 'R'] as const) {
    const s = S === 'L' ? 1 : -1;
    const raw = spec[`leg${S}`];
    const sl = raw === 'mirror' ? mirrorLimb(spec.legL!) : raw;
    const l: LimbSpec = sl || { t: [s * (rig.hipHalf / h), rig.ankleY / h, 0], frame: 'floor' };
    const frame = l.frame ?? 'floor';
    const T = toWorld(l.t, frame);
    const base = frame === 'floor' ? yawQ : body.rootQ;
    const f = l.foot || {};
    const endQ = base.clone().multiply(new Quaternion().setFromEuler(new Euler((f.pitch ?? 0) * r2d, (f.yaw ?? 0) * r2d, (f.roll ?? 0) * r2d, 'YXZ')));
    const pole = l.pole ? new Vector3(...l.pole) : null;
    solveLimb(body, LIMBS[`leg${S}`], T, { pole, endQ, spring: 0 });
    solveLimb(body, LIMBS[`leg${S}`], T, { pole, endQ, spring: 0 });
  }

  for (const S of ['L', 'R'] as const) {
    const raw = spec[`arm${S}`];
    const sl = raw === 'mirror' ? mirrorLimb(spec.armL!) : raw;
    const l: LimbSpec = sl || STAND_ARM;
    const arm = S === 'L' ? l : l;
    const eb = J[`elbow${S}`];
    composeHinge(rig, eb, 0, (arm.twist ?? 0) * r2d, body.q[eb]);
    const T = toWorld(arm.t, 'body');
    const pole = arm.pole ? new Vector3(...arm.pole) : null;
    solveLimb(body, LIMBS[`arm${S}`], T, { pole, spring: 0 });
    solveLimb(body, LIMBS[`arm${S}`], T, { pole, spring: 0 });
    const w = arm.wrist || [0, 0, 0];
    tiltBall(rig, J[`wrist${S}`], w[0], w[1], w[2], body.q[J[`wrist${S}`]]);
    body.fk();
    applyHand(body, S, arm.hand ?? 'relaxed');
  }
  body.fk();
}

export function applyPreset(body: Body, name: string) {
  const n = resolvePreset(name);
  if (!n) return false;
  buildSpec(body, SPECS[n]);
  return true;
}

export const _c = composeBall;
