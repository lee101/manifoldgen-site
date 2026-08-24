const { test, expect } = require('@playwright/test');

const API_KEY = 'mg_cinematic_cameras_e2e_key';

const PNG_FIXTURE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAAAAQCbAAAAFElEQVR4nAFw' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAIAAC8AEAA==',
  'base64',
);

test('cinematic cameras renders through zimage with camera preset appended', async ({ page }) => {
  await page.addInitScript(({ apiKey }) => {
    localStorage.setItem('mg_api_key', apiKey);
    localStorage.setItem('mg_user', JSON.stringify({
      id: 'cinematic-cameras-e2e-user',
      email: 'cinematic-cameras-e2e@manifoldgen.local',
      api_key: apiKey,
      credits: 10_000,
      credits_usd: 100,
    }));
  }, { apiKey: API_KEY });

  await page.route('**/api/auth/session', (route) => route.fulfill({
    status: 200,
    json: {
      user: { id: 'cinematic-cameras-e2e-user', email: 'cinematic-cameras-e2e@manifoldgen.local', api_key: API_KEY, credits: 10_000 },
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
      result: { images: [{ image_url: 'https://studio-result.example/cinematic.png' }] },
      credits_used: 4,
      credits_remain: 9996,
      usd_equivalent: 0.04,
    } });
  });
  await page.route('https://studio-result.example/cinematic.png', (route) => route.fulfill({
    status: 200,
    contentType: 'image/png',
    body: PNG_FIXTURE,
  }));

  await page.goto('/tools/cinematic-cameras');
  await expect(page.getByText('CINEMATIC CAMERAS', { exact: true })).toBeVisible();
  await page.getByTestId('cinematic-cameras-prompt').fill('a lighthouse on black basalt');
  await page.getByRole('button', { name: 'dolly-in close-up', exact: true }).click();
  await page.getByRole('button', { name: 'anamorphic 35mm lens flare', exact: true }).click();
  await page.getByTestId('cinematic-cameras-run').click();

  await expect(page.getByTestId('cinematic-cameras-result').locator('img')).toBeVisible();
  expect(requests[0]).toMatchObject({ service: 'zimage', width: 1024, height: 1024, n: 1 });
  expect(requests[0].prompt).toContain('dolly-in close-up');
  expect(requests[0].prompt).toContain('anamorphic 35mm lens flare');
});
