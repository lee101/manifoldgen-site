const { test, expect } = require('@playwright/test');

const API_KEY = 'mg_h3_image_e2e_key';

test('H3 image generator queues and completes an image job', async ({ page }) => {
  await page.addInitScript(({ apiKey }) => {
    localStorage.setItem('mg_api_key', apiKey);
    localStorage.setItem('mg_user', JSON.stringify({
      id: 'h3-image-e2e-user',
      email: 'h3-image-e2e@manifoldgen.local',
      api_key: apiKey,
      credits: 10_000,
      credits_usd: 100,
    }));
  }, { apiKey: API_KEY });

  await page.route('**/api/auth/session', (route) => route.fulfill({
    status: 200,
    json: {
      user: { id: 'h3-image-e2e-user', email: 'h3-image-e2e@manifoldgen.local', api_key: API_KEY, credits: 10_000 },
      api_key: API_KEY,
      cute_price_usd: 0.01,
      credits_usd: 100,
    },
  }));

  let requestBody;
  await page.route('**/api/service', async (route) => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({ status: 202, json: { result: { job_id: 'h3-image-e2e-job' }, estimated_cost_usd: 0.25 } });
  });
  await page.route('**/api/video-jobs/h3-image-e2e-job', (route) => route.fulfill({
    status: 200,
    json: {
      job: {
        job_id: 'h3-image-e2e-job',
        status: 'completed',
        result: { image_url: 'https://cdn.example/h3-image.png', charged_usd: 0.1234 },
      },
    },
  }));

  await page.goto('/tools/h3-image');
  await expect(page.getByText('MINIMAX H3 · IMAGE GENERATOR')).toBeVisible();
  await page.getByLabel('Describe the image').fill('A glass hummingbird in a greenhouse');
  await page.getByTestId('h3-image-run').click();

  await expect(page.getByText('H3 IMAGE OUTPUT')).toBeVisible();
  await expect(page.getByText('$0.1234 charged')).toBeVisible();
  expect(requestBody).toMatchObject({
    service: 'h3_image',
    prompt: 'A glass hummingbird in a greenhouse',
    width: 992,
    height: 992,
    num_steps: 12,
    quant: 'int8_convrot',
  });
});
