import type { CaptionPage, CaptionStyle, CaptionWord, Emphasis, Grouping } from './types';

let counter = 0;
export function wordID() {
  counter += 1;
  return `w${Date.now().toString(36)}${counter.toString(36)}`;
}

export function makeWord(text: string, start: number, end: number, energy = 0.5): CaptionWord {
  return { id: wordID(), text, start, end, energy, emphasis: 'auto' };
}

export const DEFAULT_GROUPING: Grouping = { mode: 'words', wordsPerPage: 3, maxChars: 28, pauseBreak: 0.65, respectPunctuation: true };

const STOP = new Set(['a', 'an', 'the', 'to', 'of', 'in', 'on', 'at', 'is', 'it', 'and', 'or', 'but', 'so', 'as', 'if', 'for', 'be', 'are', 'was', 'were', 'i', 'im', 'you', 'we', 'he', 'she', 'they', 'that', 'this', 'with', 'my', 'your', 'me', 'do', 'its', 'just', 'um', 'uh']);

export function plainKey(text: string) {
  return text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]+/gu, '');
}

function weight(text: string) {
  const letters = plainKey(text).length;
  let value = Math.max(1, letters) + (letters ? 0.5 : 0);
  if (/[.!?]$/.test(text)) value += 1.2;
  else if (/[,;:—-]$/.test(text)) value += 0.6;
  return value;
}

export function splitTokens(text: string) {
  return text.split(/\s+/).map((part) => part.trim()).filter(Boolean);
}

/** Spread tokens across [t0, t1] proportionally to their spoken length. */
export function distribute(tokens: string[], t0: number, t1: number, minEach = 0.05): { text: string; start: number; end: number }[] {
  if (!tokens.length) return [];
  const total = tokens.reduce((sum, token) => sum + weight(token), 0);
  const span = Math.max(minEach * tokens.length, t1 - t0);
  let cursor = t0;
  return tokens.map((text) => {
    const share = (span * weight(text)) / total;
    const out = { text, start: cursor, end: cursor + share };
    cursor += share;
    return out;
  });
}

export function sortWords(words: CaptionWord[]) {
  return [...words].sort((a, b) => a.start - b.start || a.end - b.end);
}

export function wordsToText(words: CaptionWord[]) {
  return words.map((word) => word.text).join(' ');
}

export function setWordText(words: CaptionWord[], index: number, value: string): CaptionWord[] {
  const tokens = splitTokens(value);
  const word = words[index];
  if (!word) return words;
  if (tokens.length === 0) return words;
  if (tokens.length === 1) return words.map((item, i) => (i === index ? { ...item, text: tokens[0] } : item));
  const parts = distribute(tokens, word.start, word.end);
  const replacement = parts.map((part, i) => ({ ...word, id: i === 0 ? word.id : wordID(), text: part.text, start: part.start, end: part.end, breakBefore: i === 0 ? word.breakBefore : false }));
  return [...words.slice(0, index), ...replacement, ...words.slice(index + 1)];
}

export function mergeWithPrevious(words: CaptionWord[], index: number): CaptionWord[] {
  if (index <= 0 || index >= words.length) return words;
  const prev = words[index - 1];
  const word = words[index];
  const merged = { ...prev, text: prev.text + word.text, end: word.end, energy: Math.max(prev.energy, word.energy) };
  return [...words.slice(0, index - 1), merged, ...words.slice(index + 1)];
}

export function deleteWord(words: CaptionWord[], index: number): CaptionWord[] {
  return words.filter((_, i) => i !== index);
}

export function insertWordAfter(words: CaptionWord[], index: number, text = 'word'): CaptionWord[] {
  const prev = words[index];
  const next = words[index + 1];
  const start = prev ? prev.end : 0;
  const end = next ? Math.max(start + 0.12, Math.min(next.start, start + 0.5)) : start + 0.4;
  const word = makeWord(text, start, end, prev?.energy ?? 0.5);
  return [...words.slice(0, index + 1), word, ...words.slice(index + 1)];
}

export function splitWordAt(words: CaptionWord[], index: number, time: number): CaptionWord[] {
  const word = words[index];
  if (!word || time <= word.start + 0.03 || time >= word.end - 0.03) return words;
  const chars = [...word.text];
  const cut = Math.max(1, Math.min(chars.length - 1, Math.round(chars.length * ((time - word.start) / (word.end - word.start)))));
  if (chars.length < 2) return words;
  const left = { ...word, text: chars.slice(0, cut).join(''), end: time };
  const right = { ...word, id: wordID(), text: chars.slice(cut).join(''), start: time, breakBefore: false };
  return [...words.slice(0, index), left, right, ...words.slice(index + 1)];
}

/** Move one boundary of a word; a touching neighbour follows so edits ripple through connected speech. */
export function moveEdge(words: CaptionWord[], index: number, edge: 'start' | 'end', value: number, minLength = 0.04): CaptionWord[] {
  const next = words.map((word) => ({ ...word }));
  const word = next[index];
  if (!word) return words;
  const prev = next[index - 1];
  const after = next[index + 1];
  if (edge === 'start') {
    const floor = prev ? prev.start + minLength : 0;
    const start = Math.max(floor, Math.min(value, word.end - minLength));
    if (prev && Math.abs(prev.end - word.start) < 0.06) prev.end = start;
    else if (prev && prev.end > start) prev.end = start;
    word.start = start;
  } else {
    const ceiling = after ? after.end - minLength : Infinity;
    const end = Math.min(ceiling, Math.max(value, word.start + minLength));
    if (after && Math.abs(after.start - word.end) < 0.06) after.start = end;
    else if (after && after.start < end) after.start = end;
    word.end = end;
  }
  return next;
}

export function shiftWord(words: CaptionWord[], index: number, delta: number): CaptionWord[] {
  const word = words[index];
  if (!word) return words;
  const prev = words[index - 1];
  const after = words[index + 1];
  let amount = delta;
  if (prev) amount = Math.max(amount, prev.start + 0.04 - word.start);
  if (after) amount = Math.min(amount, after.end - 0.04 - word.end);
  amount = Math.max(amount, -word.start);
  if (amount === 0) return words;
  return words.map((item, i) => {
    if (i === index) return { ...item, start: item.start + amount, end: item.end + amount };
    if (i === index - 1 && item.end > word.start + amount) return { ...item, end: word.start + amount };
    if (i === index + 1 && item.start < word.end + amount) return { ...item, start: word.end + amount };
    return item;
  });
}

type Match = { oldIndex: number; newIndex: number };

function lcs(a: string[], b: string[]): Match[] {
  const n = a.length;
  const m = b.length;
  const table = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[i][j] = a[i] && a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const out: Match[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] && a[i] === b[j]) {
      out.push({ oldIndex: i, newIndex: j });
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) i += 1;
    else j += 1;
  }
  return out;
}

/** Apply an edited full transcript while keeping the timing of every word that survived the edit. */
export function realignText(old: CaptionWord[], text: string): CaptionWord[] {
  const tokens = splitTokens(text);
  if (!tokens.length) return [];
  if (!old.length) return tokens.map((token, i) => makeWord(token, i * 0.35, i * 0.35 + 0.3));
  const matches = lcs(old.map((word) => plainKey(word.text)), tokens.map(plainKey));
  const duration = old[old.length - 1].end;
  const out: CaptionWord[] = [];
  const anchors = [{ oldIndex: -1, newIndex: -1 }, ...matches, { oldIndex: old.length, newIndex: tokens.length }];
  for (let k = 0; k < anchors.length - 1; k += 1) {
    const a = anchors[k];
    const b = anchors[k + 1];
    const gapNew = tokens.slice(a.newIndex + 1, b.newIndex);
    if (gapNew.length) {
      const gapOld = old.slice(a.oldIndex + 1, b.oldIndex);
      const before = old[a.oldIndex];
      const after = old[b.oldIndex];
      let t0 = gapOld.length ? gapOld[0].start : before ? before.end : 0;
      let t1 = gapOld.length ? gapOld[gapOld.length - 1].end : after ? after.start : duration;
      if (t1 - t0 < 0.1 * gapNew.length) {
        const need = 0.12 * gapNew.length;
        t1 = t0 + need;
        if (after && t1 > after.start) {
          t1 = after.start;
          t0 = Math.max(before ? before.end : 0, t1 - need);
        }
      }
      const energy = gapOld.length ? gapOld.reduce((s, w) => s + w.energy, 0) / gapOld.length : ((before?.energy ?? 0.5) + (after?.energy ?? 0.5)) / 2;
      const pool = gapOld.length === gapNew.length ? gapOld : null;
      distribute(gapNew, t0, t1, 0.01).forEach((part, i) => {
        const source = pool?.[i];
        out.push(source ? { ...source, text: part.text } : { ...makeWord(part.text, part.start, part.end, energy), start: part.start, end: part.end });
      });
    }
    if (b.oldIndex < old.length) out.push({ ...old[b.oldIndex], text: tokens[b.newIndex] });
  }
  return out;
}

function formatTime(seconds: number, comma: boolean) {
  const total = Math.max(0, seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const ms = Math.min(999, Math.round((total - Math.floor(total)) * 1000));
  const pad = (n: number, width = 2) => String(n).padStart(width, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}${comma ? ',' : '.'}${pad(ms, 3)}`;
}

export function toSRT(pages: CaptionPage[], words: CaptionWord[]) {
  return pages.map((page, i) => `${i + 1}\n${formatTime(page.start, true)} --> ${formatTime(Math.max(page.end, page.start + 0.2), true)}\n${page.words.map((w) => words[w].text).join(' ')}\n`).join('\n');
}

export function toVTT(pages: CaptionPage[], words: CaptionWord[]) {
  return `WEBVTT\n\n${pages.map((page) => `${formatTime(page.start, false)} --> ${formatTime(Math.max(page.end, page.start + 0.2), false)}\n${page.words.map((w) => words[w].text).join(' ')}\n`).join('\n')}`;
}

function parseClock(value: string) {
  const match = value.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?$/);
  if (!match) return NaN;
  const frac = match[4] ? Number(match[4].padEnd(3, '0')) / 1000 : 0;
  return Number(match[1] || 0) * 3600 + Number(match[2]) * 60 + Number(match[3]) + frac;
}

/** Parse SRT or WebVTT cues into words, splitting each cue's time by spoken length. */
export function parseSubtitles(text: string): CaptionWord[] {
  const out: CaptionWord[] = [];
  const blocks = text.replace(/\r/g, '').split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    const at = lines.findIndex((line) => line.includes('-->'));
    if (at < 0) continue;
    const [from, to] = lines[at].split('-->').map((part) => part.trim().split(/\s+/)[0]);
    const start = parseClock(from);
    const end = parseClock(to);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    const body = lines.slice(at + 1).join(' ').replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '');
    distribute(splitTokens(body), start, end).forEach((part) => out.push(makeWord(part.text, part.start, part.end)));
  }
  return out;
}

export function buildPages(words: CaptionWord[], grouping: Grouping, offset = 0, duration = Infinity): CaptionPage[] {
  const pages: CaptionPage[] = [];
  let current: number[] = [];
  const flush = () => {
    if (!current.length) return;
    const first = words[current[0]];
    const last = words[current[current.length - 1]];
    pages.push({ index: pages.length, start: first.start + offset, end: last.end + offset, show: first.start + offset, hide: last.end + offset, words: current });
    current = [];
  };
  let chars = 0;
  for (let i = 0; i < words.length; i += 1) {
    const word = words[i];
    if (word.hidden) continue;
    const prevIndex = current[current.length - 1];
    const prev = prevIndex === undefined ? null : words[prevIndex];
    let split = false;
    if (prev) {
      const gap = word.start - prev.end;
      const strong = /[.!?…]["')\]]?$/.test(prev.text);
      const soft = /[,;:—]["')\]]?$/.test(prev.text);
      if (word.breakBefore || gap >= grouping.pauseBreak) split = true;
      else if (grouping.mode === 'word') split = true;
      else if (grouping.mode === 'words') split = current.length >= grouping.wordsPerPage || (grouping.respectPunctuation && strong) || chars + word.text.length + 1 > grouping.maxChars;
      else split = (grouping.respectPunctuation && (strong || (soft && chars > grouping.maxChars * 0.45))) || chars + word.text.length + 1 > grouping.maxChars;
    }
    if (split) {
      flush();
      chars = 0;
    }
    current.push(i);
    chars += word.text.length + 1;
  }
  flush();
  for (let i = 0; i < pages.length; i += 1) {
    const page = pages[i];
    const next = pages[i + 1];
    const gap = next ? next.show - page.end : Infinity;
    page.hide = next && gap < 0.45 ? next.show : Math.min(page.end + 0.35, next ? next.show : duration + 1);
  }
  return pages;
}

export function pageAt(pages: CaptionPage[], t: number): CaptionPage | null {
  let lo = 0;
  let hi = pages.length - 1;
  let found: CaptionPage | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (pages[mid].show <= t) {
      found = pages[mid];
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found && t < found.hide ? found : null;
}

/** Energy-aware emphasis levels (0-3). Explicit per-word choices win over the automatic ranking. */
export function resolveEmphasis(words: CaptionWord[], style: Pick<CaptionStyle, 'autoEmphasis'>): number[] {
  const scores = words.map((word) => {
    const key = plainKey(word.text);
    let score = word.energy;
    if (/!/.test(word.text)) score += 0.28;
    if (/\?/.test(word.text)) score += 0.1;
    if (word.text.length > 1 && word.text === word.text.toUpperCase() && /\p{L}/u.test(word.text)) score += 0.3;
    if (STOP.has(key)) score -= 0.4;
    if (key.length >= 7) score += 0.08;
    return score;
  });
  const order = scores.map((score, i) => ({ score, i })).sort((a, b) => a.score - b.score);
  const rank = new Array<number>(words.length).fill(0);
  order.forEach((item, position) => { rank[item.i] = words.length > 1 ? position / (words.length - 1) : 1; });
  const a = Math.max(0, Math.min(1, style.autoEmphasis));
  return words.map((word, i) => {
    const forced: Emphasis = word.emphasis;
    if (forced !== 'auto') return forced;
    if (a === 0) return 0;
    const r = rank[i];
    if (r > 1 - a * 0.05) return 3;
    if (r > 1 - a * 0.18) return 2;
    if (r > 1 - a * 0.5) return 1;
    return 0;
  });
}

export function applyEnergy(words: CaptionWord[], envelope: Float32Array, hop: number): CaptionWord[] {
  if (!envelope.length) return words;
  const peaks = words.map((word) => {
    const a = Math.max(0, Math.floor(word.start / hop));
    const b = Math.min(envelope.length - 1, Math.max(a, Math.ceil(word.end / hop)));
    let sum = 0;
    let top = 0;
    for (let i = a; i <= b; i += 1) {
      sum += envelope[i];
      top = Math.max(top, envelope[i]);
    }
    return 0.5 * top + 0.5 * (sum / (b - a + 1));
  });
  const sorted = [...peaks].sort((x, y) => x - y);
  const low = sorted[Math.floor(sorted.length * 0.05)] ?? 0;
  const high = sorted[Math.floor(sorted.length * 0.95)] ?? 1;
  const span = Math.max(1e-6, high - low);
  return words.map((word, i) => ({ ...word, energy: Math.max(0, Math.min(1, (peaks[i] - low) / span)) }));
}
