const { test, expect } = require('@playwright/test');

const API_KEY = 'mg_make_image_e2e_key';

const PNG_FIXTURE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAAAAQCbAAAAFElEQVR4nAFw' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAIAAC8AEAA==',
  'base64',
);

test('bulk image tool generates variants across a chosen engine', async ({ page }) => {
  await page.addInitScript(({ apiKey }) => {
    localStorage.setItem('mg_api_key', apiKey);
    localStorage.setItem('mg_user', JSON.stringify({
      id: 'make-image-e2e-user',
      email: 'make-image-e2e@manifoldgen.local',
      api_key: apiKey,
      credits: 10_000,
      credits_usd: 100,
    }));
  }, { apiKey: API_KEY });

  await page.route('**/api/auth/session', (route) => route.fulfill({
    status: 200,
    json: {
      user: { id: 'make-image-e2e-user', email: 'make-image-e2e@manifoldgen.local', api_key: API_KEY, credits: 10_000 },
      api_key: API_KEY,
      cute_price_usd: 0.01,
      credits_usd: 100,
    },
  }));

  await page.route('**/api/pricing', (route) => route.fulfill({
    status: 200,
    json: { credit_price_usd: 0.01, cute_price_usd: 0.01, image_credits: 4, image_price_usd: 0.04 },
  }));

  const requests = [];
  await page.route('**/api/service', async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, json: {
      images: [
        { image_url: 'https://studio-result.example/generated.png' },
        { image_url: 'https://studio-result.example/generated-2.png' },
        { image_url: 'https://studio-result.example/generated-3.png' },
        { image_url: 'https://studio-result.example/generated-4.png' },
      ],
      engine: 'omniserve-native',
    } });
  });
  for (const n of ['', '-2', '-3', '-4']) {
    await page.route(`https://studio-result.example/generated${n}.png`, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG_FIXTURE }));
  }

  await page.goto('/tools/make-image');
  await expect(page.getByText('MAKE IMAGE')).toBeVisible();
  await page.getByLabel('Prompts — one per line').fill('a glass hummingbird in a greenhouse');
  await page.getByRole('button', { name: /Generate 4 images/ }).click();
  await expect(page.getByText('VARIANTS · 4')).toBeVisible();
  expect(requests[0]).toMatchObject({ service: 'zimage', image_backend: 'omniserve' });
});