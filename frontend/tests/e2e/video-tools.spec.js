import { expect, test } from '@playwright/test';

const slugs = [
  'manifold', 'seedance-2-fast', 'seedance-2', 'seedance-2-image',
  'seedance-2-reference-fast', 'seedance-2-reference', 'happy-horse',
  'ltx-2-3', 'wan', 'ltx-2', 'ra2v',
];

test('video tool and API directories expose every generator', async ({ page }) => {
  await page.goto('/tools');
  await expect(page.getByRole('heading', { name: 'Choose the right generator for the shot.' })).toBeVisible();
  await expect(page.locator('a[href="/tool/animate-video"]')).toBeVisible();
  for (const slug of slugs) await expect(page.locator(`a[href="/tools/${slug}"]`)).toBeVisible();

  await page.goto('/api/video-generators');
  await expect(page.getByRole('heading', { name: 'One API. Every video workflow.' })).toBeVisible();
  for (const slug of slugs) await expect(page.locator(`a[href="/api/video-generators/${slug}"]`)).toBeVisible();
});

test('Animation Transfer uploads both sources, prices measured compute, and hands the result to Studio', async ({ page }) => {
  let requestBody;
  await page.addInitScript(() => {
    localStorage.setItem('mg_api_key', 'mg_test_key');
    localStorage.setItem('mg_user', JSON.stringify({ api_key: 'mg_test_key', credits: 1000, credit_price_usd: 0.01 }));
  });
  await page.route('**/api/uploads/presign?**', async (route) => {
    const filename = new URL(route.request().url()).searchParams.get('filename');
    await route.fulfill({ status: 200, json: { upload_url: `https://uploads.example/${filename}`, public_url: `https://media.example/${filename}` } });
  });
  await page.route('https://uploads.example/**', (route) => route.fulfill({ status: 200, body: '' }));
  await page.route('**/api/service', async (route) => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({ status: 202, json: { result: { job_id: 'animate_test' } } });
  });
  await page.route('**/api/video-jobs/animate_test', (route) => route.fulfill({ status: 200, json: { job: { status: 'completed', result: { video_url: 'https://media.example/animated.mp4' } } } }));

  await page.goto('/tool/animate-video');
  await page.getByTestId('animate-image-drop').locator('input').setInputFiles({ name: 'character.png', mimeType: 'image/png', buffer: Buffer.from('image') });
  await page.getByTestId('animate-video-drop').locator('input').setInputFiles({ name: 'dance.mp4', mimeType: 'video/mp4', buffer: Buffer.from('video') });
  await expect(page.getByTestId('animate-estimate')).toContainText('100 credits');
  await page.getByTestId('animate-submit').click();
  await expect(page.getByTestId('animate-output')).toHaveAttribute('src', 'https://media.example/animated.mp4', { timeout: 10_000 });
  expect(requestBody).toMatchObject({
    service: 'video_restyle', model: 'wan-animate-2', image_url: 'https://media.example/character.png',
    video_url: 'https://media.example/dance.mp4', resolution: 'preview', duration: 5,
    frames_per_second: 24, num_frames: 37, num_steps: 10, include_audio: true,
  });
  await expect(page.getByRole('link', { name: /Open in Studio/ })).toHaveAttribute('href', /\/studio\?video_url=https%3A%2F%2Fmedia\.example%2Fanimated\.mp4/);
});

test('image generator submits branded model request and hands output to Studio', async ({ page }) => {
  let requestBody;
  await page.addInitScript(() => {
    localStorage.setItem('mg_api_key', 'mg_test_key');
    localStorage.setItem('mg_user', JSON.stringify({ api_key: 'mg_test_key', credits: 1000 }));
  });
  await page.route('**/api/service', async (route) => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ result: { job_id: 'video_test', status: 'queued' } }) });
  });
  await page.route('**/api/video-jobs/video_test', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ job: { status: 'completed', result: { video_url: 'https://media.example/generated.webm' } } }) });
  });

  await page.goto('/tools/seedance-2-image');
  await page.getByLabel('Starting image URL').fill('https://media.example/start.webp');
  await page.getByRole('button', { name: 'Generate with Seedance Image' }).click();
  const editor = page.getByRole('link', { name: 'Edit in Studio' });
  await expect(editor).toBeVisible({ timeout: 10_000 });
  expect(requestBody).toMatchObject({
    service: 'video_generate',
    model: 'seedance-2.0-image-to-video',
    image_url: 'https://media.example/start.webp',
  });
  await expect(editor).toHaveAttribute('href', /\/studio\?video_url=https%3A%2F%2Fmedia\.example%2Fgenerated\.webm/);
});

test('per-generator API page includes schema, tester, and private routing language', async ({ page }) => {
  await page.goto('/api/video-generators/manifold');
  await expect(page.getByRole('heading', { name: 'Manifold Video API' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Live API tester' })).toBeVisible();
  await expect(page.getByText('Provider routing stays behind ManifoldGen.')).toBeVisible();
  await expect(page.locator('pre')).toContainText('"service": "h3_video"');
});
