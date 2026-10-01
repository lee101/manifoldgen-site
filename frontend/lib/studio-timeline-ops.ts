export type TimelineClip = {
  id: string;
  kind: 'video' | 'image' | 'audio';
  timelineStart: number;
  trimStart: number;
  trimEnd: number;
};

const EPSILON = 0.001;

const length = (clip: Pick<TimelineClip, 'trimStart' | 'trimEnd'>) => Math.max(0, clip.trimEnd - clip.trimStart);
const end = (clip: TimelineClip) => clip.timelineStart + length(clip);
const group = (kind: TimelineClip['kind']) => (kind === 'audio' ? 'audio' : 'visual');

function mergeSpans(spans: Array<{ start: number; end: number }>) {
  const sorted = [...spans].sort((left, right) => left.start - right.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const span of sorted) {
    const last = merged.at(-1);
    if (last && span.start <= last.end + EPSILON) last.end = Math.max(last.end, span.end);
    else merged.push({ ...span });
  }
  return merged;
}

/**
 * Remove clips and close the hole they leave: every remaining clip of the same
 * group (visual lanes together, audio separately) that starts at or after a
 * removed span moves left by that span's length. Music keeps its place when
 * only pictures are rippled, and vice versa.
 */
export function rippleRemove<T extends TimelineClip>(clips: T[], removeIDs: Iterable<string>): T[] {
  const ids = new Set(removeIDs);
  const removed = clips.filter((clip) => ids.has(clip.id));
  const remaining = clips.filter((clip) => !ids.has(clip.id));
  const spansByGroup = new Map<string, Array<{ start: number; end: number }>>();
  for (const clip of removed) {
    const key = group(clip.kind);
    spansByGroup.set(key, [...(spansByGroup.get(key) || []), { start: clip.timelineStart, end: end(clip) }]);
  }
  const merged = new Map([...spansByGroup].map(([key, spans]) => [key, mergeSpans(spans)]));
  return remaining.map((clip) => {
    const spans = merged.get(group(clip.kind));
    if (!spans) return clip;
    let shift = 0;
    for (const span of spans) {
      if (clip.timelineStart >= span.end - EPSILON) shift += span.end - span.start;
    }
    return shift > EPSILON ? { ...clip, timelineStart: Math.max(0, clip.timelineStart - shift) } : clip;
  });
}

/** Nearest clip boundary strictly before/after `time`, or null when none exists. */
export function adjacentEdge(clips: TimelineClip[], time: number, direction: -1 | 1): number | null {
  let best: number | null = null;
  for (const clip of clips) {
    for (const edge of [clip.timelineStart, end(clip)]) {
      if (direction === 1 && edge > time + EPSILON && (best === null || edge < best)) best = edge;
      if (direction === -1 && edge < time - EPSILON && (best === null || edge > best)) best = edge;
    }
  }
  return best;
}

export const MIN_TIMELINE_ZOOM = 0.05;
export const MAX_TIMELINE_ZOOM = 2.5;
export const BASE_PIXELS_PER_SECOND = 64;

/** Zoom factor at which `duration` seconds fill `viewportWidth` px with a small margin. */
export function fitZoom(duration: number, viewportWidth: number) {
  if (!(duration > 0) || !(viewportWidth > 0)) return 1;
  const zoom = (viewportWidth * 0.94) / (duration * BASE_PIXELS_PER_SECOND);
  return Math.max(MIN_TIMELINE_ZOOM, Math.min(MAX_TIMELINE_ZOOM, Number(zoom.toFixed(3))));
}
