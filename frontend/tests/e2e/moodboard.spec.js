const { test, expect } = require('@playwright/test');

const API_KEY = 'mg_moodboard_e2e_key';

const PNG_FIXTURE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAAAAQCbAAAAFElEQVR4nAFw' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAIAAC8AEAA==',
  'base64',
);

test('soul moodboard fuses uploaded references into one design', async ({ page }) => {
  await page.addInitScript(({ apiKey }) => {
    localStorage.setItem('mg_api_key', apiKey);
    localStorage.setItem('mg_user', JSON.stringify({
      id: 'moodboard-e2e-user',
      email: 'moodboard-e2e@manifoldgen.local',
      api_key: apiKey,
      credits: 10_000,
      credits_usd: 100,
    }));
  }, { apiKey: API_KEY });

  await page.route('**/api/auth/session', (route) => route.fulfill({
    status: 200,
    json: {
      user: { id: 'moodboard-e2e-user', email: 'moodboard-e2e@manifoldgen.local', api_key: API_KEY, credits: 10_000 },
      api_key: API_KEY,
      cute_price_usd: 0.01,
      credits_usd: 100,
    },
  }));

  await page.route('**/api/pricing', (route) => route.fulfill({
    status: 200,
    json: { credit_price_usd: 0.01, cute_price_usd: 0.01, image_credits: 4, image_price_usd: 0.04 },
  }));

  let uploadCount = 0;
  await page.route('**/api/uploads/presign*', async (route) => {
    uploadCount += 1;
    await route.fulfill({ status: 200, json: {
      upload_url: `https://upload.example/moodboard-${uploadCount}`,
      public_url: `https://refs.example/reference-${uploadCount}.png`,
    } });
  });
  await page.route('https://upload.example/*', (route) => route.fulfill({ status: 200, body: '' }));
  for (const n of [1, 2]) {
    await page.route(`https://refs.example/reference-${n}.png`, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG_FIXTURE }));
  }

  const requests = [];
  await page.route('**/api/service', async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, json: {
      result: { image_url: 'https://mood-result.example/fused.png' },
      credits_used: 16,
      credits_remain: 9_984,
      usd_equivalent: 0.16,
    } });
  });
  await page.route('https://mood-result.example/fused.png', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG_FIXTURE }));

  await page.goto('/tools/moodboard');
  await expect(page.getByText('SOUL MOODBOARD', { exact: true })).toBeVisible();
  const run = page.getByTestId('moodboard-run');
  await expect(run).toBeDisabled();

  await page.setInputFiles('input[type=file]', [
    { name: 'ref-a.png', mimeType: 'image/png', buffer: PNG_FIXTURE },
    { name: 'ref-b.png', mimeType: 'image/png', buffer: PNG_FIXTURE },
  ]);
  await expect(page.getByAltText('Reference 1', { exact: true })).toBeVisible();
  await page.getByTestId('moodboard-prompt').fill('Fuse these references into one cohesive poster with a shared palette.');
  await run.click();

  await expect(page.getByTestId('moodboard-result').locator('img')).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({
    service: 'openpaths-image',
    model: 'nano-banana-2',
    image_url: 'https://refs.example/reference-1.png',
    reference_image_urls: [
      'https://refs.example/reference-1.png',
      'https://refs.example/reference-2.png',
    ],
    n: 1,
  });
});
