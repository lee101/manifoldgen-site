const path = require('path');
const { execFileSync } = require('child_process');
const { test, expect } = require('@playwright/test');

const VIDEO = path.resolve(__dirname, '../../public/showcase/h3-loop-glass-torus.mp4');
const API_KEY = 'mg_studio_e2e_key';

function wavFixture(seconds = 0.3, sampleRate = 8000) {
  const samples = Math.floor(seconds * sampleRate);
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVE', 8);
  buffer.write('fmt ', 12); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22); buffer.writeUInt32LE(sampleRate, 24); buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(samples * 2, 40);
  for (let index = 0; index < samples; index += 1) {
    buffer.writeInt16LE(Math.round(Math.sin(index / sampleRate * Math.PI * 2 * 220) * 5000), 44 + index * 2);
  }
  return buffer;
}

async function installMocks(page) {
  await page.addInitScript(({ apiKey }) => {
    localStorage.setItem('mg_api_key', apiKey);
    localStorage.setItem('mg_user', JSON.stringify({ id: 'studio-user', email: 'studio@example.com', api_key: apiKey, credits: 10000, credits_usd: 100 }));
  }, { apiKey: API_KEY });
  await page.route('**/api/pricing', (route) => route.fulfill({ status: 200, json: {
    credit_price_usd: 0.01,
    h3_video_estimate: { estimated_cost_usd: 1.01 },
    studio: { extend_input_second_usd: 0.012, extend_output_second_usd: 0.084 },
  } }));
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, json: {
    user: { id: 'studio-user', email: 'studio@example.com', api_key: API_KEY, credits: 10000, credits_usd: 100 },
  } }));
}

test('studio mobile workspace has no horizontal overflow and uses an overlay tool drawer', async ({ page }) => {
  await installMocks(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/studio');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByTestId('studio-tool-audio').click();
  await expect(page.getByTestId('studio-panel')).toBeVisible();
  const panel = await page.getByTestId('studio-panel').boundingBox();
  expect(panel.x).toBeGreaterThanOrEqual(0);
  expect(panel.x + panel.width).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Close tools' }).click();
  await expect(page.getByTestId('studio-panel')).toBeHidden();
});

test('licensed Netwrck catalog result imports as an editable audio clip for free', async ({ page }) => {
  await installMocks(page);
  const wav = wavFixture();
  await page.route('**/api/studio/audio-search**', (route) => route.fulfill({ status: 200, json: { results: [{
    id: 44, title: 'Night Pulse', url: 'https://audio.example/night-pulse.wav', duration: 0.3,
    provider: 'opengameart', kind: 'music', license: 'cc0', attribution: 'Example Artist',
  }] } }));
  await page.route('https://audio.example/night-pulse.wav', (route) => route.fulfill({ status: 200, contentType: 'audio/wav', body: wav }));
  await page.goto('/studio');
  await page.getByTestId('studio-tool-audio').click();
  await page.getByTestId('studio-audio-search').fill('night pulse');
  await page.getByRole('button', { name: 'Find' }).click();
  const card = page.getByText('Night Pulse').locator('..').locator('..');
  await expect(card).toContainText('CC0');
  await card.locator('button').last().click();
  await expect(page.getByRole('heading', { name: 'Night Pulse.wav' })).toBeVisible();
  await expect(page.getByTestId('studio-export')).toBeEnabled();
});

test('text to speech is credit priced, calls TTS, and adds the returned clip', async ({ page }) => {
  await installMocks(page);
  const wav = wavFixture();
  let request;
  await page.route('**/api/service', async (route) => {
    request = route.request().postDataJSON();
    await route.fulfill({ status: 200, json: {
      result: { audio_base64: wav.toString('base64'), content_type: 'audio/wav', format: 'wav' },
      credits_remain: 9999.5,
    } });
  });
  await page.goto('/studio');
  await page.getByTestId('studio-tool-audio').click();
  await page.getByRole('button', { name: /Speech/ }).click();
  await expect(page.getByText('Exact text charge')).toBeVisible();
  await page.getByTestId('studio-speech-text').fill('A short line for the timeline.');
  await page.getByTestId('studio-audio-generate').click();
  await expect(page.getByRole('heading', { name: /speech-\d+\.wav/ })).toBeVisible();
  expect(request).toMatchObject({ service: 'tts', text: 'A short line for the timeline.', voice: 'M1', language: 'en' });
});

test('video import exposes local MP4 export and priced Grok extension', async ({ page }) => {
  await installMocks(page);
  await page.goto('/studio');
  await page.locator('input[type=file]').setInputFiles(VIDEO);
  await expect(page.getByTestId('studio-export')).toBeEnabled();
  await page.getByTestId('studio-export').click();
  await expect(page.getByRole('heading', { name: 'Export video' })).toBeVisible();
  await expect(page.getByText('MP4 · H.264')).toBeVisible();
  await page.getByRole('heading', { name: 'Export video' }).locator('../..').getByRole('button').click();
  await page.getByTestId('studio-tool-ai').click();
  await page.getByRole('button', { name: /Extend video/ }).click();
  await expect(page.getByRole('heading', { name: 'Extend video' })).toBeVisible();
  await expect(page.getByText(/credits/).last()).toBeVisible();
});

test('local MP4 export mixes an added audio clip into the downloaded video', async ({ page }) => {
  test.setTimeout(120_000);
  await installMocks(page);
  await page.goto('/studio');
  const input = page.locator('input[type=file]');
  await input.setInputFiles(VIDEO);
  await input.setInputFiles({ name: 'timeline-tone.wav', mimeType: 'audio/wav', buffer: wavFixture(1) });
  await page.getByTestId('studio-tool-media').click();
  await page.getByTestId('studio-panel').getByRole('button', { name: /h3-loop-glass-torus\.mp4/ }).click();
  await page.getByTestId('studio-export').click();
  await page.getByRole('button', { name: /MP4 · H\.264/ }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export locally' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/-studio\.mp4$/);
  const outputPath = await download.path();
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'json', outputPath], { encoding: 'utf8' }));
  expect(probe.streams.map((stream) => stream.codec_type).sort()).toEqual(['audio', 'video']);
});
