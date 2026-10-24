import { describe, expect, test } from 'bun:test';
import { autoTime, chunkIsSilent, encodeWav16, envelope, planChunks, snapWordsToSpeech, speechRegions } from '../lib/captions/dsp';
import { FX_ON, FX_READABLE, applyFx, fxIsReadable, presetStyle } from '../lib/captions/styles';
import type { CaptionWord } from '../lib/captions/types';
import { DEFAULT_GROUPING, applyEnergy, buildPages, deleteWord, makeWord, mergeWithPrevious, moveEdge, pageAt, parseSubtitles, realignText, resolveEmphasis, setWordText, splitWordAt, toBilingualSRT, toSRT, toVTT, wordsToText } from '../lib/captions/words';

function words(text: string, step = 0.4): CaptionWord[] {
  return text.split(' ').map((t, i) => makeWord(t, i * step, i * step + step * 0.9, 0.5));
}

function tone(rate: number, segments: [number, number][], seconds: number) {
  const out = new Float32Array(Math.floor(rate * seconds));
  for (const [a, b] of segments) {
    for (let i = Math.floor(a * rate); i < Math.min(out.length, Math.floor(b * rate)); i += 1) out[i] = 0.4 * Math.sin((2 * Math.PI * 220 * i) / rate) * (0.7 + 0.3 * Math.sin(i / 900));
  }
  return out;
}

describe('captions words', () => {
  test('setWordText splits a word and times the parts inside the old span', () => {
    const list = words('hello world');
    const next = setWordText(list, 0, 'hel lo');
    expect(wordsToText(next)).toBe('hel lo world');
    expect(next[0].start).toBe(list[0].start);
    expect(next[1].end).toBeCloseTo(list[0].end, 6);
    expect(next[0].end).toBeCloseTo(next[1].start, 6);
  });

  test('merge and delete', () => {
    const list = words('foo bar baz');
    expect(wordsToText(mergeWithPrevious(list, 1))).toBe('foobar baz');
    expect(mergeWithPrevious(list, 1)[0].end).toBe(list[1].end);
    expect(wordsToText(deleteWord(list, 1))).toBe('foo baz');
  });

  test('splitWordAt cuts the text by time', () => {
    const list = [makeWord('abcdef', 0, 1)];
    const next = splitWordAt(list, 0, 0.5);
    expect(next.map((w) => w.text)).toEqual(['abc', 'def']);
    expect(next[0].end).toBe(0.5);
    expect(next[1].start).toBe(0.5);
  });

  test('moveEdge ripples a touching neighbour and respects minimum length', () => {
    const list = [makeWord('a', 0, 1), makeWord('b', 1, 2), makeWord('c', 2.5, 3)];
    const moved = moveEdge(list, 0, 'end', 1.4);
    expect(moved[0].end).toBe(1.4);
    expect(moved[1].start).toBe(1.4);
    const clamped = moveEdge(list, 0, 'end', 5);
    expect(clamped[1].end - clamped[1].start).toBeGreaterThanOrEqual(0.04 - 1e-9);
  });

  test('realignText keeps timings of unchanged words and times inserted words between anchors', () => {
    const list = words('the quick brown fox');
    const next = realignText(list, 'the very quick brown fox jumps');
    expect(wordsToText(next)).toBe('the very quick brown fox jumps');
    const quick = next.find((w) => w.text === 'quick')!;
    expect(quick.start).toBeCloseTo(list[1].start, 6);
    const very = next.find((w) => w.text === 'very')!;
    expect(very.start).toBeGreaterThanOrEqual(list[0].end - 1e-6);
    expect(very.end).toBeLessThanOrEqual(quick.start + 1e-6);
    for (let i = 1; i < next.length; i += 1) expect(next[i].start).toBeGreaterThanOrEqual(next[i - 1].start - 1e-6);
  });

  test('realignText applies edits that only change case and punctuation in place', () => {
    const list = words('hello there friend');
    const next = realignText(list, 'Hello, there Friend!');
    expect(next.map((w) => w.id)).toEqual(list.map((w) => w.id));
    expect(wordsToText(next)).toBe('Hello, there Friend!');
  });

  test('subtitle round trip', () => {
    const list = words('one two three four', 0.5);
    const pages = buildPages(list, { ...DEFAULT_GROUPING, mode: 'words', wordsPerPage: 2 });
    const srt = toSRT(pages, list);
    expect(srt).toContain('00:00:00,000 --> 00:00:00,950');
    const parsed = parseSubtitles(srt);
    expect(wordsToText(parsed)).toBe('one two three four');
    expect(parseSubtitles(toVTT(pages, list)).length).toBe(4);
  });

  test('bilingual SRT keeps one translated line per caption page', () => {
    const list = words('bonjour mon ami', 0.5);
    const pages = buildPages(list, { ...DEFAULT_GROUPING, mode: 'phrase', maxChars: 40 });
    const srt = toBilingualSRT(pages, list, ['Hello my friend']);
    expect(srt).toContain('bonjour mon ami\nHello my friend');
    expect(srt).toContain('00:00:00,000 -->');
    const missing = toBilingualSRT(pages, list, ['']);
    expect(missing).toContain('\nbonjour mon ami\n');
    expect(missing).not.toContain('\n\n');
  });

  test('pages follow grouping modes', () => {
    const list = words('a b c d e f g');
    expect(buildPages(list, { ...DEFAULT_GROUPING, mode: 'word' }).length).toBe(7);
    expect(buildPages(list, { ...DEFAULT_GROUPING, mode: 'words', wordsPerPage: 3 }).map((p) => p.words.length)).toEqual([3, 3, 1]);
    const broken = list.map((w, i) => (i === 2 ? { ...w, breakBefore: true } : w));
    expect(buildPages(broken, { ...DEFAULT_GROUPING, mode: 'words', wordsPerPage: 5 }).map((p) => p.words.length)).toEqual([2, 5]);
    const sentence = [...words('hi there.'), { ...makeWord('next', 0.9, 1.2), start: 0.9 }];
    expect(buildPages(sentence, { ...DEFAULT_GROUPING, mode: 'phrase' }).length).toBe(2);
  });

  test('pages keep captions up through short gaps and look up by time', () => {
    const list = words('a b c d', 0.5);
    const pages = buildPages(list, { ...DEFAULT_GROUPING, mode: 'words', wordsPerPage: 2 });
    expect(pages[0].hide).toBe(pages[1].show);
    expect(pageAt(pages, 0.1)?.index).toBe(0);
    expect(pageAt(pages, 1.1)?.index).toBe(1);
    expect(pageAt(pages, 9)).toBeNull();
    expect(buildPages(list, { ...DEFAULT_GROUPING, mode: 'word' }, 2)[0].show).toBe(2);
  });

  test('emphasis honours explicit levels and ranks by energy', () => {
    const list = words('so this is really important now').map((w, i) => ({ ...w, energy: i === 4 ? 1 : 0.2 }));
    const levels = resolveEmphasis(list, { autoEmphasis: 0.5 });
    expect(levels[4]).toBeGreaterThanOrEqual(2);
    expect(levels[0]).toBe(0);
    expect(resolveEmphasis(list, { autoEmphasis: 0 }).every((l) => l === 0)).toBe(true);
    list[0].emphasis = 3;
    expect(resolveEmphasis(list, { autoEmphasis: 0 })[0]).toBe(3);
  });

  test('applyEnergy normalizes loudness per word', () => {
    const env = new Float32Array(300).fill(0.01);
    for (let i = 100; i < 150; i += 1) env[i] = 0.5;
    const list = [makeWord('quiet', 0.1, 0.5), makeWord('loud', 1.0, 1.5)];
    const out = applyEnergy(list, env, 0.01);
    expect(out[1].energy).toBeGreaterThan(out[0].energy);
  });
});

describe('captions dsp', () => {
  const rate = 16000;
  const segments: [number, number][] = [[0.5, 1.5], [2.0, 3.2], [4.0, 4.6]];
  const samples = tone(rate, segments, 6);
  const env = envelope(samples, rate);

  test('speech regions find the voiced stretches', () => {
    const regions = speechRegions(env);
    expect(regions.length).toBe(3);
    segments.forEach(([a, b], i) => {
      expect(Math.abs(regions[i].start - a)).toBeLessThan(0.08);
      expect(Math.abs(regions[i].end - b)).toBeLessThan(0.1);
    });
  });

  test('autoTime tiles words over the voiced time only', () => {
    const regions = speechRegions(env);
    const timed = autoTime('one two three four five six seven eight', regions, 6);
    expect(timed.length).toBe(8);
    for (const word of timed) {
      const inside = segments.some(([a, b]) => word.start >= a - 0.1 && word.start <= b + 0.1);
      expect(inside).toBe(true);
    }
    for (let i = 1; i < timed.length; i += 1) expect(timed[i].start).toBeGreaterThanOrEqual(timed[i - 1].start - 1e-6);
  });

  test('snapWordsToSpeech pulls late model timestamps onto the real phrases', () => {
    const regions = speechRegions(env);
    const late = [
      ...words('this is the first phrase', 0.2).map((w, i) => ({ ...w, start: 0.8 + i * 0.2, end: 0.95 + i * 0.2 })),
      ...words('and now a second one here', 0.19).map((w, i) => ({ ...w, start: 2.5 + i * 0.19, end: 2.64 + i * 0.19 })),
    ];
    const snapped = snapWordsToSpeech(late, regions, env);
    expect(snapped.length).toBe(late.length);
    expect(snapped[0].start).toBeLessThan(0.62);
    expect(Math.abs(snapped[5].start - 2.0)).toBeLessThan(0.15);
    for (let i = 1; i < snapped.length; i += 1) expect(snapped[i].start).toBeGreaterThanOrEqual(snapped[i - 1].end - 1e-6);
  });

  test('chunks cut at quiet points and wav encoding is valid', () => {
    const long = tone(rate, [[0, 50], [51, 120]], 125);
    const longEnv = envelope(long, rate);
    const chunks = planChunks(longEnv, 125, 60);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0].end).toBeGreaterThan(48);
    expect(chunks[0].end).toBeLessThanOrEqual(60.02);
    expect(chunkIsSilent(longEnv, { start: 50.1, end: 50.9 })).toBe(true);
    const wav = encodeWav16(samples, 0, 1, rate);
    expect(wav.length).toBe(44 + rate * 2);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe('RIFF');
    expect(new DataView(wav.buffer).getUint32(24, true)).toBe(rate);
  });
});

describe('captions readability', () => {
  test('all effects on leaves the style untouched', () => {
    const style = presetStyle('hifi-glitch');
    expect(applyFx(style, FX_ON)).toBe(style);
  });

  test('glitch off removes distortion and glitchy animations', () => {
    const out = applyFx(presetStyle('hifi-glitch'), { ...FX_ON, glitch: false });
    expect([out.glitch, out.rgbSplit, out.slices, out.jitter, out.scanlines, out.flicker, out.scramble, out.emphasisGlitch]).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(out.animIn).toBe('fade');
    expect(out.shake).toBeGreaterThan(0);
  });

  test('readable preset flattens riot scatter', () => {
    const out = applyFx(presetStyle('riot-scatter'), FX_READABLE);
    expect(out.placement).toBe('fixed');
    expect([out.shake, out.punch, out.tilt, out.wordRotate, out.glitch]).toEqual([0, 0, 0, 0, 0]);
    expect(out.futureOpacity).toBeGreaterThanOrEqual(0.6);
    expect(out.emphasisScale.every((value) => value <= 1.5)).toBe(true);
    expect(fxIsReadable(FX_READABLE)).toBe(true);
    expect(fxIsReadable(FX_ON)).toBe(false);
  });
});
