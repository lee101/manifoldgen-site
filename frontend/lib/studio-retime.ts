export const RETIME_MIN_SPEED = 0.1;
export const RETIME_MAX_SPEED = 8;
export const RETIME_HEAVY_MAX_SECONDS = 60;
export const RETIME_SPEED_PRESETS = [-1, 0.25, 0.5, 1, 2, 4] as const;

export type RetimeOptions = { speed: number; stabilize: boolean; smooth: boolean };

export function parseSpeed(value: string): number | null {
  const cleaned = value.trim().toLowerCase().replace(/[x×]$/, '').trim();
  if (!/^-?\d*\.?\d+$/.test(cleaned)) return null;
  const speed = Number(cleaned);
  const rate = Math.abs(speed);
  if (!Number.isFinite(speed) || rate < RETIME_MIN_SPEED || rate > RETIME_MAX_SPEED) return null;
  return speed;
}

export function speedLabel(speed: number) {
  const rate = Math.abs(speed);
  const text = `${Number.isInteger(rate) ? rate : Number(rate.toFixed(2))}×`;
  return speed < 0 ? `Reverse ${text}` : text;
}

export function retimedDuration(clipSeconds: number, speed: number) {
  return clipSeconds / Math.abs(speed || 1);
}

export function retimeBlocker(options: RetimeOptions, clipSeconds: number, kind: 'video' | 'audio' | 'image'): string {
  if (kind === 'image') return 'Images have no motion to retime';
  if (options.speed === 1 && !options.stabilize) return 'Choose a speed, reverse, or stabilize';
  const rate = Math.abs(options.speed);
  if (rate < RETIME_MIN_SPEED || rate > RETIME_MAX_SPEED) return `Speed must be ${RETIME_MIN_SPEED}× to ${RETIME_MAX_SPEED}×`;
  const heavy = kind === 'video' && (options.speed < 0 || options.stabilize || (options.smooth && rate < 1));
  if (heavy && clipSeconds > RETIME_HEAVY_MAX_SECONDS) return `Reverse, stabilize and smooth slow motion work on clips up to ${RETIME_HEAVY_MAX_SECONDS}s. Split the clip first`;
  if (kind === 'video' && options.smooth && rate < 1 && clipSeconds / rate > RETIME_HEAVY_MAX_SECONDS) return `Smooth slow motion is limited to ${RETIME_HEAVY_MAX_SECONDS}s of output. Trim the clip or use a faster speed`;
  return '';
}
