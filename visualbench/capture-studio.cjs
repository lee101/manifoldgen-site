const path = require('path');
const fs = require('fs');
const { chromium } = require('../frontend/node_modules/@playwright/test');

const baseURL = (process.env.VISUALBENCH_BASE_URL || 'http://127.0.0.1:3219').replace(/\/$/, '');
const catalogOrigin = (process.env.VISUALBENCH_CATALOG_ORIGIN || 'https://manifoldgen.com').replace(/\/$/, '');
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

(async () => {
  const requestedExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  const systemChrome = requestedExecutable || (fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);
  const browser = await chromium.launch({ headless: true, ...(systemChrome ? { executablePath: systemChrome } : {}) });
  try {
    for (const mode of ['videos', 'images', 'music']) {
      await capture(browser, { width: 1440, height: 1000 }, 'desktop', mode);
      await capture(browser, { width: 390, height: 844 }, 'mobile', mode);
    }
  } finally {
    await browser.close();
  }
  console.log(`Captured populated Studio media views from ${catalogOrigin} into ${outputDir}`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
