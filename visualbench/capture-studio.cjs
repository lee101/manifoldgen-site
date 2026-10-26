const path = require('path');
const fs = require('fs');
const { chromium } = require('../frontend/node_modules/@playwright/test');

const baseURL = (process.env.VISUALBENCH_BASE_URL || 'http://127.0.0.1:3219').replace(/\/$/, '');
const catalogOrigin = (process.env.VISUALBENCH_CATALOG_ORIGIN || 'https://manifoldgen.com').replace(/\/$/, '');
const galleryImageURL = process.env.VISUALBENCH_STUDIO_IMAGE_URL || 'https://manifoldgenstatic.manifoldgen.com/gallery/originals/6d8e21e1b77e32bd_af6cc51c.webp';
const galleryImageName = process.env.VISUALBENCH_STUDIO_IMAGE_NAME || 'Surreal desert cathedral of bone-white arches, lone dancer silhouette, golden hour';
const outputDir = __dirname;

const catalogPaths = [
  '/api/videos/featured',
  '/api/search',
  '/api/images',
  '/api/studio/audio-search',
];

async function proxyProductionCatalog(page) {
  await page.route('**/api/**', async (route) => {
    const requestURL = new URL(route.request().url());
    if (!catalogPaths.some((pathname) => requestURL.pathname === pathname || requestURL.pathname.startsWith(`${pathname}/`))) {
      await route.continue();
      return;
    }
    try {
      const response = await fetch(`${catalogOrigin}${requestURL.pathname}${requestURL.search}`, {
        headers: { accept: 'application/json' },
      });
      await route.fulfill({
        status: response.status,
        contentType: response.headers.get('content-type') || 'application/json',
        body: Buffer.from(await response.arrayBuffer()),
      });
    } catch (error) {
      await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: String(error) }) });
    }
  });
}

async function captureLoaderReview(browser) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 1 });
  await page.goto(`${baseURL}/visual-review`, { waitUntil: 'networkidle' });
  await page.getByRole('img', { name: 'Brand reference' }).waitFor({ state: 'visible' });
  await page.screenshot({ path: path.join(outputDir, 'manifold-loader-review.png'), fullPage: true });
  await page.close();
}

async function captureHomepageGallery(browser, viewport, device) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await proxyProductionCatalog(page);
  await page.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded' });
  const gallery = page.getByTestId('still-gallery');
  await gallery.waitFor({ state: 'visible', timeout: 20_000 });
  await page.locator('[data-testid^="gallery-video-"]').first().waitFor({ state: 'visible', timeout: 20_000 });
  await gallery.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(outputDir, `homepage-${device}-gallery.png`), fullPage: false });
  await page.close();
}

async function captureTools(browser, viewport, device) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await page.goto(`${baseURL}/tools`, { waitUntil: 'networkidle' });
  await page.getByTestId('tools-search').waitFor({ state: 'visible' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(outputDir, `tools-${device}.png`) });
  await page.close();
}

async function capture(browser, viewport, device, mode) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await proxyProductionCatalog(page);
  await page.goto(`${baseURL}/studio`, { waitUntil: 'networkidle' });
  if (device === 'mobile') await page.getByTestId('studio-tool-media').click();
  await page.getByTestId(`studio-media-${mode}`).click();

  const readySelector = mode === 'videos'
    ? '[data-testid^="studio-video-hit-"]'
    : mode === 'images'
      ? '[data-testid^="studio-image-hit-"]'
      : '[data-testid^="studio-music-hit-"]';
  await page.locator(readySelector).first().waitFor({ state: 'visible', timeout: 20_000 });
  if (mode === 'images') {
    await page.locator(`${readySelector} img`).first().waitFor({ state: 'visible', timeout: 10_000 });
    await page.waitForFunction((selector) => {
      const image = document.querySelector(selector);
      return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0;
    }, `${readySelector} img`, { timeout: 15_000 });
    await page.locator(readySelector).first().scrollIntoViewIfNeeded();
  }
  if (mode === 'videos') {
    await page.waitForFunction((selector) => [...document.querySelectorAll(selector)].some((video) => video instanceof HTMLVideoElement && video.readyState >= 2), `${readySelector} video`, { timeout: 15_000 }).catch(() => undefined);
  }
  await page.screenshot({ path: path.join(outputDir, `studio-${device}-${mode}.png`), fullPage: false });
  await page.close();
}

// Exercise the exact gallery-to-Studio handoff used by the gallery’s “edit in
// Studio” link. The image is fulfilled from its public source at the local
// proxy URL, so this remains useful even when the local Go API is not running.
async function captureGalleryImage(browser, viewport, device) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await page.route('**/api/gallery-assets/**', async (route) => {
    try {
      const response = await fetch(galleryImageURL);
      await route.fulfill({
        status: response.status,
        contentType: response.headers.get('content-type') || 'image/webp',
        body: Buffer.from(await response.arrayBuffer()),
      });
    } catch (error) {
      await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: String(error) }) });
    }
  });
  const studioURL = new URL(`${baseURL}/studio`);
  studioURL.searchParams.set('image_url', galleryImageURL);
  studioURL.searchParams.set('name', galleryImageName);
  await page.goto(studioURL.toString(), { waitUntil: 'domcontentloaded' });
  const stageElement = page.getByTestId('studio-stage-element');
  await stageElement.waitFor({ state: 'visible', timeout: 20_000 });
  await page.waitForFunction(() => {
    const canvas = document.querySelector('[data-testid="studio-stage-element"] canvas');
    return canvas instanceof HTMLCanvasElement && canvas.width > 16 && canvas.height > 16;
  }, { timeout: 10_000 });
  await page.screenshot({ path: path.join(outputDir, `studio-${device}-gallery-image.png`), fullPage: false });
  await page.close();
}

// Motion FX lives behind the signed-in AI tools panel. Auth, cloud save and the
// upload endpoints are stubbed so the capture needs only a Studio dev server.
const motionVideo = path.resolve(__dirname, '../frontend/public/showcase/h3-loop-glass-torus.webm');

async function captureMotionFx(browser, viewport, device) {
  const apiKey = 'mg_visualbench_key';
  const user = { id: 'visualbench', email: 'bench@example.com', api_key: apiKey, credits: 10000, credits_usd: 100 };
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await page.addInitScript(({ key, value }) => {
    localStorage.setItem('mg_api_key', key);
    localStorage.setItem('mg_user', JSON.stringify(value));
  }, { key: apiKey, value: user });
  await page.route('**/api/pricing', (route) => route.fulfill({ status: 200, json: { credit_price_usd: 0.01 } }));
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, json: { user } }));
  await page.route('**/api/video-jobs', (route) => route.fulfill({ status: 200, json: { jobs: [] } }));
  await page.route('**/api/studio/projects', (route) => route.fulfill({ status: 200, json: { projects: [] } }));
  await page.route('**/api/studio/projects/*', (route) => {
    if (route.request().method() !== 'PUT') return route.fulfill({ status: 404, json: { error: 'project not found' } });
    const body = route.request().postDataJSON();
    const now = new Date().toISOString();
    return route.fulfill({ status: 200, json: { project: { id: new URL(route.request().url()).pathname.split('/').pop(), name: body.name, document: body.document, revision: 1, created_at: now, updated_at: now } } });
  });
  await page.route('**/api/studio/assets/presign', async (route) => {
    const body = route.request().postDataJSON();
    await route.fulfill({ status: 200, json: {
      upload_url: `https://studio-upload.example/${body.project_id}/${body.asset_id}`,
      public_url: `https://studio-media.example/${body.project_id}/${body.asset_id}/${encodeURIComponent(body.filename)}`,
      object_key: `gallery/studio/bench/${body.project_id}/${body.asset_id}/${body.filename}`,
    } });
  });
  await page.route('https://studio-upload.example/**', (route) => route.fulfill({ status: 200 }));
  await page.goto(`${baseURL}/studio`, { waitUntil: 'load' });
  await page.getByTestId('studio-save-status').waitFor({ state: 'attached', timeout: 60_000 });
  await page.waitForTimeout(1500);
  if (device === 'mobile') await page.getByTestId('studio-tool-media').click();
  await page.locator('input[type=file]').setInputFiles(motionVideo);
  await page.getByTestId('studio-panel').getByRole('button', { name: /h3-loop-glass-torus\.webm/ }).first().waitFor({ state: 'visible', timeout: 60_000 }).catch(async (error) => {
    await page.screenshot({ path: path.join(outputDir, `studio-${device}-motion-fx-failed.png`) });
    throw error;
  });
  await page.getByTestId('studio-tool-ai').click();
  await page.getByTestId('studio-motion-open').waitFor({ state: 'visible' });
  await page.screenshot({ path: path.join(outputDir, `studio-${device}-motion-fx-panel.png`), fullPage: false });
  await page.getByTestId('studio-motion-open').click();
  await page.getByTestId('motion-fx-dialog').waitFor({ state: 'visible' });
  await page.getByTestId('motion-preset-ki-aura').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outputDir, `studio-${device}-motion-fx-dialog.png`), fullPage: false });
  await page.close();
}

(async () => {
  const requestedExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  const systemChrome = requestedExecutable || (fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);
  const browser = await chromium.launch({ headless: true, ...(systemChrome ? { executablePath: systemChrome } : {}) });
  try {
    if (process.env.VISUALBENCH_MOTION_ONLY === '1') {
      await captureMotionFx(browser, { width: 1440, height: 1000 }, 'desktop');
      await captureMotionFx(browser, { width: 390, height: 844 }, 'mobile');
      return;
    }
    await captureLoaderReview(browser);
    if (process.env.VISUALBENCH_LOADER_ONLY === '1') return;
    await captureHomepageGallery(browser, { width: 1440, height: 1000 }, 'desktop');
    await captureHomepageGallery(browser, { width: 390, height: 844 }, 'mobile');
    await captureGalleryImage(browser, { width: 1440, height: 1000 }, 'desktop');
    await captureGalleryImage(browser, { width: 390, height: 844 }, 'mobile');
    await captureTools(browser, { width: 1440, height: 1000 }, 'desktop');
    await captureTools(browser, { width: 390, height: 844 }, 'mobile');
    await captureMotionFx(browser, { width: 1440, height: 1000 }, 'desktop');
    await captureMotionFx(browser, { width: 390, height: 844 }, 'mobile');
    if (process.env.VISUALBENCH_GALLERY_ONLY !== '1') {
      for (const mode of ['videos', 'images', 'music']) {
        await capture(browser, { width: 1440, height: 1000 }, 'desktop', mode);
        await capture(browser, { width: 390, height: 844 }, 'mobile', mode);
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`Captured populated Studio media views from ${catalogOrigin} into ${outputDir}`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
