import type { CaptionWord } from './types';
import { distribute, makeWord } from './words';

export const ENV_HOP = 0.01;
export const SPEECH_RATE = 16000;

export type Region = { start: number; end: number };

/** RMS envelope (linear) with one value per ENV_HOP seconds. */
export function envelope(samples: Float32Array, rate = SPEECH_RATE, hop = ENV_HOP): Float32Array {
  const frame = Math.max(1, Math.round(rate * hop));
  const count = Math.floor(samples.length / frame);
  const out = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    let sum = 0;
    const base = i * frame;
    for (let j = 0; j < frame; j += 1) {
      const v = samples[base + j];
      sum += v * v;
    }
    out[i] = Math.sqrt(sum / frame);
  }
  return out;
}

function percentile(values: ArrayLike<number>, p: number) {
  const copy = Array.from(values).sort((a, b) => a - b);
  return copy[Math.min(copy.length - 1, Math.max(0, Math.floor(copy.length * p)))] ?? 0;
}

function toDB(value: number) {
  return 20 * Math.log10(value + 1e-5);
}

/** Voiced stretches found with a noise-floor relative hysteresis threshold. */
export function speechRegions(env: Float32Array, hop = ENV_HOP, closeGap = 0.09, minLength = 0.05): Region[] {
  if (env.length < 3) return [];
  const smooth = new Float32Array(env.length);
  for (let i = 0; i < env.length; i += 1) {
    smooth[i] = toDB(((env[i - 1] ?? env[i]) + env[i] * 2 + (env[i + 1] ?? env[i])) / 4);
  }
  const floor = percentile(smooth, 0.1);
  const peak = percentile(smooth, 0.95);
  if (peak - floor < 8) return [];
  const high = floor + Math.max(8, 0.34 * (peak - floor));
  const low = floor + Math.max(5, 0.2 * (peak - floor));
  const raw: Region[] = [];
  let start = -1;
  for (let i = 0; i < smooth.length; i += 1) {
    if (start < 0 && smooth[i] >= high) {
      start = i;
      while (start > 0 && smooth[start - 1] >= low) start -= 1;
    } else if (start >= 0 && smooth[i] < low) {
      raw.push({ start: start * hop, end: i * hop });
      start = -1;
    }
  }
  if (start >= 0) raw.push({ start: start * hop, end: env.length * hop });
  const merged: Region[] = [];
  for (const region of raw) {
    const last = merged[merged.length - 1];
    if (last && region.start - last.end < closeGap) last.end = region.end;
    else merged.push({ ...region });
  }
  return merged.filter((region) => region.end - region.start >= minLength);
}

/** Breath groups: regions separated by less than `gap` seconds merge. */
export function speechBlocks(regions: Region[], gap = 0.16): Region[] {
  const out: Region[] = [];
  for (const region of regions) {
    const last = out[out.length - 1];
    if (last && region.start - last.end < gap) last.end = region.end;
    else out.push({ ...region });
  }
  return out;
}

/** Chunk boundaries (seconds) of at most `max` seconds, cut at the quietest point near the end of each chunk. */
export function planChunks(env: Float32Array, duration: number, max = 60, hop = ENV_HOP): Region[] {
  const chunks: Region[] = [];
  let start = 0;
  while (duration - start > max + 6) {
    const from = Math.floor((start + max - 12) / hop);
    const to = Math.floor((start + max) / hop);
    let best = to;
    let bestValue = Infinity;
    for (let i = from; i < to; i += 1) {
      const window = ((env[i - 3] ?? 0) + (env[i - 2] ?? 0) + (env[i - 1] ?? 0) + (env[i] ?? 0) + (env[i + 1] ?? 0) + (env[i + 2] ?? 0) + (env[i + 3] ?? 0)) / 7;
      if (window < bestValue) {
        bestValue = window;
        best = i;
      }
    }
    chunks.push({ start, end: best * hop });
    start = best * hop;
  }
  chunks.push({ start, end: duration });
  return chunks;
}

export function chunkIsSilent(env: Float32Array, region: Region, hop = ENV_HOP) {
  let peak = 0;
  for (let i = Math.floor(region.start / hop); i < Math.min(env.length, Math.ceil(region.end / hop)); i += 1) peak = Math.max(peak, env[i]);
  return peak < 0.004;
}

export function encodeWav16(samples: Float32Array, start: number, end: number, rate = SPEECH_RATE, gain = 1): Uint8Array {
  const from = Math.max(0, Math.floor(start * rate));
  const to = Math.min(samples.length, Math.ceil(end * rate));
  const count = Math.max(0, to - from);
  const buffer = new ArrayBuffer(44 + count * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => { for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i)); };
  text(0, 'RIFF');
  view.setUint32(4, 36 + count * 2, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, count * 2, true);
  for (let i = 0; i < count; i += 1) {
    const v = Math.max(-1, Math.min(1, samples[from + i] * gain));
    view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  return new Uint8Array(buffer);
}

/** Spread a plain transcript over the detected speech so untimed text still lands on the voice. */
export function autoTime(text: string, regions: Region[], duration: number): CaptionWord[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const blocks = speechBlocks(regions, 0.3);
  if (!blocks.length || duration <= 0) {
    return distribute(tokens, 0, Math.max(duration, tokens.length * 0.35)).map((part) => ({ ...makeWord(part.text, part.start, part.end), start: part.start, end: part.end }));
  }
  const total = blocks.reduce((sum, block) => sum + block.end - block.start, 0);
  const virtual = distribute(tokens, 0, total);
  const toReal = (v: number, end: boolean) => {
    let left = v;
    for (const block of blocks) {
      const length = block.end - block.start;
      if (left < length || (end && left <= length)) return block.start + left;
      left -= length;
    }
    return blocks[blocks.length - 1].end;
  };
  return virtual.map((part) => {
    const start = toReal(part.start, false);
    const end = Math.max(start + 0.05, toReal(part.end, true));
    return { ...makeWord(part.text, start, end), start, end };
  });
}

function syllables(word: string) {
  const lower = word.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  if (!lower) return 0;
  if (/^\d+$/.test(lower)) return Math.max(1, Math.ceil(lower.length * 1.1));
  if (!/^[a-z]+$/.test(lower)) return Math.max(1, Math.round(lower.length / 2));
  const groups = lower.replace(/e$/, '').match(/[aeiouy]+/g);
  return Math.max(1, groups ? groups.length : 1);
}

function wordWeight(text: string) {
  const count = syllables(text);
  return count === 0 ? 0.4 : 0.55 + count;
}

/**
 * The model's timestamps are loose (often 0.2-0.7 s late and stretched). The word sequence is trusted,
 * the timing is not: words are assigned to the real breath groups of the audio with a monotonic DP that
 * matches how long each group lasts against how long its text takes to say, with the model's times as
 * a weak prior. Words then tile their group by spoken length and settle into the nearest energy valley.
 */
export function snapWordsToSpeech(words: CaptionWord[], regions: Region[], env: Float32Array, hop = ENV_HOP): CaptionWord[] {
  if (words.length === 0 || regions.length === 0) return words;
  const blocks = speechBlocks(regions, 0.14);
  const n = words.length;
  const m = blocks.length;
  const w = words.map((word) => wordWeight(word.text));
  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i += 1) prefix[i + 1] = prefix[i] + w[i];
  const voiced = blocks.reduce((sum, block) => sum + block.end - block.start, 0);
  const given = words.reduce((sum, word) => sum + Math.max(0.02, word.end - word.start), 0);
  const guess = given / prefix[n];
  const rate = Math.min(guess * 1.6, Math.max(guess * 0.6, (0.9 * voiced) / prefix[n]));

  const gap = words.map((word, i) => (i === 0 ? 1 : Math.max(0, word.start - words[i - 1].end)));
  const pauses = new Float64Array(n + 1);
  for (let i = 0; i < n; i += 1) pauses[i + 1] = pauses[i] + Math.max(0, gap[i] - 0.28);

  const cost = (k: number, i: number, j: number) => {
    const block = blocks[k];
    const length = block.end - block.start;
    if (i === j) return length >= 0.25 ? 1.6 * length + 0.2 : 0.15 * length;
    const expected = rate * (prefix[j] - prefix[i]) + 0.15;
    const ratio = (length - expected) / (0.45 * (length + expected) / 2 + 0.1);
    const drift = (words[i].start - block.start) / 1.2;
    const inner = 6 * (pauses[j] - pauses[i + 1]);
    const edge = j < n ? 4 * Math.max(0, 0.2 - gap[j]) : 0;
    return ratio * ratio + 0.3 * drift * drift + inner + edge;
  };

  const INF = 1e18;
  const best = Array.from({ length: m + 1 }, () => new Float64Array(n + 1).fill(INF));
  const from = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
  best[0][0] = 0;
  for (let k = 0; k < m; k += 1) {
    for (let i = 0; i <= n; i += 1) {
      const base = best[k][i];
      if (base >= INF) continue;
      for (let j = i; j <= n; j += 1) {
        const total = base + cost(k, i, j);
        if (total < best[k + 1][j]) {
          best[k + 1][j] = total;
          from[k + 1][j] = i;
        }
      }
    }
  }
  if (best[m][n] >= INF) return words;

  const out = words.map((word) => ({ ...word }));
  let j = n;
  for (let k = m; k >= 1; k -= 1) {
    const i = from[k][j];
    if (i < j) {
      const block = blocks[k - 1];
      const total = prefix[j] - prefix[i];
      let cursor = block.start;
      for (let x = i; x < j; x += 1) {
        const span = ((block.end - block.start) * w[x]) / total;
        out[x].start = cursor;
        out[x].end = cursor + span;
        cursor += span;
      }
    }
    j = i;
  }

  let moved = 0;
  for (let x = 0; x < n; x += 1) moved += Math.abs(out[x].start - words[x].start);
  if (moved / n > 1.6) return words;

  for (let x = 1; x < n; x += 1) {
    const a = out[x - 1];
    const b = out[x];
    if (b.start - a.end > 0.12) continue;
    const boundary = (a.end + b.start) / 2;
    const lo = Math.max(a.start + 0.05, boundary - 0.07);
    const hi = Math.min(b.end - 0.05, boundary + 0.07);
    if (hi <= lo) continue;
    let pick = boundary;
    let low = Infinity;
    for (let t = lo; t <= hi; t += hop) {
      const v = env[Math.round(t / hop)] ?? low;
      if (v < low - 1e-6) {
        low = v;
        pick = t;
      }
    }
    const around = Math.max(env[Math.round(lo / hop)] ?? 0, env[Math.round(hi / hop)] ?? 0);
    if (low < around * 0.7) {
      a.end = pick;
      b.start = pick;
    }
  }
  for (let x = 0; x < n; x += 1) {
    const prev = out[x - 1];
    if (prev && out[x].start < prev.end) prev.end = Math.max(prev.start + 0.03, out[x].start);
    if (out[x].end < out[x].start + 0.03) out[x].end = out[x].start + 0.03;
  }
  return out;
}

/** Boost quiet chunks so recognition has something to hear; loud ones are untouched. */
export function chunkGain(samples: Float32Array, start: number, end: number, rate = SPEECH_RATE) {
  let peak = 0;
  for (let i = Math.floor(start * rate); i < Math.min(samples.length, Math.ceil(end * rate)); i += 1) peak = Math.max(peak, Math.abs(samples[i]));
  return peak > 0.0005 && peak < 0.5 ? Math.min(8, 0.9 / peak) : 1;
}

/** Snap a long transcript in windows so the assignment stays fast on hour-long files. */
export function snapWordsChunked(words: CaptionWord[], regions: Region[], env: Float32Array, hop = ENV_HOP, maxWords = 180): CaptionWord[] {
  if (words.length <= maxWords) return snapWordsToSpeech(words, regions, env, hop);
  const out: CaptionWord[] = [];
  let at = 0;
  while (at < words.length) {
    let end = Math.min(words.length, at + maxWords);
    if (end < words.length) {
      let bestGap = -1;
      for (let i = end - 1; i > end - 40 && i > at; i -= 1) {
        const gap = words[i].start - words[i - 1].end;
        if (gap > bestGap) {
          bestGap = gap;
          end = i;
        }
      }
    }
    const part = words.slice(at, end);
    const t0 = Math.max(0, part[0].start - 1);
    const t1 = part[part.length - 1].end + 1;
    const local = part.map((word) => ({ ...word, start: word.start - t0, end: word.end - t0 }));
    const localEnv = env.subarray(Math.floor(t0 / hop), Math.ceil(t1 / hop));
    const localRegions = regions
      .filter((region) => region.end > t0 && region.start < t1)
      .map((region) => ({ start: Math.max(region.start, t0) - t0, end: Math.min(region.end, t1) - t0 }));
    for (const word of snapWordsToSpeech(local, localRegions, localEnv, hop)) out.push({ ...word, start: word.start + t0, end: word.end + t0 });
    at = end;
  }
  return out;
}
