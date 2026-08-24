const { test, expect } = require('@playwright/test');

const API_KEY = 'mg_gpt_image_e2e_key';

const PNG_FIXTURE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAAAAQCbAAAAFElEQVR4nAFw' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAIAAC8AEAA==',
  'base64',
);

test('gpt image 2 tool sends openpaths-image request and renders result', async ({ page }) => {
  await page.addInitScript(({ apiKey }) => {
    localStorage.setItem('mg_api_key', apiKey);
    localStorage.setItem('mg_user', JSON.stringify({
      id: 'gpt-image-e2e-user',
      email: 'gpt-image-e2e@manifoldgen.local',
      api_key: apiKey,
      credits: 10_000,
      credits_usd: 100,
    }));
  }, { apiKey: API_KEY });

  await page.route('**/api/auth/session', (route) => route.fulfill({
    status: 200,
    json: {
      user: { id: 'gpt-image-e2e-user', email: 'gpt-image-e2e@manifoldgen.local', api_key: API_KEY, credits: 10_000 },
      api_key: API_KEY,
      credit_price_usd: 0.01,
      credits_usd: 100,
    },
  }));

  await page.route('**/api/pricing', (route) => route.fulfill({
    status: 200,
    json: { credit_price_usd: 0.01 },
  }));

  await page.route('https://manifoldgenstatic.manifoldgen.com/gallery/originals/d9e1b11a3ec6e66f_22e5d455.webp', (route) => route.fulfill({ status: 200, contentType: 'image/webp', body: PNG_FIXTURE }));

  const requests = [];
  await page.route('**/api/service', async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, json: {
      result: {
        data: [
          { url: 'https://gpt-image-result.example/out.png' },
          { url: 'https://gpt-image-result.example/out-2.png' },
        ],
      },
      credits_used: 48,
      credits_remain: 9_952,
    } });
  });
  for (const n of ['', '-2']) {
    await page.route(`https://gpt-image-result.example/out${n}.png`, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG_FIXTURE }));
  }

  await page.goto('/tools/gpt-image');
  await expect(page.getByText('GPT IMAGE 2', { exact: true })).toBeVisible();

  await page.getByTestId('gpt-image-prompt').fill('a floating botanical conservatory beneath a star-filled sky');
  await page.getByTestId('gpt-image-run').click();

  const result = page.getByTestId('gpt-image-result');
  await expect(result.locator('img')).toHaveCount(2);
  expect(requests[0]).toMatchObject({
    service: 'openpaths-image',
    model: 'gpt-image-2',
    prompt: 'a floating botanical conservatory beneath a star-filled sky',
    width: 1024,
    height: 1024,
    n: 1,
  });
  expect(requests[0].seed).toBeUndefined();
});
