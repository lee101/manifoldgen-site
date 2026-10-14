const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const { test, expect } = require('@playwright/test');

const API_KEY = 'mg_studio_parity_key';
const BASELINE = path.resolve(__dirname, '../fixtures/studio-export-parity.json');
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'manifold-studio-parity-'));
const MEDIA = 'https://studio-media.example/parity';
const PROJECT_ID = '4b8f0a52-8f3c-4b8e-9c55-0d6f6c1f7a10';
const ids = {
  a: 'a0c0b5a4-1f7e-4c55-8a7e-3c0a0b4c8d01',
  b: 'b1d1c6b5-2a8f-4d66-9b8f-4d1b1c5d9e02',
  logo: 'c2e2d7c6-3b9a-4e77-8c9a-5e2c2d6eaf03',
  tone: 'd3f3e8d7-4cab-4f88-9dab-6f3d3e7fb004',
};
const files = {};

function ffmpeg(args) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { timeout: 60_000, stdio: 'pipe' });
}

test.beforeAll(() => {
  files.a = path.join(DIR, 'a.mp4');
  files.b = path.join(DIR, 'b.mp4');
  files.logo = path.join(DIR, 'logo.png');
  files.tone = path.join(DIR, 'tone.wav');
  ffmpeg(['-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=30', '-t', '2', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-g', '15', files.a]);
  ffmpeg(['-f', 'lavfi', '-i', 'smptebars=size=320x240:rate=30', '-t', '2', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-g', '15', files.b]);
  ffmpeg(['-f', 'lavfi', '-i', 'color=c=orange:size=96x64', '-frames:v', '1', files.logo]);
  ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=330:sample_rate=48000', '-t', '3', files.tone]);
});

test.afterAll(() => fs.rmSync(DIR, { recursive: true, force: true }));

const neutral = { exposure: 0, brightness: 0, contrast: 0, highlights: 0, shadows: 0, shadowHue: 0, midtoneHue: 0, highlightHue: 0, saturation: 0, temperature: 0, tint: 0, fade: 0, vignette: 0, grain: 0 };

function clip(id, name, kind, extra) {
  return {
    id, mediaID: id, name, kind, duration: 2, width: 320, height: 240, trimStart: 0, trimEnd: 2, timelineStart: 0, visualTrack: 0,
    volume: 1, fadeIn: 0, fadeOut: 0, stageX: 0, stageY: 0, stageScale: 1, stageRotation: 0, adjustments: neutral,
    contentType: kind === 'video' ? 'video/mp4' : kind === 'audio' ? 'audio/wav' : 'image/png', size: 1, lastModified: 1,
    cloudURL: `${MEDIA}/${name}`, ...extra,
  };
}

function parityDocument() {
  return {
    version: 6,
    selectedID: ids.a,
    canvas: { width: 640, height: 360 },
    audioTrackVolume: 0.8,
    assets: [
      clip(ids.a, 'a.mp4', 'video', { trimStart: 0.25, trimEnd: 1.75 }),
      clip(ids.b, 'b.mp4', 'video', {
        timelineStart: 1.5, trimStart: 0.25, trimEnd: 1.75, transition: { type: 'crossfade', duration: 0.5 },
        adjustments: { ...neutral, contrast: 0.2, saturation: 0.3, vignette: 0.4, liftB: 0.05, gainR: 0.1 },
      }),
      clip(ids.logo, 'logo.png', 'image', { width: 96, height: 64, duration: 3, trimEnd: 3, visualTrack: 1, stageScale: 0.3, stageX: 0.3, stageY: -0.3, opacity: 0.8, blendMode: 'screen' }),
      clip(ids.tone, 'tone.wav', 'audio', { duration: 3, trimEnd: 3, width: 1, height: 1, volume: 0.5, fadeIn: 0.3, fadeOut: 0.5 }),
    ],
  };
}

function titleDocument() {
  const doc = parityDocument();
  doc.assets.splice(2, 1, {
    ...clip('e4a4f9e8-5dbc-4a99-8ebc-7a4e4f80c105', 'Parity title', 'image', { width: 1920, height: 1080, duration: 3, trimEnd: 3, visualTrack: 1, stageScale: 0.8, stageRotation: 8 }),
    cloudURL: undefined,
    text: { content: 'Parity title', fontSize: 140, fontFamily: 'Bebas Neue', fontWeight: 800, color: '#ffd400', align: 'center' },
  });
  return doc;
}

const SETTINGS = { format: 'mp4-h264', resolution: 'source', frameRate: 30, quality: 'balanced', audio: 'aac' };

async function install(page, document) {
  const now = new Date().toISOString();
  const project = { id: PROJECT_ID, name: 'Parity', revision: 1, created_at: now, updated_at: now, document };
  await page.addInitScript(({ apiKey, settings }) => {
    localStorage.setItem('mg_api_key', apiKey);
    localStorage.setItem('mg_user', JSON.stringify({ id: 'parity-user', email: 'parity@example.com', api_key: apiKey, credits: 10000, credits_usd: 100 }));
    localStorage.setItem('mg_studio_export_settings_v1', JSON.stringify(settings));
  }, { apiKey: API_KEY, settings: SETTINGS });
  await page.route('**/api/pricing', (route) => route.fulfill({ status: 200, json: { credit_price_usd: 0.01 } }));
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, json: { user: { id: 'parity-user', email: 'parity@example.com', api_key: API_KEY, credits: 10000, credits_usd: 100 } } }));
  await page.route('**/api/video-jobs', (route) => route.fulfill({ status: 200, json: { jobs: [] } }));
  await page.route('**/api/studio/projects', (route) => route.fulfill({ status: 200, json: { projects: [project] } }));
  await page.route('**/api/studio/projects/*', (route) => route.request().method() === 'GET' ? route.fulfill({ status: 200, json: { project } }) : route.fulfill({ status: 200, json: { project: { ...project, document: route.request().postDataJSON().document } } }));
  await page.route('**/api/studio/assets/presign', (route) => route.fulfill({ status: 500, json: { error: 'uploads disabled in parity test' } }));
  await page.route(`${MEDIA}/*`, (route) => {
    const name = new URL(route.request().url()).pathname.split('/').pop();
    const key = { 'a.mp4': 'a', 'b.mp4': 'b', 'logo.png': 'logo', 'tone.wav': 'tone' }[name];
    const type = name.endsWith('.mp4') ? 'video/mp4' : name.endsWith('.wav') ? 'audio/wav' : 'image/png';
    return route.fulfill({ status: 200, contentType: type, headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(files[key]) });
  });
}

function frameHashes(file) {
  const hashes = (stream) => execFileSync('ffmpeg', ['-loglevel', 'error', '-i', file, '-map', `0:${stream}`, '-f', 'framemd5', '-'], { encoding: 'utf8' })
    .split('\n').filter((line) => line && !line.startsWith('#')).map((line) => line.split(',').pop().trim());
  return { video: hashes('v'), audio: hashes('a') };
}

async function studioExport(page, document) {
  await install(page, document);
  await page.goto(`/studio?project=${PROJECT_ID}`);
  await expect(page.locator('[data-testid^="timeline-clip-"]')).toHaveCount(3, { timeout: 30_000 });
  await expect(page.locator('[data-testid^="timeline-audio-"]')).toHaveCount(1);
  await expect(page.getByTestId('studio-export')).toBeEnabled({ timeout: 30_000 });
  await page.getByTestId('studio-export').click();
  const downloadPromise = page.waitForEvent('download', { timeout: 120_000 });
  await page.getByRole('dialog', { name: 'Export' }).getByRole('button', { name: 'Export', exact: true }).click();
  const download = await downloadPromise;
  const output = path.join(DIR, `studio-${Date.now()}.mp4`);
  await download.saveAs(output);
  return frameHashes(output);
}

async function renderPageExport(page, document) {
  await install(page, document);
  await page.goto('/studio/render');
  await page.waitForFunction(() => typeof window.__manifoldRender === 'function', null, { timeout: 30_000 });
  const result = await page.evaluate(({ document, settings }) => window.__manifoldRender({ document, settings }), { document, settings: SETTINGS });
  expect(result.mime).toBe('video/mp4');
  const output = path.join(DIR, `render-${Date.now()}.mp4`);
  fs.writeFileSync(output, Buffer.concat(result.chunks.map((chunk) => Buffer.from(chunk, 'base64'))));
  return frameHashes(output);
}

function baseline() {
  return JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
}

test('Studio export matches the pre-refactor baseline frame for frame', async ({ page }) => {
  test.setTimeout(180_000);
  const hashes = await studioExport(page, parityDocument());
  expect(hashes.video).toHaveLength(90);
  if (process.env.STUDIO_PARITY_WRITE === '1' || !fs.existsSync(BASELINE)) {
    fs.writeFileSync(BASELINE, `${JSON.stringify(hashes, null, 1)}\n`);
    return;
  }
  expect(hashes.video).toEqual(baseline().video);
  expect(hashes.audio).toEqual(baseline().audio);
});

test('the headless render page reproduces the Studio export exactly', async ({ page }) => {
  test.setTimeout(180_000);
  const hashes = await renderPageExport(page, parityDocument());
  expect(hashes.video).toEqual(baseline().video);
  expect(hashes.audio).toEqual(baseline().audio);
});

test('agent title cards without media render identically in Studio and the render page', async ({ browser }) => {
  test.setTimeout(240_000);
  const studio = await browser.newPage();
  const studioHashes = await studioExport(studio, titleDocument());
  await studio.close();
  const render = await browser.newPage();
  const renderHashes = await renderPageExport(render, titleDocument());
  await render.close();
  expect(studioHashes.video).toHaveLength(90);
  expect(renderHashes.video).toEqual(studioHashes.video);
  expect(renderHashes.audio).toEqual(studioHashes.audio);
  expect(new Set(studioHashes.video).size).toBeGreaterThan(30);
  expect(studioHashes.video).not.toEqual(baseline().video);
});
