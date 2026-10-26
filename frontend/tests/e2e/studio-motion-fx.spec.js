const path = require('path');
const fs = require('fs');
const { test, expect } = require('@playwright/test');

const VIDEO = path.resolve(__dirname, '../../public/showcase/h3-loop-glass-torus.webm');
const IMAGE = path.resolve(__dirname, '../../public/images/logo.png');
const API_KEY = 'mg_studio_e2e_key';
const USER = { id: 'studio-user', email: 'studio@example.com', api_key: API_KEY, credits: 10000, credits_usd: 100 };

async function installMocks(page, { signedIn = true } = {}) {
  if (signedIn) {
    await page.addInitScript(({ apiKey, user }) => {
      localStorage.setItem('mg_api_key', apiKey);
      localStorage.setItem('mg_user', JSON.stringify(user));
    }, { apiKey: API_KEY, user: USER });
  }
  await page.route('**/api/pricing', (route) => route.fulfill({ status: 200, json: { credit_price_usd: 0.01 } }));
  await page.route('**/api/auth/session', (route) => route.fulfill(signedIn ? { status: 200, json: { user: USER } } : { status: 401, json: { error: 'invalid API key' } }));
  await page.route('**/api/video-jobs', (route) => route.fulfill({ status: 200, json: { jobs: [] } }));
  await page.route('**/api/studio/projects', (route) => route.fulfill({ status: 200, json: { projects: [] } }));
  await page.route('**/api/studio/projects/*', async (route) => {
    if (route.request().method() !== 'PUT') return route.fulfill({ status: 404, json: { error: 'project not found' } });
    const body = route.request().postDataJSON();
    const now = new Date().toISOString();
    return route.fulfill({ status: 200, json: { project: { id: new URL(route.request().url()).pathname.split('/').pop(), name: body.name, document: body.document, revision: 1, created_at: now, updated_at: now } } });
  });
  await page.route('**/api/studio/assets/presign', async (route) => {
    const body = route.request().postDataJSON();
    await route.fulfill({ status: 200, json: {
      upload_url: `https://studio-upload.example/${body.project_id}/${body.asset_id}`,
      public_url: `https://studio-media.example/${body.project_id}/${body.asset_id}/${encodeURIComponent(body.filename)}`,
      object_key: `gallery/studio/test/${body.project_id}/${body.asset_id}/${body.filename}`,
    } });
  });
  await page.route('https://studio-upload.example/**', (route) => route.fulfill({ status: 200 }));
}

async function mockMotionJob(page, { status = 'completed', error, onSubmit } = {}) {
  await page.route('**/api/service', async (route) => {
    onSubmit?.(route.request().postDataJSON());
    await route.fulfill({ status: 202, json: { result: { job_id: 'motion_fx_test', status_url: '/api/video-jobs/motion_fx_test' } } });
  });
  await page.route('**/api/video-jobs/motion_fx_test', (route) => route.fulfill({ status: 200, json: {
    job: status === 'completed'
      ? { status, result: { video_url: 'https://studio-result.example/motion-fx.mp4', poster_url: 'https://studio-result.example/p.jpg', tracks_count: 2, events_count: 7, bpm: 84.7, preset: 'lightning' } }
      : { status, error },
  } }));
  await page.route('https://studio-result.example/motion-fx.mp4', (route) => route.fulfill({ status: 200, contentType: 'video/mp4', body: fs.readFileSync(VIDEO) }));
}

async function openAITools(page) {
  await page.getByTestId('studio-tool-ai').click();
  await expect(page.getByTestId('studio-motion-open')).toBeVisible();
}

test('the Motion FX card is disabled without a selection and for images', async ({ page }) => {
  await installMocks(page);
  await page.goto('/studio');
  await openAITools(page);
  await expect(page.getByTestId('studio-motion-open')).toBeDisabled();
  await page.getByTestId('studio-tool-media').click();
  await page.locator('input[type=file]').setInputFiles(IMAGE);
  await openAITools(page);
  await expect(page.getByTestId('studio-motion-open')).toBeDisabled();
});

test('the Motion FX card enables for a selected video clip', async ({ page }) => {
  await installMocks(page);
  await page.goto('/studio');
  await page.locator('input[type=file]').setInputFiles(VIDEO);
  await openAITools(page);
  await expect(page.getByTestId('studio-motion-open')).toBeEnabled();
});

test('the dialog quotes the price, validates choices and submits the clip window', async ({ page }) => {
  let submitted;
  await installMocks(page);
  await mockMotionJob(page, { onSubmit: (body) => { submitted = body; } });
  await page.goto('/studio');
  await page.locator('input[type=file]').setInputFiles(VIDEO);
  await expect(page.getByTestId('studio-save-status')).toHaveText('Saved to cloud', { timeout: 20_000 });
  await openAITools(page);
  await page.getByTestId('studio-motion-open').click();

  const dialog = page.getByTestId('motion-fx-dialog');
  await expect(page.getByRole('heading', { name: 'Motion FX' })).toBeVisible();
  await expect(dialog).toContainText('h3-loop-glass-torus.webm');
  await expect(page.getByTestId('motion-preset-anime-fight')).toHaveAttribute('aria-checked', 'true');
  const quote = await page.getByTestId('motion-quote').innerText();
  expect(quote).toMatch(/\$0\.\d\d/);
  expect(quote).toContain('minimum $0.15');

  await page.getByTestId('motion-preset-lightning').click();
  await expect(page.getByTestId('motion-preset-lightning')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('motion-preset-anime-fight')).toHaveAttribute('aria-checked', 'false');
  await page.getByTestId('motion-palette').selectOption('ice');
  await page.getByTestId('motion-sfx').selectOption('off');
  await page.getByTestId('motion-aspect').selectOption('9:16');
  await page.getByTestId('motion-names').fill('Sensei, Rival');
  await page.getByTestId('motion-intensity').fill('1.4');
  await page.getByTestId('motion-run').click();

  await expect(page.getByText(/Motion FX added to Media · 2 fighters tracked · 7 hits · 85 BPM/)).toBeVisible({ timeout: 25_000 });
  await page.getByTestId('studio-tool-media').click();
  await expect(page.getByTestId('studio-panel').getByRole('button', { name: /h3-loop-glass-torus-lightning\.mp4/ }).first()).toBeVisible();
  expect(submitted).toMatchObject({
    service: 'motion-fx',
    params: { preset: 'lightning', intensity: 1.4, palette: 'ice', aspect: '9:16', sfx: false, names: ['Sensei', 'Rival'] },
  });
  expect(submitted.video_url).toContain('studio-media.example');
  expect(Number.isInteger(submitted.duration)).toBe(true);
  expect(submitted.duration).toBeGreaterThanOrEqual(1);
  expect(submitted.duration).toBeLessThanOrEqual(20);
  expect(submitted.params).not.toHaveProperty('slowmo');
});

test('a video context menu opens Motion FX and server failures are shown to the user', async ({ page }) => {
  await installMocks(page);
  await mockMotionJob(page, { status: 'failed', error: 'no people found in the video; try a clip where a person is fully visible' });
  await page.goto('/studio');
  await page.locator('input[type=file]').setInputFiles(VIDEO);
  await expect(page.getByTestId('studio-save-status')).toHaveText('Saved to cloud', { timeout: 20_000 });
  await page.locator('[data-testid^="timeline-clip-"]').first().click({ button: 'right' });
  await page.getByTestId('studio-context-video-motion-fx').click();
  await expect(page.getByTestId('motion-fx-dialog')).toBeVisible();
  await page.getByTestId('motion-run').click();
  await expect(page.getByText(/no people found in the video/)).toBeVisible({ timeout: 25_000 });
  await expect(page.locator('[data-testid^="timeline-clip-"]')).toHaveCount(1);
});

test('signed-out users cannot run Motion FX', async ({ page }) => {
  await installMocks(page, { signedIn: false });
  await page.goto('/studio');
  await page.locator('input[type=file]').setInputFiles(VIDEO);
  await openAITools(page);
  await page.getByTestId('studio-motion-open').click();
  await expect(page.getByTestId('motion-blocker')).toContainText('Sign in');
  await expect(page.getByTestId('motion-run')).toBeDisabled();
});

test('the dialog fits a phone viewport and closes with Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installMocks(page);
  await page.goto('/studio');
  await page.locator('input[type=file]').setInputFiles(VIDEO);
  await page.getByTestId('studio-tool-ai').click();
  await page.getByTestId('studio-motion-open').click();
  const box = await page.getByTestId('motion-fx-dialog').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await expect(page.getByTestId('motion-run')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('motion-fx-dialog')).toHaveCount(0);
});
