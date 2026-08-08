const fs = require('fs');
const path = require('path');
const { chromium, expect } = require('../frontend/node_modules/@playwright/test');

const outputDir = __dirname;
const baseURL = process.env.VISUALBENCH_BASE_URL || 'http://127.0.0.1:3219';

const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
];

function screenshotPath(viewport, step) {
  return path.join(outputDir, `${viewport}-${step}.png`);
}

async function installMocks(page) {
  await page.route('**/api/pricing', async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        pricing: [
          {
            service: 'h3_video',
            price_usd: 2.688,
            price_cute: 2.688,
            cute_price_usd: 1,
            unit: 'per GPU-hour, metered by app.nz execution time (includes 20% reseller markup)',
          },
        ],
      },
    });
  });

  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        email: 'visual@manifoldgen.local',
        api_key: 'manifoldgen_visualbench_test_key',
        credits: 42.5,
        credits_usd: 42.5,
      },
    });
  });

  await page.route('**/api/auth/email-login', async (route) => {
    const req = route.request().postDataJSON() || {};
    if (!req.email || !req.password || String(req.password).length < 8) {
      await route.fulfill({ status: 400, json: { error: 'valid email and password required' } });
      return;
    }
    await route.fulfill({
      status: 200,
      json: {
        api_key: 'manifoldgen_visualbench_test_key',
        user: { email: req.email },
        created: true,
      },
    });
  });

  await page.route('**/api/balance**', async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        credits: 42.5,
        credits_usd: 42.5,
        total_deposited: 50,
      },
    });
  });

  await page.route('**/api/stripe-checkout', async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        success: true,
        url: 'https://checkout.stripe.com/c/pay/cs_test_visualbench',
        session_id: 'cs_visualbench',
      },
    });
  });

  await page.route('**/api/service', async (route) => {
    await route.fulfill({
      status: 200,
      json: { job_id: 'job_visualbench', status: 'queued' },
    });
  });

  await page.route('**/api/video-jobs/**', async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        id: 'job_visualbench',
        status: 'completed',
        result_url: '',
        cost_usd: 0.084,
      },
    });
  });
}

async function hideNextNoise(page) {
  await page.addStyleTag({
    content: `
      nextjs-portal,
      [data-nextjs-dev-tools-button],
      [data-nextjs-toast],
      [data-nextjs-dialog-overlay] {
        display: none !important;
      }
    `,
  });
}

async function captureViewport(browser, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await installMocks(page);

  await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
  await hideNextNoise(page);
  await expect(page.getByRole('heading', { name: 'ManifoldGen' })).toBeVisible();
  await page.screenshot({ path: screenshotPath(viewport.name, '01-studio'), fullPage: true });

  await page.getByRole('button', { name: 'Settings' }).first().click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.screenshot({ path: screenshotPath(viewport.name, '02-settings'), fullPage: true });
  await page.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.screenshot({ path: screenshotPath(viewport.name, '03-signin'), fullPage: true });

  await page.getByLabel('Email').fill('visual@manifoldgen.local');
  await page.getByLabel('Password').fill('visualbench-pass');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: screenshotPath(viewport.name, '04-signed-in'), fullPage: true });

  await page.goto(`${baseURL}/account`, { waitUntil: 'networkidle' });
  await hideNextNoise(page);
  await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible();
  await page.screenshot({ path: screenshotPath(viewport.name, '05-account'), fullPage: true });

  await context.close();
}

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({
    executablePath:
      process.env.PLAYWRIGHT_CHROME ||
      `${process.env.HOME}/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`,
    headless: true,
  });
  try {
    for (const viewport of viewports) {
      await captureViewport(browser, viewport);
    }
  } finally {
    await browser.close();
  }
  console.log(`Screenshots written to ${outputDir}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
