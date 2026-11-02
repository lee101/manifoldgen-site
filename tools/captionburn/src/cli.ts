#!/usr/bin/env bun
/**
 * captionburn — burn the ManifoldGen caption engine onto a video, headless.
 *
 *   bun run tools/captionburn/src/cli.ts in.mp4 words.json --style viral-pop --out out.mp4
 *
 * words.json: [{ "text": "muse", "start": 24.3, "end": 25.1 }, ...]
 *
 * Reuses frontend/lib/captions (CaptionEngine + presets + grouping), so preview
 * and export go through the same renderer as /tools/crazy-captions. The canvas
 * shim lives in src/shim.ts and is preloaded by bunfig.toml. Frames are piped
 * raw through ffmpeg, so there are no intermediate PNGs.
 */
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { readFileSync } from 'node:fs';
import { CaptionEngine } from '../../../frontend/lib/captions/render';
import { presetStyle } from '../../../frontend/lib/captions/styles';
import type { CaptionDoc, CaptionStyle, CaptionWord, FontKey } from '../../../frontend/lib/captions/types';
import { DEFAULT_GROUPING, makeWord } from '../../../frontend/lib/captions/words';
import { ensureFonts } from './fonts';

const FONT_FAMILIES = ['Montserrat', 'Anton', 'Bebas Neue', 'Archivo Black', 'Bangers', 'Bungee', 'Russo One'];

const argv = process.argv.slice(2);
const positional: string[] = [];
const flags: Record<string, string> = {};
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg.startsWith('--')) {
    const [key, val] = arg.slice(2).split('=');
    flags[key] = val ?? argv[++i] ?? 'true';
  } else {
    positional.push(arg);
  }
}
const [input, wordsPath] = positional;
if (!input || !wordsPath) {
  console.error('usage: captionburn <video> <words.json> [--style viral-pop] [--y 0.86] [--size 7] [--out out.mp4] [--crf 18]');
  process.exit(2);
}

const FONT_KEYS: FontKey[] = [
  'anton', 'bebas', 'archivo', 'montserrat', 'poppins', 'oswald', 'russo', 'bangers', 'marker',
  'pixel', 'vt323', 'orbitron', 'spacemono', 'syne', 'playfair', 'dmserif', 'unbounded',
  'rubikglitch', 'bungee', 'inter', 'caveat',
];
const isFontKey = (value: string): value is FontKey => FONT_KEYS.some((key) => key === value);

const styleId = flags.style ?? 'viral-pop';
const outPath = flags.out ?? (/\.[^./]+$/.test(input) ? input.replace(/\.([^.]+)$/, '.captioned.$1') : `${input}.captioned.mp4`);
if (outPath === input) throw new Error('output path must differ from input');

function readNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' ? value : undefined;
}

function parseWords(text: string): CaptionWord[] {
  const parsed: unknown = JSON.parse(text);
  let list: unknown = parsed;
  if (!Array.isArray(parsed) && parsed && typeof parsed === 'object' && 'words' in parsed) {
    list = parsed.words;
  }
  if (!Array.isArray(list)) throw new Error('words file must be an array or { words: [...] }');
  return list.map((entry: unknown, index: number) => {
    if (!entry || typeof entry !== 'object') throw new Error(`word ${index} is not an object`);
    const record: Record<string, unknown> = { ...entry };
    const label = record.text;
    const start = readNumber(record, 'start');
    const end = readNumber(record, 'end');
    const energy = readNumber(record, 'energy');
    if (typeof label !== 'string' || start === undefined || end === undefined) {
      throw new Error(`word ${index} needs string text and numeric start/end`);
    }
    return { ...makeWord(label, start, end, energy ?? 0.6), id: `w${index}` };
  });
}

type ProbeStream = { width: number; height: number; r_frame_rate: string; duration?: string };

function probeVideo(path: string): ProbeStream {
  const probe = Bun.spawnSync([
    'ffprobe', '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,r_frame_rate,duration',
    '-of', 'json', path,
  ]);
  if (probe.exitCode !== 0) throw new Error(`ffprobe failed: ${probe.stderr.toString()}`);
  const payload: unknown = JSON.parse(probe.stdout.toString());
  if (!payload || typeof payload !== 'object' || !('streams' in payload)) throw new Error('ffprobe: no streams');
  const streams = payload.streams;
  if (!Array.isArray(streams) || streams.length === 0) throw new Error('ffprobe: empty stream list');
  const first: unknown = streams[0];
  if (!first || typeof first !== 'object') throw new Error('ffprobe: bad stream entry');
  const record: Record<string, unknown> = { ...first };
  const { width, height, r_frame_rate, duration } = record;
  if (typeof width !== 'number' || typeof height !== 'number' || typeof r_frame_rate !== 'string') {
    throw new Error('ffprobe: stream is missing width/height/r_frame_rate');
  }
  return { width, height, r_frame_rate, duration: typeof duration === 'string' ? duration : undefined };
}

const meta = probeVideo(input);
const width = meta.width;
const height = meta.height;
const [rateNum, rateDen] = meta.r_frame_rate.split('/').map(Number);
const fps = rateNum / (rateDen || 1);
const duration = Number(meta.duration) || 0;
console.log(`in: ${width}x${height} @ ${fps.toFixed(3)}fps, ${duration.toFixed(2)}s`);

const registered = await ensureFonts(FONT_FAMILIES);
for (const [family, path] of Object.entries(registered)) GlobalFonts.registerFromPath(path, family);

const words = parseWords(readFileSync(wordsPath, 'utf8'));
const style: CaptionStyle = {
  ...presetStyle(styleId),
  ...(flags.y ? { y: Number(flags.y) } : {}),
  ...(flags.size ? { size: Number(flags.size) } : {}),
  ...(flags.maxwidth ? { maxWidth: Number(flags.maxwidth) } : {}),
  ...(flags.font && isFontKey(flags.font) ? { font: flags.font } : {}),
};
const doc: CaptionDoc = { words, style, grouping: DEFAULT_GROUPING, offset: 0 };

const engine = new CaptionEngine(style);
engine.update(doc, duration);

const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');
const frame = ctx.createImageData(width, height);
// The engine's Ctx is DOM's CanvasRenderingContext2D; @napi-rs/canvas implements the
// same drawing surface at runtime but does not share the lib.dom type.
const engineCtx = ctx as unknown as CanvasRenderingContext2D;
// Self-draw target: the engine composites the current canvas contents (punch/shake/vignette).
const engineSource = canvas as unknown as CanvasImageSource;

const decoder = Bun.spawn(['ffmpeg', '-v', 'error', '-i', input, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], {
  stdout: 'pipe',
});
const encoder = Bun.spawn(
  [
    'ffmpeg', '-v', 'error', '-y',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${width}x${height}`, '-r', String(fps), '-i', '-',
    '-i', input,
    '-map', '0:v:0', '-map', '1:a:0?',
    '-c:v', 'libx264', '-crf', flags.crf ?? '18', '-preset', 'medium', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart',
    outPath,
  ],
  { stdin: 'pipe', stderr: 'inherit' },
);

const frameBytes = width * height * 4;
const reader = decoder.stdout.getReader();
let buffered: Buffer = Buffer.alloc(0);
let count = 0;
const started = Date.now();
for (;;) {
  const { value, done } = await reader.read();
  if (done) break;
  buffered = buffered.length ? Buffer.concat([buffered, Buffer.from(value)]) : Buffer.from(value);
  while (buffered.length >= frameBytes) {
    const chunk = buffered.subarray(0, frameBytes);
    buffered = buffered.subarray(frameBytes);
    frame.data.set(chunk);
    ctx.putImageData(frame, 0, 0);
    engine.render(engineCtx, width, height, count / fps, engineSource);
    encoder.stdin.write(canvas.data());
    encoder.stdin.flush();
    count += 1;
  }
}
encoder.stdin.end();
const decodeCode = await decoder.exited;
const encodeCode = await encoder.exited;
if (decodeCode !== 0 || encodeCode !== 0) {
  throw new Error(`ffmpeg failed (decode ${decodeCode}, encode ${encodeCode})`);
}
console.log(`wrote ${outPath}: ${count} frames in ${((Date.now() - started) / 1000).toFixed(1)}s`);
