import { MOTION_PRICING, type MotionService } from './production-tools';

export type { MotionService };

export const MOTION_SERVICES = Object.keys(MOTION_PRICING) as MotionService[];

export const MOTION_PALETTES = ['gold-blue', 'fire', 'neon', 'ice'] as const;
export type MotionPalette = (typeof MOTION_PALETTES)[number];

export const MOTION_ASPECTS = ['9:16', '4:5', '1:1', '16:9'] as const;
export type MotionAspect = (typeof MOTION_ASPECTS)[number];

export const MOTION_INTENSITY = { min: 0.3, max: 1.6, step: 0.1, default: 1 } as const;
export const MOTION_MAX_NAMES = 4;
export const MOTION_MAX_NAME_LENGTH = 16;
export const MOTION_MAX_SEED = 1 << 30;

export type MotionPreset = { id: string; label: string; blurb: string };

export const STUDIO_MOTION_PRESETS: readonly MotionPreset[] = [
  { id: 'anime-fight', label: 'Anime fight', blurb: 'Aura, trails, comic hits, slow-mo' },
  { id: 'ki-aura', label: 'Power aura', blurb: 'Flames and lightning that follow effort' },
  { id: 'lightning', label: 'Lightning', blurb: 'Electric arcs and shockwaves' },
  { id: 'neon-trails', label: 'Neon trails', blurb: 'Glowing skeleton on a dim scene' },
  { id: 'game-hud', label: 'Fighting HUD', blurb: 'Health bars, combo counter, FIGHT!' },
  { id: 'spotlight', label: 'Spotlight', blurb: 'Light up the most active fighter' },
  { id: 'slowmo-impacts', label: 'Impact slow-mo', blurb: 'Ramp into every big hit' },
  { id: 'exaggerate', label: 'Exaggerate', blurb: 'Whip, smear and overshoot the motion' },
  { id: 'echo', label: 'Echo', blurb: 'Afterimage ghosts trailing each move' },
];

export const DEFAULT_MOTION_PRESET = STUDIO_MOTION_PRESETS[0].id;

export type MotionOptions = {
  preset: string;
  intensity: number;
  palette: string;
  aspect?: string;
  slowmo?: boolean;
  sfx?: boolean;
  text?: boolean;
  names: string;
  seed?: number;
  keepAudio?: boolean;
};

export const DEFAULT_MOTION_OPTIONS: MotionOptions = {
  preset: DEFAULT_MOTION_PRESET,
  intensity: MOTION_INTENSITY.default,
  palette: '',
  names: '',
};

export type MotionAssetLike = {
  kind: string;
  name: string;
  trimStart: number;
  trimEnd: number;
  duration?: number;
  cloudURL?: string;
};

export type MotionWindow = {
  seconds: number;
  truncated: boolean;
  clipSeconds: number;
  offsetStart: boolean;
};

export type MotionRequest = {
  service: MotionService;
  video_url: string;
  duration: number;
  audio_url?: string;
  params: Record<string, unknown>;
};

export type MotionResult = {
  videoURL: string;
  posterURL: string;
  bpm: number;
  seconds: number;
  tracks: number;
  events: number;
  preset: string;
};

const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));

export function parseMotionNames(raw: string): string[] {
  return raw
    .split(',')
    .map((part) => part.trim().slice(0, MOTION_MAX_NAME_LENGTH))
    .filter(Boolean)
    .slice(0, MOTION_MAX_NAMES);
}

/** The service reads the file from its start, so a clip trimmed to [a, b] needs seconds [0, b] processed. */
export function motionWindow(asset: Pick<MotionAssetLike, 'trimStart' | 'trimEnd'>, service: MotionService): MotionWindow {
  const cap = MOTION_PRICING[service].max;
  const start = Math.max(0, asset.trimStart);
  const clipSeconds = Math.max(0, asset.trimEnd - start);
  const wanted = Math.max(1, Math.ceil(start > 0 ? asset.trimEnd : clipSeconds));
  return { seconds: Math.min(cap, wanted), truncated: wanted > cap, clipSeconds, offsetStart: start > 0 };
}

export const motionRule = (service: MotionService) => MOTION_PRICING[service];

export function quoteMotion(service: MotionService, seconds: number): number {
  const rule = MOTION_PRICING[service];
  const billed = Math.ceil(clamp(seconds > 0 ? seconds : 1, 0, rule.max));
  return Math.round(Math.max(rule.min, rule.rate * billed) * 100) / 100;
}

export function formatUSD(value: number) {
  return `$${value.toFixed(2)}`;
}

export function motionBlocker(asset: MotionAssetLike | undefined, ctx: { signedIn: boolean; streaming?: boolean }): string {
  if (!asset || asset.kind !== 'video') return 'Select a video clip first.';
  if (!ctx.signedIn) return 'Sign in to use Motion FX.';
  if (ctx.streaming) return 'This clip is still downloading. Try again in a moment.';
  if (asset.trimEnd - asset.trimStart <= 0) return 'This clip has no visible duration.';
  return '';
}

export function motionParams(service: MotionService, options: MotionOptions): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  const intensity = Number.isFinite(options.intensity) ? clamp(options.intensity, MOTION_INTENSITY.min, MOTION_INTENSITY.max) : MOTION_INTENSITY.default;
  const palette = (MOTION_PALETTES as readonly string[]).includes(options.palette) ? options.palette : '';
  const seed = options.seed !== undefined && Number.isFinite(options.seed) ? clamp(Math.floor(options.seed), 0, MOTION_MAX_SEED) : undefined;
  if (service === 'motion-fx') {
    params.preset = STUDIO_MOTION_PRESETS.some((preset) => preset.id === options.preset) ? options.preset : DEFAULT_MOTION_PRESET;
    params.intensity = Math.round(intensity * 100) / 100;
    if (palette) params.palette = palette;
    if ((MOTION_ASPECTS as readonly string[]).includes(options.aspect ?? '')) params.aspect = options.aspect;
    for (const key of ['slowmo', 'sfx', 'text'] as const) if (typeof options[key] === 'boolean') params[key] = options[key];
    const names = parseMotionNames(options.names);
    if (names.length) params.names = names;
    if (seed !== undefined) params.seed = seed;
  } else if (service === 'beat-drop') {
    params.intensity = Math.round(intensity * 100) / 100;
    if (palette) params.palette = palette;
    if (seed !== undefined) params.seed = seed;
  } else if (service === 'motion-score' && typeof options.keepAudio === 'boolean') {
    params.keep_audio = options.keepAudio;
  }
  return params;
}

export function buildMotionRequest(
  asset: Pick<MotionAssetLike, 'trimStart' | 'trimEnd'>,
  videoURL: string,
  service: MotionService,
  options: MotionOptions,
  audioURL = '',
): MotionRequest {
  const request: MotionRequest = {
    service,
    video_url: videoURL,
    duration: motionWindow(asset, service).seconds,
    params: motionParams(service, options),
  };
  if (audioURL) request.audio_url = audioURL;
  return request;
}

const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
const str = (value: unknown) => (typeof value === 'string' ? value : '');

export function parseMotionResult(raw: unknown): MotionResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const nested = data.result && typeof data.result === 'object' ? (data.result as Record<string, unknown>) : data;
  const videoURL = str(nested.video_url);
  if (!videoURL) return null;
  return {
    videoURL,
    posterURL: str(nested.poster_url),
    bpm: num(nested.bpm),
    seconds: num(nested.seconds),
    tracks: num(nested.tracks_count),
    events: num(nested.events_count),
    preset: str(nested.preset),
  };
}

export function motionOutputName(sourceName: string, service: MotionService, preset: string) {
  const stem = sourceName.replace(/\.[^.]+$/, '') || 'clip';
  const label = service === 'motion-fx' ? preset || 'motion-fx' : service;
  return `${stem}-${label.replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}.mp4`;
}

export function motionSummary(result: MotionResult) {
  const parts: string[] = [];
  if (result.tracks) parts.push(`${result.tracks} ${result.tracks === 1 ? 'fighter' : 'fighters'} tracked`);
  if (result.events) parts.push(`${result.events} hits`);
  if (result.bpm >= 60) parts.push(`${Math.round(result.bpm)} BPM`);
  return parts.length ? `Motion FX added to Media · ${parts.join(' · ')}` : 'Motion FX added to Media';
}

export type JobPayload = { job?: { status?: string; result?: unknown; error?: string } };

const FAILED_STATUSES = new Set(['failed', 'payment_required', 'cancelled', 'canceled']);

/** Polls a video-job status endpoint until it completes; returns the job result or throws the job error. */
export async function pollJob(
  fetchJob: () => Promise<JobPayload>,
  options: { label: string; maxAttempts?: number; intervalMs?: number; sleep?: (ms: number) => Promise<void>; onStatus?: (status: string) => void },
): Promise<unknown> {
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  for (let attempt = 0; attempt < (options.maxAttempts ?? 1440); attempt += 1) {
    await sleep(options.intervalMs ?? 2500);
    const payload = await fetchJob();
    const status = payload.job?.status?.toLowerCase() || '';
    if (FAILED_STATUSES.has(status)) throw new Error(payload.job?.error || `${options.label} failed`);
    if (status === 'completed') return payload.job?.result;
    options.onStatus?.(status);
  }
  throw new Error(`${options.label} is still running and remains available in your account.`);
}
