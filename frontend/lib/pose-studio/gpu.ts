import {
  BufferGeometry, DepthTexture, DoubleSide, FrontSide, LessDepth, LineBasicMaterial, LineSegments, Float32BufferAttribute, Matrix4, Mesh,
  NearestFilter, OrthographicCamera, PerspectiveCamera, Scene, ShaderMaterial, Sphere, Vector3, WebGLRenderTarget, WebGLRenderer, UnsignedByteType, RGBAFormat,
} from 'three';
import { Body, N } from './rig';
import { PART_COUNT, boneMatrices, buildGeometry, skinPositions } from './mesh';

export type MapKind = 'mesh' | 'skeleton' | 'depth' | 'region';
export type RegionMode = 'person' | 'parts';

export const PERSON_COLORS: [number, number, number][] = [[255, 90, 60], [60, 205, 140], [80, 140, 255], [255, 190, 50]];
export const REGION_COLORS: [number, number, number][] = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0]];

export function hsv(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

export function partColors(person: number): [number, number, number][] {
  const base = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0]];
  const alt = [[255, 0, 255], [0, 255, 255], [255, 128, 0], [128, 0, 255]];
  const alt2 = [[0, 255, 128], [255, 0, 128], [128, 255, 0], [0, 128, 255]];
  const alt3 = [[255, 160, 160], [160, 255, 160], [160, 160, 255], [255, 255, 160]];
  return [base, alt, alt2, alt3][person % 4] as [number, number, number][];
}

const BONES = N;

const SKIN_VS = `
attribute vec4 skinIndex;
attribute vec4 skinWeight;
attribute float part;
uniform mat4 uBones[${BONES}];
varying vec3 vN;
varying vec3 vP;
varying float vPart;
varying float vD;
void main(){
  mat4 s = skinWeight.x*uBones[int(skinIndex.x+.5)] + skinWeight.y*uBones[int(skinIndex.y+.5)] + skinWeight.z*uBones[int(skinIndex.z+.5)] + skinWeight.w*uBones[int(skinIndex.w+.5)];
  vec4 wp = s*vec4(position,1.0);
  vP = wp.xyz;
  vN = mat3(s)*normal;
  vPart = part;
  vec4 mv = viewMatrix*wp;
  vD = -mv.z;
  gl_Position = projectionMatrix*mv;
}`;

const SHADED_FS = `
uniform vec3 uColor;
uniform vec3 uKeyDir;
uniform vec3 uFillDir;
uniform sampler2D uShadowMap;
uniform mat4 uShadowMat;
uniform float uShadowOn;
uniform float uTexel;
uniform float uHi;
varying vec3 vN;
varying vec3 vP;
varying float vPart;
varying float vD;
float shadowAt(vec3 N, float ndl){
  vec4 lp = uShadowMat*vec4(vP + N*0.012, 1.0);
  vec3 c = lp.xyz*0.5+0.5;
  if(c.x<0.||c.x>1.||c.y<0.||c.y>1.||c.z>1.) return 1.0;
  float bias = 0.0012 + 0.0025*(1.0-ndl);
  float lit = 0.0;
  for(int x=-1;x<=1;x++){
    for(int y=-1;y<=1;y++){
      float d = texture2D(uShadowMap, c.xy + vec2(float(x),float(y))*uTexel).r;
      lit += (c.z - bias <= d) ? 1.0 : 0.0;
    }
  }
  return lit/9.0;
}
void main(){
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vP);
  float ndl = max(dot(N,uKeyDir),0.0);
  float sh = uShadowOn > 0.5 ? mix(0.18, 1.0, shadowAt(N, ndl)) : 1.0;
  float fd = max(dot(N,uFillDir),0.0);
  vec3 amb = mix(vec3(0.17,0.16,0.2), vec3(0.34,0.35,0.4), N.y*0.5+0.5);
  float tint = vPart < 0.5 ? 1.0 : (vPart < 1.5 ? 0.97 : (vPart < 2.5 ? 1.05 : 0.93));
  vec3 base = uColor*tint;
  vec3 H = normalize(uKeyDir + V);
  float spec = pow(max(dot(N,H),0.0), 42.0)*0.2*ndl*sh;
  float rim = pow(1.0 - max(dot(N,V),0.0), 3.0);
  vec3 col = base*(amb + 0.82*ndl*sh + 0.3*fd*vec3(0.85,0.92,1.0)) + vec3(spec) + uHi*rim*0.35*vec3(0.6,1.0,0.9);
  gl_FragColor = vec4(clamp(col,0.0,1.0),1.0);
}`;

const FLAT_FS = `
uniform vec3 uColor;
uniform vec3 uPartColors[${PART_COUNT}];
uniform float uByPart;
varying float vPart;
void main(){
  vec3 c = uByPart > 0.5 ? uPartColors[int(vPart+0.5)] : uColor;
  gl_FragColor = vec4(c, 1.0);
}`;

const DEPTH_FS = `
uniform float uNear;
uniform float uFar;
varying float vD;
void main(){
  float v = 1.0 - clamp((vD - uNear)/(uFar - uNear), 0.0, 1.0);
  gl_FragColor = vec4(vec3(v), 1.0);
}`;

const SHADOW_FS = `void main(){ gl_FragColor = vec4(1.0); }`;

const PLANAR_VS = `
attribute vec4 skinIndex;
attribute vec4 skinWeight;
uniform mat4 uBones[${BONES}];
uniform vec3 uShadowLight;
void main(){
  mat4 s = skinWeight.x*uBones[int(skinIndex.x+.5)] + skinWeight.y*uBones[int(skinIndex.y+.5)] + skinWeight.z*uBones[int(skinIndex.z+.5)] + skinWeight.w*uBones[int(skinIndex.w+.5)];
  vec4 wp = s*vec4(position,1.0);
  wp.xyz -= uShadowLight*(wp.y/uShadowLight.y);
  wp.y = 0.002;
  gl_Position = projectionMatrix*viewMatrix*wp;
}`;
const PLANAR_FS = `void main(){ gl_FragColor = vec4(0.0,0.0,0.0,0.34); }`;

interface Shared {
  uKeyDir: { value: Vector3 };
  uFillDir: { value: Vector3 };
  uShadowMap: { value: DepthTexture | null };
  uShadowMat: { value: Matrix4 };
  uShadowOn: { value: number };
  uTexel: { value: number };
  uNear: { value: number };
  uFar: { value: number };
  uShadowLight: { value: Vector3 };
}

interface FigGPU {
  id: number;
  body: Body;
  geo: BufferGeometry;
  mats: Matrix4[];
  uBones: { value: Matrix4[] };
  uColor: { value: Vector3 };
  uHi: { value: number };
  uPartColors: { value: Vector3[] };
  uByPart: { value: number };
  mesh: Mesh;
  shadowMesh: Mesh;
  m: { shaded: ShaderMaterial; flat: ShaderMaterial; depth: ShaderMaterial; shadow: ShaderMaterial; planar: ShaderMaterial };
  propsRef: unknown;
  color: number;
}

const KEY_CAM = new Vector3(-0.55, 0.7, 0.62).normalize();
const FILL_CAM = new Vector3(0.75, -0.1, 0.5).normalize();

export interface ViewOptions { grid: boolean; shadow: boolean; selected: number | null; dim: boolean }
export interface MapOptions { regionMode?: RegionMode }

export class Gpu {
  renderer: WebGLRenderer;
  scene = new Scene();
  figs = new Map<number, FigGPU>();
  shared: Shared;
  gridLines: LineSegments;
  shadowRT: WebGLRenderTarget | null = null;
  exportRT: { key: string; rt: WebGLRenderTarget } | null = null;
  lightCam = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  exportCam = new PerspectiveCamera();
  lost = false;
  disposed = false;
  shadowSize = 1024;

  constructor(public canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.shared = {
      uKeyDir: { value: new Vector3(0, 1, 0) },
      uFillDir: { value: new Vector3(1, 0, 0) },
      uShadowMap: { value: null },
      uShadowMat: { value: new Matrix4() },
      uShadowOn: { value: 1 },
      uTexel: { value: 1 / this.shadowSize },
      uNear: { value: 1 },
      uFar: { value: 10 },
      uShadowLight: { value: new Vector3(-0.35, 1, -0.2).normalize() },
    };
    const pts: number[] = [];
    const R = 3;
    for (let i = -R * 2; i <= R * 2; i++) {
      const v = i * 0.5;
      pts.push(-R, 0, v, R, 0, v, v, 0, -R, v, 0, R);
    }
    const gg = new BufferGeometry();
    gg.setAttribute('position', new Float32BufferAttribute(pts, 3));
    this.gridLines = new LineSegments(gg, new LineBasicMaterial({ color: 0x35514c, transparent: true, opacity: 0.55 }));
    this.gridLines.position.y = 0.001;
    this.scene.add(this.gridLines);
  }

  private makeFig(id: number, body: Body, color: number): FigGPU {
    const geo = buildGeometry(body.rig);
    const mats = Array.from({ length: N }, () => new Matrix4());
    const uBones = { value: mats };
    const uColor = { value: new Vector3(1, 1, 1) };
    const uHi = { value: 0 };
    const uPartColors = { value: Array.from({ length: PART_COUNT }, () => new Vector3()) };
    const uByPart = { value: 0 };
    const common = { uBones, uColor, uHi, uPartColors, uByPart, ...this.shared };
    const mk = (vs: string, fs: string, extra: Partial<ConstructorParameters<typeof ShaderMaterial>[0]> = {}) =>
      new ShaderMaterial({ vertexShader: vs, fragmentShader: fs, uniforms: common as never, ...extra });
    const m = {
      shaded: mk(SKIN_VS, SHADED_FS, { side: FrontSide }),
      flat: mk(SKIN_VS, FLAT_FS, { side: FrontSide }),
      depth: mk(SKIN_VS, DEPTH_FS, { side: FrontSide }),
      shadow: mk(SKIN_VS, SHADOW_FS, { side: DoubleSide }),
      planar: mk(PLANAR_VS, PLANAR_FS, { transparent: true, depthFunc: LessDepth, depthWrite: true, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    };
    const mesh = new Mesh(geo, m.shaded);
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    const shadowMesh = new Mesh(geo, m.planar);
    shadowMesh.frustumCulled = false;
    shadowMesh.matrixAutoUpdate = false;
    shadowMesh.renderOrder = -1;
    this.scene.add(mesh, shadowMesh);
    const f: FigGPU = { id, body, geo, mats, uBones, uColor, uHi, uPartColors, uByPart, mesh, shadowMesh, m, propsRef: body.rig, color };
    this.applyColor(f, color);
    return f;
  }

  private applyColor(f: FigGPU, color: number) {
    f.color = color;
    const c = PERSON_COLORS[color % PERSON_COLORS.length];
    f.uColor.value.set(c[0] / 255, c[1] / 255, c[2] / 255);
  }

  private disposeFig(f: FigGPU) {
    this.scene.remove(f.mesh, f.shadowMesh);
    f.geo.dispose();
    for (const m of Object.values(f.m)) m.dispose();
  }

  sync(list: { id: number; body: Body; color: number }[]) {
    const ids = new Set(list.map((l) => l.id));
    for (const [id, f] of this.figs) if (!ids.has(id)) { this.disposeFig(f); this.figs.delete(id); }
    for (const l of list) {
      let f = this.figs.get(l.id);
      if (f && (f.body !== l.body || f.propsRef !== l.body.rig)) {
        this.disposeFig(f);
        f = undefined;
      }
      if (!f) { f = this.makeFig(l.id, l.body, l.color); this.figs.set(l.id, f); }
      if (f.color !== l.color) this.applyColor(f, l.color);
      boneMatrices(l.body, f.mats);
    }
  }

  setSize(w: number, h: number, dpr: number) {
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
  }

  private setLights(cam: PerspectiveCamera) {
    this.shared.uKeyDir.value.copy(KEY_CAM).applyQuaternion(cam.quaternion);
    this.shared.uFillDir.value.copy(FILL_CAM).applyQuaternion(cam.quaternion);
  }

  private bounds() {
    const pts: Vector3[] = [];
    for (const f of this.figs.values()) {
      f.body.fk();
      for (let i = 0; i < N; i++) pts.push(f.body.wp[i]);
    }
    const s = new Sphere().setFromPoints(pts);
    s.radius += 0.35;
    return s;
  }

  private shadowPass() {
    if (!this.shadowRT) {
      const dt = new DepthTexture(this.shadowSize, this.shadowSize);
      dt.minFilter = NearestFilter;
      dt.magFilter = NearestFilter;
      this.shadowRT = new WebGLRenderTarget(this.shadowSize, this.shadowSize, { depthTexture: dt, minFilter: NearestFilter, magFilter: NearestFilter });
    }
    const s = this.bounds();
    const key = this.shared.uKeyDir.value;
    const lc = this.lightCam;
    lc.left = -s.radius; lc.right = s.radius; lc.top = s.radius; lc.bottom = -s.radius;
    lc.near = 0.1; lc.far = s.radius * 4;
    lc.position.copy(s.center).addScaledVector(key, s.radius * 2);
    lc.up.set(0, 1, 0);
    if (Math.abs(key.y) > 0.98) lc.up.set(0, 0, 1);
    lc.lookAt(s.center);
    lc.updateProjectionMatrix();
    lc.updateMatrixWorld();
    this.shared.uShadowMat.value.multiplyMatrices(lc.projectionMatrix, lc.matrixWorldInverse);
    this.shared.uShadowMap.value = this.shadowRT.depthTexture as DepthTexture;
    this.shared.uTexel.value = 1 / this.shadowSize;
    this.gridLines.visible = false;
    for (const f of this.figs.values()) { f.mesh.material = f.m.shadow; f.mesh.visible = true; f.shadowMesh.visible = false; }
    const r = this.renderer;
    r.setRenderTarget(this.shadowRT);
    r.setClearColor(0x000000, 1);
    r.clear(true, true, false);
    r.render(this.scene, lc);
    r.setRenderTarget(null);
  }

  renderView(cam: PerspectiveCamera, o: ViewOptions) {
    if (this.lost || this.disposed) return;
    const r = this.renderer;
    this.setLights(cam);
    this.shared.uShadowOn.value = 1;
    this.shadowPass();
    r.setClearColor(0x000000, 0);
    r.clear();
    this.gridLines.visible = o.grid;
    this.shared.uShadowLight.value.copy(this.shared.uKeyDir.value);
    if (this.shared.uShadowLight.value.y < 0.25) this.shared.uShadowLight.value.y = 0.25;
    this.shared.uShadowLight.value.normalize();
    for (const f of this.figs.values()) {
      f.mesh.material = f.m.shaded;
      f.mesh.visible = true;
      f.shadowMesh.visible = o.shadow;
      f.uHi.value = o.selected === f.id ? 1 : 0;
      f.uByPart.value = 0;
    }
    r.render(this.scene, cam);
  }

  private rt(w: number, h: number, samples: number) {
    const key = `${w}x${h}x${samples}`;
    if (this.exportRT && this.exportRT.key !== key) { this.exportRT.rt.dispose(); this.exportRT = null; }
    if (!this.exportRT) {
      const rt = new WebGLRenderTarget(w, h, { samples, type: UnsignedByteType, format: RGBAFormat, minFilter: NearestFilter, magFilter: NearestFilter, depthBuffer: true });
      this.exportRT = { key, rt };
    }
    return this.exportRT.rt;
  }

  depthRange(cam: PerspectiveCamera) {
    cam.updateMatrixWorld();
    const inv = cam.matrixWorldInverse;
    let lo = Infinity, hi = -Infinity;
    for (const f of this.figs.values()) {
      boneMatrices(f.body, f.mats);
      const p = skinPositions(f.geo, f.mats);
      const e = inv.elements;
      for (let i = 0; i < p.length; i += 3) {
        const d = -(e[2] * p[i] + e[6] * p[i + 1] + e[10] * p[i + 2] + e[14]);
        if (d < lo) lo = d;
        if (d > hi) hi = d;
      }
    }
    if (!Number.isFinite(lo)) { lo = 1; hi = 2; }
    return { near: lo, far: hi };
  }

  renderMap(kind: 'mesh' | 'depth' | 'region', cam: PerspectiveCamera, w: number, h: number, o: MapOptions = {}): ImageData {
    if (this.lost || this.disposed) throw new Error('WebGL context lost');
    const r = this.renderer;
    const rt = this.rt(w, h, kind === 'region' ? 0 : 4);
    this.setLights(cam);
    this.gridLines.visible = false;
    const list = [...this.figs.values()];
    for (const f of list) boneMatrices(f.body, f.mats);
    if (kind === 'mesh') { this.shared.uShadowOn.value = 1; this.shadowPass(); }
    if (kind === 'depth') {
      const { near, far } = this.depthRange(cam);
      const margin = Math.max(0.02, (far - near) * 0.04);
      this.shared.uNear.value = near - margin;
      this.shared.uFar.value = far + margin;
    }
    list.forEach((f, idx) => {
      f.mesh.visible = true;
      f.shadowMesh.visible = false;
      f.uHi.value = 0;
      f.mesh.material = kind === 'mesh' ? f.m.shaded : kind === 'depth' ? f.m.depth : f.m.flat;
      if (kind === 'region') {
        const parts = o.regionMode === 'parts';
        f.uByPart.value = parts ? 1 : 0;
        const rc = REGION_COLORS[idx % REGION_COLORS.length];
        f.uColor.value.set(rc[0] / 255, rc[1] / 255, rc[2] / 255);
        const pc = partColors(idx);
        for (let k = 0; k < PART_COUNT; k++) f.uPartColors.value[k].set(pc[k][0] / 255, pc[k][1] / 255, pc[k][2] / 255);
      }
    });
    r.setRenderTarget(rt);
    r.setClearColor(0x000000, 1);
    r.clear(true, true, true);
    r.render(this.scene, cam);
    const buf = new Uint8Array(w * h * 4);
    r.readRenderTargetPixels(rt, 0, 0, w, h, buf);
    r.setRenderTarget(null);
    r.setClearColor(0x000000, 0);
    for (const f of list) {
      const c = PERSON_COLORS[f.color % PERSON_COLORS.length];
      f.uColor.value.set(c[0] / 255, c[1] / 255, c[2] / 255);
      f.uByPart.value = 0;
    }
    const out = new Uint8ClampedArray(w * h * 4);
    const row = w * 4;
    for (let y = 0; y < h; y++) out.set(buf.subarray((h - 1 - y) * row, (h - y) * row), y * row);
    return new ImageData(out, w, h);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const f of this.figs.values()) this.disposeFig(f);
    this.figs.clear();
    this.gridLines.geometry.dispose();
    (this.gridLines.material as LineBasicMaterial).dispose();
    this.shadowRT?.depthTexture?.dispose();
    this.shadowRT?.dispose();
    this.exportRT?.rt.dispose();
    this.shadowRT = null;
    this.exportRT = null;
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
