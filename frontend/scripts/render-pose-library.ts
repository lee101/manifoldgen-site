import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const root = join(dirname(import.meta.path), '..');
const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) args.set(a.slice(2), a.includes('=') ? a.slice(a.indexOf('=') + 1) : process.argv[++i] ?? '');
}
const out = resolve(args.get('out') || join(root, '../tools/poselib/data'));
const solo = Number(args.get('solo') ?? 400);
const duo = Number(args.get('duo') ?? 60);
const trio = Number(args.get('trio') ?? 20);
const seed0 = Number(args.get('seed') ?? 1000);
const bundle = join(root, 'public/pose-studio/pose-studio.js');
const SOLO_VIEWS = ['front', '3/4 left', 'side', 'high angle', 'low angle'];
const GROUP_VIEWS = ['front', '3/4 left', 'high angle'];
const MAN = ['genman', 'genman', 'tall man', 'stocky man', 'teen boy'];
const WOMAN = ['genwoman', 'genwoman', 'slim woman', 'short woman', 'curvy woman', 'teen girl'];
const SIZE: Record<string, string> = { genman: 'average man', genwoman: 'average woman', 'tall man': 'tall man', 'stocky man': 'stocky man', 'slim woman': 'slim woman', 'short woman': 'short woman', 'curvy woman': 'curvy woman', 'teen boy': 'teen boy', 'teen girl': 'teen girl', child: 'child', neutral: 'mannequin' };

function chromiumPath() {
  const dir = join(homedir(), '.cache/ms-playwright');
  if (!existsSync(dir)) return undefined;
  const builds = readdirSync(dir).filter((d) => d.startsWith('chromium_headless_shell-')).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
  for (const b of builds) {
    const p = join(dir, b, 'chrome-headless-shell-linux64/chrome-headless-shell');
    if (existsSync(p)) return p;
  }
  return undefined;
}
const launchArgs = ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'];
const browser = await chromium.launch({ headless: true, args: launchArgs, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }).catch(() =>
  chromium.launch({ headless: true, args: launchArgs, executablePath: chromiumPath() }));
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.setContent('<!doctype html><body style="margin:0;background:#070a0b"><div id="root" style="width:900px;height:900px"></div></body>');
await page.addScriptTag({ path: bundle });
await mkdir(join(out, 'images/gen'), { recursive: true });

type Plan = { id: string; n: number; w: number; h: number; views: string[]; seeds: number[]; bodies: string[]; dx: number[] };
const plans: Plan[] = [];
const rnd = (s: number) => { let a = s; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const r = rnd(seed0);
const pickBody = () => (r() < 0.5 ? MAN : WOMAN)[Math.floor(r() * 5.99) % (r() < 0.5 ? 5 : 6)] ?? 'genman';
for (let i = 0; i < solo; i++) plans.push({ id: `gen-${String(seed0 + i)}`, n: 1, w: 768, h: 1024, views: SOLO_VIEWS, seeds: [seed0 + i], bodies: [i % 2 ? WOMAN[(i >> 1) % WOMAN.length] : MAN[(i >> 1) % MAN.length]], dx: [0] });
for (let i = 0; i < duo; i++) plans.push({ id: `gen-duo-${i}`, n: 2, w: 1024, h: 768, views: GROUP_VIEWS, seeds: [seed0 + 5000 + i * 2, seed0 + 5001 + i * 2], bodies: [i % 3 === 0 ? pickBody() : MAN[i % MAN.length], i % 3 === 1 ? pickBody() : WOMAN[i % WOMAN.length]], dx: [-0.6, 0.6] });
for (let i = 0; i < trio; i++) plans.push({ id: `gen-trio-${i}`, n: 3, w: 1024, h: 768, views: GROUP_VIEWS.slice(0, 2), seeds: [0, 1, 2].map((k) => seed0 + 9000 + i * 3 + k), bodies: [pickBody(), pickBody(), pickBody()], dx: [-1.0, 0, 1.0] });
void SIZE;

const entries: unknown[] = [];
let done = 0;
for (const p of plans) {
  const res = await page.evaluate(async ({ p }) => {
    const A = (window as any).PoseStudioApp;
    const w = window as any;
    w.__app?.destroy();
    const el = document.getElementById('root')!;
    el.innerHTML = '';
    const app = A.mount(el, { width: p.w, height: p.h });
    w.__app = app;
    const s = app.studio;
    const samples: any[] = [];
    for (let i = 0; i < p.n; i++) {
      if (i > 0) s.addPerson();
      const id = s.getPeople()[i].id;
      s.selectPerson(id);
      const sm = A.sampleSpec(p.seeds[i]);
      s.setBodyType(p.bodies[i]);
      s.applySpec(sm.spec);
      s.placePerson(id, p.dx[i], 0);
      samples.push({ name: sm.name, base: sm.base, description: sm.description, tags: sm.tags, body: p.bodies[i] });
    }
    s.setOutputSize(p.w, p.h);
    const b64 = (b: Blob) => new Promise<string>((rs) => { const fr = new FileReader(); fr.onload = () => rs((fr.result as string).split(',')[1]); fr.readAsDataURL(b); });
    const views: Record<string, Record<string, string>> = {};
    for (const v of p.views) {
      s.setCameraView(v);
      const all = await s.exportAll({ width: p.w, height: p.h });
      views[v] = {};
      for (const k of ['skeleton', 'depth', 'mesh']) views[v][k] = await b64(all[k].blob);
    }
    s.setCameraView('front');
    return { samples, views, pose: s.getPoseString() };
  }, { p });
  const files: Record<string, Record<string, string>> = {};
  for (const [v, maps] of Object.entries(res.views)) {
    const vs = v.replace(/[^a-z]+/g, '');
    files[v] = {};
    for (const [k, b64] of Object.entries(maps)) {
      const rel = `gen/${p.id}_${vs}_${k}.png`;
      await writeFile(join(out, 'images', rel), Buffer.from(b64, 'base64'));
      files[v][k] = rel;
    }
  }
  entries.push({ id: p.id, n: p.n, w: p.w, h: p.h, figures: res.samples, pose: res.pose, views: files });
  if (++done % 20 === 0) console.log(`${done}/${plans.length}`);
}
await writeFile(join(out, 'gen-raw.json'), JSON.stringify(entries));
await browser.close();
console.log(`wrote ${entries.length} poses`);
