const { test, expect } = require('@playwright/test');

const API_KEY = 'mg_outpaint_e2e_key';

const PNG_FIXTURE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAAAAQCbAAAAFElEQVR4nAFw' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAIAAC8AEAA==',
  'base64',
);

async function seed(page) {
  await page.addInitScript(({ apiKey }) => {
    localStorage.setItem('mg_api_key', apiKey);
    localStorage.setItem('mg_user', JSON.stringify({
      id: 'outpaint-e2e-user',
      email: 'outpaint-e2e@manifoldgen.local',
      api_key: apiKey,
      credits: 10_000,
      credits_usd: 100,
    }));
  }, { apiKey: API_KEY });

  await page.route('**/api/auth/session', (route) => route.fulfill({
    status: 200,
    json: {
      user: { id: 'outpaint-e2e-user', email: 'outpaint-e2e@manifoldgen.local', api_key: API_KEY, credits: 10_000 },
      api_key: API_KEY,
      cute_price_usd: 0.01,
      credits_usd: 100,
    },
  }));

  await page.route('**/api/pricing', (route) => route.fulfill({
    status: 200,
    json: { credit_price_usd: 0.01, cute_price_usd: 0.01 },
  }));

  await page.route('**/api/uploads/presign?**', (route) => {
    const filename = new URL(route.request().url()).searchParams.get('filename');
    return route.fulfill({ status: 200, json: { upload_url: `https://uploads.example/${filename}`, public_url: `https://media.example/${filename}` } });
  });
  await page.route('https://uploads.example/**', (route) => route.fulfill({ status: 200 }));
}

async function upload(page) {
  await page.setInputFiles('input[type=file]', { name: 'desert-station.png', mimeType: 'image/png', buffer: PNG_FIXTURE });
}

test('zoom-out mode sends zoom_out_percentage and renders the extended result', async ({ page }) => {
  await seed(page);

  const requests = [];
  await page.route('**/api/service', async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, json: {
      result: { image_url: 'https://studio-result.example/extended.png' },
      credits_used: 10,
      credits_remain: 9_990,
    } });
  });
  await page.route('https://studio-result.example/extended.png', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG_FIXTURE }));

  await page.goto('/tools/outpaint');
  await expect(page.getByText('EXTEND IMAGE', { exact: true })).toBeVisible();
  await upload(page);
  await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  await page.getByLabel(/Zoom-out percentage/).fill('25');
  await page.getByTestId('outpaint-run').click();

  await expect(page.getByTestId('outpaint-result').locator('img')).toBeVisible();
  expect(requests[0]).toMatchObject({ service: 'extend-image', image_url: 'https://media.example/desert-station.png', zoom_out_percentage: 25 });
});

test('per-side mode sends expand fractions from the sliders', async ({ page }) => {
  await seed(page);

  const requests = [];
  await page.route('**/api/service', async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, json: {
      result: { saved_image_url: 'https://studio-result.example/extended-left.png' },
      credits_used: 10,
      credits_remain: 9_990,
    } });
  });
  await page.route('https://studio-result.example/extended-left.png', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG_FIXTURE }));

  await page.goto('/tools/outpaint');
  await upload(page);
  await page.getByLabel(/Expand left/).fill('20');
  await page.getByTestId('outpaint-run').click();

  await expect(page.getByText('READY')).toBeVisible();
  await expect(page.getByTestId('outpaint-result').locator('img')).toBeVisible();
  expect(requests[0]).toMatchObject({
    service: 'extend-image',
    expand_left: 0.2,
    expand_top: 0,
    expand_bottom: 0,
    expand_right: 0,
  });
});

test('run without any expansion shows the client-side validation error', async ({ page }) => {
  await seed(page);
  await page.goto('/tools/outpaint');
  await upload(page);
  const frame = page.locator('div[class*=frame]');
  await expect(frame).toHaveCSS('border-style', 'dashed');
  await expect(frame).toHaveCSS('padding', '0px');
  await page.getByLabel(/Expand left/).fill('20');
  await expect(frame).not.toHaveCSS('padding-left', '0px');
  await page.getByLabel(/Expand left/).fill('0');
  await expect(frame).toHaveCSS('padding-left', '0px');
  await page.getByTestId('outpaint-run').click();
  await expect(page.getByText('Choose at least one side to expand or set zoom-out.')).toBeVisible();
});
