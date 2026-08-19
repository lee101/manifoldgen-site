const { test, expect } = require('@playwright/test');

test('voice history animates, keeps friendly names, and can be deleted', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('mg_api_key', 'voice-test-key');
    localStorage.setItem('mg_user', JSON.stringify({ api_key: 'voice-test-key', credits: 100, credit_price_usd: 0.01 }));
    window.confirm = () => true;
  });

  await page.route('**/api/auth/session', (route) => route.fulfill({ json: { api_key: 'voice-test-key', user: { credits: 100 }, credit_price_usd: 0.01 } }));
  await page.route('**/api/voice/models', (route) => route.fulfill({ json: {
    credit_price_usd: 0.01,
    models: [{ id: 'seed-speech', name: 'Seed Speech', description: 'Multilingual speech', max_characters: 5000, voices: ['stokie_en'], formats: ['mp3'], sample_rates: [24000], supports_speed: true, supports_pitch: true, supports_volume: true, supports_mood: true, supports_voice_details: true, price_usd_per_1000_characters: 0.036, markup: 1.2 }],
  } }));
  await page.route('**/api/voice/generations', (route) => route.fulfill({ json: { results: [{ id: 'voice-1', audio_url: 'https://audio.example/hi.mp3', filename: 'hi-hows-it-going.mp3', title: 'Hi how is it going', duration_seconds: 4, format: 'mp3' }] } }));
  await page.route('**/api/voice/generate', (route) => route.fulfill({ json: { results: [{ id: 'voice-2', audio_url: 'https://audio.example/second.mp3', filename: 'a-second-line.mp3', title: 'A second line', duration_seconds: 2, format: 'mp3' }], errors: [], credits_used: 1, credits_remain: 99 } }));
  await page.route('https://audio.example/**', (route) => route.fulfill({ status: 200, contentType: 'audio/mpeg', body: Buffer.from('audio') }));
  let deleted = '';
  await page.route('**/api/voice/generations/*', (route) => {
    deleted = route.request().url().split('/').pop();
    return route.fulfill({ json: { deleted: true } });
  });

  await page.goto('/voice');
  await expect(page.getByText('hi-hows-it-going.mp3')).toBeVisible();
  await page.getByRole('textbox', { name: 'Script' }).fill('A second line');
  await page.getByRole('button', { name: 'Generate voice' }).click();
  await expect(page.getByText('a-second-line.mp3')).toBeVisible();
  await expect(page.locator('article')).toHaveCount(2);
  await expect(page.getByText('hi-hows-it-going.mp3')).toBeVisible();
  const audio = page.locator('#voice-voice-1');
  await audio.evaluate((element) => {
    Object.defineProperty(element, 'duration', { configurable: true, value: 4 });
    Object.defineProperty(element, 'currentTime', { configurable: true, value: 2, writable: true });
    element.dispatchEvent(new Event('timeupdate'));
  });
  await expect(page.getByRole('slider', { name: 'Playback position for hi-hows-it-going.mp3' })).toHaveAttribute('aria-valuenow', '50');
  await expect(page.locator('article').filter({ hasText: 'hi-hows-it-going.mp3' }).getByRole('link', { name: 'Open in editor' })).toHaveAttribute('href', /name=hi-hows-it-going.mp3/);

  await page.getByRole('button', { name: 'Delete hi-hows-it-going.mp3' }).click();
  await expect(page.locator('article').filter({ hasText: 'hi-hows-it-going.mp3' })).toHaveCount(0);
  await expect(page.getByText('hi-hows-it-going.mp3 deleted')).toBeVisible();
  expect(deleted).toBe('voice-1');
});
