const fs = require('fs');
const path = require('path');
const { chromium } = require('../frontend/node_modules/@playwright/test');
const { CDN, signIn, mockBackend, addClip, upload, SONG } = require('../frontend/tests/e2e/helpers/motion-mocks.cjs');

const baseURL = (process.env.VISUALBENCH_BASE_URL || 'http://127.0.0.1:3927').replace(/\/$/, '');
const outputDir = process.env.VISUALBENCH_OUT || __dirname;
const showcase = path.resolve(__dirname, '../testvids/motion/showcase');

const pages = [
  { slug: 'motion-fx', service: 'motion-fx', demo: ['motion-fx', 1] },
  { slug: 'anime-fight-fx', service: 'motion-fx', demo: ['motion-fx', 1] },
  { slug: 'beat-drop-fx', service: 'beat-drop', demo: ['beat-drop', 1], audio: true },
  { slug: 'motion-tracker', service: 'motion-track', demo: ['motion-track', 1] },
];
const viewports = [
  { device: 'desktop', viewport: { width: 1440, height: 900 }, mobile: false },
  { device: 'mobile', viewport: { width: 390, height: 844 }, mobile: true },
];

async function realMedia(page, [service, n]) {
  const file = (name) => path.join(showcase, service, `${n}-${name}`);
  const serve = async (url, name, type) => {
    if (fs.existsSync(file(name))) await page.route(url, (route) => route.fulfill({ status: 200, contentType: type, body: fs.readFileSync(file(name)) }));
  };
  await serve(`${CDN}/result.mp4`, 'output.mp4', 'video/mp4');
  await serve(`${CDN}/beat.mp4`, 'output.mp4', 'video/mp4');
  await serve(`${CDN}/preview.mp4`, 'output.mp4', 'video/mp4');
  await serve(`${CDN}/guide.mp4`, 'guide.mp4', 'video/mp4');
  await serve(`${CDN}/poster.jpg`, 'poster.jpg', 'image/jpeg');
  await page.route('https://manifoldgenstatic.manifoldgen.com/static/tools/production/**', async (route) => {
    const match = /production\/([\w-]+)\/(\d+)-(input|output)\.mp4|production\/([\w-]+)\/(\d+)-poster\.jpg/.exec(route.request().url());
    const [svc, idx, kind] = match ? (match[1] ? [match[1], match[2], match[3] + '.mp4'] : [match[4], match[5], 'poster.jpg']) : [];
    const local = svc && path.join(showcase, svc, `${idx}-${kind}`);
    if (local && fs.existsSync(local)) return route.fulfill({ status: 200, contentType: kind === 'poster.jpg' ? 'image/jpeg' : 'video/mp4', body: fs.readFileSync(local) });
    return route.fulfill({ status: 204, body: '' });
  });
}

async function capture(browser, entry, { device, viewport, mobile }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  const page = await context.newPage();
  await signIn(page);
  await mockBackend(page, { service: entry.service, jobStatuses: ['completed'] });
  await realMedia(page, entry.demo);
  await page.goto(`${baseURL}/tools/${entry.slug}`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('production-run').waitFor({ state: 'visible', timeout: 60_000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outputDir, `motion-tool-${entry.slug}-${device}-idle.png`), fullPage: true });
  await addClip(page);
  if (entry.audio) await upload(page, 'audio-drop', SONG);
  await page.getByTestId('production-run').click();
  await page.getByTestId('share-row').waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outputDir, `motion-tool-${entry.slug}-${device}-result.png`), fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await context.close();
  return overflow;
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/google-chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
  const failures = [];
  for (const entry of pages) {
    for (const device of viewports) {
      const overflow = await capture(browser, entry, device);
      console.log(`${entry.slug} ${device.device} overflow=${overflow}`);
      if (overflow > 0) failures.push(`${entry.slug}/${device.device}`);
    }
  }
  await browser.close();
  if (failures.length) { console.error(`horizontal overflow: ${failures.join(', ')}`); process.exit(1); }
})().catch((error) => { console.error(error); process.exit(1); });
