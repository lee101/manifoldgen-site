export type StudioBlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'add' | 'difference';
export type StudioCrop = { left: number; top: number; right: number; bottom: number };
export type StudioTransitionType = 'crossfade' | 'dip' | 'wipe-left' | 'wipe-right' | 'wipe-up' | 'wipe-down';
export type StudioTransition = { type: StudioTransitionType; duration: number };

export const BLEND_MODES: { id: StudioBlendMode; label: string; canvas: GlobalCompositeOperation; css: string }[] = [
  { id: 'normal', label: 'Normal', canvas: 'source-over', css: 'normal' },
  { id: 'multiply', label: 'Multiply', canvas: 'multiply', css: 'multiply' },
  { id: 'screen', label: 'Screen', canvas: 'screen', css: 'screen' },
  { id: 'overlay', label: 'Overlay', canvas: 'overlay', css: 'overlay' },
  { id: 'add', label: 'Add', canvas: 'lighter', css: 'plus-lighter' },
  { id: 'difference', label: 'Difference', canvas: 'difference', css: 'difference' },
];

export const TRANSITIONS: { id: StudioTransitionType; label: string }[] = [
  { id: 'crossfade', label: 'Crossfade' },
  { id: 'dip', label: 'Dip to black' },
  { id: 'wipe-left', label: 'Wipe left' },
  { id: 'wipe-right', label: 'Wipe right' },
  { id: 'wipe-up', label: 'Wipe up' },
  { id: 'wipe-down', label: 'Wipe down' },
];

export const NO_CROP: StudioCrop = { left: 0, top: 0, right: 0, bottom: 0 };

export function blendMode(id: StudioBlendMode | undefined) {
  return BLEND_MODES.find((mode) => mode.id === id) || BLEND_MODES[0];
}

export function normalizeCrop(crop: Partial<StudioCrop> | undefined): StudioCrop {
  const value = (key: keyof StudioCrop) => Math.max(0, Math.min(0.95, Number(crop?.[key]) || 0));
  const next = { left: value('left'), top: value('top'), right: value('right'), bottom: value('bottom') };
  if (next.left + next.right > 0.95) next.right = Math.max(0, 0.95 - next.left);
  if (next.top + next.bottom > 0.95) next.bottom = Math.max(0, 0.95 - next.top);
  return next;
}

export function normalizeTransition(value: Partial<StudioTransition> | undefined): StudioTransition | undefined {
  if (!value || !TRANSITIONS.some((item) => item.id === value.type)) return undefined;
  const duration = Number(value.duration);
  return { type: value.type as StudioTransitionType, duration: Number.isFinite(duration) ? Math.max(0.1, Math.min(5, duration)) : 1 };
}

export type CompositeClip = {
  id: string;
  kind: 'video' | 'image' | 'audio';
  timelineStart: number;
  trimStart: number;
  trimEnd: number;
  visualTrack: number;
  transition?: StudioTransition;
};

const EPSILON = 0.02;
const clipLength = (clip: CompositeClip) => Math.max(0, clip.trimEnd - clip.trimStart);
const clipStop = (clip: CompositeClip) => clip.timelineStart + clipLength(clip);

export function previousAdjacent<T extends CompositeClip>(clip: T, clips: T[]) {
  return clips.find((other) => other.id !== clip.id && other.kind !== 'audio' && other.visualTrack === clip.visualTrack && Math.abs(clipStop(other) - clip.timelineStart) < EPSILON) || null;
}

export function nextAdjacent<T extends CompositeClip>(clip: T, clips: T[]) {
  return clips.find((other) => other.id !== clip.id && other.kind !== 'audio' && other.visualTrack === clip.visualTrack && Math.abs(other.timelineStart - clipStop(clip)) < EPSILON) || null;
}

function transitionDuration(clip: CompositeClip, outgoing: CompositeClip | null) {
  if (!clip.transition) return 0;
  const limit = outgoing ? Math.min(clipLength(clip), clipLength(outgoing)) : clipLength(clip);
  return Math.max(0, Math.min(clip.transition.duration, limit));
}

export function clipWindow<T extends CompositeClip>(clip: T, clips: T[]) {
  const previous = previousAdjacent(clip, clips);
  const next = nextAdjacent(clip, clips);
  const incoming = previous ? transitionDuration(clip, previous) / 2 : 0;
  const outgoing = next?.transition ? transitionDuration(next, clip) / 2 : 0;
  return { start: clip.timelineStart - incoming, end: clipStop(clip) + outgoing, handleIn: incoming, handleOut: outgoing };
}

export type TransitionState = { alpha: number; wipe?: { type: StudioTransitionType; progress: number } };

export function transitionState<T extends CompositeClip>(clip: T, clips: T[], time: number): TransitionState | null {
  const window = clipWindow(clip, clips);
  if (time < window.start || time >= window.end) return null;
  let alpha = 1;
  let wipe: TransitionState['wipe'];
  if (clip.transition) {
    const previous = previousAdjacent(clip, clips);
    const duration = transitionDuration(clip, previous);
    const start = previous ? clip.timelineStart - duration / 2 : clip.timelineStart;
    if (duration > 0 && time < start + duration) {
      const progress = Math.max(0, Math.min(1, (time - start) / duration));
      if (clip.transition.type === 'crossfade') alpha = progress;
      else if (clip.transition.type === 'dip') alpha = previous ? Math.max(0, progress * 2 - 1) : progress;
      else wipe = { type: clip.transition.type, progress };
    }
  }
  const next = nextAdjacent(clip, clips);
  if (next?.transition?.type === 'dip') {
    const duration = transitionDuration(next, clip);
    const start = next.timelineStart - duration / 2;
    if (duration > 0 && time >= start) alpha = Math.min(alpha, Math.max(0, 1 - (time - start) / duration * 2));
  }
  return alpha <= 0 ? null : { alpha, wipe };
}

export function wipeRect(type: StudioTransitionType, progress: number, width: number, height: number) {
  if (type === 'wipe-left') return { x: width * (1 - progress), y: 0, width: width * progress, height };
  if (type === 'wipe-up') return { x: 0, y: height * (1 - progress), width, height: height * progress };
  if (type === 'wipe-down') return { x: 0, y: 0, width, height: height * progress };
  return { x: 0, y: 0, width: width * progress, height };
}

export function wipeInsets(type: StudioTransitionType, progress: number): StudioCrop {
  const hidden = 1 - Math.max(0, Math.min(1, progress));
  if (type === 'wipe-left') return { ...NO_CROP, left: hidden };
  if (type === 'wipe-up') return { ...NO_CROP, top: hidden };
  if (type === 'wipe-down') return { ...NO_CROP, bottom: hidden };
  return { ...NO_CROP, right: hidden };
}

export function compositeClipPath(crop: StudioCrop | undefined, wipe?: { type: StudioTransitionType; progress: number }) {
  if (!wipe) return cropClipPath(crop);
  const reveal = wipeInsets(wipe.type, wipe.progress);
  const base = crop || NO_CROP;
  return cropClipPath({ left: Math.max(base.left, reveal.left), top: Math.max(base.top, reveal.top), right: Math.max(base.right, reveal.right), bottom: Math.max(base.bottom, reveal.bottom) }) || 'inset(0 0 0 0)';
}

export function cropClipPath(crop: StudioCrop | undefined) {
  if (!crop || (!crop.left && !crop.top && !crop.right && !crop.bottom)) return undefined;
  return `inset(${(crop.top * 100).toFixed(2)}% ${(crop.right * 100).toFixed(2)}% ${(crop.bottom * 100).toFixed(2)}% ${(crop.left * 100).toFixed(2)}%)`;
}
