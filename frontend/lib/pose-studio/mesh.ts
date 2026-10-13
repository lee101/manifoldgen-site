import { BufferAttribute, BufferGeometry, Matrix4, Vector3 } from 'three';
import { Body, FINGERS, FINGER_RADIUS, J, N, type Rig } from './rig';

export const PART_HEAD = 0;
export const PART_TORSO = 1;
export const PART_ARMS = 2;
export const PART_LEGS = 3;
export const PART_COUNT = 4;

type Skin = { i: [number, number, number, number]; w: [number, number, number, number] };
const rigid = (b: number): Skin => ({ i: [b, 0, 0, 0], w: [1, 0, 0, 0] });
const blend = (a: number, b: number, t: number): Skin => ({ i: [a, b, 0, 0], w: [1 - t, t, 0, 0] });
const smooth = (t: number) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

interface Node { c: Vector3; rx: number; rz: number; skin: Skin }

class Builder {
  pos: number[] = [];
  nrm: number[] = [];
  si: number[] = [];
  sw: number[] = [];
  part: number[] = [];
  idx: number[] = [];

  grid(rings: Vector3[][], skins: Skin[], part: number, poleA: Vector3 | null, poleB: Vector3 | null) {
    const base = this.pos.length / 3;
    const R = rings.length;
    const M = rings[0].length;
    const nrm = new Float32Array(R * M * 3);
    for (let i = 0; i < R; i++) {
      for (let j = 0; j < M; j++) {
        const p = rings[i][j];
        this.pos.push(p.x, p.y, p.z);
        const s = skins[i];
        this.si.push(...s.i);
        this.sw.push(...s.w);
        this.part.push(part);
      }
    }
    const a = new Vector3(), b = new Vector3(), c = new Vector3(), e1 = new Vector3(), e2 = new Vector3(), n = new Vector3();
    const tri = (i0: number, i1: number, i2: number) => {
      this.idx.push(base + i0, base + i1, base + i2);
      a.fromArray(this.pos, (base + i0) * 3); b.fromArray(this.pos, (base + i1) * 3); c.fromArray(this.pos, (base + i2) * 3);
      n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a));
      for (const k of [i0, i1, i2]) { nrm[k * 3] += n.x; nrm[k * 3 + 1] += n.y; nrm[k * 3 + 2] += n.z; }
    };
    for (let i = 0; i < R - 1; i++) {
      for (let j = 0; j < M; j++) {
        const j1 = (j + 1) % M;
        const q00 = i * M + j, q01 = i * M + j1, q10 = (i + 1) * M + j, q11 = (i + 1) * M + j1;
        tri(q00, q01, q10);
        tri(q01, q11, q10);
      }
    }
    const setPole = (ri: number, v: Vector3 | null) => {
      if (!v) return;
      for (let j = 0; j < M; j++) { const k = (ri * M + j) * 3; nrm[k] = v.x; nrm[k + 1] = v.y; nrm[k + 2] = v.z; }
    };
    setPole(0, poleA);
    setPole(R - 1, poleB);
    for (let k = 0; k < R * M; k++) {
      n.set(nrm[k * 3], nrm[k * 3 + 1], nrm[k * 3 + 2]).normalize();
      this.nrm.push(n.x, n.y, n.z);
    }
  }

  tube(nodes: Node[], o: { u: Vector3; seg: number; part: number; startCap?: number; endCap?: number; capSteps?: number }) {
    const K = o.capSteps ?? 6;
    const first = nodes[0], last = nodes[nodes.length - 1];
    const tA = new Vector3().subVectors(nodes[1].c, first.c).normalize();
    const tB = new Vector3().subVectors(last.c, nodes[nodes.length - 2].c).normalize();
    const rings: Vector3[][] = [];
    const skins: Skin[] = [];
    const ring = (c: Vector3, t: Vector3, rx: number, rz: number) => {
      const u = o.u.clone().addScaledVector(t, -o.u.dot(t)).normalize();
      const v = new Vector3().crossVectors(t, u);
      const pts: Vector3[] = [];
      for (let j = 0; j < o.seg; j++) {
        const th = (j / o.seg) * Math.PI * 2;
        pts.push(c.clone().addScaledVector(u, rx * Math.cos(th)).addScaledVector(v, rz * Math.sin(th)));
      }
      return pts;
    };
    if (o.startCap) {
      for (let k = 0; k < K; k++) {
        const phi = (Math.PI / 2) * (1 - k / K);
        const f = Math.cos(phi);
        const c = first.c.clone().addScaledVector(tA, -o.startCap * Math.sin(phi));
        rings.push(ring(c, tA, first.rx * f, first.rz * f));
        skins.push(first.skin);
      }
    }
    for (const n of nodes) { rings.push(ring(n.c, n === first ? tA : n === last ? tB : tA, n.rx, n.rz)); skins.push(n.skin); }
    if (o.endCap) {
      for (let k = 1; k <= K; k++) {
        const phi = (Math.PI / 2) * (k / K);
        const f = Math.cos(phi);
        const c = last.c.clone().addScaledVector(tB, o.endCap * Math.sin(phi));
        rings.push(ring(c, tB, last.rx * f, last.rz * f));
        skins.push(last.skin);
      }
    }
    const poleA = o.startCap ? tA.clone().negate() : null;
    const poleB = o.endCap ? tB.clone() : null;
    this.grid(rings, skins, o.part, poleA, poleB);
  }

  geometry() {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.nrm), 3));
    g.setAttribute('skinIndex', new BufferAttribute(new Float32Array(this.si), 4));
    g.setAttribute('skinWeight', new BufferAttribute(new Float32Array(this.sw), 4));
    g.setAttribute('part', new BufferAttribute(new Float32Array(this.part), 1));
    g.setIndex(this.idx.length > 65535 ? new BufferAttribute(new Uint32Array(this.idx), 1) : new BufferAttribute(new Uint16Array(this.idx), 1));
    return g;
  }
}

function lerpProfile(prof: number[][], t: number) {
  const f = Math.min(prof.length - 1.0001, Math.max(0, t * (prof.length - 1)));
  const i = Math.floor(f);
  const k = f - i;
  return prof[i].map((v, c) => v + (prof[i + 1][c] - v) * k);
}

function catmull(nodes: number[][], samples: number) {
  const out: number[][] = [];
  const n = nodes.length;
  for (let s = 0; s < samples; s++) {
    const f = (s / (samples - 1)) * (n - 1);
    const i = Math.min(n - 2, Math.floor(f));
    const t = f - i;
    const p0 = nodes[Math.max(0, i - 1)], p1 = nodes[i], p2 = nodes[i + 1], p3 = nodes[Math.min(n - 1, i + 2)];
    out.push(p1.map((_, c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t * t + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t * t * t)));
  }
  return out;
}

export function buildGeometry(rig: Rig): BufferGeometry {
  const b = new Builder();
  const h = rig.h;
  const P = rig.rest[0];
  const X = new Vector3(1, 0, 0), Z = new Vector3(0, 0, 1);
  const { props } = rig;

  const hipS = 1 + (props.hip - 1) * 0.8;
  const shS = 1 + (props.shoulder - 1) * 0.6;
  const prof = catmull([
    [-0.44, 0.1, 0.1, 0],
    [-0.34, 0.5 * hipS, 0.4, -0.02],
    [-0.12, 0.66 * hipS, 0.47, -0.03],
    [0.2, 0.62 * hipS, 0.43, -0.03],
    [0.5, 0.5, 0.36, 0],
    [0.95, 0.55, 0.39, 0.02],
    [1.35, 0.7 * shS, 0.42, 0.04],
    [1.7, 0.75 * shS, 0.4, 0.03],
    [1.98, 0.64 * shS, 0.32, 0],
    [2.16, 0.32, 0.24, 0],
    [2.3, 0.2, 0.2, 0],
  ], 44);
  const knots = [0, 0.45, 1.0, 1.55, 2.1];
  const bones = [J.pelvis, J.spine1, J.spine2, J.spine3, J.neck];
  const torsoSkin = (y: number): Skin => {
    if (y <= knots[0]) return rigid(bones[0]);
    if (y >= knots[4]) return rigid(bones[4]);
    let k = 0;
    while (y > knots[k + 1]) k++;
    return blend(bones[k], bones[k + 1], smooth((y - knots[k]) / (knots[k + 1] - knots[k])));
  };
  b.tube(prof.map((r) => ({ c: new Vector3(0, P.y + r[0] * h, r[3] * h), rx: r[1] * h, rz: r[2] * h, skin: torsoSkin(r[0]) })), { u: X, seg: 32, part: PART_TORSO, capSteps: 1 });

  const neckA = rig.rest[J.neck];
  const neckB = rig.rest[J.head];
  const neckNodes: Node[] = [];
  for (let i = 0; i <= 5; i++) {
    const t = i / 5;
    neckNodes.push({ c: neckA.clone().lerp(neckB, t).add(new Vector3(0, -0.1 * h * (1 - t), 0)), rx: (0.215 - 0.02 * t) * h, rz: (0.215 - 0.02 * t) * h, skin: blend(J.neck, J.head, smooth((t - 0.35) / 0.65)) });
  }
  b.tube(neckNodes, { u: X, seg: 20, part: PART_HEAD });

  const hc = rig.rest[J.head].clone().add(new Vector3(0, 0.45 * h, 0.03 * h));
  const headSkin = rigid(J.head);
  const LAT = 28, LON = 36;
  const rings: Vector3[][] = [];
  const skins: Skin[] = [];
  for (let i = 0; i <= LAT; i++) {
    const phi = -Math.PI / 2 + (i / LAT) * Math.PI;
    const sy = Math.sin(phi);
    const cy = Math.cos(phi);
    const taper = sy < 0 ? 1 - 0.32 * smooth(-sy * 1.1) : 1 - 0.06 * sy * sy;
    const pts: Vector3[] = [];
    for (let j = 0; j < LON; j++) {
      const th = (j / LON) * Math.PI * 2;
      const sx = Math.cos(th) * cy;
      const sz = -Math.sin(th) * cy;
      const zs = sz >= 0 ? 0.43 : 0.5;
      const chin = sy < 0 && sz > 0 ? 0.04 * smooth(-sy) * sz : 0;
      pts.push(new Vector3(hc.x + 0.37 * h * sx * taper, hc.y + 0.5 * h * sy, hc.z + h * (zs * sz * taper + chin)));
    }
    rings.push(pts);
    skins.push(headSkin);
  }
  b.grid(rings, skins, PART_HEAD, new Vector3(0, -1, 0), new Vector3(0, 1, 0));

  const blob = (c: Vector3, rx: number, ry: number, rz: number, part: number, skin: Skin, seg = 14, lat = 10) => {
    const rs: Vector3[][] = [];
    const ss: Skin[] = [];
    for (let i = 0; i <= lat; i++) {
      const phi = -Math.PI / 2 + (i / lat) * Math.PI;
      const pts: Vector3[] = [];
      for (let j = 0; j < seg; j++) {
        const th = (j / seg) * Math.PI * 2;
        pts.push(new Vector3(c.x + rx * Math.cos(phi) * Math.cos(th), c.y + ry * Math.sin(phi), c.z - rz * Math.cos(phi) * Math.sin(th)));
      }
      rs.push(pts);
      ss.push(skin);
    }
    b.grid(rs, ss, part, new Vector3(0, -1, 0), new Vector3(0, 1, 0));
  };
  blob(hc.clone().add(new Vector3(0, -0.06 * h, 0.4 * h)), 0.065 * h, 0.1 * h, 0.1 * h, PART_HEAD, headSkin, 12, 8);
  for (const s of [1, -1]) blob(hc.clone().add(new Vector3(s * 0.37 * h, -0.02 * h, -0.02 * h)), 0.04 * h, 0.1 * h, 0.07 * h, PART_HEAD, headSkin, 12, 8);

  for (const [S, s] of [['L', 1], ['R', -1]] as const) {
    const pc = rig.rest[J[`clav${S}`]], ps = rig.rest[J[`shoulder${S}`]];
    b.tube([
      { c: pc, rx: 0.15 * h, rz: 0.15 * h, skin: rigid(J[`clav${S}`]) },
      { c: pc.clone().lerp(ps, 0.5), rx: 0.16 * h, rz: 0.16 * h, skin: rigid(J[`clav${S}`]) },
      { c: ps, rx: 0.17 * h, rz: 0.17 * h, skin: rigid(J[`clav${S}`]) },
    ], { u: Z, seg: 16, part: PART_TORSO, startCap: 0.15 * h, endCap: 0.17 * h });

    const segTube = (from: string, to: string, prof: number[][], part: number, startCap: boolean, u: Vector3, seg = 20, n = 7, endCapScale = 1) => {
      const a = rig.rest[J[from + S]], c = rig.rest[J[to + S]];
      const nodes: Node[] = [];
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const r = lerpProfile(prof, t);
        nodes.push({ c: a.clone().lerp(c, t), rx: r[0] * h, rz: (r[1] ?? r[0]) * h, skin: rigid(J[from + S]) });
      }
      const rEnd = nodes[n - 1];
      b.tube(nodes, { u, seg, part, startCap: startCap ? nodes[0].rx : 0, endCap: rEnd.rx * endCapScale });
    };
    segTube('shoulder', 'elbow', [[0.24], [0.215], [0.19], [0.17], [0.165]], PART_ARMS, true, Z);
    segTube('elbow', 'wrist', [[0.165], [0.178], [0.16], [0.13], [0.105]], PART_ARMS, false, Z);
    segTube('hip', 'knee', [[0.34], [0.325], [0.29], [0.245], [0.2]], PART_LEGS, true, X, 24, 8);
    segTube('knee', 'ankle', [[0.2], [0.215], [0.205], [0.15], [0.115]], PART_LEGS, false, X, 22, 8);

    const w = rig.rest[J[`wrist${S}`]];
    const pdir = new Vector3(s, 0, 0);
    const wristSkin = rigid(J[`wrist${S}`]);
    const palmNodes: Node[] = [];
    const pp = [[0.12, 0.085], [0.17, 0.09], [0.205, 0.085], [0.215, 0.075], [0.21, 0.065]];
    for (let i = 0; i < pp.length; i++) {
      const t = i / (pp.length - 1);
      palmNodes.push({ c: w.clone().addScaledVector(pdir, (-0.04 + t * 0.52) * h).add(new Vector3(0, 0, 0.0 * h)), rx: pp[i][0] * h, rz: pp[i][1] * h, skin: wristSkin });
    }
    b.tube(palmNodes, { u: Z, seg: 16, part: PART_ARMS, startCap: 0.06 * h, endCap: 0.06 * h });

    for (const f of FINGERS) {
      const r0 = FINGER_RADIUS[f] * h * 1.12;
      const j1 = J[`${f}1${S}`], j2 = J[`${f}2${S}`], j3 = J[`${f}3${S}`];
      const p1 = rig.rest[j1], p2 = rig.rest[j2], p3 = rig.rest[j3], p4 = p3.clone().add(rig.tip[j3]!);
      const thumb = f === 'thumb';
      const segs: [Vector3, Vector3, number, number, number][] = [
        [p1, p2, j1, r0 * (thumb ? 1.12 : 1), r0 * 0.96],
        [p2, p3, j2, r0 * 0.96, r0 * 0.9],
        [p3, p4, j3, r0 * 0.9, r0 * 0.72],
      ];
      segs.forEach(([a, c, bone, ra, rb], k) => {
        const nodes: Node[] = [];
        for (let i = 0; i < 3; i++) {
          const t = i / 2;
          const r = ra + (rb - ra) * t;
          nodes.push({ c: a.clone().lerp(c, t), rx: r, rz: r * 0.92, skin: rigid(bone) });
        }
        b.tube(nodes, { u: new Vector3(0, 1, 0), seg: 10, part: PART_ARMS, startCap: k === 0 ? ra : 0, endCap: rb, capSteps: 4 });
      });
    }

    const a = rig.rest[J[`ankle${S}`]];
    const toeP = rig.rest[J[`toe${S}`]];
    const ankleSkin = rigid(J[`ankle${S}`]);
    const toeSkin = rigid(J[`toe${S}`]);
    const fz = [[-0.3, 0.13, 0.12], [-0.2, 0.17, 0.155], [0, 0.2, 0.16], [0.2, 0.15, 0.17], [0.4, 0.115, 0.2], [0.55, 0.098, 0.215]];
    const footNodes: Node[] = fz.map(([z, ry, rx]) => ({ c: new Vector3(a.x, ry * h, a.z + z * h), rx: rx * h, rz: ry * h, skin: ankleSkin }));
    footNodes[footNodes.length - 1].c.copy(new Vector3(toeP.x, 0.098 * h, toeP.z));
    b.tube(footNodes, { u: X, seg: 20, part: PART_LEGS, startCap: 0.14 * h, endCap: 0.1 * h });
    const toeNodes: Node[] = [[0.55, 0.098, 0.215], [0.72, 0.075, 0.195], [0.86, 0.058, 0.15]].map(([z, ry, rx]) => ({ c: new Vector3(toeP.x, ry * h, toeP.z + (z - 0.55) * h), rx: rx * h, rz: ry * h, skin: toeSkin }));
    b.tube(toeNodes, { u: X, seg: 16, part: PART_LEGS, endCap: 0.06 * h });
  }
  return b.geometry();
}

export function boneMatrices(body: Body, out: Matrix4[]) {
  const { rest } = body.rig;
  const t = new Vector3();
  for (let i = 0; i < N; i++) {
    const m = out[i];
    m.makeRotationFromQuaternion(body.wq[i]);
    const e = m.elements;
    t.copy(rest[i]).applyQuaternion(body.wq[i]);
    e[12] = body.wp[i].x - t.x;
    e[13] = body.wp[i].y - t.y;
    e[14] = body.wp[i].z - t.z;
  }
}

export function skinPositions(geo: BufferGeometry, mats: Matrix4[], out?: Float32Array) {
  const pos = geo.getAttribute('position').array as Float32Array;
  const si = geo.getAttribute('skinIndex').array as Float32Array;
  const sw = geo.getAttribute('skinWeight').array as Float32Array;
  const n = pos.length / 3;
  const res = out && out.length === pos.length ? out : new Float32Array(pos.length);
  for (let v = 0; v < n; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    let ox = 0, oy = 0, oz = 0;
    for (let k = 0; k < 4; k++) {
      const w = sw[v * 4 + k];
      if (w === 0) continue;
      const e = mats[si[v * 4 + k]].elements;
      ox += w * (e[0] * x + e[4] * y + e[8] * z + e[12]);
      oy += w * (e[1] * x + e[5] * y + e[9] * z + e[13]);
      oz += w * (e[2] * x + e[6] * y + e[10] * z + e[14]);
    }
    res[v * 3] = ox; res[v * 3 + 1] = oy; res[v * 3 + 2] = oz;
  }
  return res;
}

