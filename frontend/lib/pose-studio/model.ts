import { Quaternion, Vector3 } from 'three';
import { Body, DEFAULT_PROPS, JOINT_NAMES, J, MIRROR, N, PIN_KEYS, mirrorQuat, sanitizeProps, type PinKey, type Props } from './rig';
import { DEFAULT_PRESET, applyPreset } from './poses';

export const MAX_PEOPLE = 4;
export const HISTORY_LIMIT = 100;

export interface PoseFigureJSON {
  id: number;
  c: number;
  p: number[];
  r: number[];
  j: Record<string, number[]>;
  pin?: Record<string, { p: number[]; r: number[] }>;
  pr: { h: number; H: number; s: number; w: number; l: number };
}

export interface PoseJSON {
  v: 1;
  sel: number;
  fig: PoseFigureJSON[];
  cam?: { az: number; el: number; d: number; t: number[]; fov: number };
  out?: [number, number];
}

export interface Person { id: number; color: number; body: Body }

const r4 = (x: number) => Math.round(x * 1e4) / 1e4 + 0;
const r5 = (x: number) => Math.round(x * 1e5) / 1e5 + 0;
const r3 = (x: number) => Math.round(x * 1e3) / 1e3 + 0;

function packQ(q: Quaternion): number[] {
  const s = q.w < 0 ? -1 : 1;
  const l = Math.hypot(q.x, q.y, q.z, q.w) || 1;
  return [r5((q.x * s) / l), r5((q.y * s) / l), r5((q.z * s) / l)];
}

function unpackQ(a: number[] | undefined, out: Quaternion) {
  if (!a || a.length < 3 || a.some((v) => !Number.isFinite(v))) return out.set(0, 0, 0, 1);
  const x = a[0], y = a[1], z = a[2];
  const n = x * x + y * y + z * z;
  if (n > 1) { const k = 1 / Math.sqrt(n); return out.set(x * k, y * k, z * k, 0); }
  return out.set(x, y, z, Math.sqrt(1 - n));
}

export function mirrorBody(b: Body) {
  const old = b.q.map((q) => q.clone());
  for (let i = 0; i < N; i++) mirrorQuat(b.q[i].copy(old[MIRROR[i]]));
  mirrorQuat(b.rootQ);
  const rx = b.rootP.x;
  const pins = b.pins;
  const swap: Record<PinKey, PinKey> = { footL: 'footR', footR: 'footL', handL: 'handR', handR: 'handL' };
  const next: Record<PinKey, ReturnType<typeof clonePin>> = { footL: null, footR: null, handL: null, handR: null };
  for (const k of PIN_KEYS) {
    const p = pins[k];
    if (!p) continue;
    next[swap[k]] = { p: new Vector3(2 * rx - p.p.x, p.p.y, p.p.z), q: mirrorQuat(p.q.clone()) };
  }
  b.pins = next;
  b.fk();
}
const clonePin = (p: { p: Vector3; q: Quaternion } | null) => (p ? { p: p.p.clone(), q: p.q.clone() } : null);

export class PoseModel {
  persons: Person[] = [];
  selected = 0;
  nextId = 1;
  undoStack: string[] = [];
  redoStack: string[] = [];
  pending: string | null = null;
  clipboard: { q: Quaternion[]; rootQ: Quaternion; y: number; props: Props } | null = null;

  constructor(initial = true) {
    if (initial) this.addPerson(false);
  }

  get(id?: number) {
    return this.persons.find((p) => p.id === (id ?? this.selected)) || this.persons[0] || null;
  }

  addPerson(record = true): number | null {
    if (this.persons.length >= MAX_PEOPLE) return null;
    if (record) this.push();
    const used = new Set(this.persons.map((p) => p.color));
    let color = 0;
    while (used.has(color)) color++;
    const body = new Body(this.persons.length ? this.persons[this.persons.length - 1].body.rig.props : DEFAULT_PROPS);
    const id = this.nextId++;
    const slots = [0, 0.95, -0.95, 1.9];
    body.rootP.x = slots[this.persons.length] ?? 0;
    applyPreset(body, DEFAULT_PRESET);
    this.persons.push({ id, color, body });
    this.selected = id;
    return id;
  }

  removePerson(id: number) {
    if (this.persons.length <= 1) return false;
    const i = this.persons.findIndex((p) => p.id === id);
    if (i < 0) return false;
    this.push();
    this.persons.splice(i, 1);
    if (this.selected === id) this.selected = this.persons[Math.min(i, this.persons.length - 1)].id;
    return true;
  }

  selectPerson(id: number) {
    if (!this.persons.some((p) => p.id === id)) return false;
    this.selected = id;
    return true;
  }

  preset(name: string, id?: number) {
    const p = this.get(id);
    if (!p) return false;
    this.push();
    return applyPreset(p.body, name);
  }

  resetPose(id?: number) {
    const p = this.get(id);
    if (!p) return;
    this.push();
    applyPreset(p.body, DEFAULT_PRESET);
  }

  mirror(id?: number) {
    const p = this.get(id);
    if (!p) return;
    this.push();
    mirrorBody(p.body);
  }

  setProportions(props: Partial<Props>, id?: number) {
    const p = this.get(id);
    if (!p) return;
    p.body.setProps(props);
  }

  copyPose(id?: number) {
    const p = this.get(id);
    if (!p) return;
    this.clipboard = { q: p.body.q.map((q) => q.clone()), rootQ: p.body.rootQ.clone(), y: p.body.rootP.y, props: p.body.rig.props };
  }

  pastePose(id?: number) {
    const p = this.get(id);
    const c = this.clipboard;
    if (!p || !c) return false;
    this.push();
    for (let i = 0; i < N; i++) p.body.q[i].copy(c.q[i]);
    p.body.rootQ.copy(c.rootQ);
    p.body.rootP.y += c.y - p.body.rootP.y;
    p.body.pins = { footL: null, footR: null, handL: null, handR: null };
    p.body.fk();
    return true;
  }

  snapshot() {
    return JSON.stringify(this.getPose());
  }

  push() {
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  begin() {
    this.pending = this.snapshot();
  }

  end() {
    if (this.pending === null) return false;
    const changed = this.pending !== this.snapshot();
    if (changed) {
      this.undoStack.push(this.pending);
      if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
      this.redoStack.length = 0;
    }
    this.pending = null;
    return changed;
  }

  undo() {
    const s = this.undoStack.pop();
    if (s === undefined) return false;
    this.redoStack.push(this.snapshot());
    this.restore(s);
    return true;
  }

  redo() {
    const s = this.redoStack.pop();
    if (s === undefined) return false;
    this.undoStack.push(this.snapshot());
    this.restore(s);
    return true;
  }

  private restore(s: string) {
    const sel = this.selected;
    this.setPose(JSON.parse(s) as PoseJSON);
    if (this.persons.some((p) => p.id === sel) && !this.persons.some((p) => p.id === this.selected)) this.selected = sel;
  }

  getPose(): PoseJSON {
    const fig: PoseFigureJSON[] = this.persons.map(({ id, color, body }) => {
      const j: Record<string, number[]> = {};
      for (let i = 1; i < N; i++) {
        const a = packQ(body.q[i]);
        if (a[0] !== 0 || a[1] !== 0 || a[2] !== 0) j[JOINT_NAMES[i]] = a;
      }
      const f: PoseFigureJSON = {
        id,
        c: color,
        p: [r4(body.rootP.x), r4(body.rootP.y), r4(body.rootP.z)],
        r: packQ(body.rootQ),
        j,
        pr: { h: r3(body.rig.props.headsTall), H: r3(body.rig.props.height), s: r3(body.rig.props.shoulder), w: r3(body.rig.props.hip), l: r3(body.rig.props.limb) },
      };
      const pins: Record<string, { p: number[]; r: number[] }> = {};
      for (const k of PIN_KEYS) {
        const pn = body.pins[k];
        if (pn) pins[k] = { p: [r4(pn.p.x), r4(pn.p.y), r4(pn.p.z)], r: packQ(pn.q) };
      }
      if (Object.keys(pins).length) f.pin = pins;
      return f;
    });
    return { v: 1, sel: this.selected, fig };
  }

  setPose(json: PoseJSON | string) {
    const data = (typeof json === 'string' ? JSON.parse(json) : json) as PoseJSON;
    if (!data || data.v !== 1 || !Array.isArray(data.fig) || data.fig.length === 0) throw new Error('Invalid pose data');
    const persons: Person[] = [];
    let maxId = 0;
    for (const f of data.fig.slice(0, MAX_PEOPLE)) {
      const body = new Body(sanitizeProps({ headsTall: f.pr?.h, height: f.pr?.H, shoulder: f.pr?.s, hip: f.pr?.w, limb: f.pr?.l }));
      const p = f.p || [0, 0, 0];
      body.rootP.set(p[0] || 0, p[1] || 0, p[2] || 0);
      unpackQ(f.r, body.rootQ);
      for (let i = 1; i < N; i++) {
        const a = f.j?.[JOINT_NAMES[i]];
        if (a) unpackQ(a, body.q[i]);
      }
      for (const k of PIN_KEYS) {
        const pn = f.pin?.[k];
        if (pn) body.pins[k] = { p: new Vector3(pn.p[0], pn.p[1], pn.p[2]), q: unpackQ(pn.r, new Quaternion()) };
      }
      body.fk();
      const id = Number.isInteger(f.id) ? f.id : persons.length + 1;
      maxId = Math.max(maxId, id);
      persons.push({ id, color: Number.isInteger(f.c) ? Math.abs(f.c) % MAX_PEOPLE : persons.length, body });
    }
    this.persons = persons;
    this.nextId = Math.max(this.nextId, maxId + 1);
    this.selected = persons.some((p) => p.id === data.sel) ? data.sel : persons[0].id;
  }
}

export function encodePose(json: PoseJSON): string {
  const s = JSON.stringify(json);
  const b = typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(s))) : Buffer.from(s).toString('base64');
  return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodePose(str: string): PoseJSON {
  const t = str.trim();
  if (t.startsWith('{')) return JSON.parse(t) as PoseJSON;
  const b = t.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b + '='.repeat((4 - (b.length % 4)) % 4);
  const s = typeof atob === 'function' ? decodeURIComponent(escape(atob(pad))) : Buffer.from(pad, 'base64').toString();
  return JSON.parse(s) as PoseJSON;
}

export const _j = J;
