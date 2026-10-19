import type { CaptionStyle } from './types';

export const BASE_STYLE: CaptionStyle = {
  name: 'Custom',
  font: 'montserrat', fontAlt: 'anton', size: 7.5, weight: 800, italic: false, caseMode: 'upper', tracking: 0, lineHeight: 1.05, skew: 0,
  x: 0.5, y: 0.72, maxWidth: 0.86, placement: 'fixed', rotate: 0, tilt: 0,
  fill: '#ffffff', fill2: '#ffd400', gradient: false, gradientAngle: 90, palette: ['#ffffff'], paletteMode: 'off',
  activeColor: '#ffd400', active: 'color', activeScale: 1.08, pastOpacity: 1, futureOpacity: 0.55, reveal: 'all',
  strokeWidth: 0.9, stroke: '#000000', shadowX: 0, shadowY: 6, shadowBlur: 14, shadow: 'rgba(0,0,0,0.65)', glow: 0, glowColor: '#ffffff',
  box: 0, boxColor: '#000000', boxRadius: 0.2, boxPad: 0.28, boxMode: 'page',
  animIn: 'pop', animOut: 'none', animMs: 220, stagger: 0, overshoot: 0.6,
  glitch: 0, glitchTrigger: 'onset', glitchMs: 260, rgbSplit: 0.5, slices: 4, jitter: 0, scanlines: 0, flicker: 0, scramble: 0,
  energyScale: 0.45, emphasisScale: [1.18, 1.45, 1.9], emphasisColors: ['', '#ffd400', '#ff3d6e'], emphasisFont: true, emphasisGlitch: 0.4, autoEmphasis: 0.4,
  wordRotate: 0, wordJitter: 0,
  punch: 0, shake: 0, dim: 0, vignette: 0.25, chromaVideo: 0, seed: 7,
};

type Preset = { id: string; label: string; blurb: string; style: Partial<CaptionStyle> };

export const PRESETS: Preset[] = [
  {
    id: 'viral-pop', label: 'Viral Pop', blurb: 'Three-word bursts, yellow highlight, pop-in',
    style: { name: 'Viral Pop', font: 'montserrat', fontAlt: 'anton', weight: 900, size: 8, caseMode: 'upper', strokeWidth: 1.1, shadowY: 8, shadowBlur: 10, active: 'color', activeColor: '#ffe600', activeScale: 1.12, animIn: 'pop', overshoot: 0.8, futureOpacity: 0.7, y: 0.7, autoEmphasis: 0.45, emphasisColors: ['', '#ffe600', '#ff3d6e'] },
  },
  {
    id: 'hifi-glitch', label: 'Hi-Fi Glitch', blurb: 'RGB split, sliced tears, decode on every word',
    style: { name: 'Hi-Fi Glitch', font: 'orbitron', fontAlt: 'rubikglitch', weight: 800, size: 9, caseMode: 'upper', tracking: 0.04, fill: '#f5f7ff', activeColor: '#00f0ff', active: 'color', activeScale: 1.04, strokeWidth: 0, shadowBlur: 0, shadowY: 0, glow: 0.35, glowColor: '#00e5ff', animIn: 'decode', animMs: 280, glitch: 0.95, glitchTrigger: 'onset', glitchMs: 320, rgbSplit: 0.9, slices: 6, jitter: 0.5, scanlines: 0.35, flicker: 0.2, scramble: 0.6, reveal: 'progressive', futureOpacity: 0, emphasisColors: ['#ffffff', '#00f0ff', '#ff2bd6'], emphasisGlitch: 0.8, punch: 0.4, shake: 0.35, chromaVideo: 0.5, vignette: 0.35, y: 0.5 },
  },
  {
    id: 'neon-karaoke', label: 'Neon Karaoke', blurb: 'Glowing line with a sweep fill that follows the voice',
    style: { name: 'Neon Karaoke', font: 'unbounded', fontAlt: 'unbounded', weight: 700, size: 6, caseMode: 'none', fill: '#ffffff', activeColor: '#ff2bd6', active: 'sweep', activeScale: 1, strokeWidth: 0, shadowBlur: 0, shadowY: 0, glow: 0.9, glowColor: '#7a5cff', animIn: 'fade', animMs: 160, futureOpacity: 0.45, pastOpacity: 0.9, y: 0.82, maxWidth: 0.9, emphasisScale: [1.08, 1.18, 1.3], emphasisColors: ['', '#22e3ff', '#ff2bd6'], autoEmphasis: 0.2, dim: 0.22, vignette: 0.45 },
  },
  {
    id: 'riot-scatter', label: 'Riot Scatter', blurb: 'One word at a time, random spots, huge emphasis, shake',
    style: { name: 'Riot Scatter', font: 'anton', fontAlt: 'bangers', weight: 400, size: 13, caseMode: 'upper', placement: 'scatter', tilt: 9, fill: '#ffffff', paletteMode: 'random', palette: ['#ffffff', '#ffe600', '#ff3d6e', '#30f0ff', '#8bff3c'], strokeWidth: 1.4, shadowY: 10, shadowBlur: 0, shadow: '#000000', active: 'none', animIn: 'slam', animMs: 200, overshoot: 0.5, glitch: 0.5, glitchTrigger: 'emphasis', rgbSplit: 0.6, slices: 3, energyScale: 0.9, emphasisScale: [1.2, 1.5, 2.1], autoEmphasis: 0.6, wordRotate: 6, punch: 0.7, shake: 0.6, maxWidth: 0.8, reveal: 'progressive', futureOpacity: 0 },
  },
  {
    id: 'brutal-block', label: 'Brutal Block', blurb: 'White slab, black type, snaps in and out',
    style: { name: 'Brutal Block', font: 'archivo', fontAlt: 'archivo', weight: 400, size: 7.5, caseMode: 'upper', fill: '#0a0a0a', activeColor: '#0a0a0a', active: 'none', strokeWidth: 0, shadowBlur: 0, shadowY: 0, shadowX: 0, box: 1, boxColor: '#ffffff', boxRadius: 0.04, boxPad: 0.32, boxMode: 'page', animIn: 'slam', animOut: 'shrink', animMs: 140, overshoot: 0.2, futureOpacity: 1, y: 0.68, emphasisColors: ['', '#e5001b', '#e5001b'], emphasisScale: [1.1, 1.25, 1.5], autoEmphasis: 0.3, tilt: 2, vignette: 0.15 },
  },
  {
    id: 'vhs-tape', label: 'VHS Tape', blurb: 'Scanlines, tracking jitter, chroma bleed, pixel type',
    style: { name: 'VHS Tape', font: 'vt323', fontAlt: 'pixel', weight: 400, size: 8.5, caseMode: 'upper', fill: '#f4f1e8', activeColor: '#ffdf5a', active: 'color', activeScale: 1, strokeWidth: 0, shadowBlur: 0, shadowY: 0, glow: 0.2, glowColor: '#ff3b3b', animIn: 'typewriter', animMs: 240, glitch: 0.55, glitchTrigger: 'always', rgbSplit: 0.7, slices: 3, jitter: 0.6, scanlines: 0.8, flicker: 0.35, x: 0.5, y: 0.82, maxWidth: 0.9, reveal: 'all', futureOpacity: 0.85, emphasisFont: false, autoEmphasis: 0.2, chromaVideo: 0.35, vignette: 0.5, dim: 0.1 },
  },
  {
    id: 'chrome-y2k', label: 'Chrome Y2K', blurb: 'Silver gradient letters with hard outline and glow',
    style: { name: 'Chrome Y2K', font: 'bungee', fontAlt: 'bungee', weight: 400, size: 8, caseMode: 'upper', gradient: true, fill: '#ffffff', fill2: '#6c7a99', gradientAngle: 90, activeColor: '#ffffff', active: 'none', strokeWidth: 1.6, stroke: '#0b1330', shadowBlur: 0, shadowY: 7, shadow: '#0b1330', glow: 0.5, glowColor: '#6fa8ff', animIn: 'zoom', animMs: 260, overshoot: 0.7, futureOpacity: 0.6, y: 0.7, emphasisColors: ['', '#ffffff', '#fff1a8'], autoEmphasis: 0.35, tilt: 3 },
  },
  {
    id: 'soft-clean', label: 'Soft Clean', blurb: 'Quiet sentence-case subtitles with a gentle fade',
    style: { name: 'Soft Clean', font: 'inter', fontAlt: 'inter', weight: 600, size: 4.6, caseMode: 'none', italic: false, fill: '#ffffff', active: 'none', strokeWidth: 0, shadowY: 2, shadowBlur: 10, shadow: 'rgba(0,0,0,0.75)', animIn: 'fade', animOut: 'fade', animMs: 180, y: 0.88, maxWidth: 0.78, futureOpacity: 1, energyScale: 0, autoEmphasis: 0, vignette: 0.3, reveal: 'all' },
  },
  {
    id: 'editorial', label: 'Editorial Serif', blurb: 'Large serif italics that rise out of blur',
    style: { name: 'Editorial Serif', font: 'playfair', fontAlt: 'dmserif', weight: 700, size: 8.5, italic: true, caseMode: 'none', fill: '#fff7ea', activeColor: '#ffb86b', active: 'color', activeScale: 1, strokeWidth: 0, shadowBlur: 22, shadowY: 4, shadow: 'rgba(0,0,0,0.6)', animIn: 'blur', animOut: 'fade', animMs: 380, futureOpacity: 0.45, y: 0.5, maxWidth: 0.82, emphasisScale: [1.1, 1.25, 1.45], emphasisColors: ['', '#ffb86b', '#ff7a59'], autoEmphasis: 0.3, energyScale: 0.2, dim: 0.28, vignette: 0.5 },
  },
  {
    id: 'comic-impact', label: 'Comic Impact', blurb: 'Bold comic lettering with thick outline and tilt',
    style: { name: 'Comic Impact', font: 'bangers', fontAlt: 'bangers', weight: 400, size: 9, caseMode: 'upper', tracking: 0.03, fill: '#ffffff', activeColor: '#ffe000', active: 'color', activeScale: 1.15, strokeWidth: 1.8, stroke: '#111111', shadowX: 5, shadowY: 7, shadowBlur: 0, shadow: '#111111', animIn: 'pop', animMs: 190, overshoot: 1, tilt: 6, wordRotate: 3, futureOpacity: 0.85, y: 0.72, energyScale: 0.6, autoEmphasis: 0.5, emphasisColors: ['', '#ffe000', '#ff3b30'], punch: 0.3, shake: 0.3, glitch: 0 },
  },
  {
    id: 'terminal', label: 'Terminal Decode', blurb: 'Green console text that decodes as it is spoken',
    style: { name: 'Terminal Decode', font: 'spacemono', fontAlt: 'spacemono', weight: 700, size: 5.6, caseMode: 'lower', fill: '#6dff8b', activeColor: '#d9ffe0', active: 'box', activeScale: 1, strokeWidth: 0, shadowBlur: 0, shadowY: 0, glow: 0.55, glowColor: '#1aff5a', animIn: 'decode', animMs: 260, scramble: 0.5, glitch: 0.3, glitchTrigger: 'onset', rgbSplit: 0.2, scanlines: 0.5, x: 0.12, y: 0.86, maxWidth: 0.82, reveal: 'progressive', futureOpacity: 0, emphasisFont: false, emphasisColors: ['', '#d9ffe0', '#ffffff'], autoEmphasis: 0.2, dim: 0.2, vignette: 0.5 },
  },
  {
    id: 'zine-marker', label: 'Zine Marker', blurb: 'Hand-drawn marker, mixed colours, wobbly tilt',
    style: { name: 'Zine Marker', font: 'marker', fontAlt: 'caveat', weight: 400, size: 8, caseMode: 'none', paletteMode: 'cycle', palette: ['#ffffff', '#ffec3d', '#ff8ac1', '#7df9ff'], strokeWidth: 0.9, stroke: '#101010', shadowBlur: 0, shadowY: 5, shadow: '#101010', active: 'underline', activeColor: '#ff3d6e', activeScale: 1.05, animIn: 'rise', animMs: 240, wordRotate: 5, tilt: 4, futureOpacity: 0.7, y: 0.72, emphasisColors: ['', '#ffec3d', '#ff3d6e'], autoEmphasis: 0.4, wordJitter: 0.3 },
  },
];

export function presetStyle(id: string): CaptionStyle {
  const preset = PRESETS.find((item) => item.id === id);
  return { ...BASE_STYLE, ...(preset?.style || {}) };
}

export const DEFAULT_PRESET = 'viral-pop';

export type FxFlags = { glitch: boolean; camera: boolean; wobble: boolean; scatter: boolean; legible: boolean };

export const FX_ON: FxFlags = { glitch: true, camera: true, wobble: true, scatter: true, legible: false };
export const FX_READABLE: FxFlags = { glitch: false, camera: false, wobble: false, scatter: false, legible: true };

export function fxIsReadable(fx: FxFlags) {
  return !fx.glitch && !fx.camera && !fx.wobble && !fx.scatter;
}

/** Per-effect kill switches layered on top of any preset, so captions can always be made plainly readable. */
export function applyFx(style: CaptionStyle, fx: FxFlags): CaptionStyle {
  if (fx.glitch && fx.camera && fx.wobble && fx.scatter && !fx.legible) return style;
  const next = { ...style };
  if (!fx.glitch) {
    Object.assign(next, { glitch: 0, rgbSplit: 0, slices: 0, jitter: 0, scanlines: 0, flicker: 0, scramble: 0, emphasisGlitch: 0 });
    if (next.animIn === 'glitch' || next.animIn === 'decode') next.animIn = 'fade';
    if (next.animOut === 'glitch') next.animOut = 'fade';
  }
  if (!fx.camera) Object.assign(next, { punch: 0, shake: 0, chromaVideo: 0 });
  if (!fx.wobble) Object.assign(next, { tilt: 0, wordRotate: 0, wordJitter: 0, rotate: 0, skew: 0 });
  if (!fx.scatter && next.placement === 'scatter') next.placement = 'fixed';
  if (fx.legible) {
    next.futureOpacity = Math.max(next.futureOpacity, 0.6);
    next.pastOpacity = Math.max(next.pastOpacity, 0.85);
    next.vignette = Math.min(next.vignette, 0.3);
    next.dim = Math.max(next.dim, 0.12);
    next.energyScale = Math.min(next.energyScale, 0.5);
    next.emphasisScale = next.emphasisScale.map((value) => Math.min(value, 1.5)) as CaptionStyle['emphasisScale'];
    next.size = Math.max(next.size, 5);
    next.maxWidth = Math.min(next.maxWidth, 0.9);
    if (next.box < 0.5 && next.strokeWidth < 0.8) next.strokeWidth = 0.8;
    if (next.box < 0.5 && next.shadowBlur < 8 && next.shadowX === 0 && next.shadowY < 4) {
      next.shadowBlur = 10;
      next.shadowY = 4;
      next.shadow = 'rgba(0,0,0,0.75)';
    }
  }
  return next;
}

/** Master "chaos" dial: scales every disruptive parameter of a style without changing its look. */
export function applyChaos(style: CaptionStyle, chaos: number): CaptionStyle {
  if (Math.abs(chaos - 1) < 0.001) return style;
  const up = (value: number, max: number) => Math.min(max, value * chaos);
  return {
    ...style,
    glitch: up(style.glitch, 1.5),
    jitter: up(style.jitter, 1.6),
    flicker: up(style.flicker, 0.9),
    scramble: up(style.scramble, 1),
    rgbSplit: up(style.rgbSplit, 1.6),
    shake: up(style.shake, 1.6),
    punch: up(style.punch, 1.6),
    chromaVideo: up(style.chromaVideo, 1.2),
    wordRotate: style.wordRotate * chaos,
    tilt: style.tilt * chaos,
    wordJitter: up(style.wordJitter, 1.5),
    energyScale: up(style.energyScale, 1.6),
    autoEmphasis: Math.min(1, style.autoEmphasis * Math.max(0.15, chaos)),
    emphasisScale: style.emphasisScale.map((value) => 1 + (value - 1) * chaos) as CaptionStyle['emphasisScale'],
  };
}
