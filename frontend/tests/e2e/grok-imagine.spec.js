const { test, expect } = require('@playwright/test');

const API_KEY = 'mg_grok_imagine_e2e_key';

const PNG_FIXTURE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAAAAQCbAAAAFElEQVR4nAFw' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAIAAC8AEAA==',
  'base64',
);

test('grok imagine tool sends openpaths-image request and renders result', async ({ page }) => {
  await page.addInitScript(({ apiKey }) => {
    localStorage.setItem('mg_api_key', apiKey);
    localStorage.setItem('mg_user', JSON.stringify({
      id: 'grok-imagine-e2e-user',
      email: 'grok-imagine-e2e@manifoldgen.local',
      api_key: apiKey,
      credits: 10_000,
      credits_usd: 100,
    }));
  }, { apiKey: API_KEY });

  await page.route('**/api/auth/session', (route) => route.fulfill({
    status: 200,
    json: {
      user: { id: 'grok-imagine-e2e-user', email: 'grok-imagine-e2e@manifoldgen.local', api_key: API_KEY, credits: 10_000 },
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
      result: { data: [{ url: 'https://grok-result.example/generated.png' }] },
      credits_used: 9,
      credits_remain: 9991,
      usd_equivalent: 0.09,
    } });
  });
  await page.route('https://grok-result.example/generated.png', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG_FIXTURE }));

  await page.goto('/tools/grok-imagine');
  await expect(page.locator('header').getByText('GROK IMAGINE')).toBeVisible();
  await expect(page.getByTestId('grok-imagine-price')).toHaveText('~4 credits · $0.04');

  await page.getByLabel('Prompt').fill('a cliffside observatory in quiet late-afternoon haze');
  await page.getByLabel('Quality').selectOption('2k');
  await expect(page.getByTestId('grok-imagine-price')).toHaveText('~9 credits · $0.09');

  await page.getByTestId('grok-imagine-run').click();
  const result = page.getByTestId('grok-imagine-result');
  await expect(result.locator('img')).toBeVisible();
  await expect(result.getByLabel('Download image')).toBeVisible();
  expect(requests[0]).toMatchObject({
    service: 'openpaths-image',
    model: 'grok-imagine',
    prompt: 'a cliffside observatory in quiet late-afternoon haze',
    aspect_ratio: '16:9',
    resolution: '2k',
    n: 1,
  });
});
