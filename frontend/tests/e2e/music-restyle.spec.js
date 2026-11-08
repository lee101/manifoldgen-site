const { test, expect } = require('@playwright/test');

const API_KEY = 'mg_restyle_e2e_key';

function silentWav(seconds) {
  const rate = 8000;
  const samples = rate * seconds;
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(36 + samples * 2, 4); buffer.write('WAVE', 8);
  buffer.write('fmt ', 12); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36); buffer.writeUInt32LE(samples * 2, 40);
  return buffer;
}

async function signIn(page) {
  await page.addInitScript(({ apiKey }) => {
    localStorage.setItem('mg_api_key', apiKey);
    localStorage.setItem('mg_user', JSON.stringify({ id: 'restyle-e2e', email: 'restyle@manifoldgen.local', api_key: apiKey, credits: 10_000, credits_usd: 100 }));
  }, { apiKey: API_KEY });
  await page.route('**/api/auth/session', (route) => route.fulfill({
    status: 200, json: { user: { id: 'restyle-e2e', api_key: API_KEY, credits: 10_000 }, api_key: API_KEY, cute_price_usd: 0.01, credits_usd: 100 },
  }));
}

test('music restyle uploads, restyles in a preset style and hands the track to a lofi loop', async ({ page }) => {
  await signIn(page);
  const bodies = [];
  await page.route('**/api/uploads/presign**', (route) => route.fulfill({
    status: 200, json: { upload_url: 'https://uploads.example/put', public_url: 'https://manifoldgenstatic.manifoldgen.com/u/source.wav' },
  }));
  await page.route('https://uploads.example/put', (route) => route.fulfill({ status: 200, body: '' }));
  await page.route('**/api/service', async (route) => {
    const body = route.request().postDataJSON();
    bodies.push(body);
    if (body.quote_only) return route.fulfill({ status: 200, json: { estimated_cost_usd: 0.19, seconds: 12 } });
    if (body.service === 'music_restyle') return route.fulfill({ status: 202, json: { result: { job_id: 'restyle-job', status_url: '/api/audio-jobs/restyle-job' }, estimated_minutes: 3 } });
    return route.fulfill({ status: 202, json: { result: { job_id: 'loop-job', status_url: '/api/video-jobs/loop-job' } } });
  });
  await page.route('**/api/audio-jobs/restyle-job', (route) => route.fulfill({
    status: 200, json: { job: { status: 'completed', result: {
      audio_url: 'https://manifoldgenstatic.manifoldgen.com/u/restyled.mp3', duration_seconds: 12, key: 'D', bpm: 80, bars: 8,
      score_abc: 'X:1\nM:4/4\nL:1/16\nQ:1/4=80\nK:D\n% intro\nV: Ins\nd4A4|\n',
    } } },
  }));
  await page.route('**/api/video-jobs/loop-job', (route) => route.fulfill({
    status: 200, json: { job: { status: 'completed', result: { video_url: 'https://manifoldgenstatic.manifoldgen.com/u/loop.mp4' } } },
  }));

  await page.goto('/tools/music-restyle');
  await page.getByTestId('mr-preset-violin').click();
  await expect(page.getByTestId('mr-prompt')).toHaveValue(/violin/);
  await page.getByTestId('mr-preset-lofi').click();
  await expect(page.getByTestId('mr-tempo-label')).toHaveText('80 BPM');
  await page.getByTestId('mr-harmony-full').click();
  await page.getByTestId('mr-file').setInputFiles({ name: 'theme.wav', mimeType: 'audio/wav', buffer: silentWav(12) });
  await expect(page.getByTestId('mr-drop')).toContainText('12s track ready');
  await expect(page.getByTestId('mr-run')).toBeDisabled();
  await page.getByTestId('mr-rights').check();
  await expect(page.getByTestId('mr-price')).toHaveText('Estimate · $0.19');
  await page.getByTestId('mr-run').click();
  await expect(page.getByTestId('mr-result')).toContainText('80 BPM');
  const submitted = bodies.find((b) => b.service === 'music_restyle' && !b.quote_only);
  expect(submitted).toMatchObject({ audio_url: 'https://manifoldgenstatic.manifoldgen.com/u/source.wav', harmony: 'full', bpm: 80, n: 1, rights_confirmed: true });
  expect(submitted.prompt).toContain('lofi');

  await page.getByTestId('mr-interval').selectOption('16');
  await page.getByTestId('mr-video-run').click();
  await expect(page.getByTestId('mr-video').locator('video')).toHaveAttribute('src', /loop\.mp4$/);
  expect(bodies.find((b) => b.service === 'lofi_loop')).toMatchObject({ audio_url: 'https://manifoldgenstatic.manifoldgen.com/u/restyled.mp3', loop_seconds: 16 });

  await page.getByTestId('mr-next-agent').click();
  await expect(page.getByTestId('mr-agent-link')).toHaveAttribute('href', /trailer-agent\?soundtrack=https/);
});

test('music restyle fits a phone without sideways scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/tools/music-restyle');
  await expect(page.getByTestId('mr-next')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
