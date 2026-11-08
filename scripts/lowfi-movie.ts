import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const base = process.env.MANIFOLDGEN_BASE_URL || 'https://manifoldgen.com';
const key = process.env.MANIFOLDGEN_API_KEY || '';
const argv = process.argv.slice(2);
const flag = (n: string, d = '') => {
  const i = argv.indexOf('--' + n);
  return i >= 0 ? argv[i + 1] : d;
};
const out = flag('out', 'lowfi-movie');
const count = Number(flag('tracks', '10'));
const trackSeconds = Number(flag('seconds', '180'));
const clipSeconds = Number(flag('clip', '15'));
const dry = argv.includes('--dry-run');
const clipBin = process.env.LOWFICLIP_BIN || 'lowficlip';

const scenes: [string, string, string][] = [
  ['Rainy Window Study', 'cozy attic study with a rain-streaked window at night, desk lamp, steaming mug, sleeping cat', 'slow lofi hip hop, 72 bpm, soft vinyl crackle, mellow rhodes piano, dusty boom bap drums'],
  ['Midnight Ramen Stand', 'tiny neon ramen stand on a wet alley, steam rising, paper lanterns, quiet city night', 'jazzy lofi beat, 80 bpm, warm upright bass, muted trumpet, soft brushed drums'],
  ['Train Window Dusk', 'night train carriage seat by the window, glowing city lights drifting past, headphones on seat', 'dreamy lofi instrumental, 70 bpm, tape-saturated guitar, airy pads, gentle kick and snare'],
  ['Rooftop Garden', 'rooftop garden at golden hour, string lights, potted plants, distant skyline, hammock', 'sunny chillhop, 85 bpm, plucked guitar, warm bass, light shaker, vinyl noise'],
  ['Bookshop Afternoon', 'quiet old bookshop afternoon, dust motes in sunbeam, ladder, stacked books, tabby cat on counter', 'mellow lofi piano, 68 bpm, felt piano, soft strings, subtle crackle, no drums intro'],
  ['Seaside Cafe', 'empty seaside cafe terrace at dawn, calm sea, a coffee cup, drifting curtains', 'ambient lofi beats, 75 bpm, ocean-soft pads, nylon guitar, lazy drums'],
  ['Neon Arcade Break', 'back room of a retro arcade, glowing cabinets, a single player stool, purple haze', 'synthy lofi, 78 bpm, warm analog synth, soft 808, chiptune sparkle, tape wobble'],
  ['Snowed-In Cabin', 'snowed-in wooden cabin, crackling fireplace, blanket on armchair, window with falling snow', 'cozy winter lofi, 66 bpm, music box, soft pads, slow drums, fireplace warmth'],
  ['Studio Apartment Plants', 'sunlit studio apartment with many plants, vinyl turntable spinning, morning light', 'bright lofi hip hop, 82 bpm, bouncy bass, vibraphone, crisp hats, vinyl pops'],
  ['Late Night Library', 'university library at 2am, green banker lamp, empty desks, rain on tall windows', 'focus lofi, 74 bpm, soft keys, deep sub bass, minimal drums, instrumental, no vocals'],
];

const headers = { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data: any = {};
  try { data = JSON.parse(text); } catch {}
  if (!res.ok) throw new Error(`${method} ${path} ${res.status} ${(data.error || text).slice(0, 200)}`);
  return data;
}

function find(o: any, names: string[]): string {
  if (!o || typeof o !== 'object') return '';
  for (const n of names) if (typeof o[n] === 'string' && o[n].startsWith('http')) return o[n];
  for (const v of Object.values(o)) {
    const r = find(v, names);
    if (r) return r;
  }
  return '';
}

async function run(body: any, names: string[], kind: 'video' | 'audio') {
  const first = await api('POST', '/api/service', body);
  let url = find(first, names);
  if (url) return url;
  const id = first?.result?.job_id || first?.job_id;
  const statusUrl = first?.result?.status_url || `/api/${kind}-jobs/${id}`;
  for (let i = 0; i < 360; i++) {
    await new Promise((r) => setTimeout(r, 10000));
    const s = await api('GET', statusUrl);
    const j = s.job || s;
    const st = String(j.status || '').toLowerCase();
    if (st === 'failed' || st === 'error' || st === 'cancelled') throw new Error(`${body.service} ${st}: ${j.error || ''}`);
    if (st === 'completed' || st === 'succeeded' || st === 'done') {
      url = find(j, names);
      if (url) return url;
      throw new Error('completed without url: ' + JSON.stringify(j).slice(0, 300));
    }
  }
  throw new Error(body.service + ' timed out');
}

async function download(url: string, path: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('download ' + url + ' ' + res.status);
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
}

function sh(cmd: string, args: string[]) {
  const r = spawnSync(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] });
  if (r.status !== 0) throw new Error(`${cmd} failed`);
}

async function main() {
  mkdirSync(out, { recursive: true });
  const state = join(out, 'state.json');
  const meta: any[] = existsSync(state) ? JSON.parse(readFileSync(state, 'utf8')) : [];
  if (dry) {
    console.log(JSON.stringify({ base, tracks: count, trackSeconds, clipSeconds, scenes: scenes.slice(0, count).map((s) => s[0]) }, null, 2));
    return;
  }
  if (!key) throw new Error('set MANIFOLDGEN_API_KEY');
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const [title, scene, music] = scenes[i % scenes.length];
    const n = String(i + 1).padStart(2, '0');
    const m = (meta[i] ||= { title });
    const dir = join(out, n);
    mkdirSync(dir, { recursive: true });
    const audioPath = join(dir, 'track.mp3');
    const clipPath = join(dir, 'loop.mp4');
    const videoPath = join(dir, 'track.mp4');
    if (!m.audio) {
      console.log(n, 'music');
      m.audio = await run({ service: 'music', prompt: `${music}, instrumental, no vocals, seamless chill beat to study to`, duration: trackSeconds }, ['audio_url', 'url'], 'audio');
      writeFileSync(state, JSON.stringify(meta, null, 2));
    }
    if (!m.still) {
      console.log(n, 'still');
      m.still = await run({ service: 'image', prompt: `lofi anime illustration, ${scene}, warm muted colors, soft film grain, cinematic 16:9, no text`, width: 1280, height: 720 }, ['image_url', 'url'], 'video');
      writeFileSync(state, JSON.stringify(meta, null, 2));
    }
    if (!m.clip) {
      console.log(n, 'loop clip');
      m.clip = await run({
        service: 'video', prompt: `${scene}, subtle ambient motion only, gentle lofi loop, static camera, same style throughout`,
        first_frame: m.still, loop: true, duration: clipSeconds, aspect_ratio: '16:9', size: 'balanced', output_format: 'mp4-h264',
      }, ['video_url', 'url'], 'video');
      writeFileSync(state, JSON.stringify(meta, null, 2));
    }
    await download(m.audio, audioPath);
    await download(m.clip, clipPath);
    sh(clipBin, ['--clip', clipPath, '--audio', audioPath, '--out', videoPath, '--fade', '2']);
    parts.push(videoPath);
  }
  const movie = join(out, 'lowfi-movie.mp4');
  sh(clipBin, ['--concat', parts.join(','), '--out', movie]);
  console.log('done', movie);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
