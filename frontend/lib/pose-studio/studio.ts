import { PerspectiveCamera, Plane, Quaternion, Ray, Vector3 } from 'three';
import { Gpu, type MapKind, type RegionMode } from './gpu';
import { MAX_PEOPLE, PoseModel, decodePose, encodePose, type PoseJSON } from './model';
import { Body, J, JOINT_NAMES, N, PARENT, PIN_KEYS, SIDE, isFingerJoint, sanitizeProps, type PinKey, type Props } from './rig';
import { CHEST_CHAIN, HEAD_CHAIN, HEAD_WEIGHTS, LIMBS, PIN_LIMB, aimChild, applyPins, clampRootToPins, headCenter, rotateJointWorld, setPin, solveChain, solveLimb } from './ik';
import { PRESET_NAMES, applyHand, resolvePreset, type HandShape } from './poses';
import { keypointsOf, rasterSkeleton, type PersonKeypoints } from './skeleton2d';

export type Mode = 'ik' | 'fk';
export type EventName = 'change' | 'select' | 'ready' | 'state' | 'contextlost' | 'contextrestored' | 'error';

export const OUTPUT_SIZES: [number, number][] = [
  [1024, 1024], [768, 1024], [1024, 768], [768, 768], [640, 1024], [1024, 640], [832, 1216], [1216, 832], [896, 1152], [1152, 896], [512, 512], [512, 768], [768, 512],
];

export const CAMERA_VIEWS: Record<string, { az: number; el: number }> = {
  front: { az: 0, el: 4 },
  '3/4 left': { az: 38, el: 8 },
  '3/4 right': { az: -38, el: 8 },
  side: { az: 90, el: 4 },
  back: { az: 180, el: 4 },
  top: { az: 0, el: 86 },
  'low angle': { az: 12, el: -24 },
  'high angle': { az: 12, el: 36 },
};
export const CAMERA_VIEW_NAMES = Object.keys(CAMERA_VIEWS);

export interface PoseStudioOptions {
  width?: number;
  height?: number;
  grid?: boolean;
  shadow?: boolean;
  bones?: boolean;
  fov?: number;
  mode?: Mode;
  pose?: PoseJSON | string;
  pixelRatio?: number;
}

export interface MapRequest { width?: number; height?: number; regionMode?: RegionMode; hands?: boolean; face?: boolean; thumb?: boolean }
export interface MapResult { kind: MapKind; width: number; height: number; imageData: ImageData; blob: Blob }
export type MapSet = Record<MapKind, MapResult>;
export const MAP_KINDS: MapKind[] = ['mesh', 'skeleton', 'depth', 'region'];

export interface StudioState {
  people: { id: number; color: number }[];
  selected: number;
  mode: Mode;
  pins: Record<PinKey, boolean>;
  canUndo: boolean;
  canRedo: boolean;
  canPaste: boolean;
  props: Props;
  fov: number;
  size: [number, number];
  grid: boolean;
  shadow: boolean;
  bones: boolean;
  depthMode: boolean;
  selectedJoint: string | null;
  webgl: boolean;
}

type Handle = { kind: string; id: string; pos: Vector3; r: number; color: string; joint?: number; label?: string };

const HANDLE_COLORS: Record<string, string> = {
  pelvis: '#ffb454', chest: '#d6a8ff', head: '#7ab8ff', hand: '#76dcc0', foot: '#76dcc0', elbow: '#f7e07a', knee: '#f7e07a', floor: '#9fb3ae', joint: '#e8f3f0',
};

const UP = new Vector3(0, 1, 0);
const _v = new Vector3(), _w = new Vector3(), _q = new Quaternion(), _q2 = new Quaternion();

export class PoseStudio {
  readonly model = new PoseModel();
  private listeners = new Map<EventName, Set<(d?: unknown) => void>>();
  private root: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private overlay: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private msg: HTMLDivElement;
  private gpu: Gpu | null = null;
  private cam = new PerspectiveCamera(35, 1, 0.05, 100);
  private view = { az: 0, el: 4, dist: 4.4, target: new Vector3(0, 0.9, 0), fov: 35 };
  private out: [number, number] = [768, 1024];
  private cw = 1;
  private ch = 1;
  private dpr = 1;
  private guide = { x: 0, y: 0, w: 1, h: 1 };
  private dirty = true;
  private raf = 0;
  private mode: Mode = 'ik';
  private depthMode = false;
  private showGrid = true;
  private showShadow = true;
  private showBones = true;
  private selJoint: number | null = null;
  private handles: Handle[] = [];
  private hover: string | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private drag: DragState | null = null;
  private gesture: { kind: 'orbit' | 'pan' | 'pinch'; x: number; y: number; dist?: number; cx?: number; cy?: number } | null = null;
  private ro: ResizeObserver | null = null;
  private destroyed = false;
  private changePending = false;
  private pixelRatioOpt?: number;
  private webgl = true;
  private ready = false;
  private onResizeBound = () => this.resize();

  constructor(public container: HTMLElement, options: PoseStudioOptions = {}) {
    this.root = document.createElement('div');
    this.root.tabIndex = 0;
    this.root.setAttribute('role', 'application');
    this.root.setAttribute('aria-label', '3D pose editor. Drag handles to pose the figure. Ctrl+Z undo, M mirror, R reset, 1 to 4 select figure.');
    Object.assign(this.root.style, { position: 'relative', width: '100%', height: '100%', overflow: 'hidden', touchAction: 'none', outline: 'none', userSelect: 'none', background: 'radial-gradient(ellipse at 50% 30%, #14201f 0%, #0a1011 70%)' });
    this.canvas = document.createElement('canvas');
    this.overlay = document.createElement('canvas');
    for (const c of [this.canvas, this.overlay]) Object.assign(c.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block' });
    this.overlay.style.touchAction = 'none';
    this.msg = document.createElement('div');
    Object.assign(this.msg.style, { position: 'absolute', inset: '0', display: 'none', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px', color: '#c8d9d5', font: '14px system-ui, sans-serif', background: 'rgba(7,10,11,.9)' });
    this.root.append(this.canvas, this.overlay, this.msg);
    container.appendChild(this.root);
    this.ctx = this.overlay.getContext('2d')!;
    this.pixelRatioOpt = options.pixelRatio;
    if (options.width && options.height) this.out = [options.width, options.height];
    if (options.fov) this.view.fov = options.fov;
    if (options.grid !== undefined) this.showGrid = options.grid;
    if (options.shadow !== undefined) this.showShadow = options.shadow;
    if (options.bones !== undefined) this.showBones = options.bones;
    if (options.mode) this.mode = options.mode;
    if (options.pose) { try { this.model.setPose(typeof options.pose === 'string' ? decodePose(options.pose) : options.pose); } catch (e) { this.emit('error', e); } }

    this.initGpu();
    this.bind();
    this.resize();
    this.frameFigures();
    this.ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(this.onResizeBound) : null;
    this.ro?.observe(this.root);
    this.loop();
    queueMicrotask(() => { if (!this.destroyed) { this.ready = true; this.emit('ready'); this.emitState(); } });
  }

  private initGpu() {
    try {
      const test = document.createElement('canvas');
      if (!test.getContext('webgl2')) throw new Error('WebGL2 is not available');
      this.gpu = new Gpu(this.canvas);
      this.canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        if (this.gpu) this.gpu.lost = true;
        this.showMessage('Graphics context lost. Restoring...');
        this.emit('contextlost');
      });
      this.canvas.addEventListener('webglcontextrestored', () => {
        if (this.gpu) this.gpu.lost = false;
        this.showMessage('');
        this.dirty = true;
        this.emit('contextrestored');
      });
    } catch (e) {
      this.webgl = false;
      this.gpu = null;
      this.showMessage('3D preview needs WebGL2, which this browser or device does not provide. Pose data and the skeleton map still work. Try a recent Chrome, Edge, Firefox or Safari with hardware acceleration enabled.');
      this.emit('error', e);
    }
  }

  private showMessage(t: string) {
    this.msg.textContent = t;
    this.msg.style.display = t ? 'flex' : 'none';
  }

  on(event: EventName, cb: (d?: unknown) => void) {
    let s = this.listeners.get(event);
    if (!s) this.listeners.set(event, (s = new Set()));
    s.add(cb);
    if (event === 'ready' && this.ready) queueMicrotask(() => cb());
    return () => this.off(event, cb);
  }

  off(event: EventName, cb: (d?: unknown) => void) {
    this.listeners.get(event)?.delete(cb);
  }

  private emit(event: EventName, d?: unknown) {
    this.listeners.get(event)?.forEach((cb) => { try { cb(d); } catch {} });
  }

  private emitState() {
    if (!this.ready) return;
    this.emit('state', this.getState());
  }

  private changed() {
    this.dirty = true;
    if (this.changePending) return;
    this.changePending = true;
    requestAnimationFrame(() => {
      this.changePending = false;
      if (this.destroyed) return;
      this.emit('change', this.model.getPose());
      this.emitState();
    });
  }

  getState(): StudioState {
    const sel = this.model.get();
    const pins = { footL: false, footR: false, handL: false, handR: false };
    if (sel) for (const k of PIN_KEYS) pins[k] = !!sel.body.pins[k];
    return {
      people: this.model.persons.map((p) => ({ id: p.id, color: p.color })),
      selected: this.model.selected,
      mode: this.mode,
      pins,
      canUndo: this.model.undoStack.length > 0,
      canRedo: this.model.redoStack.length > 0,
      canPaste: !!this.model.clipboard,
      props: { ...(sel?.body.rig.props as Props) },
      fov: this.view.fov,
      size: [...this.out],
      grid: this.showGrid,
      shadow: this.showShadow,
      bones: this.showBones,
      depthMode: this.depthMode,
      selectedJoint: this.selJoint === null ? null : JOINT_NAMES[this.selJoint],
      webgl: this.webgl,
    };
  }

  private sel() {
    return this.model.get()!;
  }

  setMode(m: Mode) { this.mode = m; this.selJoint = m === 'fk' ? this.selJoint : null; this.dirty = true; this.emitState(); }
  getMode() { return this.mode; }
  setDepthMode(v: boolean) { this.depthMode = v; this.emitState(); }
  setShowGrid(v: boolean) { this.showGrid = v; this.dirty = true; this.emitState(); }
  setShowShadow(v: boolean) { this.showShadow = v; this.dirty = true; this.emitState(); }
  setShowBones(v: boolean) { this.showBones = v; this.dirty = true; this.emitState(); }

  setOutputSize(w: number, h: number) {
    w = Math.max(16, Math.round(w / 16) * 16);
    h = Math.max(16, Math.round(h / 16) * 16);
    this.out = [w, h];
    this.dirty = true;
    this.emitState();
    this.changed();
  }
  getOutputSize(): [number, number] { return [...this.out]; }

  setFov(deg: number) {
    this.view.fov = Math.min(90, Math.max(12, deg));
    this.dirty = true;
    this.emitState();
    this.changed();
  }

  addPerson() {
    const id = this.model.addPerson();
    if (id !== null) { this.selJoint = null; this.frameFigures(); this.changed(); this.emit('select', id); }
    return id;
  }
  removePerson(id?: number) {
    const target = id ?? this.model.selected;
    const ok = this.model.removePerson(target);
    if (ok) { this.selJoint = null; this.changed(); this.emit('select', this.model.selected); }
    return ok;
  }
  selectPerson(id: number) {
    if (this.model.selected === id) return true;
    const ok = this.model.selectPerson(id);
    if (ok) { this.selJoint = null; this.dirty = true; this.emit('select', id); this.emitState(); }
    return ok;
  }
  selectIndex(i: number) {
    const p = this.model.persons[i];
    if (p) this.selectPerson(p.id);
  }
  getPeople() { return this.model.persons.map((p) => ({ id: p.id, color: p.color, selected: p.id === this.model.selected })); }
  copyPose() { this.model.copyPose(); this.emitState(); }
  pastePose() { if (this.model.pastePose()) this.changed(); }

  placePerson(id: number, x: number, z: number) {
    const p = this.model.get(id);
    if (!p) return;
    this.model.push();
    const b = p.body;
    const dx = x - b.rootP.x;
    const dz = z - b.rootP.z;
    b.rootP.x = x;
    b.rootP.z = z;
    for (const k of PIN_KEYS) { const pin = b.pins[k]; if (pin) { pin.p.x += dx; pin.p.z += dz; } }
    b.fk();
    this.changed();
  }

  setPreset(name: string) {
    if (!resolvePreset(name)) return false;
    this.model.preset(name);
    this.changed();
    return true;
  }
  mirror() { this.model.mirror(); this.changed(); }
  reset() { this.model.resetPose(); this.changed(); }
  undo() { const ok = this.model.undo(); if (ok) { this.selJoint = null; this.changed(); this.emit('select', this.model.selected); } return ok; }
  redo() { const ok = this.model.redo(); if (ok) { this.selJoint = null; this.changed(); this.emit('select', this.model.selected); } return ok; }

  setProportions(p: Partial<Props>) {
    this.model.begin();
    this.model.setProportions(p);
    this.model.end();
    this.changed();
  }
  previewProportions(p: Partial<Props>) {
    this.model.setProportions(p);
    this.changed();
  }
  beginEdit() { this.model.begin(); }
  endEdit() { if (this.model.end()) this.emitState(); }
  getProportions(): Props { return { ...this.sel().body.rig.props }; }

  setHandShape(side: 'L' | 'R' | 'both', shape: HandShape) {
    this.model.push();
    const b = this.sel().body;
    if (side !== 'R') applyHand(b, 'L', shape);
    if (side !== 'L') applyHand(b, 'R', shape);
    this.changed();
  }

  togglePin(key: PinKey) {
    const b = this.sel().body;
    this.model.push();
    setPin(b, key, !b.pins[key]);
    this.changed();
  }

  setCameraView(name: string) {
    const v = CAMERA_VIEWS[name];
    if (!v) return false;
    this.view.az = (v.az * Math.PI) / 180;
    this.view.el = (v.el * Math.PI) / 180;
    this.frameFigures();
    this.changed();
    return true;
  }

  frameFigures() {
    const pts: Vector3[] = [];
    for (const p of this.model.persons) {
      p.body.fk();
      for (let i = 0; i < N; i++) if (!isFingerJoint(i) || /1[LR]$/.test(JOINT_NAMES[i])) pts.push(p.body.wp[i]);
    }
    const { az, el } = this.view;
    const ce = Math.cos(el);
    const dirv = new Vector3(Math.sin(az) * ce, Math.sin(el), Math.cos(az) * ce);
    const right = new Vector3().crossVectors(UP, dirv).normalize();
    const upv = new Vector3().crossVectors(dirv, right).normalize();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of pts) {
      const x = p.dot(right), y = p.dot(upv);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    const pad = 0.2;
    x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const centerDepth = pts.reduce((s, p) => s + p.dot(dirv), 0) / pts.length;
    const target = right.clone().multiplyScalar(cx).addScaledVector(upv, cy).addScaledVector(dirv, centerDepth);
    const a = this.out[0] / this.out[1];
    const tv = Math.tan((this.view.fov * Math.PI) / 360);
    const th = tv * a;
    let dist = 0.8;
    for (const p of pts) {
      const rel = p.clone().sub(target);
      const z = rel.dot(dirv);
      const ex = Math.max(Math.abs(rel.dot(right)) + pad, 0) / th + z;
      const ey = (Math.abs(rel.dot(upv)) + pad) / tv + z;
      dist = Math.max(dist, ex, ey);
    }
    this.view.target.copy(target);
    this.view.dist = Math.min(30, dist * 1.04);
    this.dirty = true;
  }

  private updateCamera() {
    const { az, el, dist, target } = this.view;
    const ce = Math.cos(el);
    this.cam.position.set(target.x + dist * Math.sin(az) * ce, target.y + dist * Math.sin(el), target.z + dist * Math.cos(az) * ce);
    this.cam.up.copy(UP);
    this.cam.lookAt(target);
    const a = this.out[0] / this.out[1];
    const gh = Math.min(this.ch * 0.92, (this.cw * 0.94) / a);
    const gw = gh * a;
    this.guide = { x: (this.cw - gw) / 2, y: (this.ch - gh) / 2, w: gw, h: gh };
    this.cam.fov = (2 * Math.atan((Math.tan((this.view.fov * Math.PI) / 360) * this.ch) / gh) * 180) / Math.PI;
    this.cam.aspect = this.cw / this.ch;
    this.cam.near = 0.05;
    this.cam.far = 120;
    this.cam.updateProjectionMatrix();
    this.cam.updateMatrixWorld();
  }

  private resize() {
    const r = this.root.getBoundingClientRect();
    this.cw = Math.max(1, Math.floor(r.width));
    this.ch = Math.max(1, Math.floor(r.height));
    this.dpr = this.pixelRatioOpt ?? Math.min(2, window.devicePixelRatio || 1);
    this.gpu?.setSize(this.cw, this.ch, this.dpr);
    this.overlay.width = Math.round(this.cw * this.dpr);
    this.overlay.height = Math.round(this.ch * this.dpr);
    this.dirty = true;
  }

  private loop = () => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (!this.dirty) return;
    this.dirty = false;
    this.render();
  };

  private render() {
    this.updateCamera();
    const gpu = this.gpu;
    if (gpu && !gpu.lost) {
      gpu.sync(this.model.persons.map((p) => ({ id: p.id, body: p.body, color: p.color })));
      gpu.renderView(this.cam, { grid: this.showGrid, shadow: this.showShadow, selected: this.model.persons.length > 1 ? this.model.selected : null, dim: false });
    }
    this.drawOverlay();
  }

  requestRender() { this.dirty = true; }

  private project(p: Vector3, out = { x: 0, y: 0, z: 0 }) {
    _w.copy(p).project(this.cam);
    out.x = ((_w.x + 1) / 2) * this.cw;
    out.y = ((1 - _w.y) / 2) * this.ch;
    out.z = _w.z;
    return out;
  }

  private computeHandles(): Handle[] {
    const person = this.model.get();
    if (!person) return [];
    const b = person.body;
    b.fk();
    const out: Handle[] = [];
    if (this.mode === 'ik') {
      out.push({ kind: 'pelvis', id: 'pelvis', pos: b.wp[J.pelvis].clone(), r: 9, color: HANDLE_COLORS.pelvis });
      out.push({ kind: 'chest', id: 'chest', pos: b.wp[J.spine3].clone(), r: 7, color: HANDLE_COLORS.chest });
      out.push({ kind: 'head', id: 'head', pos: headCenter(b), r: 9, color: HANDLE_COLORS.head });
      for (const S of ['L', 'R']) {
        out.push({ kind: 'hand', id: `hand${S}`, pos: b.wp[J[`wrist${S}`]].clone(), r: 8, color: HANDLE_COLORS.hand });
        out.push({ kind: 'foot', id: `foot${S}`, pos: b.wp[J[`ankle${S}`]].clone(), r: 8, color: HANDLE_COLORS.foot });
        out.push({ kind: 'elbow', id: `elbow${S}`, pos: b.wp[J[`elbow${S}`]].clone(), r: 6, color: HANDLE_COLORS.elbow });
        out.push({ kind: 'knee', id: `knee${S}`, pos: b.wp[J[`knee${S}`]].clone(), r: 6, color: HANDLE_COLORS.knee });
      }
      const fx = (b.wp[J.ankleL].x + b.wp[J.ankleR].x) / 2, fz = (b.wp[J.ankleL].z + b.wp[J.ankleR].z) / 2;
      out.push({ kind: 'floor', id: 'floor', pos: new Vector3(fx, 0, fz), r: 8, color: HANDLE_COLORS.floor });
    } else {
      const fingersOpen = this.selJoint !== null && (isFingerJoint(this.selJoint) || /^wrist/.test(JOINT_NAMES[this.selJoint]));
      const side = this.selJoint !== null ? JOINT_NAMES[this.selJoint].slice(-1) : '';
      for (let i = 0; i < N; i++) {
        if (isFingerJoint(i)) {
          if (!fingersOpen || JOINT_NAMES[i].slice(-1) !== side) continue;
          out.push({ kind: 'joint', id: `j${i}`, pos: b.wp[i].clone(), r: 4, color: HANDLE_COLORS.joint, joint: i });
        } else out.push({ kind: 'joint', id: `j${i}`, pos: b.wp[i].clone(), r: i === 0 ? 8 : 6, color: HANDLE_COLORS.joint, joint: i });
      }
    }
    return out;
  }

  private drawOverlay() {
    const c = this.ctx;
    const { dpr, cw, ch } = this;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, cw, ch);
    const g = this.guide;
    c.fillStyle = 'rgba(4,8,9,0.5)';
    c.beginPath();
    c.rect(0, 0, cw, ch);
    c.rect(g.x, g.y, g.w, g.h);
    c.fill('evenodd');
    c.strokeStyle = 'rgba(118,220,192,0.55)';
    c.lineWidth = 1;
    c.setLineDash([6, 5]);
    c.strokeRect(g.x + 0.5, g.y + 0.5, g.w - 1, g.h - 1);
    c.setLineDash([]);
    c.fillStyle = 'rgba(118,220,192,0.75)';
    c.font = '11px ui-monospace, monospace';
    c.textBaseline = 'bottom';
    c.fillText(`${this.out[0]}×${this.out[1]}`, g.x + 6, g.y + g.h - 5);

    const person = this.model.get();
    const pt = { x: 0, y: 0, z: 0 };
    if (this.showBones && person) {
      const b = person.body;
      c.lineWidth = 1.5;
      c.strokeStyle = 'rgba(232,243,240,0.28)';
      c.beginPath();
      for (let i = 1; i < N; i++) {
        if (isFingerJoint(i)) continue;
        const p = PARENT[i];
        this.project(b.wp[p], pt);
        c.moveTo(pt.x, pt.y);
        this.project(b.wp[i], pt);
        c.lineTo(pt.x, pt.y);
      }
      c.stroke();
    }

    if (this.model.persons.length > 1) {
      this.model.persons.forEach((p, i) => {
        const hp = headCenter(p.body, new Vector3()).add(new Vector3(0, p.body.rig.h * 0.8, 0));
        this.project(hp, pt);
        const sel = p.id === this.model.selected;
        c.fillStyle = sel ? '#8ee4ca' : 'rgba(20,32,31,0.9)';
        c.strokeStyle = sel ? '#8ee4ca' : 'rgba(142,228,202,0.5)';
        c.lineWidth = 1.5;
        c.beginPath();
        c.arc(pt.x, pt.y, 11, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        c.fillStyle = sel ? '#06120f' : '#c8d9d5';
        c.font = '700 12px system-ui, sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(String(i + 1), pt.x, pt.y + 0.5);
      });
      c.textAlign = 'start';
    }

    this.handles = this.computeHandles();
    const active = this.drag?.handle.id ?? null;
    for (const h of this.handles) {
      this.project(h.pos, pt);
      const isActive = active === h.id;
      const hot = isActive || this.hover === h.id || (h.joint !== undefined && h.joint === this.selJoint);
      const pinKey = h.kind === 'hand' || h.kind === 'foot' ? (h.id as PinKey) : null;
      const pinned = pinKey && person?.body.pins[pinKey];
      if (h.kind === 'floor') {
        c.strokeStyle = h.color;
        c.lineWidth = hot ? 2.5 : 1.5;
        c.beginPath();
        c.ellipse(pt.x, pt.y, 22, 8, 0, 0, Math.PI * 2);
        c.stroke();
        continue;
      }
      c.fillStyle = hot ? '#ffffff' : h.color;
      c.strokeStyle = 'rgba(5,9,10,0.85)';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(pt.x, pt.y, h.r + (hot ? 2 : 0), 0, Math.PI * 2);
      c.fill();
      c.stroke();
      if (pinned) {
        c.strokeStyle = '#ff6b6b';
        c.lineWidth = 2;
        c.beginPath();
        c.arc(pt.x, pt.y, h.r + 5, 0, Math.PI * 2);
        c.stroke();
      }
    }
  }

  private hitRadius(touch: boolean) { return touch ? 26 : 16; }

  private pick(x: number, y: number, touch: boolean): Handle | null {
    let best: Handle | null = null;
    let bd = Infinity;
    const pt = { x: 0, y: 0, z: 0 };
    const rad = this.hitRadius(touch);
    for (const h of this.handles) {
      this.project(h.pos, pt);
      let d = Math.hypot(pt.x - x, pt.y - y);
      if (h.kind === 'floor') { d = Math.hypot((pt.x - x) / 2.4, pt.y - y); }
      const lim = h.kind === 'floor' ? rad : rad + (h.r > 7 ? 2 : 0);
      const weight = h.kind === 'elbow' || h.kind === 'knee' || h.kind === 'chest' ? 1.15 : h.kind === 'floor' ? 1.6 : 1;
      if (d <= lim && d * weight < bd) { bd = d * weight; best = h; }
    }
    return best;
  }

  private pickPerson(x: number, y: number, touch: boolean): number | null {
    const pt = { x: 0, y: 0, z: 0 };
    const rad = touch ? 22 : 15;
    if (this.model.persons.length > 1) {
      for (const p of this.model.persons) {
        const hp = headCenter(p.body, new Vector3()).add(new Vector3(0, p.body.rig.h * 0.8, 0));
        this.project(hp, pt);
        if (Math.hypot(pt.x - x, pt.y - y) <= rad) return p.id;
      }
    }
    let best: number | null = null;
    let bd = touch ? 34 : 24;
    for (const p of this.model.persons) {
      if (p.id === this.model.selected) continue;
      p.body.fk();
      const b = p.body;
      for (let i = 1; i < N; i++) {
        if (isFingerJoint(i)) continue;
        this.project(b.wp[PARENT[i]], pt);
        const ax = pt.x, ay = pt.y;
        this.project(b.wp[i], pt);
        const dx = pt.x - ax, dy = pt.y - ay;
        const l2 = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
        const d = Math.hypot(ax + t * dx - x, ay + t * dy - y);
        if (d < bd) { bd = d; best = p.id; }
      }
    }
    return best;
  }

  private rayAt(x: number, y: number) {
    const ndc = _v.set((x / this.cw) * 2 - 1, -(y / this.ch) * 2 + 1, 0.5).unproject(this.cam);
    return new Ray(this.cam.position.clone(), ndc.sub(this.cam.position).normalize());
  }

  private bind() {
    const o = this.overlay;
    o.addEventListener('pointerdown', this.onDown);
    o.addEventListener('pointermove', this.onMove);
    o.addEventListener('pointerup', this.onUp);
    o.addEventListener('pointercancel', this.onUp);
    o.addEventListener('pointerleave', () => { if (this.hover && !this.drag) { this.hover = null; this.dirty = true; } });
    o.addEventListener('wheel', this.onWheel, { passive: false });
    o.addEventListener('contextmenu', (e) => e.preventDefault());
    o.addEventListener('dblclick', () => { if (!this.drag) { this.frameFigures(); this.dirty = true; } });
    this.root.addEventListener('keydown', this.onKey);
  }

  private local(e: PointerEvent | WheelEvent) {
    const r = this.overlay.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private onDown = (e: PointerEvent) => {
    this.root.focus({ preventScroll: true });
    const { x, y } = this.local(e);
    this.overlay.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x, y });
    const touch = e.pointerType === 'touch';
    if (this.pointers.size === 2) {
      this.cancelDrag();
      const [a, b] = [...this.pointers.values()];
      this.gesture = { kind: 'pinch', x, y, dist: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      return;
    }
    if (this.pointers.size > 2) return;
    if (e.button === 0 || touch) {
      const h = this.pick(x, y, touch);
      if (h && !e.shiftKey) { this.startDrag(h, x, y, e); return; }
      const pid = this.pickPerson(x, y, touch);
      if (pid !== null && pid !== this.model.selected) { this.selectPerson(pid); return; }
      if (this.mode === 'fk' && this.selJoint !== null) { this.selJoint = null; this.dirty = true; this.emitState(); }
    }
    const pan = e.button === 1 || e.button === 2 || (e.button === 0 && (e.shiftKey || e.metaKey));
    this.gesture = { kind: pan ? 'pan' : 'orbit', x, y };
    this.root.style.cursor = pan ? 'move' : 'grabbing';
  };

  private startDrag(h: Handle, x: number, y: number, e: PointerEvent) {
    const person = this.sel();
    const b = person.body;
    this.model.begin();
    const ray = this.rayAt(x, y);
    const fwd = this.cam.getWorldDirection(new Vector3());
    const d0 = _v.copy(h.pos).sub(this.cam.position).dot(fwd);
    const planePoint = ray.origin.clone().addScaledVector(ray.direction, d0 / Math.max(1e-6, ray.direction.dot(fwd)));
    const ds: DragState = {
      handle: h,
      offset: h.pos.clone().sub(planePoint),
      depth: 0,
      d0,
      fwd,
      lx: x,
      ly: y,
      moved: false,
      startQ: h.kind === 'foot' ? b.wq[PIN_LIMB[h.id as PinKey].end].clone() : null,
      headQ: h.kind === 'head' ? b.wq[J.head].clone() : null,
      pinned: false,
      alt: e.altKey || e.ctrlKey,
    };
    this.drag = ds;
    if (h.joint !== undefined) { this.selJoint = h.joint; this.emitState(); }
    this.root.style.cursor = 'grabbing';
    this.dirty = true;
  }

  private cancelDrag() {
    if (!this.drag) return;
    if (this.model.end()) this.emitState();
    this.drag = null;
  }

  private onMove = (e: PointerEvent) => {
    const { x, y } = this.local(e);
    const prev = this.pointers.get(e.pointerId);
    if (prev) { prev.x = x; prev.y = y; }
    const touch = e.pointerType === 'touch';
    if (this.drag) {
      const d = this.drag;
      const dy = y - d.ly, dx = x - d.lx;
      if (e.altKey || e.ctrlKey || (this.depthMode && this.mode === 'ik' && d.handle.kind !== 'floor')) d.depth += -dy * 0.004 * Math.max(1, d.d0);
      if (this.mode === 'fk') this.fkDrag(d, dx, dy, e.altKey || e.ctrlKey);
      else if (!(e.altKey || e.ctrlKey || this.depthMode) || d.handle.kind === 'floor') this.ikDrag(d, x, y);
      else this.ikDrag(d, d.lx, d.ly);
      d.lx = x;
      d.ly = y;
      d.moved = true;
      this.changed();
      return;
    }
    if (this.gesture) {
      const g = this.gesture;
      if (g.kind === 'pinch' && this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        this.view.dist = Math.min(30, Math.max(0.5, this.view.dist * (g.dist! / Math.max(1, dist))));
        this.panBy(cx - g.cx!, cy - g.cy!);
        g.dist = dist; g.cx = cx; g.cy = cy;
      } else if (g.kind === 'orbit') {
        this.view.az -= (x - g.x) * 0.0075;
        this.view.el = Math.max(-1.52, Math.min(1.52, this.view.el + (y - g.y) * 0.0075));
        g.x = x; g.y = y;
      } else if (g.kind === 'pan') {
        this.panBy(x - g.x, y - g.y);
        g.x = x; g.y = y;
      }
      this.dirty = true;
      this.changed();
      return;
    }
    if (!touch) {
      const h = this.pick(x, y, false);
      const id = h?.id ?? null;
      if (id !== this.hover) { this.hover = id; this.dirty = true; }
      this.root.style.cursor = h ? 'grab' : 'default';
    }
  };

  private onUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    try { this.overlay.releasePointerCapture(e.pointerId); } catch {}
    if (this.drag) {
      if (this.model.end()) { this.emitState(); this.changed(); }
      this.drag = null;
    }
    if (this.pointers.size === 0) this.gesture = null;
    else if (this.pointers.size === 1 && this.gesture?.kind === 'pinch') {
      const p = [...this.pointers.values()][0];
      this.gesture = { kind: 'orbit', x: p.x, y: p.y };
    }
    this.root.style.cursor = 'default';
    this.dirty = true;
  };

  private panBy(dx: number, dy: number) {
    const dist = this.view.dist;
    const hh = 2 * dist * Math.tan((this.cam.fov * Math.PI) / 360);
    const k = hh / this.ch;
    const right = _v.set(1, 0, 0).applyQuaternion(this.cam.quaternion);
    const up = _w.set(0, 1, 0).applyQuaternion(this.cam.quaternion);
    this.view.target.addScaledVector(right, -dx * k).addScaledVector(up, dy * k);
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (this.drag) { this.drag.depth += -e.deltaY * 0.0015 * Math.max(1, this.drag.d0); this.ikDrag(this.drag, this.drag.lx, this.drag.ly); this.changed(); return; }
    if (e.shiftKey) { this.panBy(-e.deltaX - e.deltaY * (e.deltaX === 0 ? 1 : 0), 0); this.panBy(0, 0); }
    const k = e.ctrlKey ? 0.012 : 0.0015;
    this.view.dist = Math.min(30, Math.max(0.5, this.view.dist * Math.exp(e.deltaY * k)));
    if (!e.ctrlKey && Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.5) { this.panBy(-e.deltaX, 0); this.view.dist = Math.min(30, Math.max(0.5, this.view.dist / Math.exp(e.deltaY * k))); }
    this.dirty = true;
    this.changed();
  };

  private ikDrag(d: DragState, x: number, y: number) {
    const person = this.sel();
    const b = person.body;
    const h = d.handle;
    const ray = this.rayAt(x, y);
    const plane = new Plane().setFromNormalAndCoplanarPoint(d.fwd, this.cam.position.clone().addScaledVector(d.fwd, d.d0 + d.depth));
    const hit = ray.intersectPlane(plane, new Vector3());
    if (!hit && h.kind !== 'floor') return;
    const target = hit ? hit.add(d.offset) : h.pos.clone();
    b.fk();
    if (h.kind === 'floor') {
      const fp = new Plane(UP, 0);
      const fh = ray.intersectPlane(fp, new Vector3());
      if (!fh || ray.direction.y > -0.04) return;
      if (!d.floorStart) d.floorStart = { hit: fh.clone(), root: b.rootP.clone(), pins: PIN_KEYS.map((k) => b.pins[k]?.p.clone() ?? null) };
      const delta = fh.clone().sub(d.floorStart.hit);
      b.rootP.set(d.floorStart.root.x + delta.x, b.rootP.y, d.floorStart.root.z + delta.z);
      PIN_KEYS.forEach((k, i) => { const p = b.pins[k]; const s = d.floorStart!.pins[i]; if (p && s) p.p.set(s.x + delta.x, s.y, s.z + delta.z); });
      b.fk();
      applyPins(b);
      return;
    }
    switch (h.kind) {
      case 'pelvis':
        b.rootP.copy(target);
        clampRootToPins(b);
        applyPins(b);
        break;
      case 'chest':
        solveChain(b, CHEST_CHAIN, J.spine3, _v.set(0, 0, 0), target, { iters: 16, weights: [0.9, 0.9] });
        applyPins(b);
        break;
      case 'head': {
        solveChain(b, HEAD_CHAIN, J.head, new Vector3(0, b.rig.h * 0.45, 0), target, { iters: 24, weights: HEAD_WEIGHTS });
        if (d.headQ) {
          _q.copy(b.wq[J.head]).slerp(d.headQ, 0.55);
          _q2.copy(b.wq[J.neck]).invert().multiply(_q);
          b.q[J.head].copy(_q2);
          b.fk(J.head);
        }
        applyPins(b);
        break;
      }
      case 'hand':
      case 'foot': {
        const key = h.id as PinKey;
        const limb = PIN_LIMB[key];
        const pin = b.pins[key];
        solveLimb(b, limb, target, { endQ: pin ? pin.q : d.startQ });
        if (pin) { pin.p.copy(b.wp[limb.end]); pin.q.copy(b.wq[limb.end]); }
        break;
      }
      case 'elbow':
      case 'knee': {
        const S = h.id.slice(-1);
        const limb = LIMBS[`${h.kind === 'elbow' ? 'arm' : 'leg'}${S}`];
        const pin = b.pins[limb.pin];
        if (pin) solveLimb(b, limb, pin.p, { elbow: target, endQ: pin.q });
        else aimChild(b, limb.root, limb.mid, target);
        break;
      }
    }
    b.fk();
  }

  private fkDrag(d: DragState, dx: number, dy: number, twist: boolean) {
    const j = d.handle.joint;
    if (j === undefined) return;
    const b = this.sel().body;
    b.fk();
    const camUp = _v.set(0, 1, 0).applyQuaternion(this.cam.quaternion).clone();
    const camRight = _w.set(1, 0, 0).applyQuaternion(this.cam.quaternion).clone();
    const k = 0.012;
    let delta: Quaternion;
    if (twist) {
      const axis = new Vector3().copy(b.rig.dir[j]).applyQuaternion(b.wq[j]).normalize();
      delta = new Quaternion().setFromAxisAngle(axis, dx * k);
    } else {
      delta = new Quaternion().setFromAxisAngle(camUp, dx * k).multiply(new Quaternion().setFromAxisAngle(camRight, dy * k));
    }
    rotateJointWorld(b, j, delta);
    applyPins(b);
  }

  private onKey = (e: KeyboardEvent) => { this.handleKey(e); };

  handleKey(e: KeyboardEvent): boolean {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA') && !(e.ctrlKey || e.metaKey)) return false;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    let handled = true;
    if (mod && k === 'z') { if (e.shiftKey) this.redo(); else this.undo(); }
    else if (mod && k === 'y') this.redo();
    else if (mod && k === 'c') this.copyPose();
    else if (mod && k === 'v') this.pastePose();
    else if (!mod && k === 'm') this.mirror();
    else if (!mod && k === 'r') this.reset();
    else if (!mod && k === 'f') { this.frameFigures(); this.changed(); }
    else if (!mod && k === 'g') this.setShowGrid(!this.showGrid);
    else if (!mod && k === 'x') this.setMode(this.mode === 'ik' ? 'fk' : 'ik');
    else if (!mod && /^[1-4]$/.test(k)) this.selectIndex(Number(k) - 1);
    else if (!mod && (k === 'delete' || k === 'backspace')) this.removePerson();
    else handled = false;
    if (handled) e.preventDefault();
    return handled;
  }

  private exportCamera(w: number, h: number) {
    this.updateCamera();
    const c = new PerspectiveCamera(this.view.fov, w / h, 0.05, 120);
    c.position.copy(this.cam.position);
    c.quaternion.copy(this.cam.quaternion);
    c.updateMatrixWorld();
    return c;
  }

  getKeypoints2D(opts: { width?: number; height?: number } = {}): PersonKeypoints[] {
    const [w, h] = [opts.width ?? this.out[0], opts.height ?? this.out[1]];
    const cam = this.exportCamera(w, h);
    return this.model.persons.map((p) => keypointsOf(p.body, cam, p.id));
  }

  exportImageData(kind: MapKind, req: MapRequest = {}): ImageData {
    const w = req.width ?? this.out[0];
    const h = req.height ?? this.out[1];
    const cam = this.exportCamera(w, h);
    if (kind === 'skeleton') {
      const people = this.model.persons.map((p) => keypointsOf(p.body, cam, p.id));
      const r = rasterSkeleton(people, w, h, { hands: req.hands ?? true, face: req.face ?? true, scale: req.thumb ? w / this.out[0] : 1 });
      return new ImageData(r.data, w, h);
    }
    if (!this.gpu) throw new Error('WebGL2 is required for this map');
    this.gpu.sync(this.model.persons.map((p) => ({ id: p.id, body: p.body, color: p.color })));
    const img = this.gpu.renderMap(kind, cam, w, h, { regionMode: req.regionMode });
    this.dirty = true;
    return img;
  }

  async exportMap(kind: MapKind, req: MapRequest = {}): Promise<Blob> {
    return (await this.exportResult(kind, req)).blob;
  }

  async exportResult(kind: MapKind, req: MapRequest = {}): Promise<MapResult> {
    const imageData = this.exportImageData(kind, req);
    return { kind, width: imageData.width, height: imageData.height, imageData, blob: await imageDataToBlob(imageData) };
  }

  async exportAll(req: MapRequest = {}): Promise<MapSet> {
    const out = {} as MapSet;
    for (const k of MAP_KINDS) out[k] = await this.exportResult(k, req);
    return out;
  }

  exportAllImageData(req: MapRequest = {}): Record<MapKind, ImageData> {
    const out = {} as Record<MapKind, ImageData>;
    for (const k of MAP_KINDS) out[k] = this.exportImageData(k, req);
    return out;
  }

  getPose(): PoseJSON {
    const p = this.model.getPose();
    p.cam = {
      az: Math.round(((this.view.az * 180) / Math.PI) * 100) / 100,
      el: Math.round(((this.view.el * 180) / Math.PI) * 100) / 100,
      d: Math.round(this.view.dist * 1000) / 1000,
      t: [this.view.target.x, this.view.target.y, this.view.target.z].map((v) => Math.round(v * 1000) / 1000),
      fov: this.view.fov,
    };
    p.out = [...this.out];
    return p;
  }

  setPose(json: PoseJSON | string) {
    const data = typeof json === 'string' ? decodePose(json) : json;
    this.model.push();
    this.model.setPose(data);
    if (data.cam) {
      this.view.az = (data.cam.az * Math.PI) / 180;
      this.view.el = (data.cam.el * Math.PI) / 180;
      this.view.dist = data.cam.d;
      this.view.target.set(data.cam.t[0], data.cam.t[1], data.cam.t[2]);
      this.view.fov = data.cam.fov;
    }
    if (data.out) this.out = [data.out[0], data.out[1]];
    this.selJoint = null;
    this.changed();
    this.emit('select', this.model.selected);
  }

  getPoseString() { return encodePose(this.getPose()); }
  setPoseString(s: string) { this.setPose(decodePose(s)); }

  importKeypoints2D(points: { x: number; y: number; v?: number }[] | number[][]) {
    const { importKeypoints } = fitModule;
    const pts = (points as (number[] | { x: number; y: number; v?: number })[]).map((p) => (Array.isArray(p) ? { x: p[0], y: p[1], v: p[2] ?? 1 } : p));
    this.model.push();
    importKeypoints(this.sel().body, pts, this.exportCamera(this.out[0], this.out[1]), this.out);
    this.changed();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.root.removeEventListener('keydown', this.onKey);
    this.gpu?.dispose();
    this.gpu = null;
    this.root.remove();
    this.listeners.clear();
    this.pointers.clear();
  }

  static sanitizeProps = sanitizeProps;
  static maxPeople = MAX_PEOPLE;
  static presets = PRESET_NAMES;
  static views = CAMERA_VIEW_NAMES;
  static sizes = OUTPUT_SIZES;
}

interface DragState {
  handle: Handle;
  offset: Vector3;
  depth: number;
  d0: number;
  fwd: Vector3;
  lx: number;
  ly: number;
  moved: boolean;
  startQ: Quaternion | null;
  headQ: Quaternion | null;
  pinned: boolean;
  alt: boolean;
  floorStart?: { hit: Vector3; root: Vector3; pins: (Vector3 | null)[] };
}

export function imageDataToBlob(img: ImageData): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const c = new OffscreenCanvas(img.width, img.height);
    c.getContext('2d')!.putImageData(img, 0, 0);
    return c.convertToBlob({ type: 'image/png' });
  }
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  c.getContext('2d')!.putImageData(img, 0, 0);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('PNG encode failed'))), 'image/png'));
}

const fitModule = {
  importKeypoints: (_b: Body, _p: { x: number; y: number; v?: number }[], _c: PerspectiveCamera, _o: [number, number]) => {},
};
