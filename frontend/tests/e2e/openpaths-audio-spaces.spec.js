const { test, expect } = require('@playwright/test');

const API_KEY = 'mg_openpaths_audio_e2e_key';

async function seedAccount(page) {
  await page.addInitScript(({ apiKey }) => {
    localStorage.setItem('mg_api_key', apiKey);
    localStorage.setItem('mg_user', JSON.stringify({ email: 'audio@manifoldgen.local', api_key: apiKey, credits: 10_000, credits_usd: 100 }));
  }, { apiKey: API_KEY });
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, json: { user: { email: 'audio@manifoldgen.local', credits: 10_000 }, api_key: API_KEY, cute_price_usd: 0.01, credits_usd: 100 } }));
}

test('Gemini voice space sends a multi-speaker request and renders WAV', async ({ page }) => {
  await seedAccount(page);
  let request;
  await page.route('**/api/service', async (route) => {
    request = route.request().postDataJSON();
    await route.fulfill({ status: 200, json: { result: { audio_base64: 'UklGRiQAAABXQVZFZm10IA==', format: 'wav', characters: 480 }, credits_used: 2 } });
  });

  await page.goto('/tools/gemini-tts');
  await expect(page.getByRole('heading', { name: 'Direct every voice.' })).toBeVisible();
  const editor = page.getByTestId('gemini-transcript');
  await expect(editor.locator('.mg-speaker-one').first()).toHaveText('Speaker 1:');
  await expect(editor.locator('.mg-speaker-two').first()).toHaveText('Speaker 2:');
  await expect(editor.locator('.mg-cue-hot').first()).toHaveText('[shouting]');
  await editor.locator('.cm-content').click();
  await page.keyboard.press('Control+End');
  await page.getByRole('button', { name: '[angry]' }).click();
  await expect(editor.locator('.mg-cue-hot').last()).toHaveText('[angry]');
  await page.getByTestId('gemini-run').click();
  await expect(page.getByTestId('gemini-audio')).toBeVisible();
  expect(request.service).toBe('gemini-tts');
  expect(request.speaker_voices).toEqual([{ speaker: 'Speaker 1', voice: 'Fenrir' }, { speaker: 'Speaker 2', voice: 'Puck' }]);
  expect(request.input).toContain('# Audio Profile');
  expect(request.input).toContain('## Scene');
});

test('Lyria space defaults to Pro Opus and supports Clip', async ({ page }) => {
  await seedAccount(page);
  const requests = [];
  await page.route('**/api/service', async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, json: { result: { audio_base64: 'T2dnUw==', format: 'opus', mime_type: 'audio/ogg;codecs=opus', size: 524288 }, credits_used: 8 } });
  });

  await page.goto('/tools/lyria');
  await expect(page.getByRole('heading', { name: 'From direction to record.' })).toBeVisible();
  await page.getByTestId('lyria-run').click();
  await expect(page.getByTestId('lyria-audio')).toBeVisible();
  expect(requests[0]).toMatchObject({ service: 'lyria', model: 'lyria-3-pro-preview', output_format: 'opus' });
  expect(requests[0].prompt).toContain('Instrumental only');

  await page.getByTestId('lyria-clip').click();
  await expect(page.getByText('30s · opus')).toBeVisible();
});

test('Gemini transcript editor highlights custom characters and completes cues and voices', async ({ page }) => {
  await seedAccount(page);
  await page.goto('/tools/gemini-tts');
  const editor = page.getByTestId('gemini-transcript');
  const content = editor.locator('.cm-content');
  await content.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Gatekeeper: [angry] Fenrir');
  const lastLine = editor.locator('.cm-line').last();
  await expect(lastLine.locator('[class*="mg-speaker-"]')).toHaveText('Gatekeeper:');
  await expect(lastLine.locator('.mg-cue-hot')).toHaveText('[angry]');
  await expect(lastLine.locator('.mg-voice-name')).toHaveText('Fenrir');

  await page.keyboard.press('Enter');
  await page.keyboard.type('[an');
  await expect(page.locator('.cm-tooltip-autocomplete')).toBeVisible();
  await expect(page.locator('.cm-tooltip-autocomplete')).toContainText('[angry]');
  await page.keyboard.press('Escape');
});
