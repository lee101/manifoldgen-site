import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const root = join(dirname(import.meta.path), '..');
const SCRATCH = '/tmp/claude-1000/-vfast-data-code-manifoldgen-site/3a6857ca-60c0-4843-98d7-b4f22d10585f/scratchpad/poser-samples';
const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) args.set(a.slice(2), a.includes('=') ? a.slice(a.indexOf('=') + 1) : process.argv[++i] ?? '');
}
const out = resolve(args.get('out') || SCRATCH);
const [width, height] = (args.get('size') || '768x1024').split('x').map(Number);
const bundle = resolve(args.get('bundle') || join(root, 'public/pose-studio/pose-studio.js'));
const cssPath = bundle.replace(/\.js$/, '.css');
const DEFAULT = ['stand', 'relaxed', 'casting a spell with one arm extended', 'sword two-hand hold', 'sit on chair', 'fighting stance', 'run', 'kneel'];
const presets = (args.get('presets') ? args.get('presets')!.split(',').map((s) => s.trim()) : DEFAULT).filter(Boolean);
const scene = args.get('scene') !== 'false' && !args.get('presets');
const VIEWS: Record<string, string> = { 'lying down': 'high angle', top: 'top' };
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

type Job = { name: string; view: string; people: { preset: string; dx: number }[] };
const jobs: Job[] = presets.map((p) => ({ name: p, view: VIEWS[p] || 'front', people: [{ preset: p, dx: 0 }] }));
if (scene) jobs.push({ name: 'two-person scene', view: 'front', people: [{ preset: 'stand', dx: -0.55 }, { preset: 'sit on chair', dx: 0.55 }] });

await mkdir(out, { recursive: true });
function fallbackChromium() {
  const dir = join(homedir(), '.cache/ms-playwright');
  if (!existsSync(dir)) return undefined;
  const builds = readdirSync(dir).filter((d) => d.startsWith('chromium_headless_shell-')).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
  for (const b of builds) {
    const p = join(dir, b, 'chrome-headless-shell-linux64/chrome-headless-shell');
    if (existsSync(p)) return p;
  }
  return existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined;
}
const launchArgs = ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'];
const explicit = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const browser = await chromium.launch({ headless: true, args: launchArgs, executablePath: explicit }).catch(() => {
  const executablePath = fallbackChromium();
  if (!executablePath) throw new Error('No Chromium found; run `bunx playwright install chromium` or set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH');
  return chromium.launch({ headless: true, args: launchArgs, executablePath });
});
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
page.on('pageerror', (e) => console.error('pageerror', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('console', m.text()); });
await page.setContent('<!doctype html><body style="margin:0;background:#070a0b"><div id="root" style="width:900px;height:900px"></div></body>');
await page.addScriptTag({ path: bundle });
await page.addStyleTag({ path: cssPath }).catch(() => undefined);
const ok = await page.evaluate(() => !!(window as unknown as { PoseStudioApp?: unknown }).PoseStudioApp);
if (!ok) throw new Error('PoseStudioApp missing from bundle');

for (const job of jobs) {
  const res = await page.evaluate(async ({ job, width, height }) => {
    const w = window as unknown as { PoseStudioApp: { mount: (el: HTMLElement, o: object) => { studio: any; destroy: () => void } }; __app?: { studio: any; destroy: () => void } };
    w.__app?.destroy();
    const el = document.getElementById('root')!;
    el.innerHTML = '';
    const app = w.PoseStudioApp.mount(el, { width, height });
    w.__app = app;
    const s = app.studio;
    job.people.forEach((p, i) => {
      if (i > 0) s.addPerson();
      s.setPreset(p.preset);
      s.placePerson(s.getPeople()[i].id, p.dx, 0);
    });
    s.setOutputSize(width, height);
    s.setCameraView(job.view);
    const toB64 = (b: Blob) => new Promise<string>((r) => { const fr = new FileReader(); fr.onload = () => r((fr.result as string).split(',')[1]); fr.readAsDataURL(b); });
    const all = await s.exportAll({ width, height });
    const o: Record<string, string> = {};
    for (const k of Object.keys(all)) o[k] = await toB64(all[k].blob);
    return o;
  }, { job, width, height });
  const base = slug(job.name);
  for (const [k, b64] of Object.entries(res)) await writeFile(join(out, `${base}_${k}.png`), Buffer.from(b64, 'base64'));
  console.log(`wrote ${base} (${width}x${height})`);
}
await browser.close();
