import { SPECS, type HandShape, type LimbSpec, type Spec } from './poses';

type V3 = [number, number, number];
interface Gesture { id: string; phrase: string; limb: LimbSpec }

const G = (id: string, phrase: string, t: V3, hand: HandShape, pole?: V3, extra: Partial<LimbSpec> = {}): Gesture => ({ id, phrase, limb: { t, hand, pole, ...extra } });

const GESTURES: Gesture[] = [
  G('down', 'arm relaxed at the side', [1.0, -0.45, 0.05], 'relaxed'),
  G('hip', 'hand on hip', [0.72, 0.1, 0.5], 'relaxed', [1, 0, -0.3], { wrist: [-10, 0, 0], twist: -10 }),
  G('pocket', 'hand in pocket', [0.8, -0.15, 0.35], 'relaxed', [0.6, -0.4, -0.6]),
  G('raised', 'arm raised overhead', [1.3, 4.5, 0.2], 'open', [0.4, -0.5, -1]),
  G('reach-up', 'reaching up high', [-0.45, 4.65, 0.5], 'open', [-0.3, -0.4, -1]),
  G('wave', 'arm raised waving', [1.3, 3.0, 0.3], 'open', [0.6, -0.8, -0.5]),
  G('out-side', 'arm stretched out to the side', [3.2, 1.9, 0.0], 'open'),
  G('diag-down', 'arm held out low to the side', [2.6, 0.15, 0.0], 'open', undefined, { twist: -20 }),
  G('forward', 'arm stretched forward', [0.78, 1.3, 2.3], 'open', [0.8, -1, -0.5]),
  G('point', 'pointing forward', [0.9, 1.7, 2.4], 'point', [0.8, -1, -0.5]),
  G('chest', 'hand on chest', [0.3, 1.45, 0.65], 'relaxed', [0.9, -0.5, -0.5]),
  G('chin', 'hand raised to the chin', [0.3, 2.4, 0.7], 'relaxed', [0.9, -0.6, -0.4]),
  G('head', 'hand behind the head', [0.55, 2.8, -0.15], 'relaxed', [1, 0.2, -0.2]),
  G('salute', 'saluting', [0.45, 2.55, 0.45], 'open', [1, -0.3, -0.3]),
  G('fist', 'fist raised', [0.7, 2.6, 1.0], 'fist', [0.5, -1, -0.2]),
  G('behind', 'hand behind the back', [0.4, 0.2, -0.6], 'relaxed', [0.9, -0.5, 0.2]),
  G('cross', 'arm folded across the body', [-0.15, 1.15, 0.75], 'relaxed', [0.2, -1, -0.2]),
  G('guard', 'fist up in guard', [0.4, 1.7, 1.0], 'fist', [0.9, -1, -0.2]),
  G('hold', 'holding something in front', [0.3, 1.1, 1.3], 'grip', [0.8, -1, -0.3]),
];

const BASES: { id: string; phrase: string; ground: boolean; free: boolean }[] = [
  { id: 'stand', phrase: 'standing', ground: true, free: true },
  { id: 'relaxed', phrase: 'standing relaxed, weight on one leg', ground: true, free: true },
  { id: 'walk', phrase: 'walking mid stride', ground: true, free: true },
  { id: 'run', phrase: 'running', ground: true, free: false },
  { id: 'sit on floor', phrase: 'sitting on the floor', ground: false, free: true },
  { id: 'sit on chair', phrase: 'sitting on a chair', ground: false, free: true },
  { id: 'kneel', phrase: 'kneeling on one knee', ground: false, free: true },
  { id: 'crouch', phrase: 'crouching', ground: false, free: true },
  { id: 'jump', phrase: 'jumping in the air', ground: false, free: true },
  { id: 'fighting stance', phrase: 'in a fighting stance', ground: true, free: false },
  { id: 'sword two-hand hold', phrase: 'gripping a two-handed weapon', ground: true, free: false },
  { id: 'casting a spell with one arm extended', phrase: 'casting a spell', ground: true, free: false },
];

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(r: () => number, a: T[]) => a[Math.floor(r() * a.length)];
const jit = (r: () => number, v: number, a: number) => v + (r() * 2 - 1) * a;
const mirLimb = (l: LimbSpec): LimbSpec => ({ ...l, t: [-l.t[0], l.t[1], l.t[2]], pole: l.pole ? [-l.pole[0], l.pole[1], l.pole[2]] : undefined });

export interface SampledPose { name: string; base: string; description: string; tags: string[]; spec: Spec; yaw: number }

export function sampleSpec(seed: number, baseId?: string): SampledPose {
  const r = rng(seed * 7919 + 17);
  const base = baseId ? BASES.find((b) => b.id === baseId)! : pick(r, BASES);
  const src = SPECS[base.id];
  const spec: Spec = JSON.parse(JSON.stringify(src));
  const phrases: string[] = [base.phrase];
  const tags = [base.id];

  if (base.free) {
    const gl = pick(r, GESTURES);
    const sym = r() < 0.3;
    const gr = sym ? gl : pick(r, GESTURES);
    const left: LimbSpec = { ...gl.limb, t: [...gl.limb.t] as V3 };
    const right: LimbSpec = sym ? mirLimb(left) : mirLimb({ ...gr.limb, t: [...gr.limb.t] as V3 });
    for (const l of [left, right]) {
      l.t = [jit(r, l.t[0], 0.12), jit(r, l.t[1], 0.2), jit(r, l.t[2], 0.12)];
    }
    spec.armL = left;
    spec.armR = right;
    if (sym) {
      const ph = gl.phrase;
      phrases.push(/^arm /.test(ph) ? ph.replace(/^arm/, 'both arms') : /^(hand|fist) /.test(ph) ? ph.replace(/^(hand|fist)/, 'both $1s') : `${ph} with both arms`);
    } else if (gl.id !== 'down' || gr.id !== 'down') phrases.push(`left ${gl.phrase}`, `right ${gr.phrase}`);
    tags.push(gl.id, gr.id);
  }
  const root = (spec.root = { ...(spec.root || {}) });
  const yaw = Math.round(jit(r, root.yaw ?? 0, base.ground ? 28 : 18));
  root.yaw = yaw;
  const lean = Math.round(jit(r, 0, 8));
  spec.spine = [((spec.spine?.[0] ?? 0) + lean), jit(r, spec.spine?.[1] ?? 0, 8), jit(r, spec.spine?.[2] ?? 0, 7)];
  const hx = Math.round(jit(r, spec.head?.[0] ?? 0, 10));
  const hz = Math.round(jit(r, spec.head?.[2] ?? 0, 12));
  const hy = Math.round(jit(r, spec.head?.[1] ?? 0, 20));
  spec.head = [hx, hy, hz];
  spec.neck = [spec.neck?.[0] ?? 0, jit(r, spec.neck?.[1] ?? 0, 10), spec.neck?.[2] ?? 0];
  if (hz > 6) phrases.push('head tilted to the left');
  else if (hz < -6) phrases.push('head tilted to the right');
  if (hx > 7) phrases.push('chin down');
  else if (hx < -7) phrases.push('chin up');
  if (hy > 12) phrases.push('looking over the left shoulder');
  else if (hy < -12) phrases.push('looking over the right shoulder');
  if (lean > 5) phrases.push('leaning forward');
  else if (lean < -5) phrases.push('leaning back');
  if (Math.abs(yaw) > 20 && base.ground) phrases.push(yaw > 0 ? 'body turned to the left' : 'body turned to the right');

  if (base.ground && spec.legL && spec.legL !== undefined) {
    const wide = jit(r, 0, 0.18);
    const legL = spec.legL as LimbSpec;
    legL.t = [legL.t[0] + wide, legL.t[1], jit(r, legL.t[2], 0.2)];
    if (spec.legR && spec.legR !== 'mirror') {
      const legR = spec.legR as LimbSpec;
      legR.t = [legR.t[0] - wide, legR.t[1], jit(r, legR.t[2], 0.2)];
    }
    if (wide > 0.1) phrases.push('feet wide apart');
  }
  return { name: phrases.slice(0, 3).join(', '), base: base.id, description: phrases.join(', '), tags, spec, yaw };
}

export const BASE_IDS = BASES.map((b) => b.id);
