import type { StudioFxLayer } from './studio-fx/registry';

export type CurvePoint = [number, number];

export type StudioCurves = {
  master: CurvePoint[];
  red: CurvePoint[];
  green: CurvePoint[];
  blue: CurvePoint[];
};

export type StudioCurveChannel = keyof StudioCurves;

export type StudioNumericAdjustments = {
  exposure: number;
  brightness: number;
  contrast: number;
  highlights: number;
  shadows: number;
  shadowHue: number;
  midtoneHue: number;
  highlightHue: number;
  saturation: number;
  temperature: number;
  tint: number;
  fade: number;
  vignette: number;
  grain: number;
  glitchAmount: number;
  glitchRGB: number;
  glitchTear: number;
  glitchBlocks: number;
  glitchColor: number;
  glitchScanlines: number;
  glitchSpeed: number;
  glitchHue: number;
  liftR: number;
  liftG: number;
  liftB: number;
  liftM: number;
  gammaR: number;
  gammaG: number;
  gammaB: number;
  gammaM: number;
  gainR: number;
  gainG: number;
  gainB: number;
  gainM: number;
  lutIntensity: number;
};

export type StudioAdjustments = StudioNumericAdjustments & {
  curves?: StudioCurves;
  lutID?: string;
  fx?: StudioFxLayer[];
};

export type StudioLUT = {
  id: string;
  name: string;
  size: number;
  data: Float32Array;
};

export const DEFAULT_ADJUSTMENTS: StudioAdjustments = {
  exposure: 0,
  brightness: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  shadowHue: 0,
  midtoneHue: 0,
  highlightHue: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  fade: 0,
  vignette: 0,
  grain: 0,
  glitchAmount: 0,
  glitchRGB: 0,
  glitchTear: 0,
  glitchBlocks: 0,
  glitchColor: 0,
  glitchScanlines: 0,
  glitchSpeed: 0.5,
  glitchHue: 180,
  liftR: 0,
  liftG: 0,
  liftB: 0,
  liftM: 0,
  gammaR: 0,
  gammaG: 0,
  gammaB: 0,
  gammaM: 0,
  gainR: 0,
  gainG: 0,
  gainB: 0,
  gainM: 0,
  lutIntensity: 1,
};

export const GRADE_NUMERIC_KEYS = [
  'exposure', 'brightness', 'contrast', 'highlights', 'shadows', 'shadowHue', 'midtoneHue', 'highlightHue',
  'saturation', 'temperature', 'tint', 'fade',
  'liftR', 'liftG', 'liftB', 'liftM', 'gammaR', 'gammaG', 'gammaB', 'gammaM', 'gainR', 'gainG', 'gainB', 'gainM', 'lutIntensity',
] as const satisfies readonly (keyof StudioNumericAdjustments)[];

export type StudioGrade = Pick<StudioAdjustments, typeof GRADE_NUMERIC_KEYS[number] | 'curves' | 'lutID'>;

export const IDENTITY_CURVE: CurvePoint[] = [[0, 0], [1, 1]];

export function identityCurves(): StudioCurves {
  return { master: [[0, 0], [1, 1]], red: [[0, 0], [1, 1]], green: [[0, 0], [1, 1]], blue: [[0, 0], [1, 1]] };
}

export function normalizeAdjustments(value: Partial<StudioAdjustments> | undefined): StudioAdjustments {
  const merged = { ...DEFAULT_ADJUSTMENTS } as StudioAdjustments;
  if (!value || typeof value !== 'object') return merged;
  for (const key of Object.keys(DEFAULT_ADJUSTMENTS) as (keyof StudioNumericAdjustments)[]) {
    const number = Number(value[key]);
    if (value[key] !== undefined && Number.isFinite(number)) merged[key] = number;
  }
  if (value.curves && typeof value.curves === 'object') merged.curves = normalizeCurves(value.curves);
  if (typeof value.lutID === 'string' && value.lutID) merged.lutID = value.lutID;
  if (Array.isArray(value.fx)) merged.fx = value.fx;
  return merged;
}

function normalizeCurve(points: unknown): CurvePoint[] {
  if (!Array.isArray(points)) return [[0, 0], [1, 1]];
  const cleaned = points
    .filter((point): point is [number, number] => Array.isArray(point) && point.length >= 2 && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1])))
    .map(([x, y]) => [clamp01(Number(x)), clamp01(Number(y))] as CurvePoint)
    .sort((left, right) => left[0] - right[0]);
  const unique: CurvePoint[] = [];
  for (const point of cleaned) {
    if (unique.length && Math.abs(unique[unique.length - 1][0] - point[0]) < 1e-4) unique[unique.length - 1] = point;
    else unique.push(point);
  }
  return unique.length >= 2 ? unique : [[0, 0], [1, 1]];
}

export function normalizeCurves(value: Partial<StudioCurves>): StudioCurves {
  return { master: normalizeCurve(value.master), red: normalizeCurve(value.red), green: normalizeCurve(value.green), blue: normalizeCurve(value.blue) };
}

function isIdentityCurve(points: CurvePoint[] | undefined) {
  return !points || points.every(([x, y]) => Math.abs(x - y) < 1e-4);
}

export function curvesActive(curves: StudioCurves | undefined) {
  return !!curves && !(isIdentityCurve(curves.master) && isIdentityCurve(curves.red) && isIdentityCurve(curves.green) && isIdentityCurve(curves.blue));
}

export function clamp01(value: number) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function curveEvaluator(points: CurvePoint[]) {
  const sorted = normalizeCurve(points);
  const count = sorted.length;
  const xs = sorted.map((point) => point[0]);
  const ys = sorted.map((point) => point[1]);
  const slopes: number[] = [];
  const deltas: number[] = [];
  for (let index = 0; index < count - 1; index += 1) deltas.push((ys[index + 1] - ys[index]) / Math.max(1e-6, xs[index + 1] - xs[index]));
  for (let index = 0; index < count; index += 1) {
    if (index === 0) slopes.push(deltas[0]);
    else if (index === count - 1) slopes.push(deltas[count - 2]);
    else if (deltas[index - 1] * deltas[index] <= 0) slopes.push(0);
    else slopes.push((deltas[index - 1] + deltas[index]) / 2);
  }
  for (let index = 0; index < count - 1; index += 1) {
    if (Math.abs(deltas[index]) < 1e-9) {
      slopes[index] = 0;
      slopes[index + 1] = 0;
      continue;
    }
    const alpha = slopes[index] / deltas[index];
    const beta = slopes[index + 1] / deltas[index];
    const magnitude = alpha * alpha + beta * beta;
    if (magnitude > 9) {
      const tau = 3 / Math.sqrt(magnitude);
      slopes[index] = tau * alpha * deltas[index];
      slopes[index + 1] = tau * beta * deltas[index];
    }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[count - 1]) return ys[count - 1];
    let segment = 0;
    while (segment < count - 2 && x > xs[segment + 1]) segment += 1;
    const width = xs[segment + 1] - xs[segment];
    const t = (x - xs[segment]) / width;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[segment]
      + (t3 - 2 * t2 + t) * width * slopes[segment]
      + (-2 * t3 + 3 * t2) * ys[segment + 1]
      + (t3 - t2) * width * slopes[segment + 1];
  };
}

export const CURVE_TABLE_SIZE = 256;
const curveTableCache = new WeakMap<StudioCurves, Float32Array>();

export function curveTable(curves: StudioCurves) {
  const cached = curveTableCache.get(curves);
  if (cached) return cached;
  const master = curveEvaluator(curves.master);
  const channels = [curveEvaluator(curves.red), curveEvaluator(curves.green), curveEvaluator(curves.blue)];
  const table = new Float32Array(CURVE_TABLE_SIZE * 4);
  for (let index = 0; index < CURVE_TABLE_SIZE; index += 1) {
    const base = clamp01(master(index / (CURVE_TABLE_SIZE - 1)));
    for (let channel = 0; channel < 3; channel += 1) table[index * 4 + channel] = clamp01(channels[channel](base));
    table[index * 4 + 3] = 1;
  }
  curveTableCache.set(curves, table);
  return table;
}

function sampleCurveTable(table: Float32Array, channel: number, value: number) {
  const position = clamp01(value) * (CURVE_TABLE_SIZE - 1);
  const low = Math.floor(position);
  const high = Math.min(CURVE_TABLE_SIZE - 1, low + 1);
  const fraction = position - low;
  return table[low * 4 + channel] * (1 - fraction) + table[high * 4 + channel] * fraction;
}

export function sampleLUT(lut: Pick<StudioLUT, 'size' | 'data'>, r: number, g: number, b: number): [number, number, number] {
  const { size, data } = lut;
  const max = size - 1;
  const fr = clamp01(r) * max;
  const fg = clamp01(g) * max;
  const fb = clamp01(b) * max;
  const r0 = Math.floor(fr);
  const g0 = Math.floor(fg);
  const b0 = Math.floor(fb);
  const r1 = Math.min(max, r0 + 1);
  const g1 = Math.min(max, g0 + 1);
  const b1 = Math.min(max, b0 + 1);
  const dr = fr - r0;
  const dg = fg - g0;
  const db = fb - b0;
  const out: [number, number, number] = [0, 0, 0];
  const at = (ri: number, gi: number, bi: number, channel: number) => data[((bi * size + gi) * size + ri) * 3 + channel];
  for (let channel = 0; channel < 3; channel += 1) {
    const c00 = at(r0, g0, b0, channel) * (1 - dr) + at(r1, g0, b0, channel) * dr;
    const c10 = at(r0, g1, b0, channel) * (1 - dr) + at(r1, g1, b0, channel) * dr;
    const c01 = at(r0, g0, b1, channel) * (1 - dr) + at(r1, g0, b1, channel) * dr;
    const c11 = at(r0, g1, b1, channel) * (1 - dr) + at(r1, g1, b1, channel) * dr;
    const c0 = c00 * (1 - dg) + c10 * dg;
    const c1 = c01 * (1 - dg) + c11 * dg;
    out[channel] = c0 * (1 - db) + c1 * db;
  }
  return out;
}

export function effectiveLGG(adjustments: StudioNumericAdjustments) {
  const lift: [number, number, number] = [adjustments.liftM + adjustments.liftR, adjustments.liftM + adjustments.liftG, adjustments.liftM + adjustments.liftB];
  const gamma: [number, number, number] = [
    Math.pow(2, -(adjustments.gammaM + adjustments.gammaR)),
    Math.pow(2, -(adjustments.gammaM + adjustments.gammaG)),
    Math.pow(2, -(adjustments.gammaM + adjustments.gammaB)),
  ];
  const gain: [number, number, number] = [
    Math.max(0, (1 + adjustments.gainM) * (1 + adjustments.gainR)),
    Math.max(0, (1 + adjustments.gainM) * (1 + adjustments.gainG)),
    Math.max(0, (1 + adjustments.gainM) * (1 + adjustments.gainB)),
  ];
  return { lift, gamma, gain };
}

const fract = (value: number) => value - Math.floor(value);
const mix = (from: number, to: number, amount: number) => from * (1 - amount) + to * amount;
const step = (edge: number, value: number) => (value < edge ? 0 : 1);
const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const kx = 0;
  const ky = -1 / 3;
  const kz = 2 / 3;
  const kw = -1;
  const s1 = step(b, g);
  const px = mix(b, g, s1);
  const py = mix(g, b, s1);
  const pz = mix(kw, kx, s1);
  const pw = mix(kz, ky, s1);
  const s2 = step(px, r);
  const qx = mix(px, r, s2);
  const qy = py;
  const qz = mix(pw, pz, s2);
  const qw = mix(r, px, s2);
  const d = qx - Math.min(qw, qy);
  const e = 1.0e-10;
  return [Math.abs(qz + (qw - qy) / (6 * d + e)), d / (qx + e), qx];
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const channel = (offset: number) => {
    const p = Math.abs(fract(h + offset) * 6 - 3);
    return v * mix(1, clamp01(p - 1), s);
  };
  return [channel(0), channel(2 / 3), channel(1 / 3)];
}

function shiftHue(color: [number, number, number], degrees: number, amount: number): [number, number, number] {
  const hsv = rgbToHsv(Math.max(color[0], 0), Math.max(color[1], 0), Math.max(color[2], 0));
  const shifted = hsvToRgb(fract(hsv[0] + degrees / 360), hsv[1], hsv[2]);
  return [mix(color[0], shifted[0], amount), mix(color[1], shifted[1], amount), mix(color[2], shifted[2], amount)];
}

export type GradeResources = { curves: Float32Array | null; lut: Pick<StudioLUT, 'size' | 'data'> | null };

export function gradeResources(adjustments: StudioAdjustments, lut?: Pick<StudioLUT, 'size' | 'data'> | null): GradeResources {
  return {
    curves: curvesActive(adjustments.curves) ? curveTable(adjustments.curves!) : null,
    lut: lut && adjustments.lutIntensity > 0 ? lut : null,
  };
}

export function gradeColor(input: [number, number, number], adjustments: StudioAdjustments, resources: GradeResources): [number, number, number] {
  const exposure = Math.pow(2, adjustments.exposure);
  let color: [number, number, number] = [input[0] * exposure, input[1] * exposure, input[2] * exposure];
  color = color.map((value) => (value + adjustments.brightness - 0.5) * (1 + adjustments.contrast) + 0.5) as [number, number, number];
  let luma = color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722;
  const shadowMask = 1 - smoothstep(0.05, 0.62, luma);
  const highlightMask = smoothstep(0.38, 0.95, luma);
  const midtoneMask = clamp01(1 - shadowMask - highlightMask);
  color = color.map((value) => value + adjustments.shadows * shadowMask * 0.45 + adjustments.highlights * highlightMask * 0.45) as [number, number, number];
  color = shiftHue(color, adjustments.shadowHue, shadowMask);
  color = shiftHue(color, adjustments.midtoneHue, midtoneMask);
  color = shiftHue(color, adjustments.highlightHue, highlightMask);
  luma = color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722;
  color = color.map((value) => mix(luma, value, 1 + adjustments.saturation)) as [number, number, number];
  color[0] += adjustments.temperature * 0.09;
  color[2] -= adjustments.temperature * 0.09;
  color[1] += adjustments.tint * 0.06;
  color = color.map((value) => mix(value, 0.5, adjustments.fade * 0.22)) as [number, number, number];
  const { lift, gamma, gain } = effectiveLGG(adjustments);
  color = color.map((value, channel) => Math.pow(Math.max(gain[channel] * (value + lift[channel] * (1 - value)), 0), gamma[channel])) as [number, number, number];
  if (resources.curves) {
    const table = resources.curves;
    color = [sampleCurveTable(table, 0, color[0]), sampleCurveTable(table, 1, color[1]), sampleCurveTable(table, 2, color[2])];
  }
  if (resources.lut) {
    const looked = sampleLUT(resources.lut, color[0], color[1], color[2]);
    const amount = adjustments.lutIntensity;
    color = [mix(color[0], looked[0], amount), mix(color[1], looked[1], amount), mix(color[2], looked[2], amount)];
  }
  return [clamp01(color[0]), clamp01(color[1]), clamp01(color[2])];
}

export function bakeGradeLUT(adjustments: StudioAdjustments, lut?: Pick<StudioLUT, 'size' | 'data'> | null, size = 33) {
  const resources = gradeResources(adjustments, lut);
  const data = new Float32Array(size * size * size * 3);
  let offset = 0;
  for (let b = 0; b < size; b += 1) {
    for (let g = 0; g < size; g += 1) {
      for (let r = 0; r < size; r += 1) {
        const out = gradeColor([r / (size - 1), g / (size - 1), b / (size - 1)], adjustments, resources);
        data[offset++] = out[0];
        data[offset++] = out[1];
        data[offset++] = out[2];
      }
    }
  }
  return data;
}

export type ParsedCube = { title: string; size: number; data: Float32Array };

export function parseCube(text: string): ParsedCube {
  let title = '';
  let size3D = 0;
  let size1D = 0;
  let domainMin: [number, number, number] = [0, 0, 0];
  let domainMax: [number, number, number] = [1, 1, 1];
  const values: number[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const upper = line.toUpperCase();
    if (upper.startsWith('TITLE')) {
      title = line.slice(5).trim().replace(/^"|"$/g, '');
    } else if (upper.startsWith('LUT_3D_SIZE')) {
      size3D = Number(line.split(/\s+/)[1]);
    } else if (upper.startsWith('LUT_1D_SIZE')) {
      size1D = Number(line.split(/\s+/)[1]);
    } else if (upper.startsWith('DOMAIN_MIN')) {
      domainMin = line.split(/\s+/).slice(1, 4).map(Number) as [number, number, number];
    } else if (upper.startsWith('DOMAIN_MAX')) {
      domainMax = line.split(/\s+/).slice(1, 4).map(Number) as [number, number, number];
    } else if (upper.startsWith('LUT_3D_INPUT_RANGE') || upper.startsWith('LUT_1D_INPUT_RANGE')) {
      const [low, high] = line.split(/\s+/).slice(1, 3).map(Number);
      domainMin = [low, low, low];
      domainMax = [high, high, high];
    } else if (/^[-+\d.]/.test(line)) {
      const parts = line.split(/\s+/).map(Number);
      if (parts.length < 3 || parts.slice(0, 3).some((value) => !Number.isFinite(value))) throw new Error('Invalid LUT data row');
      values.push(parts[0], parts[1], parts[2]);
    }
  }
  if (!size3D && !size1D) throw new Error('Missing LUT_3D_SIZE');
  const domainIdentity = domainMin.every((value) => value === 0) && domainMax.every((value) => value === 1);
  if (size1D) {
    if (size1D < 2 || values.length !== size1D * 3) throw new Error('LUT data does not match LUT_1D_SIZE');
    const size = 33;
    const data = new Float32Array(size * size * size * 3);
    const sample1D = (channel: number, value: number) => {
      const position = clamp01((value - domainMin[channel]) / Math.max(1e-6, domainMax[channel] - domainMin[channel])) * (size1D - 1);
      const low = Math.floor(position);
      const high = Math.min(size1D - 1, low + 1);
      return mix(values[low * 3 + channel], values[high * 3 + channel], position - low);
    };
    let offset = 0;
    for (let b = 0; b < size; b += 1) for (let g = 0; g < size; g += 1) for (let r = 0; r < size; r += 1) {
      data[offset++] = clamp01(sample1D(0, r / (size - 1)));
      data[offset++] = clamp01(sample1D(1, g / (size - 1)));
      data[offset++] = clamp01(sample1D(2, b / (size - 1)));
    }
    return { title, size, data };
  }
  if (size3D < 2 || size3D > 129) throw new Error('Unsupported LUT size');
  if (values.length !== size3D * size3D * size3D * 3) throw new Error('LUT data does not match LUT_3D_SIZE');
  const raw = new Float32Array(values.map(clamp01));
  if (domainIdentity) return { title, size: size3D, data: raw };
  const data = new Float32Array(raw.length);
  let offset = 0;
  const remap = (value: number, channel: number) => (value - domainMin[channel]) / Math.max(1e-6, domainMax[channel] - domainMin[channel]);
  for (let b = 0; b < size3D; b += 1) for (let g = 0; g < size3D; g += 1) for (let r = 0; r < size3D; r += 1) {
    const out = sampleLUT({ size: size3D, data: raw }, remap(r / (size3D - 1), 0), remap(g / (size3D - 1), 1), remap(b / (size3D - 1), 2));
    data[offset++] = out[0];
    data[offset++] = out[1];
    data[offset++] = out[2];
  }
  return { title, size: size3D, data };
}

export function serializeCube(lut: { title?: string; size: number; data: Float32Array }) {
  const lines = [`TITLE "${(lut.title || 'ManifoldGen grade').replace(/"/g, '')}"`, `LUT_3D_SIZE ${lut.size}`, 'DOMAIN_MIN 0.0 0.0 0.0', 'DOMAIN_MAX 1.0 1.0 1.0'];
  for (let index = 0; index < lut.data.length; index += 3) {
    lines.push(`${lut.data[index].toFixed(6)} ${lut.data[index + 1].toFixed(6)} ${lut.data[index + 2].toFixed(6)}`);
  }
  return `${lines.join('\n')}\n`;
}

export function resampleLUT(lut: Pick<StudioLUT, 'size' | 'data'>, size: number) {
  if (lut.size === size) return lut.data;
  const data = new Float32Array(size * size * size * 3);
  let offset = 0;
  for (let b = 0; b < size; b += 1) for (let g = 0; g < size; g += 1) for (let r = 0; r < size; r += 1) {
    const out = sampleLUT(lut, r / (size - 1), g / (size - 1), b / (size - 1));
    data[offset++] = out[0];
    data[offset++] = out[1];
    data[offset++] = out[2];
  }
  return data;
}

export const STORED_LUT_MAX_SIZE = 33;

export function encodeLUTData(data: Float32Array) {
  const words = new Uint16Array(data.length);
  for (let index = 0; index < data.length; index += 1) words[index] = Math.round(clamp01(data[index]) * 65535);
  const bytes = new Uint8Array(words.buffer);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

export function decodeLUTData(encoded: string, size: number) {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const words = new Uint16Array(bytes.buffer, 0, Math.floor(bytes.length / 2));
  if (words.length !== size * size * size * 3) throw new Error('Stored LUT is corrupt');
  const data = new Float32Array(words.length);
  for (let index = 0; index < words.length; index += 1) data[index] = words[index] / 65535;
  return data;
}

export function storableLUT(lut: StudioLUT): StudioLUT {
  if (lut.size <= STORED_LUT_MAX_SIZE) return lut;
  return { ...lut, size: STORED_LUT_MAX_SIZE, data: resampleLUT(lut, STORED_LUT_MAX_SIZE) };
}

function srgbToLinear(value: number) {
  return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
}

function linearToSrgb(value: number) {
  return value <= 0.0031308 ? value * 12.92 : 1.055 * Math.pow(Math.max(value, 0), 1 / 2.4) - 0.055;
}

const labF = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
const labFInverse = (t: number) => (t * t * t > 216 / 24389 ? t * t * t : (116 * t - 16) / (24389 / 27));

export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const x = (0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb) / 0.95047;
  const y = 0.2126729 * lr + 0.7151522 * lg + 0.072175 * lb;
  const z = (0.0193339 * lr + 0.119192 * lg + 0.9503041 * lb) / 1.08883;
  const fx = labF(x);
  const fy = labF(y);
  const fz = labF(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function labToRgb(l: number, a: number, bValue: number): [number, number, number] {
  const fy = (l + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - bValue / 200;
  const x = labFInverse(fx) * 0.95047;
  const y = labFInverse(fy);
  const z = labFInverse(fz) * 1.08883;
  const lr = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
  const lg = -0.969266 * x + 1.8760108 * y + 0.041556 * z;
  const lb = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z;
  return [clamp01(linearToSrgb(lr)), clamp01(linearToSrgb(lg)), clamp01(linearToSrgb(lb))];
}

export type PixelSample = { data: Uint8ClampedArray | Uint8Array; width: number; height: number };

export type FrameStats = {
  mean: [number, number, number];
  luma: number;
  labMean: [number, number, number];
  labStd: [number, number, number];
};

export function frameStats(pixels: PixelSample, adjustments?: StudioAdjustments, resources?: GradeResources): FrameStats {
  const sums = [0, 0, 0];
  const labSums = [0, 0, 0];
  const labSquares = [0, 0, 0];
  let count = 0;
  const { data } = pixels;
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] < 16) continue;
    let rgb: [number, number, number] = [data[index] / 255, data[index + 1] / 255, data[index + 2] / 255];
    if (adjustments && resources) rgb = gradeColor(rgb, adjustments, resources);
    sums[0] += rgb[0];
    sums[1] += rgb[1];
    sums[2] += rgb[2];
    const lab = rgbToLab(rgb[0], rgb[1], rgb[2]);
    for (let channel = 0; channel < 3; channel += 1) {
      labSums[channel] += lab[channel];
      labSquares[channel] += lab[channel] * lab[channel];
    }
    count += 1;
  }
  const total = Math.max(1, count);
  const mean = sums.map((value) => value / total) as [number, number, number];
  const labMean = labSums.map((value) => value / total) as [number, number, number];
  const labStd = labSquares.map((value, channel) => Math.sqrt(Math.max(0, value / total - labMean[channel] * labMean[channel]))) as [number, number, number];
  return { mean, luma: mean[0] * 0.2126 + mean[1] * 0.7152 + mean[2] * 0.0722, labMean, labStd };
}

export function reinhardMatchLUT(source: FrameStats, reference: FrameStats, size = 33, strength = 1) {
  const ratio = [0, 1, 2].map((channel) => Math.max(0.25, Math.min(4, reference.labStd[channel] / Math.max(1e-3, source.labStd[channel]))));
  const data = new Float32Array(size * size * size * 3);
  let offset = 0;
  for (let b = 0; b < size; b += 1) for (let g = 0; g < size; g += 1) for (let r = 0; r < size; r += 1) {
    const rgb: [number, number, number] = [r / (size - 1), g / (size - 1), b / (size - 1)];
    const lab = rgbToLab(rgb[0], rgb[1], rgb[2]);
    const mapped = lab.map((value, channel) => (value - source.labMean[channel]) * ratio[channel] + reference.labMean[channel]) as [number, number, number];
    const out = labToRgb(mapped[0], mapped[1], mapped[2]);
    data[offset++] = mix(rgb[0], out[0], strength);
    data[offset++] = mix(rgb[1], out[1], strength);
    data[offset++] = mix(rgb[2], out[2], strength);
  }
  return data;
}

export function autoWhiteBalance(pixels: PixelSample, adjustments: StudioAdjustments, lut?: Pick<StudioLUT, 'size' | 'data'> | null): Partial<StudioAdjustments> {
  let next: StudioAdjustments = { ...adjustments, gainR: 0, gainG: 0, gainB: 0, temperature: 0, tint: 0 };
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const stats = frameStats(pixels, next, gradeResources(next, lut));
    const target = stats.luma;
    const correct = (gain: number, mean: number) => Math.max(-0.5, Math.min(0.5, (1 + gain) * Math.pow(target / Math.max(1e-3, mean), 0.9) - 1));
    next = { ...next, gainR: correct(next.gainR, stats.mean[0]), gainG: correct(next.gainG, stats.mean[1]), gainB: correct(next.gainB, stats.mean[2]) };
  }
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return { gainR: round(next.gainR), gainG: round(next.gainG), gainB: round(next.gainB), temperature: 0, tint: 0 };
}

export function autoExposure(pixels: PixelSample, adjustments: StudioAdjustments, lut?: Pick<StudioLUT, 'size' | 'data'> | null, target = 0.46): Partial<StudioAdjustments> {
  let exposure = adjustments.exposure;
  for (let iteration = 0; iteration < 6; iteration += 1) {
    const next = { ...adjustments, exposure };
    const stats = frameStats(pixels, next, gradeResources(next, lut));
    const delta = Math.log2(target / Math.max(1e-3, stats.luma));
    if (Math.abs(delta) < 0.01) break;
    exposure = Math.max(-2, Math.min(2, exposure + delta * 0.85));
  }
  return { exposure: Math.round(exposure * 1000) / 1000 };
}

export function pickGrade(adjustments: StudioAdjustments): StudioGrade {
  const grade = {} as StudioGrade;
  for (const key of GRADE_NUMERIC_KEYS) grade[key] = adjustments[key];
  grade.curves = adjustments.curves;
  grade.lutID = adjustments.lutID;
  return grade;
}

export function gradeDefaults(): StudioGrade {
  return { ...pickGrade(DEFAULT_ADJUSTMENTS), curves: undefined, lutID: undefined };
}

export type FilmLook = { name: string; colors: string; values: Partial<StudioAdjustments> };

export const FILM_LOOKS: FilmLook[] = [
  { name: 'Teal & orange', colors: '#1f8a8f,#f2994a', values: { contrast: 0.1, saturation: 0.12, liftR: -0.035, liftG: 0.01, liftB: 0.04, gainR: 0.07, gainG: 0.01, gainB: -0.08, curves: { ...identityCurves(), master: [[0, 0.02], [0.25, 0.21], [0.75, 0.8], [1, 0.98]] } } },
  { name: 'Print film', colors: '#3a2a22,#e7c48c', values: { saturation: -0.06, liftM: 0.02, gammaM: 0.05, gainR: 0.04, gainB: -0.04, curves: { ...identityCurves(), master: [[0, 0.03], [0.22, 0.17], [0.7, 0.8], [1, 0.96]], blue: [[0, 0.04], [1, 0.95]] } } },
  { name: 'Bleach bypass', colors: '#9aa2a4,#2c3133', values: { saturation: -0.55, contrast: 0.3, gainM: 0.04, curves: { ...identityCurves(), master: [[0, 0], [0.3, 0.2], [0.7, 0.84], [1, 1]] } } },
  { name: 'Cross process', colors: '#d6f06a,#2f2a7a', values: { saturation: 0.18, curves: { master: [[0, 0], [1, 1]], red: [[0, 0], [0.3, 0.22], [0.75, 0.88], [1, 1]], green: [[0, 0], [0.3, 0.26], [0.7, 0.82], [1, 1]], blue: [[0, 0.14], [1, 0.84]] } } },
  { name: 'Faded film', colors: '#c9b8a2,#5f6a72', values: { saturation: -0.22, temperature: 0.08, curves: { ...identityCurves(), master: [[0, 0.11], [0.5, 0.52], [1, 0.92]] } } },
  { name: 'Day for night', colors: '#1c2a4a,#6d86b5', values: { exposure: -0.9, saturation: -0.4, temperature: -0.45, liftB: 0.03, gainB: 0.08, gainR: -0.06 } },
  { name: 'Matte noir', colors: '#e2e2e2,#1b1b1b', values: { saturation: -1, contrast: 0.22, curves: { ...identityCurves(), master: [[0, 0.07], [0.3, 0.22], [0.72, 0.82], [1, 0.95]] } } },
  { name: 'Golden hour', colors: '#ffcf6b,#8a3b1f', values: { temperature: 0.32, saturation: 0.12, highlights: 0.08, gammaM: 0.06, gainR: 0.07, gainG: 0.025, liftB: -0.02 } },
];

export function applyFilmLook(adjustments: StudioAdjustments, look: FilmLook): StudioAdjustments {
  return { ...adjustments, ...gradeDefaults(), lutID: adjustments.lutID, lutIntensity: adjustments.lutIntensity, ...look.values };
}

export function wheelToRGB(x: number, y: number, amount: number): [number, number, number] {
  const angle = Math.atan2(y, x);
  const magnitude = Math.min(1, Math.hypot(x, y)) * amount;
  return [0, 120, 240].map((degrees) => Math.round(magnitude * Math.cos(angle - degrees * Math.PI / 180) * 10000) / 10000) as [number, number, number];
}

export function rgbToWheel(r: number, g: number, b: number, amount: number): [number, number] {
  const x = (2 / 3) * (r - 0.5 * g - 0.5 * b);
  const y = (2 / 3) * (Math.sqrt(3) / 2) * (g - b);
  return [x / amount, y / amount];
}

export function samplePixels(source: CanvasImageSource, width: number, height: number, maxSide = 96): PixelSample | null {
  if (!width || !height) return null;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  return { data: image.data, width: canvas.width, height: canvas.height };
}
