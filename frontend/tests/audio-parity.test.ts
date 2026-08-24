// Proves the browser port in lib/audio-understanding.ts and the Go port in
// server/audio_understanding.go agree. Both analyse the exact same mono PCM,
// so any divergence is a real algorithm difference rather than a decode
// difference. Run with: bun test tests/audio-parity.test.ts
//
// The fixtures are produced by the Go test itself (AUDIO_PARITY_DIR), so this
// exercises the shipping Go code path rather than a hand-written expectation.

import { describe, expect, test, beforeAll } from 'bun:test';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import {
  analyzeAudioSamples,
  beatGrid,
  snapToBeat,
  defaultAudioAnalysisOptions,
  type AudioAnalysis,
} from '../lib/audio-understanding';

const FIXTURE_DIR = join(import.meta.dir, 'fixtures');
const PCM_PATH = join(FIXTURE_DIR, 'robotrun.f32le');
const GO_JSON_PATH = join(FIXTURE_DIR, 'robotrun.go.json');
const SERVER_DIR = resolve(import.meta.dir, '../../server');
const SOURCE_VIDEO = '/vfast/data/code/vids/robotrun.mp4';

/** Regenerates both fixtures by running the Go test that writes them. */
async function ensureFixtures(): Promise<boolean> {
  if (existsSync(PCM_PATH) && existsSync(GO_JSON_PATH)) return true;
  if (!existsSync(SOURCE_VIDEO)) return false;
  const proc = Bun.spawn(['go', 'test', '-run', 'TestAnalyzeRobotRunVideo', '.'], {
    cwd: SERVER_DIR,
    env: { ...process.env, AUDIO_PARITY_DIR: FIXTURE_DIR },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  await proc.exited;
  return existsSync(PCM_PATH) && existsSync(GO_JSON_PATH);
}

async function loadPCM(): Promise<Float64Array> {
  const buf = await readFile(PCM_PATH);
  const f32 = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
  const out = new Float64Array(f32.length);
  for (let i = 0; i < f32.length; i += 1) out[i] = f32[i];
  return out;
}

let available = false;
let pcm: Float64Array;
let goResult: AudioAnalysis;
let tsResult: AudioAnalysis;

beforeAll(async () => {
  available = await ensureFixtures();
  if (!available) return;
  pcm = await loadPCM();
  goResult = JSON.parse(await readFile(GO_JSON_PATH, 'utf8')) as AudioAnalysis;
  tsResult = analyzeAudioSamples(pcm, { includeSeries: true });
});

describe('Go/TypeScript audio-understanding parity', () => {
  test('fixtures are available', () => {
    // Fails loudly rather than silently passing if the pipeline broke.
    expect(available).toBe(true);
  });

  test('agrees on duration', () => {
    if (!available) return;
    expect(tsResult.duration).toBeCloseTo(goResult.duration, 6);
  });

  test('agrees on tempo', () => {
    if (!available) return;
    expect(tsResult.tempo).toBeCloseTo(goResult.tempo, 6);
  });

  test('detects exactly the same onsets', () => {
    if (!available) return;
    expect(tsResult.onset_times.length).toBe(goResult.onset_times.length);
    tsResult.onset_times.forEach((t, i) => {
      expect(t).toBeCloseTo(goResult.onset_times[i], 9);
    });
  });

  test('tracks exactly the same beats', () => {
    if (!available) return;
    expect(tsResult.beat_times.length).toBe(goResult.beat_times.length);
    tsResult.beat_times.forEach((t, i) => {
      expect(t).toBeCloseTo(goResult.beat_times[i], 9);
    });
  });

  test('produces a usable cut grid for the dramatizer', () => {
    if (!available) return;
    const grid = beatGrid(tsResult, 0.8);
    expect(grid.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < grid.length; i += 1) {
      expect(grid[i] - grid[i - 1]).toBeGreaterThanOrEqual(0.8);
    }
    for (const t of grid) {
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(tsResult.duration + 0.1);
    }
  });
});

describe('audio-understanding algorithm', () => {
  // Same synthetic ground truth the Go test uses.
  function clickTrack(sr: number, bpm: number, seconds: number): Float64Array {
    const n = Math.floor(sr * seconds);
    const y = new Float64Array(n);
    const period = 60 / bpm;
    for (let beat = 0; ; beat += 1) {
      const start = Math.floor(beat * period * sr);
      if (start >= n) break;
      const burst = Math.floor(0.04 * sr);
      for (let i = 0; i < burst && start + i < n; i += 1) {
        const t = i / sr;
        y[start + i] += Math.sin(2 * Math.PI * 1000 * t) * Math.exp(-40 * t);
      }
    }
    return y;
  }

  test('finds clicks at a known tempo', () => {
    const opts = defaultAudioAnalysisOptions();
    const result = analyzeAudioSamples(clickTrack(opts.sampleRate, 120, 8), { startBPM: 120 });

    // The click at t=0 is unreachable: onset strength is a first-order
    // difference, so frame 0 has no predecessor to rise above.
    const expected: number[] = [];
    for (let t = 0.5; t < 8; t += 0.5) expected.push(t);
    expect(result.onset_times.length).toBe(expected.length);

    const hop = opts.hopLength / opts.sampleRate;
    expected.forEach((want, i) => {
      expect(Math.abs(result.onset_times[i] - want)).toBeLessThanOrEqual(hop);
    });
    expect(Math.abs(result.tempo - 120)).toBeLessThan(3);
  });

  test('finds no onsets in silence', () => {
    const result = analyzeAudioSamples(new Float64Array(AUDIO_SR * 3));
    expect(result.onset_times.length).toBe(0);
  });

  test('snapToBeat prefers the nearest cut inside the tolerance', () => {
    const a = { beat_times: [1.0, 2.0], onset_times: [1.88] } as AudioAnalysis;
    expect(snapToBeat(a, 1.9, 0.2)).toBeCloseTo(1.88, 9);
    // Nothing within tolerance leaves the time untouched.
    expect(snapToBeat(a, 5.0, 0.2)).toBeCloseTo(5.0, 9);
  });
});

const AUDIO_SR = 22050;
