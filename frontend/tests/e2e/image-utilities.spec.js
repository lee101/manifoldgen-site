const { test, expect } = require('@playwright/test');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test('new tools are searchable and usable on mobile without JavaScript errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tools');
  await page.getByTestId('tools-search').fill('smart resize');
  await page.locator('section').getByRole('link', { name: /Smart Resize/ }).click();
  await expect(page.getByRole('heading', { name: 'Smart Resize' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

async function prepare(page) {
  await page.addInitScript(() => {
    localStorage.setItem('mg_api_key', 'mg_image_utilities_test');
    localStorage.setItem('mg_user', JSON.stringify({ id: 'utilities', email: 'test@example.com', api_key: 'mg_image_utilities_test', credits: 10000, credits_usd: 100 }));
  });
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, json: { user: { id: 'utilities', api_key: 'mg_image_utilities_test', credits: 10000 }, api_key: 'mg_image_utilities_test', credits_usd: 100 } }));
  await page.route('**/api/pricing', (route) => route.fulfill({ status: 200, json: { credit_price_usd: 0.01 } }));
  await page.route('**/api/uploads/presign*', (route) => route.fulfill({ status: 200, json: { upload_url: 'https://upload.example/source', public_url: 'https://uploads.example/source.png' } }));
  await page.route('https://upload.example/source', (route) => route.fulfill({ status: 200 }));
  await page.route('https://results.example/**', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
}

test('smart resize uploads once, sends multiple sizes and displays durable PNGs', async ({ page }) => {
  await prepare(page);
  const requests = [];
  await page.route('**/api/service', (route) => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ status: 200, json: { result: { data: [{ url: 'https://temporary.example/one.png' }, { url: 'https://temporary.example/two.png' }] }, saved_image_urls: ['https://results.example/square.png', 'https://results.example/story.png'] } });
  });
  await page.goto('/tools/smart-resize');
  await page.setInputFiles('input[type=file]', { name: 'source.png', mimeType: 'image/png', buffer: PNG });
  await page.getByRole('button', { name: 'Story / vertical 1080x1920' }).click();
  await expect(page.getByText('$0.42 - 42 credits')).toBeVisible();
  await page.getByTestId('utility-run').click();
  await expect(page.getByTestId('utility-result')).toHaveCount(2);
  await expect(page.getByTestId('utility-result').first().locator('img')).toHaveAttribute('src', 'https://results.example/square.png');
  expect(requests[0]).toMatchObject({ service: 'smart-resize', image_url: 'https://uploads.example/source.png', target_sizes: ['1024x1024', '1080x1920'] });
});

test('background removal sends its native service and keeps transparent PNG download', async ({ page }) => {
  await prepare(page);
  let request;
  await page.route('**/api/service', (route) => {
    request = route.request().postDataJSON();
    return route.fulfill({ status: 200, json: { result: { data: [{ url: 'https://results.example/cutout.png' }] } } });
  });
  await page.goto('/tools/image-background-remover');
  await page.setInputFiles('input[type=file]', { name: 'source.png', mimeType: 'image/png', buffer: PNG });
  await page.getByTestId('utility-run').click();
  await expect(page.getByRole('link', { name: 'Download PNG' })).toHaveAttribute('href', 'https://results.example/cutout.png');
  expect(request).toEqual({ service: 'remove-background', image_url: 'https://uploads.example/source.png' });
});

test('failed processing preserves controls and shows the error without a result', async ({ page }) => {
  await prepare(page);
  await page.route('**/api/service', (route) => route.fulfill({ status: 502, json: { error: 'Provider unavailable' } }));
  await page.goto('/tools/smart-resize');
  await page.setInputFiles('input[type=file]', { name: 'source.png', mimeType: 'image/png', buffer: PNG });
  await page.getByTestId('utility-run').click();
  await expect(page.getByRole('alert').filter({ hasText: 'Provider unavailable' })).toHaveText('Provider unavailable');
  await expect(page.getByTestId('utility-run')).toBeEnabled();
  await expect(page.getByTestId('utility-result')).toHaveCount(0);
});
