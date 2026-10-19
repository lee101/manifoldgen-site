import type { FontKey } from './types';

export type FontInfo = { key: FontKey; label: string; css: string; weights: number[]; italic: boolean; note: string };

export const FONTS: FontInfo[] = [
  { key: 'anton', label: 'Anton', css: 'Anton', weights: [400], italic: false, note: 'Tall condensed impact' },
  { key: 'bebas', label: 'Bebas Neue', css: 'Bebas Neue', weights: [400], italic: false, note: 'Clean condensed caps' },
  { key: 'archivo', label: 'Archivo Black', css: 'Archivo Black', weights: [400], italic: false, note: 'Heavy grotesque' },
  { key: 'montserrat', label: 'Montserrat', css: 'Montserrat', weights: [300, 400, 500, 600, 700, 800, 900], italic: true, note: 'Geometric, all weights' },
  { key: 'poppins', label: 'Poppins', css: 'Poppins', weights: [400, 500, 600, 700, 800, 900], italic: true, note: 'Round geometric' },
  { key: 'oswald', label: 'Oswald', css: 'Oswald', weights: [300, 400, 500, 600, 700], italic: false, note: 'Gothic condensed' },
  { key: 'russo', label: 'Russo One', css: 'Russo One', weights: [400], italic: false, note: 'Wide techno block' },
  { key: 'bangers', label: 'Bangers', css: 'Bangers', weights: [400], italic: false, note: 'Comic shout' },
  { key: 'marker', label: 'Permanent Marker', css: 'Permanent Marker', weights: [400], italic: false, note: 'Hand marker' },
  { key: 'pixel', label: 'Press Start 2P', css: 'Press Start 2P', weights: [400], italic: false, note: '8-bit pixel' },
  { key: 'vt323', label: 'VT323', css: 'VT323', weights: [400], italic: false, note: 'Terminal CRT' },
  { key: 'orbitron', label: 'Orbitron', css: 'Orbitron', weights: [400, 500, 600, 700, 800, 900], italic: false, note: 'Sci-fi display' },
  { key: 'spacemono', label: 'Space Mono', css: 'Space Mono', weights: [400, 700], italic: true, note: 'Quirky monospace' },
  { key: 'syne', label: 'Syne', css: 'Syne', weights: [400, 500, 600, 700, 800], italic: false, note: 'Art-gallery extended' },
  { key: 'playfair', label: 'Playfair Display', css: 'Playfair Display', weights: [400, 500, 600, 700, 800, 900], italic: true, note: 'High-contrast serif' },
  { key: 'dmserif', label: 'DM Serif Display', css: 'DM Serif Display', weights: [400], italic: true, note: 'Editorial serif' },
  { key: 'unbounded', label: 'Unbounded', css: 'Unbounded', weights: [300, 400, 500, 600, 700, 800, 900], italic: false, note: 'Wide rounded display' },
  { key: 'rubikglitch', label: 'Rubik Glitch', css: 'Rubik Glitch', weights: [400], italic: false, note: 'Built-in glitch cuts' },
  { key: 'bungee', label: 'Bungee', css: 'Bungee', weights: [400], italic: false, note: 'Signage caps' },
  { key: 'inter', label: 'Inter', css: 'Inter', weights: [300, 400, 500, 600, 700, 800, 900], italic: true, note: 'Neutral UI sans' },
  { key: 'caveat', label: 'Caveat Brush', css: 'Caveat Brush', weights: [400], italic: false, note: 'Brush script' },
];

const resolved: Partial<Record<FontKey, string>> = {};

/** The font module registers the hashed next/font family names so canvas and CSS agree. */
export function registerFamilies(map: Partial<Record<FontKey, string>>) {
  Object.assign(resolved, map);
}

export function fontInfo(key: FontKey): FontInfo {
  return FONTS.find((font) => font.key === key) || FONTS[0];
}

export function familyCSS(key: FontKey): string {
  const info = fontInfo(key);
  const family = resolved[key];
  const first = family ? family.split(',')[0].trim() : `"${info.css}"`;
  const mono = key === 'vt323' || key === 'spacemono' || key === 'pixel';
  return `${first}, ${mono ? 'ui-monospace, monospace' : 'system-ui, sans-serif'}`;
}

export function nearestWeight(key: FontKey, weight: number): number {
  const weights = fontInfo(key).weights;
  return weights.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), weights[0]);
}

export function fontShorthand(key: FontKey, weight: number, italic: boolean, px: number): string {
  const info = fontInfo(key);
  return `${italic && info.italic ? 'italic ' : ''}${nearestWeight(key, weight)} ${Math.max(1, px).toFixed(2)}px ${familyCSS(key)}`;
}

export async function ensureFonts(keys: FontKey[], sample = 'Abc 123 ÀÉ'): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const jobs: Promise<unknown>[] = [];
  for (const key of new Set(keys)) {
    const info = fontInfo(key);
    for (const weight of info.weights.filter((w, i, all) => info.weights.length < 4 || i === 0 || i === all.length - 1 || w === 700 || w === 900)) {
      jobs.push(document.fonts.load(`${weight} 48px ${familyCSS(key)}`, sample).catch(() => []));
      if (info.italic) jobs.push(document.fonts.load(`italic ${weight} 48px ${familyCSS(key)}`, sample).catch(() => []));
    }
  }
  await Promise.all(jobs);
}
