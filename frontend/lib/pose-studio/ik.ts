import { Matrix4, Quaternion, Vector3 } from 'three';
import { Body, J, PARENT, PIN_KEYS, clampJoint, composeHinge, hingeAxisRest, hingeTwist, jointViolation, type Hinge, type PinKey } from './rig';

export interface LimbDef {
  name: string;
  kind: 'arm' | 'leg';
  clav: number;
  root: number;
  mid: number;
  end: number;
  parent: number;
  pole: Vector3;
  pin: PinKey;
}

function mk(name: string, kind: 'arm' | 'leg', S: 'L' | 'R'): LimbDef {
  const s = S === 'L' ? 1 : -1;
  const arm = kind === 'arm';
  return {
    name,
    kind,
    clav: arm ? J[`clav${S}`] : -1,
    root: J[`${arm ? 'shoulder' : 'hip'}${S}`],
    mid: J[`${arm ? 'elbow' : 'knee'}${S}`],
    end: J[`${arm ? 'wrist' : 'ankle'}${S}`],
    parent: arm ? J[`clav${S}`] : J.pelvis,
    pole: arm ? new Vector3(s * 0.35, -0.45, -0.8) : new Vector3(s * 0.1, 0.05, 1),
    pin: `${arm ? 'hand' : 'foot'}${S}` as PinKey,
  };
}

export const LIMBS: Record<string, LimbDef> = {
  armL: mk('armL', 'arm', 'L'), armR: mk('armR', 'arm', 'R'), legL: mk('legL', 'leg', 'L'), legR: mk('legR', 'leg', 'R'),
};
export const PIN_LIMB: Record<PinKey, LimbDef> = { footL: LIMBS.legL, footR: LIMBS.legR, handL: LIMBS.armL, handR: LIMBS.armR };

export interface SolveOpts { pole?: Vector3 | null; elbow?: Vector3 | null; endQ?: Quaternion | null; spring?: number; assist?: boolean }

const swivels = new WeakMap<Body, Record<string, Vector3>>();
const V = () => new Vector3();
const t1 = V(), t2 = V(), t3 = V(), t4 = V(), t5 = V(), t6 = V();
const qa = new Quaternion(), qb = new Quaternion(), qc = new Quaternion(), qd = new Quaternion();
const m4 = new Matrix4();
const ID = new Quaternion();

function basisQ(x: Vector3, y: Vector3, out: Quaternion) {
  const z = t6.crossVectors(x, y);
  return out.setFromRotationMatrix(m4.makeBasis(x, y, z));
}

function perp(v: Vector3, axis: Vector3, out: Vector3) {
  return out.copy(v).addScaledVector(axis, -v.dot(axis));
}

export function pelvisHint(body: Body, hint: Vector3, out = V()) {
  return out.copy(hint).applyQuaternion(body.rootQ);
}

function clavAssist(body: Body, limb: LimbDef, T: Vector3) {
  const { rig } = body;
  const c = limb.clav;
  qa.copy(body.wq[PARENT[c]]).invert();
  const dp = t1.subVectors(T, body.wp[c]).normalize().applyQuaternion(qa);
  const r = qb.setFromUnitVectors(rig.dir[c], dp);
  r.copy(ID).slerp(r, 0.22);
  body.q[c].copy(clampJoint(rig, c, r));
  body.fk(c);
}

export function solveLimb(body: Body, limb: LimbDef, T: Vector3, opts: SolveOpts = {}): number {
  const { rig } = body;
  body.fk();
  if (limb.kind === 'arm' && opts.assist !== false) clavAssist(body, limb, T);
  const { root, mid, end } = limb;
  const S = t1.copy(body.wp[root]).clone();
  const a = rig.len[mid];
  const b = rig.len[end];
  const d = t2.subVectors(T, S);
  let D = d.length();
  if (D < 1e-9) { d.set(0, -1, 0); D = 1e-9; }
  const dh = d.clone().divideScalar(D);
  const Lm = rig.limits[mid] as Hinge;
  const Dmax = a + b;
  const Dmin = Math.sqrt(a * a + b * b + 2 * a * b * Math.cos(Lm.hi));
  const Dc = Math.min(Dmax, Math.max(Dmin, D));
  const E0 = body.wp[mid];
  const W0 = body.wp[end];
  const dc = W0.clone().sub(S).normalize();
  const store = swivels.get(body) || {};
  swivels.set(body, store);
  const uCur = perp(t3.copy(E0).sub(S), dc, V());
  if (uCur.lengthSq() > 1e-8) uCur.applyQuaternion(qa.setFromUnitVectors(dc, dh)).normalize();
  else if (store[limb.name]) uCur.copy(store[limb.name]).applyQuaternion(qa.setFromUnitVectors(dc, dh)).normalize();
  const hint = perp(pelvisHint(body, opts.pole ?? limb.pole, V()), dh, V());
  const hintLen = hint.length();
  if (hintLen > 1e-6) hint.divideScalar(hintLen);
  const u = V();
  if (opts.elbow) perp(t4.copy(opts.elbow).sub(S), dh, u);
  else {
    if (uCur.lengthSq() > 1e-12) u.copy(uCur);
    u.addScaledVector(hint, opts.spring ?? 0.12);
  }
  if (u.lengthSq() < 1e-12) {
    if (hintLen > 1e-6) u.copy(hint);
    else u.copy(Math.abs(dh.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0));
  }
  perp(u, dh, u);
  if (u.lengthSq() < 1e-12) u.set(dh.z, dh.x, dh.y);
  perp(u, dh, u).normalize();
  const v = new Vector3().crossVectors(dh, u);

  const Pw = qc.copy(body.wq[limb.parent]).invert().clone();
  const b0 = rig.dir[root];
  const h0 = hingeAxisRest(rig, mid);
  const restInv = basisQ(h0, b0, new Quaternion()).invert();
  const te = hingeTwist(rig, mid, body.q[mid]);
  const cosA = Math.max(-1, Math.min(1, (a * a + Dc * Dc - b * b) / (2 * a * Dc)));
  const sinA = Math.sqrt(1 - cosA * cosA);
  const Wt = dh.clone().multiplyScalar(Dc).add(S);
  const ee = V(), nn = V(), fv = V(), uu = V();
  const qs = new Quaternion(), qe = new Quaternion(), tmp = new Quaternion();

  const evalPhi = (phi: number) => {
    uu.copy(u).multiplyScalar(Math.cos(phi)).addScaledVector(v, Math.sin(phi));
    ee.copy(dh).multiplyScalar(cosA).addScaledVector(uu, sinA).normalize();
    fv.copy(ee).multiplyScalar(-a).add(Wt).sub(S);
    nn.crossVectors(ee, fv);
    if (nn.length() < 1e-7 * b) nn.crossVectors(ee, t5.copy(uu).negate());
    nn.normalize();
    qs.copy(Pw).multiply(basisQ(nn, ee, tmp).multiply(restInv));
    const f = Math.acos(Math.max(-1, Math.min(1, ee.dot(fv) / Math.max(1e-12, fv.length()))));
    composeHinge(rig, mid, f, te, qe);
    return jointViolation(rig, root, qs) + jointViolation(rig, mid, qe);
  };

  const step = Math.PI / 45;
  let best = 0;
  let bestViol = evalPhi(0);
  let found = bestViol <= 1e-5;
  if (!found) {
    let minV = bestViol;
    let minPhi = 0;
    for (let k = 1; k <= 45 && !found; k++) {
      for (const sg of [1, -1]) {
        const phi = sg * k * step;
        const vi = evalPhi(phi);
        if (vi < minV) { minV = vi; minPhi = phi; }
        if (vi <= 1e-5) {
          let bad = sg * (k - 1) * step;
          let good = phi;
          for (let i = 0; i < 7; i++) {
            const mphi = (bad + good) / 2;
            if (evalPhi(mphi) <= 1e-5) good = mphi; else bad = mphi;
          }
          best = good;
          found = true;
          break;
        }
      }
    }
    if (!found) { best = minPhi; bestViol = minV; }
  }
  evalPhi(best);
  clampJoint(rig, root, qs);
  clampJoint(rig, mid, qe);
  body.q[root].copy(qs);
  body.q[mid].copy(qe);
  store[limb.name] = (store[limb.name] || V()).copy(uu);
  body.fk(root);
  if (found) bestViol = 0;
  if (bestViol > 1e-5) refine(body, limb, D <= Dmax ? T : Wt, 30);
  if (opts.endQ) setEndOrientation(body, limb, opts.endQ);
  return body.wp[end].distanceTo(T);
}

function refine(body: Body, limb: LimbDef, T: Vector3, iters: number) {
  const { rig } = body;
  for (let it = 0; it < iters; it++) {
    for (const j of [limb.mid, limb.root]) {
      const pivot = body.wp[j];
      const v1 = t1.subVectors(body.wp[limb.end], pivot);
      const v2 = t2.subVectors(T, pivot);
      if (v1.lengthSq() < 1e-12 || v2.lengthSq() < 1e-12) continue;
      const rot = qa.setFromUnitVectors(v1.normalize(), v2.normalize());
      const wnew = qb.copy(rot).multiply(body.wq[j]);
      const local = qc.copy(body.wq[PARENT[j]]).invert().multiply(wnew);
      body.q[j].copy(clampJoint(rig, j, local));
      body.fk(j);
    }
    if (body.wp[limb.end].distanceToSquared(T) < 1e-10) break;
  }
}

export function setEndOrientation(body: Body, limb: LimbDef, worldQ: Quaternion) {
  const local = qd.copy(body.wq[limb.mid]).invert().multiply(worldQ);
  body.q[limb.end].copy(clampJoint(body.rig, limb.end, local));
  body.fk(limb.end);
}

export function headCenter(body: Body, out = V()) {
  return out.set(0, body.rig.h * 0.45, 0).applyQuaternion(body.wq[J.head]).add(body.wp[J.head]);
}

export function solveChain(body: Body, chain: number[], effJoint: number, effLocal: Vector3, T: Vector3, opts: { iters?: number; weights?: number[]; tol?: number } = {}) {
  const { rig } = body;
  const iters = opts.iters ?? 24;
  const tol = opts.tol ?? 1e-5;
  const eff = V();
  const getEff = () => eff.copy(effLocal).applyQuaternion(body.wq[effJoint]).add(body.wp[effJoint]);
  body.fk();
  for (let it = 0; it < iters; it++) {
    for (let k = chain.length - 1; k >= 0; k--) {
      const j = chain[k];
      const pivot = body.wp[j];
      const e = getEff();
      const v1 = t1.subVectors(e, pivot);
      const v2 = t2.subVectors(T, pivot);
      if (v1.lengthSq() < 1e-12 || v2.lengthSq() < 1e-12) continue;
      const rot = qa.setFromUnitVectors(v1.normalize(), v2.normalize());
      const w = opts.weights ? opts.weights[k] : 1;
      rot.copy(ID).slerp(rot, w).multiply(body.wq[j]);
      qb.copy(body.wq[PARENT[j]]).invert().multiply(rot);
      body.q[j].copy(clampJoint(rig, j, qb));
      body.fk(j);
    }
    if (getEff().distanceToSquared(T) < tol * tol) break;
  }
  return getEff().distanceTo(T);
}

export const HEAD_CHAIN = [J.spine1, J.spine2, J.spine3, J.neck];
export const HEAD_WEIGHTS = [0.8, 0.8, 0.8, 0.6];
export const CHEST_CHAIN = [J.spine1, J.spine2];

export function aimChild(body: Body, joint: number, child: number, target: Vector3) {
  body.fk();
  const from = t1.subVectors(body.wp[child], body.wp[joint]).normalize();
  const to = t2.subVectors(target, body.wp[joint]).normalize();
  const rot = qa.setFromUnitVectors(from, to).multiply(body.wq[joint]);
  const local = qb.copy(body.wq[PARENT[joint]]).invert().multiply(rot);
  body.q[joint].copy(clampJoint(body.rig, joint, local));
  body.fk(joint);
}

export function rotateJointWorld(body: Body, j: number, delta: Quaternion) {
  body.fk();
  if (j === 0) {
    body.rootQ.premultiply(delta).normalize();
  } else {
    const nq = qa.copy(delta).multiply(body.wq[j]);
    const local = qb.copy(body.wq[PARENT[j]]).invert().multiply(nq);
    body.q[j].copy(clampJoint(body.rig, j, local));
  }
  body.fk();
}

export function clampRootToPins(body: Body) {
  body.fk();
  for (let pass = 0; pass < 4; pass++) {
    let moved = false;
    for (const k of PIN_KEYS) {
      const pin = body.pins[k];
      if (!pin) continue;
      const limb = PIN_LIMB[k];
      const reach = (body.rig.len[limb.mid] + body.rig.len[limb.end]) * 0.998;
      const vec = t1.subVectors(pin.p, body.wp[limb.root]);
      const dist = vec.length();
      if (dist > reach) {
        body.rootP.addScaledVector(vec.divideScalar(dist), dist - reach);
        body.fk();
        moved = true;
      }
    }
    if (!moved) break;
  }
}

export function applyPins(body: Body, skip?: PinKey) {
  for (const k of PIN_KEYS) {
    const pin = body.pins[k];
    if (!pin || k === skip) continue;
    solveLimb(body, PIN_LIMB[k], pin.p, { endQ: pin.q, assist: PIN_LIMB[k].kind === 'arm' });
  }
}

export function setPin(body: Body, key: PinKey, on: boolean) {
  body.fk();
  if (!on) { body.pins[key] = null; return; }
  const limb = PIN_LIMB[key];
  body.pins[key] = { p: body.wp[limb.end].clone(), q: body.wq[limb.end].clone() };
}

export function resetSwivel(body: Body) {
  swivels.delete(body);
}

export function limbEnd(body: Body, limb: LimbDef) {
  return body.wp[limb.end];
}
