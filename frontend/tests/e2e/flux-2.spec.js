const { test, expect } = require('@playwright/test');

const API_KEY = 'mg_flux_2_e2e_key';

const PNG_FIXTURE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAAAAQCbAAAAFElEQVR4nAFw' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAIAAC8AEAA==',
  'base64',
);

test('flux-2 generates images across the FLUX family', async ({ page }) => {
  await page.addInitScript(({ apiKey }) => {
    localStorage.setItem('mg_api_key', apiKey);
    localStorage.setItem('mg_user', JSON.stringify({
      id: 'flux-2-e2e-user',
      email: 'flux-2-e2e@manifoldgen.local',
      api_key: apiKey,
      credits: 10_000,
      credits_usd: 100,
    }));
  }, { apiKey: API_KEY });

  await page.route('**/api/auth/session', (route) => route.fulfill({
    status: 200,
    json: {
      user: { id: 'flux-2-e2e-user', email: 'flux-2-e2e@manifoldgen.local', api_key: API_KEY, credits: 10_000 },
      api_key: API_KEY,
      credit_price_usd: 0.01,
      credits_usd: 100,
    },
  }));

  await page.route('**/api/pricing', (route) => route.fulfill({
    status: 200,
    json: { credit_price_usd: 0.01 },
  }));

  await page.route('https://manifoldgenstatic.manifoldgen.com/gallery/originals/ea0d66c5b19b8439_64411e9f.webp', (route) => route.fulfill({ status: 200, contentType: 'image/webp', body: PNG_FIXTURE }));

  const requests = [];
  await page.route('**/api/service', async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, json: {
      result: { saved_image_url: 'https://flux-result.example/flux.png' },
      credits_used: 3,
      credits_remain: 9_997,
    } });
  });
  await page.route('https://flux-result.example/flux.png', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG_FIXTURE }));
  await page.goto('/tools/flux-2');
  await expect(page.getByText('FLUX.2', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Cliffside observatory/ })).toBeVisible();
  await page.getByTestId('flux-2-prompt').fill('a paper-cut lighthouse over card-stock waves');
  await page.getByLabel('Size').selectOption('landscape');
  await page.getByLabel('Model').selectOption('flux-2-dev');
  await expect(page.getByText('~4 credits · $0.04')).toBeVisible();
  await page.getByTestId('flux-2-run').click();
  await expect(page.getByTestId('flux-2-result').locator('img[src="https://flux-result.example/flux.png"]')).toBeVisible();
  expect(requests[0]).toMatchObject({ service: 'openpaths-image', model: 'flux-2-dev', width: 1536, height: 1024, n: 1 });

  await page.getByLabel('Model').selectOption('flux-2-klein');
  await page.getByTestId('flux-2-run').click();
  expect(requests[1]).toMatchObject({ service: 'openpaths-image', model: 'flux-2-klein', width: 1536, height: 1024 });
});

test('flux-2 blocks runs without a signed-in user', async ({ page }) => {
  await page.route('**/api/pricing', (route) => route.fulfill({ status: 200, json: { credit_price_usd: 0.01 } }));
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, json: { user: null, api_key: null } }));
  const requests = [];
  await page.route('**/api/service', async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, json: {} });
  });
  await page.goto('/tools/flux-2');
  await page.getByTestId('flux-2-prompt').fill('a paper-cut lighthouse');
  await page.getByTestId('flux-2-run').click();
  await expect(page.locator('main').getByRole('alert')).toContainText('Sign in to use FLUX.2.');
  expect(requests).toHaveLength(0);
});
