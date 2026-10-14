export type StudioFxType =
  | 'feedback' | 'kaleidoscope' | 'mirror' | 'pixelate' | 'chromatic' | 'rgbShift' | 'bloom' | 'edges' | 'posterize'
  | 'halftone' | 'noiseWarp' | 'wave' | 'lightLeak' | 'crt' | 'vhs' | 'datamosh' | 'lumaKey' | 'chromaKey';

export type StudioFxLayer = {
  id: string;
  type: StudioFxType;
  enabled: boolean;
  params: Record<string, number>;
};

export type FxSlider = { key: string; label: string; min: number; max: number; step: number };
export type FxSelect = { key: string; label: string; options: string[] };
export type FxColor = { label: string; color: [string, string, string] };
export type FxControl = FxSlider | FxSelect | FxColor;

export type FxDefinition = {
  type: StudioFxType;
  label: string;
  group: 'Motion' | 'Distort' | 'Stylize' | 'Light' | 'Retro' | 'Key';
  uniforms: string[];
  defaults: Record<string, number>;
  controls: FxControl[];
  history?: boolean;
  animated?: boolean;
  keyer?: boolean;
};

const slider = (key: string, label: string, min: number, max: number, step = 0.01): FxSlider => ({ key, label, min, max, step });

export const FX_DEFINITIONS: FxDefinition[] = [
  { type: 'feedback', label: 'Feedback trails', group: 'Motion', history: true, uniforms: ['decay', 'zoom', 'rotate', 'hue'], defaults: { decay: 0.86, zoom: 0.01, rotate: 0.4, hue: 0 }, controls: [slider('decay', 'Decay', 0, 0.98), slider('zoom', 'Zoom', -0.05, 0.05, 0.001), slider('rotate', 'Rotate', -6, 6, 0.1), slider('hue', 'Hue drift', 0, 0.2, 0.005)] },
  { type: 'datamosh', label: 'Datamosh smear', group: 'Motion', history: true, animated: true, uniforms: ['amount', 'block', 'smear'], defaults: { amount: 0.35, block: 0.05, smear: 0.02 }, controls: [slider('amount', 'Amount', 0, 1), slider('block', 'Block size', 0.01, 0.2, 0.005), slider('smear', 'Smear', 0, 0.08, 0.001)] },
  { type: 'kaleidoscope', label: 'Kaleidoscope', group: 'Distort', uniforms: ['segments', 'rotation', 'zoom'], defaults: { segments: 6, rotation: 0, zoom: 1 }, controls: [slider('segments', 'Segments', 2, 16, 1), slider('rotation', 'Rotation', 0, 360, 1), slider('zoom', 'Zoom', 0.3, 2.5)] },
  { type: 'mirror', label: 'Mirror', group: 'Distort', uniforms: ['mode', 'flip'], defaults: { mode: 0, flip: 0 }, controls: [{ key: 'mode', label: 'Axis', options: ['Left / right', 'Top / bottom', 'Quad'] }, { key: 'flip', label: 'Source', options: ['First half', 'Second half'] }] },
  { type: 'wave', label: 'Wave warp', group: 'Distort', animated: true, uniforms: ['amplitude', 'frequency', 'speed', 'axis'], defaults: { amplitude: 0.015, frequency: 8, speed: 2, axis: 0 }, controls: [slider('amplitude', 'Amplitude', 0, 0.1, 0.001), slider('frequency', 'Frequency', 1, 40, 0.5), slider('speed', 'Speed', 0, 10, 0.1), { key: 'axis', label: 'Axis', options: ['Horizontal', 'Vertical', 'Both'] }] },
  { type: 'noiseWarp', label: 'Noise displace', group: 'Distort', animated: true, uniforms: ['amount', 'scale', 'speed'], defaults: { amount: 0.02, scale: 6, speed: 0.5 }, controls: [slider('amount', 'Amount', 0, 0.12, 0.001), slider('scale', 'Scale', 1, 30, 0.5), slider('speed', 'Speed', 0, 3, 0.05)] },
  { type: 'pixelate', label: 'Pixelate', group: 'Stylize', uniforms: ['size', 'round'], defaults: { size: 0.02, round: 0 }, controls: [slider('size', 'Cell size', 0.002, 0.1, 0.001), { key: 'round', label: 'Shape', options: ['Square', 'Dots'] }] },
  { type: 'posterize', label: 'Posterize', group: 'Stylize', uniforms: ['levels', 'gamma'], defaults: { levels: 5, gamma: 1 }, controls: [slider('levels', 'Levels', 2, 16, 1), slider('gamma', 'Gamma', 0.4, 2.5)] },
  { type: 'halftone', label: 'Halftone', group: 'Stylize', uniforms: ['size', 'angle', 'color'], defaults: { size: 0.012, angle: 45, color: 0 }, controls: [slider('size', 'Dot size', 0.003, 0.05, 0.001), slider('angle', 'Angle', 0, 90, 1), { key: 'color', label: 'Ink', options: ['Mono', 'Color'] }] },
  { type: 'edges', label: 'Edges / toon', group: 'Stylize', uniforms: ['strength', 'threshold', 'mode'], defaults: { strength: 1, threshold: 0.15, mode: 0 }, controls: [slider('strength', 'Strength', 0, 1), slider('threshold', 'Threshold', 0, 0.8), { key: 'mode', label: 'Style', options: ['Toon', 'Neon', 'Sketch'] }] },
  { type: 'chromatic', label: 'Chromatic aberration', group: 'Light', uniforms: ['amount'], defaults: { amount: 0.008 }, controls: [slider('amount', 'Amount', 0, 0.05, 0.001)] },
  { type: 'rgbShift', label: 'RGB shift', group: 'Light', animated: true, uniforms: ['amount', 'angle', 'jitter'], defaults: { amount: 0.008, angle: 0, jitter: 0 }, controls: [slider('amount', 'Amount', 0, 0.05, 0.001), slider('angle', 'Angle', 0, 360, 1), slider('jitter', 'Jitter', 0, 1)] },
  { type: 'bloom', label: 'Bloom / glow', group: 'Light', uniforms: ['threshold', 'intensity', 'radius'], defaults: { threshold: 0.6, intensity: 1, radius: 0.015 }, controls: [slider('threshold', 'Threshold', 0, 1), slider('intensity', 'Intensity', 0, 3), slider('radius', 'Radius', 0.002, 0.06, 0.001)] },
  { type: 'lightLeak', label: 'Film burn / leak', group: 'Light', animated: true, uniforms: ['intensity', 'hue', 'speed'], defaults: { intensity: 0.6, hue: 25, speed: 0.4 }, controls: [slider('intensity', 'Intensity', 0, 1), slider('hue', 'Hue', 0, 360, 1), slider('speed', 'Speed', 0, 2, 0.05)] },
  { type: 'crt', label: 'CRT scanlines', group: 'Retro', uniforms: ['scanlines', 'curvature', 'mask', 'lines'], defaults: { scanlines: 0.5, curvature: 0.08, mask: 0.3, lines: 360 }, controls: [slider('scanlines', 'Scanlines', 0, 1), slider('curvature', 'Curvature', 0, 0.3), slider('mask', 'RGB mask', 0, 1), slider('lines', 'Lines', 100, 1080, 10)] },
  { type: 'vhs', label: 'VHS', group: 'Retro', animated: true, uniforms: ['amount', 'tracking', 'bleed'], defaults: { amount: 0.6, tracking: 0.3, bleed: 0.5 }, controls: [slider('amount', 'Amount', 0, 1), slider('tracking', 'Tracking', 0, 1), slider('bleed', 'Color bleed', 0, 1)] },
  { type: 'lumaKey', label: 'Luma key', group: 'Key', keyer: true, uniforms: ['threshold', 'softness', 'invert'], defaults: { threshold: 0.1, softness: 0.1, invert: 0 }, controls: [slider('threshold', 'Threshold', 0, 1), slider('softness', 'Softness', 0, 0.5), { key: 'invert', label: 'Remove', options: ['Darks', 'Lights'] }] },
  { type: 'chromaKey', label: 'Chroma key', group: 'Key', keyer: true, uniforms: ['keyR', 'keyG', 'keyB', 'similarity', 'smoothness', 'spill'], defaults: { keyR: 0, keyG: 0.75, keyB: 0.25, similarity: 0.4, smoothness: 0.08, spill: 0.1 }, controls: [{ label: 'Key color', color: ['keyR', 'keyG', 'keyB'] }, slider('similarity', 'Similarity', 0, 1), slider('smoothness', 'Smoothness', 0, 0.5), slider('spill', 'Spill', 0, 1)] },
];

export const FX_BY_TYPE = Object.fromEntries(FX_DEFINITIONS.map((definition) => [definition.type, definition])) as Record<StudioFxType, FxDefinition>;

export const MAX_FX_LAYERS = 12;

export function createFxLayer(type: StudioFxType, id = `fx-${Math.random().toString(36).slice(2, 10)}`): StudioFxLayer {
  return { id, type, enabled: true, params: { mix: 1, ...FX_BY_TYPE[type].defaults } };
}

export function normalizeFxLayers(value: unknown): StudioFxLayer[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): StudioFxLayer[] => {
    if (!item || typeof item !== 'object') return [];
    const layer = item as Partial<StudioFxLayer>;
    const definition = layer.type ? FX_BY_TYPE[layer.type] : undefined;
    if (!definition) return [];
    const params: Record<string, number> = { mix: 1, ...definition.defaults };
    for (const [key, raw] of Object.entries(layer.params || {})) {
      const number = Number(raw);
      if (key in params && Number.isFinite(number)) params[key] = number;
    }
    return [{ id: typeof layer.id === 'string' && layer.id ? layer.id : `fx-${Math.random().toString(36).slice(2, 10)}`, type: definition.type, enabled: layer.enabled !== false, params }];
  }).slice(0, MAX_FX_LAYERS);
}

export function activeFx(layers: StudioFxLayer[] | undefined) {
  return (layers || []).filter((layer) => layer.enabled && FX_BY_TYPE[layer.type] && (layer.params.mix ?? 1) > 0);
}

export function fxAnimated(layers: StudioFxLayer[] | undefined) {
  return activeFx(layers).some((layer) => FX_BY_TYPE[layer.type].animated || FX_BY_TYPE[layer.type].history);
}

export function fxKeyed(layers: StudioFxLayer[] | undefined) {
  return activeFx(layers).some((layer) => FX_BY_TYPE[layer.type].keyer);
}
