const { test, expect } = require('@playwright/test');

const API_KEY = 'mg_relight_e2e_key';

const PNG_FIXTURE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAAAAQCbAAAAFElEQVR4nAFw' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAIAAC8AEAA==',
  'base64',
);

test('relight tool sends the selected lighting direction and renders the result', async ({ page }) => {
  await page.addInitScript(({ apiKey }) => {
    localStorage.setItem('mg_api_key', apiKey);
    localStorage.setItem('mg_user', JSON.stringify({
      id: 'relight-e2e-user',
      email: 'relight-e2e@manifoldgen.local',
      api_key: apiKey,
      credits: 10_000,
      credits_usd: 100,
    }));
  }, { apiKey: API_KEY });

  await page.route('**/api/auth/session', (route) => route.fulfill({
    status: 200,
    json: {
      user: { id: 'relight-e2e-user', email: 'relight-e2e@manifoldgen.local', api_key: API_KEY, credits: 10_000 },
      api_key: API_KEY,
      cute_price_usd: 0.01,
      credits_usd: 100,
    },
  }));

  await page.route('**/api/pricing', (route) => route.fulfill({
    status: 200,
    json: { credit_price_usd: 0.01, cute_price_usd: 0.01, image_credits: 4, image_price_usd: 0.04 },
  }));

  await page.route('**/api/uploads/presign*', (route) => route.fulfill({
    status: 200,
    json: { upload_url: 'https://upload.example/relight-fixture', public_url: 'https://uploads.example/relight-fixture.png' },
  }));
  await page.route('https://upload.example/*', (route) => route.fulfill({ status: 200, body: '' }));
  await page.route('**/manifoldgenstatic.manifoldgen.com/**', (route) => route.fulfill({ status: 200, contentType: 'image/webp', body: PNG_FIXTURE }));

  const requests = [];
  await page.route('**/api/service', async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, json: {
      result: { images: [{ image_url: 'https://relight-result.example/relit.png' }] },
      credits_used: 12,
      credits_remain: 9_988,
    } });
  });
  await page.route('https://relight-result.example/relit.png', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG_FIXTURE }));

  await page.goto('/tools/relight');
  await expect(page.getByText('RELIGHT', { exact: true })).toBeVisible();
  await page.setInputFiles('input[type="file"]', { name: 'relight-fixture.png', mimeType: 'image/png', buffer: PNG_FIXTURE });
  await page.getByTestId('relight-prompt').fill('warm golden-hour sunlight, soft shadows');
  await page.getByLabel('Lighting direction').selectOption('left');
  await page.getByTestId('relight-run').click();
  await expect(page.getByTestId('relight-result').locator('img')).toBeVisible();
  expect(requests[0]).toMatchObject({
    service: 'relight',
    kind: 'left',
    image_url: 'https://uploads.example/relight-fixture.png',
    aspect_ratio: 'square',
    n: 1,
  });
});
