const { test, expect } = require('@playwright/test');

const API_KEY = 'mg_nano_banana_e2e_key';

const PNG_FIXTURE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAAAAQCbAAAAFElEQVR4nAFw' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAIAAC8AEAA==',
  'base64',
);

test('nano banana 2 generates variants and asserts the openpaths-image request body', async ({ page }) => {
  await page.addInitScript(({ apiKey }) => {
    localStorage.setItem('mg_api_key', apiKey);
    localStorage.setItem('mg_user', JSON.stringify({
      id: 'nano-banana-e2e-user',
      email: 'nano-banana-e2e@manifoldgen.local',
      api_key: apiKey,
      credits: 10_000,
      credits_usd: 100,
    }));
  }, { apiKey: API_KEY });

  await page.route('**/api/auth/session', (route) => route.fulfill({
    status: 200,
    json: {
      user: { id: 'nano-banana-e2e-user', email: 'nano-banana-e2e@manifoldgen.local', api_key: API_KEY, credits: 10_000 },
      api_key: API_KEY,
      cute_price_usd: 0.01,
      credits_usd: 100,
    },
  }));

  await page.route('**/api/pricing', (route) => route.fulfill({
    status: 200,
    json: { credit_price_usd: 0.01, cute_price_usd: 0.01, image_credits: 16, image_price_usd: 0.16 },
  }));

  const requests = [];
  await page.route('**/api/service', async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, json: {
      result: {
        created: 1760000000,
        data: [
          { url: 'https://studio-result.example/nano-banana-1.png' },
          { url: 'https://studio-result.example/nano-banana-2.png' },
          { url: 'https://studio-result.example/nano-banana-3.png' },
        ],
      },
      credits_used: 48,
      credits_remain: 9952,
    } });
  });
  for (const n of [1, 2, 3]) {
    await page.route(`https://studio-result.example/nano-banana-${n}.png`, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG_FIXTURE }));
  }

  await page.goto('/tools/nano-banana');
  await expect(page.getByText('NANO BANANA 2').first()).toBeVisible();
  await page.getByTestId('nano-banana-prompt').fill('glass monorail in crisp winter sunlight');
  await page.getByTestId('nano-banana-count').fill('3');
  await page.getByTestId('nano-banana-resolution').selectOption('2k');
  await page.getByTestId('nano-banana-run').click();

  await expect(page.getByTestId('nano-banana-result').locator('img')).toHaveCount(3);
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({
    service: 'openpaths-image',
    model: 'nano-banana-2',
    prompt: 'glass monorail in crisp winter sunlight',
    aspect_ratio: 'square',
    resolution: '2k',
    n: 3,
  });
});

test('reference edit adds image_url to the request body', async ({ page }) => {
  await page.addInitScript(({ apiKey }) => {
    localStorage.setItem('mg_api_key', apiKey);
    localStorage.setItem('mg_user', JSON.stringify({
      id: 'nano-banana-e2e-user',
      email: 'nano-banana-e2e@manifoldgen.local',
      api_key: apiKey,
      credits: 10_000,
      credits_usd: 100,
    }));
  }, { apiKey: API_KEY });

  await page.route('**/api/pricing', (route) => route.fulfill({
    status: 200,
    json: { credit_price_usd: 0.01, cute_price_usd: 0.01 },
  }));

  await page.route('**/api/uploads/presign*', (route) => route.fulfill({
    status: 200,
    json: { upload_url: 'https://upload.example/put', public_url: 'https://cdn.example/reference.webp' },
  }));
  await page.route('https://upload.example/put', (route) => route.fulfill({ status: 200, body: '' }));

  const requests = [];
  await page.route('**/api/service', async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, json: {
      result: { data: [{ url: 'https://studio-result.example/nano-banana-edit.png' }] },
      credits_used: 16,
      credits_remain: 9984,
    } });
  });
  await page.route('https://studio-result.example/nano-banana-edit.png', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG_FIXTURE }));

  await page.goto('/tools/nano-banana');
  await page.getByRole('button', { name: 'Reference Edit' }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: 'ref.png', mimeType: 'image/png', buffer: PNG_FIXTURE });
  await page.getByTestId('nano-banana-prompt').fill('make the monorail red');
  await page.getByTestId('nano-banana-run').click();

  await expect(page.getByTestId('nano-banana-result').locator('img')).toHaveCount(1);
  expect(requests[0]).toMatchObject({
    service: 'openpaths-image',
    model: 'nano-banana-2',
    prompt: 'make the monorail red',
    resolution: '1k',
    n: 1,
    image_url: 'https://cdn.example/reference.webp',
  });
});
