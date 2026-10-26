import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { MOTION_PRICING, productionPriceUSD } from '../lib/production-tools';
import {
  DEFAULT_MOTION_OPTIONS, MOTION_ASPECTS, MOTION_PALETTES, MOTION_SERVICES, STUDIO_MOTION_PRESETS,
  buildMotionRequest, formatUSD, motionBlocker, motionOutputName, motionParams, motionSummary, motionWindow,
  parseMotionNames, parseMotionResult, pollJob, quoteMotion, type JobPayload, type MotionOptions,
} from '../lib/studio-motion';

const ROOT = resolve(import.meta.dir, '../..');
const goSource = readFileSync(join(ROOT, 'server/prodkit_motion.go'), 'utf8');
const goList = (name: string) => {
  const match = goSource.match(new RegExp(`var ${name} = \\[\\]string\\{([^}]*)\\}`));
  return match ? [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]) : [];
};

const clip = (trimStart: number, trimEnd: number) => ({ trimStart, trimEnd });
const options = (patch: Partial<MotionOptions> = {}): MotionOptions => ({ ...DEFAULT_MOTION_OPTIONS, ...patch });

describe('studio motion presets', () => {
  test('stay in sync with the server enums', () => {
    const server = goList('prodkitMotionPresets');
    expect(server.length).toBeGreaterThan(0);
    const ids = STUDIO_MOTION_PRESETS.map((preset) => preset.id);
    for (const id of server) expect(ids).toContain(id);
    for (const id of ids) expect(server.includes(id)).toBe(true);
    expect([...MOTION_PALETTES]).toEqual(goList('prodkitMotionPalettes'));
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('include the exaggerate and echo looks', () => {
    const ids = STUDIO_MOTION_PRESETS.map((preset) => preset.id);
    expect(ids).toEqual(['anime-fight', 'ki-aura', 'lightning', 'neon-trails', 'game-hud', 'spotlight', 'slowmo-impacts', 'exaggerate', 'echo']);
    for (const id of ['exaggerate', 'echo']) expect(motionParams('motion-fx', options({ preset: id })).preset).toBe(id);
  });

  test('every preset has a label and blurb', () => {
    for (const preset of STUDIO_MOTION_PRESETS) {
      expect(preset.label.length).toBeGreaterThan(2);
      expect(preset.blurb.length).toBeGreaterThan(8);
    }
  });
});

describe('studio motion names', () => {
  test('trims, drops blanks, caps count and length', () => {
    expect(parseMotionNames('  Sensei , Rival,, ')).toEqual(['Sensei', 'Rival']);
    expect(parseMotionNames('a,b,c,d,e,f')).toEqual(['a', 'b', 'c', 'd']);
    expect(parseMotionNames('x'.repeat(40))).toEqual(['x'.repeat(16)]);
    expect(parseMotionNames('')).toEqual([]);
  });
});

describe('studio motion window and price', () => {
  test('whole clip rounds up and caps per service', () => {
    expect(motionWindow(clip(0, 4.2), 'motion-fx')).toEqual({ seconds: 5, truncated: false, clipSeconds: 4.2, offsetStart: false });
    expect(motionWindow(clip(0, 0.2), 'motion-fx').seconds).toBe(1);
    const long = motionWindow(clip(0, 45), 'motion-fx');
    expect(long).toMatchObject({ seconds: 20, truncated: true });
    expect(motionWindow(clip(0, 45), 'beat-drop').seconds).toBe(30);
    expect(motionWindow(clip(0, 200), 'motion-track').seconds).toBe(60);
  });

  test('a trimmed start is processed from the file start', () => {
    expect(motionWindow(clip(3, 7.5), 'motion-fx')).toEqual({ seconds: 8, truncated: false, clipSeconds: 4.5, offsetStart: true });
    expect(motionWindow(clip(18, 25), 'motion-fx')).toMatchObject({ seconds: 20, truncated: true, offsetStart: true });
    expect(motionWindow(clip(-1, 2), 'motion-fx')).toMatchObject({ seconds: 2, offsetStart: false });
  });

  test('quote is rate x ceil(seconds) with a minimum and cap', () => {
    expect(quoteMotion('motion-fx', 2)).toBe(0.15);
    expect(quoteMotion('motion-fx', 5)).toBe(0.3);
    expect(quoteMotion('motion-fx', 4.2)).toBe(0.3);
    expect(quoteMotion('motion-fx', 99)).toBe(1.2);
    expect(quoteMotion('beat-drop', 1)).toBe(0.1);
    expect(quoteMotion('beat-drop', 10)).toBe(0.4);
    expect(quoteMotion('motion-track', 60)).toBe(1.2);
    expect(quoteMotion('motion-score', 3)).toBe(0.2);
    expect(quoteMotion('motion-score', 30)).toBe(1.5);
    expect(quoteMotion('motion-fx', 0)).toBe(0.15);
    expect(formatUSD(0.3)).toBe('$0.30');
  });

  test('quote matches the shared production price table', () => {
    for (const service of MOTION_SERVICES) {
      for (const seconds of [1, 3, 7.5, 20, 100]) {
        expect(quoteMotion(service, seconds)).toBe(productionPriceUSD({ service, duration: seconds, params: {} }));
      }
    }
    expect(MOTION_SERVICES.sort()).toEqual(Object.keys(MOTION_PRICING).sort());
  });
});

describe('studio motion blockers', () => {
  const video = { kind: 'video', name: 'a.mp4', trimStart: 0, trimEnd: 4 };
  test('each guard fires in order', () => {
    expect(motionBlocker(undefined, { signedIn: true })).toContain('Select a video');
    expect(motionBlocker({ ...video, kind: 'image' }, { signedIn: true })).toContain('Select a video');
    expect(motionBlocker({ ...video, kind: 'audio' }, { signedIn: true })).toContain('Select a video');
    expect(motionBlocker(video, { signedIn: false })).toContain('Sign in');
    expect(motionBlocker(video, { signedIn: true, streaming: true })).toContain('still downloading');
    expect(motionBlocker({ ...video, trimEnd: 0 }, { signedIn: true })).toContain('no visible duration');
    expect(motionBlocker(video, { signedIn: true })).toBe('');
  });
});

describe('studio motion params', () => {
  test('motion-fx whitelists and clamps', () => {
    const params = motionParams('motion-fx', options({
      preset: 'lightning', intensity: 9, palette: 'neon', slowmo: false, sfx: true, text: true, names: 'A, B', seed: 12.9,
    }));
    expect(params).toEqual({ preset: 'lightning', intensity: 1.6, palette: 'neon', slowmo: false, sfx: true, text: true, names: ['A', 'B'], seed: 12 });
  });

  test('aspect is only sent when it is one of the four reframes', () => {
    expect([...MOTION_ASPECTS]).toEqual(['9:16', '4:5', '1:1', '16:9']);
    for (const aspect of MOTION_ASPECTS) expect(motionParams('motion-fx', options({ aspect })).aspect).toBe(aspect);
    for (const aspect of [undefined, '', '2:1', 'auto']) expect(motionParams('motion-fx', options({ aspect }))).not.toHaveProperty('aspect');
    expect(motionParams('beat-drop', options({ aspect: '9:16' }))).not.toHaveProperty('aspect');
    expect(motionParams('motion-score', options({ aspect: '9:16', keepAudio: false }))).toEqual({ keep_audio: false });
  });

  test('motion-fx falls back for unknown preset, palette and non-finite numbers', () => {
    const params = motionParams('motion-fx', options({ preset: 'bogus', palette: 'rainbow', intensity: Number.NaN, seed: Number.NaN }));
    expect(params).toEqual({ preset: 'anime-fight', intensity: 1 });
    expect(motionParams('motion-fx', options({ intensity: 0.01 })).intensity).toBe(0.3);
    expect(motionParams('motion-fx', options({ seed: -5 })).seed).toBe(0);
  });

  test('other services only keep their own params', () => {
    expect(motionParams('beat-drop', options({ preset: 'lightning', palette: 'ice', seed: 3, names: 'x', slowmo: true }))).toEqual({ intensity: 1, palette: 'ice', seed: 3 });
    expect(motionParams('beat-drop', options())).toEqual({ intensity: 1 });
    expect(motionParams('motion-track', options({ preset: 'x', keepAudio: true }))).toEqual({});
    expect(motionParams('motion-score', options({ keepAudio: true }))).toEqual({ keep_audio: true });
    expect(motionParams('motion-score', options())).toEqual({});
  });

  test('every emitted key is accepted by the server allowlists', () => {
    const goTools = readFileSync(join(ROOT, 'server/prodkit.go'), 'utf8');
    const full = options({ preset: 'anime-fight', palette: 'fire', aspect: '9:16', slowmo: true, sfx: true, text: true, names: 'A', seed: 1, keepAudio: true });
    for (const service of MOTION_SERVICES) {
      const line = goTools.split('\n').findIndex((row) => row.includes(`"${service}", `) && row.includes('"motion"'));
      const allow = goTools.split('\n')[line + 1] || '';
      for (const key of Object.keys(motionParams(service, full))) expect(allow).toContain(`"${key}"`);
    }
  });
});

describe('studio motion request', () => {
  test('top-level duration and optional audio', () => {
    const request = buildMotionRequest(clip(0, 6.4), 'https://cdn.example/a.mp4', 'motion-fx', options({ preset: 'ki-aura' }));
    expect(request).toEqual({ service: 'motion-fx', video_url: 'https://cdn.example/a.mp4', duration: 7, params: { preset: 'ki-aura', intensity: 1 } });
    expect('audio_url' in request).toBe(false);
    const beat = buildMotionRequest(clip(0, 40), 'https://cdn.example/a.mp4', 'beat-drop', options(), 'https://cdn.example/song.mp3');
    expect(beat).toMatchObject({ service: 'beat-drop', duration: 30, audio_url: 'https://cdn.example/song.mp3' });
  });
});

describe('studio motion results', () => {
  test('parses flat and nested payloads', () => {
    const flat = { video_url: 'https://x/o.mp4', poster_url: 'https://x/p.jpg', bpm: 84.7, seconds: 9.1, tracks_count: 2, events_count: 7, preset: 'anime-fight' };
    expect(parseMotionResult(flat)).toEqual({ videoURL: 'https://x/o.mp4', posterURL: 'https://x/p.jpg', bpm: 84.7, seconds: 9.1, tracks: 2, events: 7, preset: 'anime-fight' });
    expect(parseMotionResult({ result: flat })?.videoURL).toBe('https://x/o.mp4');
    expect(parseMotionResult({ video_url: 'https://x/o.mp4', bpm: 'fast' })).toMatchObject({ bpm: 0, posterURL: '', tracks: 0 });
  });

  test('rejects payloads without a video', () => {
    expect(parseMotionResult(null)).toBeNull();
    expect(parseMotionResult('x')).toBeNull();
    expect(parseMotionResult({})).toBeNull();
    expect(parseMotionResult({ result: { poster_url: 'p' } })).toBeNull();
  });

  test('names outputs and summarises', () => {
    expect(motionOutputName('Fight Scene.mov', 'motion-fx', 'ki-aura')).toBe('Fight Scene-ki-aura.mp4');
    expect(motionOutputName('clip.mp4', 'motion-fx', '')).toBe('clip-motion-fx.mp4');
    expect(motionOutputName('', 'beat-drop', '')).toBe('clip-beat-drop.mp4');
    const base = { videoURL: 'v', posterURL: '', bpm: 0, seconds: 5, tracks: 0, events: 0, preset: '' };
    expect(motionSummary(base)).toBe('Motion FX added to Media');
    expect(motionSummary({ ...base, tracks: 1, events: 3, bpm: 84.7 })).toBe('Motion FX added to Media · 1 fighter tracked · 3 hits · 85 BPM');
    expect(motionSummary({ ...base, tracks: 2, bpm: 40 })).toBe('Motion FX added to Media · 2 fighters tracked');
  });
});

describe('pollJob', () => {
  const instant = async () => {};
  const sequence = (...statuses: JobPayload[]) => {
    let index = 0;
    return async () => statuses[Math.min(index++, statuses.length - 1)];
  };

  test('returns the result when the job completes and reports progress', async () => {
    const seen: string[] = [];
    const result = await pollJob(sequence({ job: { status: 'queued' } }, { job: { status: 'Processing' } }, { job: { status: 'completed', result: { video_url: 'v' } } }),
      { label: 'Motion FX', sleep: instant, onStatus: (status) => seen.push(status) });
    expect(result).toEqual({ video_url: 'v' });
    expect(seen).toEqual(['queued', 'processing']);
  });

  test('throws the job error or a label fallback on failure states', async () => {
    for (const status of ['failed', 'payment_required', 'cancelled', 'canceled']) {
      await expect(pollJob(sequence({ job: { status, error: 'no people found' } }), { label: 'Motion FX', sleep: instant })).rejects.toThrow('no people found');
      await expect(pollJob(sequence({ job: { status } }), { label: 'Motion FX', sleep: instant })).rejects.toThrow('Motion FX failed');
    }
  });

  test('gives up after maxAttempts and tolerates empty payloads', async () => {
    let calls = 0;
    await expect(pollJob(async () => { calls += 1; return {}; }, { label: 'Motion FX', sleep: instant, maxAttempts: 3 })).rejects.toThrow('still running');
    expect(calls).toBe(3);
  });

  test('sleeps the configured interval before every poll', async () => {
    const waits: number[] = [];
    await pollJob(sequence({ job: { status: 'queued' } }, { job: { status: 'completed' } }), { label: 'x', intervalMs: 123, sleep: async (ms) => { waits.push(ms); } });
    expect(waits).toEqual([123, 123]);
  });

  test('uses the real timer by default', async () => {
    const result = await pollJob(sequence({ job: { status: 'completed', result: 1 } }), { label: 'x', intervalMs: 1 });
    expect(result).toBe(1);
  });
});
