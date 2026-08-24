const { test, expect } = require('@playwright/test');

const API_KEY = 'mg_image_upscale_e2e_key';

const PNG_FIXTURE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const EXAMPLE = 'https://manifoldgenstatic.manifoldgen.com/gallery/originals/ea0d66c5b19b8439_64411e9f.webp';

test('upscale tool sends a flat-rate upscale-image request and shows the result', async ({ page }) => {
  await page.addInitScript(({ apiKey }) => {
    localStorage.setItem('mg_api_key', apiKey);
    localStorage.setItem('mg_user', JSON.stringify({
      id: 'image-upscale-e2e-user',
      email: 'image-upscale-e2e@manifoldgen.local',
      api_key: apiKey,
      credits: 10_000,
      credits_usd: 100,
    }));
  }, { apiKey: API_KEY });

  await page.route('**/api/auth/session', (route) => route.fulfill({
    status: 200,
    json: {
      user: { id: 'image-upscale-e2e-user', email: 'image-upscale-e2e@manifoldgen.local', api_key: API_KEY, credits: 10_000 },
      api_key: API_KEY,
      cute_price_usd: 0.01,
      credits_usd: 100,
    },
  }));

  await page.route('**/api/pricing', (route) => route.fulfill({
    status: 200,
    json: { credit_price_usd: 0.01, cute_price_usd: 0.01 },
  }));

  const requests = [];
  await page.route('**/api/service', async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, json: {
      result: { image_url: 'https://studio-result.example/upscaled.png' },
      credits_used: 15,
      credits_remain: 9_985,
    } });
  });
  await page.route('https://manifoldgenstatic.manifoldgen.com/gallery/originals/ea0d66c5b19b8439_64411e9f.webp', (route) => route.fulfill({ status: 200, contentType: 'image/webp', body: PNG_FIXTURE }));
  await page.route('https://studio-result.example/upscaled.png', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG_FIXTURE }));

  await page.goto('/tools/image-upscale');
  await expect(page.getByText('IMAGE UPSCALE', { exact: true })).toBeVisible();
  await page.getByTestId('image-upscale-run').click();
  await expect(page.getByTestId('image-upscale-result').getByAltText('Upscaled result')).toBeVisible();
  expect(requests[0]).toMatchObject({ service: 'upscale-image', image_url: EXAMPLE });
});
