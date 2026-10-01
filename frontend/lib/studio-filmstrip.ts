export const FILMSTRIP_FRAME_WIDTH = 96;
export const FILMSTRIP_FRAME_HEIGHT = 54;
const MAX_FRAMES = 48;

export type FilmstripGrid = { count: number; step: number };

export function filmstripGrid(duration: number): FilmstripGrid {
  const safe = Number.isFinite(duration) && duration > 0 ? duration : 1;
  const count = Math.max(1, Math.min(MAX_FRAMES, Math.ceil(safe / 0.5)));
  return { count, step: safe / count };
}

export function filmstripFrameIndex(grid: FilmstripGrid, sourceTime: number) {
  return Math.max(0, Math.min(grid.count - 1, Math.floor(sourceTime / grid.step)));
}

export function filmstripTiles(trimStart: number, clipSeconds: number, pixelsPerSecond: number, tileWidth: number) {
  const width = Math.max(1, clipSeconds * pixelsPerSecond);
  const count = Math.max(1, Math.ceil(width / tileWidth));
  return Array.from({ length: count }, (_, index) => trimStart + Math.min(clipSeconds, (index + 0.5) * tileWidth / pixelsPerSecond));
}

type Entry = { frames: Map<number, string>; listeners: Set<() => void>; started: boolean };

const entries = new Map<string, Entry>();
let queue: Promise<void> = Promise.resolve();

function entryFor(key: string) {
  let entry = entries.get(key);
  if (!entry) {
    entry = { frames: new Map(), listeners: new Set(), started: false };
    entries.set(key, entry);
  }
  return entry;
}

export function filmstripFrame(key: string, index: number) {
  return entries.get(key)?.frames.get(index);
}

export function subscribeFilmstrip(key: string, listener: () => void) {
  const entry = entryFor(key);
  entry.listeners.add(listener);
  return () => { entry.listeners.delete(listener); };
}

export function dropFilmstrip(key: string) {
  entries.delete(key);
}

function seekTo(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('seek timed out')), 8000);
    video.onseeked = () => { window.clearTimeout(timer); resolve(); };
    video.onerror = () => { window.clearTimeout(timer); reject(new Error('video error')); };
    video.currentTime = time;
  });
}

async function generate(key: string, url: string, grid: FilmstripGrid) {
  const entry = entryFor(key);
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  video.src = url;
  const canvas = document.createElement('canvas');
  canvas.width = FILMSTRIP_FRAME_WIDTH;
  canvas.height = FILMSTRIP_FRAME_HEIGHT;
  const context = canvas.getContext('2d');
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('metadata timed out')), 15000);
      video.onloadeddata = () => { window.clearTimeout(timer); resolve(); };
      video.onerror = () => { window.clearTimeout(timer); reject(new Error('video error')); };
    });
    if (!context) return;
    const order = Array.from({ length: grid.count }, (_, index) => index);
    // Coarse-to-fine so the strip is usable after the first few frames.
    order.sort((a, b) => (a % 4 === 0 ? 0 : a % 2 === 0 ? 1 : 2) - (b % 4 === 0 ? 0 : b % 2 === 0 ? 1 : 2) || a - b);
    for (const index of order) {
      if (!entries.has(key)) return;
      const time = Math.min(Math.max(0, video.duration - 0.05), (index + 0.5) * grid.step);
      await seekTo(video, time);
      const sourceRatio = video.videoWidth / Math.max(1, video.videoHeight);
      const targetRatio = FILMSTRIP_FRAME_WIDTH / FILMSTRIP_FRAME_HEIGHT;
      const drawWidth = sourceRatio > targetRatio ? FILMSTRIP_FRAME_HEIGHT * sourceRatio : FILMSTRIP_FRAME_WIDTH;
      const drawHeight = sourceRatio > targetRatio ? FILMSTRIP_FRAME_HEIGHT : FILMSTRIP_FRAME_WIDTH / sourceRatio;
      context.drawImage(video, (FILMSTRIP_FRAME_WIDTH - drawWidth) / 2, (FILMSTRIP_FRAME_HEIGHT - drawHeight) / 2, drawWidth, drawHeight);
      entry.frames.set(index, canvas.toDataURL('image/jpeg', 0.6));
      entry.listeners.forEach((listener) => listener());
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    }
  } catch {
    entry.started = false;
  } finally {
    video.removeAttribute('src');
    video.load();
  }
}

export function ensureFilmstrip(key: string, url: string, duration: number) {
  const entry = entryFor(key);
  if (entry.started) return;
  entry.started = true;
  const grid = filmstripGrid(duration);
  queue = queue.then(() => generate(key, url, grid)).catch(() => undefined);
}
