const { test, expect } = require('@playwright/test');

const API_KEY = 'mg_music_e2e_key';

test('song generator queues a music job and plays the finished track', async ({ page }) => {
  await page.addInitScript(({ apiKey }) => {
    localStorage.setItem('mg_api_key', apiKey);
    localStorage.setItem('mg_user', JSON.stringify({
      id: 'music-e2e-user',
      email: 'music-e2e@manifoldgen.local',
      api_key: apiKey,
      credits: 10_000,
      credits_usd: 100,
    }));
  }, { apiKey: API_KEY });

  await page.route('**/api/auth/session', (route) => route.fulfill({
    status: 200,
    json: {
      user: { id: 'music-e2e-user', email: 'music-e2e@manifoldgen.local', api_key: API_KEY, credits: 10_000 },
      api_key: API_KEY,
      cute_price_usd: 0.01,
      credits_usd: 100,
    },
  }));

  let requestBody;
  await page.route('**/api/service', async (route) => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({ status: 202, json: { result: { job_id: 'music-e2e-job', status_url: '/api/audio-jobs/music-e2e-job' }, estimated_cost_usd: 0.6 } });
  });
  await page.route('**/api/audio-jobs/music-e2e-job', (route) => route.fulfill({
    status: 200,
    json: {
      job: {
        job_id: 'music-e2e-job',
        status: 'completed',
        result: {
          audio_url: 'https://cdn.example/music-e2e.wav',
          charged_usd: 0.6,
          metrics: { duration_seconds: 60.5 },
        },
      },
    },
  }));

  await page.goto('/tools/music-generator');
  await expect(page.getByText('MINIMAX MUSIC 3 · SONG GENERATOR')).toBeVisible();
  await page.getByTestId('music-prompt').fill('House remix, EDM techno at 128 BPM, saxophone hook');
  await page.getByTestId('music-lyrics').fill('[Verse]\nThere is a house in New Orleans');
  await page.getByTestId('music-duration').selectOption('60');
  await page.getByTestId('music-run').click();

  await expect(page.getByTestId('music-audio')).toHaveAttribute('src', 'https://cdn.example/music-e2e.wav');
  await expect(page.getByText('$0.60 charged · 61s')).toBeVisible();
  expect(requestBody).toMatchObject({
    service: 'music',
    prompt: 'House remix, EDM techno at 128 BPM, saxophone hook',
    lyrics: '[Verse]\nThere is a house in New Orleans',
    duration: 60,
  });
});

test('song generator refuses an empty style caption', async ({ page }) => {
  await page.goto('/tools/music-generator');
  await expect(page.getByTestId('music-run')).toBeDisabled();
  await page.getByTestId('music-prompt').fill('short');
  await expect(page.getByTestId('music-run')).toBeDisabled();
});
