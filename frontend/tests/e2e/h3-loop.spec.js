const { test, expect } = require('@playwright/test');

const API_KEY = 'mg_loop_e2e_key';

async function installStudioMocks(page, serviceHandler) {
  await page.addInitScript(({ apiKey }) => {
    const user = {
      id: 'loop-e2e-user',
      wallet_address: 'email:loope2e00000000000000000000000000000',
      email: 'loop-e2e@manifoldgen.local',
      api_key: apiKey,
      credits: 10_000,
      credits_usd: 100,
    };
    localStorage.setItem('mg_api_key', apiKey);
    localStorage.setItem('mg_user', JSON.stringify(user));
  }, { apiKey: API_KEY });

  await page.route('**/api/pricing', (route) => route.fulfill({
    status: 200,
    json: {
      credit_price_usd: 0.01,
      image_credits: 4,
      video_estimate: {
        duration_seconds: 5,
        estimated_cost_usd: 0.01,
        estimated_credits: 1,
      },
      pricing: [{ service: 'video', price_usd: 2.688 }],
    },
  }));
  await page.route('**/api/auth/session', (route) => route.fulfill({
    status: 200,
    json: {
      user: {
        id: 'loop-e2e-user', email: 'loop-e2e@manifoldgen.local', api_key: API_KEY,
        wallet_address: 'email:loope2e00000000000000000000000000000', credits: 10_000,
      },
      api_key: API_KEY,
      cute_price_usd: 0.01,
      credits_usd: 100,
    },
  }));
  await page.route('**/api/images**', (route) => route.fulfill({ status: 200, json: { images: [] } }));
  await page.route('**/api/videos/featured**', (route) => route.fulfill({ status: 200, json: { results: [] } }));
  await page.route('**/api/search**', (route) => route.fulfill({ status: 200, json: { results: [] } }));
  await page.route('**/api/service', serviceHandler);
  await page.route('**/api/video-jobs/job-loop-e2e', (route) => route.fulfill({
    status: 200,
    json: {
      job: {
        job_id: 'job-loop-e2e',
        status: 'completed',
        charged_usd: 0.12,
        result: { video_url: 'https://cdn.example/verified-loop.webm' },
      },
    },
  }));
}

test('loop toggle generates a native-sized anchor before H3 and reuses it', async ({ page }) => {
  const requests = [];
  await installStudioMocks(page, async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    expect(route.request().headers().authorization).toBe(`Bearer ${API_KEY}`);
    if (body.service === 'zimage') {
      await route.fulfill({
        status: 200,
        json: { saved_image: { file_path: 'originals/exact-loop-anchor.webp' }, result: {} },
      });
      return;
    }
    await route.fulfill({ status: 202, json: { result: { job_id: 'job-loop-e2e' } } });
  });

  await page.goto('/');
  const toggle = page.getByTestId('home-loop-toggle');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('home-video-cost')).toContainText('~14 credits');
  await page.getByRole('button', { name: /^Generate video$/ }).click();
  await expect(page.getByTestId('home-job-cost')).toContainText('completed');

  expect(requests).toHaveLength(2);
  expect(requests[0]).toMatchObject({
    service: 'zimage', width: 1344, height: 768, n: 1,
  });
  expect(requests[1]).toMatchObject({
    service: 'h3_video',
    loop: true,
    first_frame: expect.stringMatching(/\/images\/originals\/exact-loop-anchor\.webp$/),
    aspect_ratio: '16:9',
    size: 'native',
  });
  expect(requests[1]).not.toHaveProperty('last_frame');
});

test('loop keyframe follows H3 balanced portrait dimensions', async ({ page }) => {
  const requests = [];
  await installStudioMocks(page, async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    if (body.service === 'zimage') {
      await route.fulfill({ status: 200, json: { saved_image_url: 'https://manifoldgen.com/images/portrait.webp' } });
      return;
    }
    await route.fulfill({ status: 202, json: { result: { job_id: 'job-loop-e2e' } } });
  });

  await page.goto('/');
  await page.locator('select').nth(0).selectOption('9:16');
  await page.locator('select').nth(1).selectOption('balanced');
  await page.getByTestId('home-loop-toggle').click();
  await page.getByRole('button', { name: /^Generate video$/ }).click();
  await expect(page.getByTestId('home-job-cost')).toContainText('completed');

  expect(requests[0]).toMatchObject({ service: 'zimage', width: 672, height: 1184 });
  expect(requests[1].first_frame).toBe('https://manifoldgen.com/images/portrait.webp');
});

test('ordinary H3 generation does not spend an image request', async ({ page }) => {
  const requests = [];
  await installStudioMocks(page, async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    await route.fulfill({ status: 202, json: { result: { job_id: 'job-loop-e2e' } } });
  });

  await page.goto('/');
  await page.getByRole('button', { name: /^Generate video$/ }).click();
  await expect(page.getByTestId('home-job-cost')).toContainText('completed');

  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({ service: 'h3_video', loop: false });
  expect(requests[0]).not.toHaveProperty('first_frame');
});

test('image mode always requests a four-image batch', async ({ page }) => {
  let requestBody;
  await installStudioMocks(page, async (route) => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({ status: 200, json: { saved_images: [{ id: 'one' }, { id: 'two' }, { id: 'three' }, { id: 'four' }] } });
  });

  await page.goto('/');
  await page.getByTestId('home-generation-mode').getByRole('button', { name: '4 images' }).click();
  const generateButton = page.getByRole('button', { name: 'Generate 4 images' });
  await generateButton.click();
  await expect(generateButton).toBeEnabled();

  expect(requestBody).toMatchObject({ service: 'zimage', n: 4, num_images: 4, image_backend: 'auto' });
});

test('home generator accepts repeated launches while earlier videos start', async ({ page }) => {
  const requests = [];
  let releaseRequests;
  const requestGate = new Promise((resolve) => { releaseRequests = resolve; });
  await installStudioMocks(page, async (route) => {
    requests.push(route.request().postDataJSON());
    await requestGate;
    await route.fulfill({ status: 202, json: { result: { job_id: 'job-loop-e2e' } } });
  });

  await page.goto('/');
  const generateButton = page.getByRole('button', { name: /^Generate video$/ });
  await generateButton.click();
  await expect(generateButton).toBeEnabled();
  await generateButton.click();
  await expect.poll(() => requests.length).toBe(2);
  await expect(page.getByTestId('home-background-activity')).toContainText('2 tasks running');
  releaseRequests();
  await expect(page.getByTestId('home-job-cost')).toContainText('completed');
});
