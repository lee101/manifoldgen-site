const { test, expect } = require('@playwright/test');
const { CDN, CLIP, SONG, MOTION_PAGES, signIn, mockBackend, upload, addClip, runToResult } = require('./helpers/motion-mocks.cjs');

const LOCKED = MOTION_PAGES.filter((entry) => entry.preset);
const effectSelect = (page) => page.locator('label', { hasText: /^Effect/ }).locator('select');
const aspectSelect = (page) => page.locator('label', { hasText: /^Reframe to/ }).locator('select');
const alert = (page) => page.locator('[role="alert"]:not([id="__next-route-announcer__"])');
const FX_AUDIO = new Set(['motion-fx', 'beat-drop-fx', 'motion-score']);

test.describe('motion tool pages', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  for (const entry of MOTION_PAGES) {
    test(`${entry.slug} renders hero, controls and the price quote`, async ({ page }) => {
      await mockBackend(page, { service: entry.service });
      await page.goto(`/tools/${entry.slug}`);
      await expect(page.getByRole('heading', { level: 1 })).toContainText(entry.name);
      await expect(page.getByTestId('video-drop')).toBeVisible();
      await expect(page.getByTestId('production-price')).toContainText(entry.price);
      await expect(page.getByTestId('production-run')).toBeEnabled();
      await expect(page.getByTestId('production-demos')).toBeVisible();
      const preset = effectSelect(page);
      if (entry.preset) await expect(preset).toHaveCount(0);
      if (entry.slug === 'motion-fx') {
        await expect(preset).toBeVisible();
        const values = await preset.locator('option').evaluateAll((options) => options.map((option) => option.value));
        expect(values).toEqual(['anime-fight', 'ki-aura', 'lightning', 'neon-trails', 'game-hud', 'spotlight', 'slowmo-impacts', 'exaggerate', 'echo']);
      }
      if (FX_AUDIO.has(entry.slug)) await expect(page.getByTestId('audio-drop')).toBeVisible();
      else await expect(page.getByTestId('audio-drop')).toHaveCount(0);
      const reframes = ['motion-fx', 'beat-drop-fx'].includes(entry.slug) || (entry.service === 'motion-fx' && !entry.aspect);
      if (reframes) {
        const values = await aspectSelect(page).locator('option').evaluateAll((options) => options.map((option) => option.value));
        expect(values).toEqual(['', '9:16', '4:5', '1:1', '16:9']);
      } else {
        await expect(aspectSelect(page)).toHaveCount(0);
      }
    });
  }

  for (const entry of LOCKED) {
    test(`${entry.slug} sends the locked preset ${entry.preset}`, async ({ page }) => {
      const calls = await mockBackend(page, { service: entry.service });
      await page.goto(`/tools/${entry.slug}`);
      await runToResult(page);
      expect(calls.service).toHaveLength(1);
      const body = calls.service[0];
      expect(body.service).toBe('motion-fx');
      expect(body.params.preset).toBe(entry.preset);
      expect(body.params.aspect).toBe(entry.aspect);
      expect(body.video_url).toBe(`${CDN}/motion-clip.mp4`);
      expect(body.duration).toBeGreaterThanOrEqual(1);
      expect(body.audio_url).toBeUndefined();
      await expect(page.getByTestId('production-result')).toHaveAttribute('src', `${CDN}/result.mp4`);
    });
  }

  test('motion-fx sends the chosen preset and tuned intensity', async ({ page }) => {
    const calls = await mockBackend(page);
    await page.goto('/tools/motion-fx');
    await effectSelect(page).selectOption('echo');
    await runToResult(page);
    expect(calls.service[0].params.preset).toBe('echo');
    expect(calls.service[0].params.intensity).toBe(1);
    expect(calls.service[0].params.aspect).toBeUndefined();
    expect(calls.service[0].params.audio_start).toBeUndefined();
  });

  test('aspect reframe is sent only when chosen, on motion-fx and beat-drop-fx', async ({ page }) => {
    const calls = await mockBackend(page);
    await page.goto('/tools/motion-fx');
    await aspectSelect(page).selectOption('4:5');
    await runToResult(page);
    expect(calls.service[0].params.aspect).toBe('4:5');
  });

  test('beat-drop-fx sends aspect and audio_start once a song is attached', async ({ page }) => {
    const calls = await mockBackend(page, { service: 'beat-drop' });
    await page.goto('/tools/beat-drop-fx');
    const start = page.getByLabel('Start song at (seconds)');
    await expect(start).toHaveCount(0);
    await aspectSelect(page).selectOption('9:16');
    await addClip(page);
    await upload(page, 'audio-drop', SONG);
    await expect(start).toBeVisible();
    await expect(start).toHaveValue('0');
    await start.fill('-5');
    await expect(start).toHaveValue('0');
    await start.fill('99999');
    await expect(start).toHaveValue('3600');
    await start.fill('12');
    await page.getByTestId('production-run').click();
    await expect(page.getByTestId('share-row')).toBeVisible({ timeout: 30_000 });
    expect(calls.service[0].params).toMatchObject({ aspect: '9:16', audio_start: 12 });
  });

  test('motion-fx with a song sends audio_url and audio_start, and drops them with the track', async ({ page }) => {
    const calls = await mockBackend(page);
    await page.goto('/tools/motion-fx');
    await addClip(page);
    await upload(page, 'audio-drop', SONG);
    await page.getByLabel('Start song at (seconds)').fill('8');
    await page.getByRole('button', { name: 'Remove track' }).click();
    await expect(page.getByLabel('Start song at (seconds)')).toHaveCount(0);
    await upload(page, 'audio-drop', SONG);
    await page.getByLabel('Start song at (seconds)').fill('8');
    await page.getByTestId('production-run').click();
    await expect(page.getByTestId('share-row')).toBeVisible({ timeout: 30_000 });
    expect(calls.service[0]).toMatchObject({ audio_url: `${CDN}/motion-song.wav`, params: { audio_start: 8 } });
  });

  test('fight stats card shows per-fighter rows, uses entered names and marks the most active', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/tools/motion-fx');
    await expect(page.getByTestId('fight-stats')).toHaveCount(0);
    await page.getByPlaceholder('Sensei, Rival').fill('Sensei, Rival');
    await runToResult(page);
    const card = page.getByTestId('fight-stats');
    await expect(card).toBeVisible();
    await expect(card).toContainText('7 strikes · 3 hits · 85 BPM · peak at 2.1 s');
    const first = page.getByTestId('fight-stats-row-1');
    await expect(first).toContainText('Sensei');
    await expect(first).toContainText('most active');
    await expect(first).toContainText('3.4');
    await expect(first).toHaveAttribute('data-active', 'true');
    await expect(page.getByTestId('fight-stats-row-2')).toContainText('Rival');
    await expect(page.getByTestId('fight-stats-row-2')).not.toHaveAttribute('data-active', /.*/);
  });

  test('fight stats card is absent when the result has no stats or no fighters', async ({ page }) => {
    await mockBackend(page, { service: 'motion-score' });
    await page.goto('/tools/motion-score');
    await runToResult(page);
    await expect(page.getByTestId('fight-stats')).toHaveCount(0);
  });

  test('running shows the stage, then the result meta and charge', async ({ page }) => {
    const calls = await mockBackend(page, { jobStatuses: ['queued', 'processing', 'processing', 'completed'] });
    await page.goto('/tools/anime-fight-fx');
    await addClip(page);
    await page.getByTestId('production-run').click();
    await expect(page.getByTestId('production-stage')).toBeVisible();
    await expect(page.getByTestId('share-row')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('85 BPM', { exact: true })).toBeVisible();
    await expect(page.getByText('2 tracked')).toBeVisible();
    await expect(page.getByText('7 hits')).toBeVisible();
    await expect(page.getByText('charged $0.30')).toBeVisible();
    expect(calls.polls).toBeGreaterThanOrEqual(3);
  });

  test('a failed job shows the server message and keeps the run button usable', async ({ page }) => {
    await mockBackend(page, { jobStatuses: ['processing', 'failed'], failWith: 'no people found in the video; try a clip where a person is fully visible' });
    await page.goto('/tools/motion-fx');
    await addClip(page);
    await page.getByTestId('production-run').click();
    await expect(alert(page)).toContainText('no people found');
    await expect(page.getByTestId('production-run')).toBeEnabled();
    await expect(page.getByTestId('share-row')).toHaveCount(0);
  });

  test('run without a video is blocked with a hint', async ({ page }) => {
    const calls = await mockBackend(page);
    await page.goto('/tools/motion-fx');
    await page.getByTestId('production-run').click();
    await expect(alert(page)).toContainText('Add a video');
    expect(calls.service).toHaveLength(0);
  });

  test('beat-drop-fx blocks the run until a song is added', async ({ page }) => {
    const calls = await mockBackend(page, { service: 'beat-drop' });
    await page.goto('/tools/beat-drop-fx');
    await addClip(page);
    await page.getByTestId('production-run').click();
    await expect(alert(page)).toContainText('Add a song');
    expect(calls.service).toHaveLength(0);
    await upload(page, 'audio-drop', SONG);
    await expect(page.getByTestId('audio-drop')).toContainText('motion-song.wav');
    await page.getByTestId('production-run').click();
    await expect(page.getByTestId('share-row')).toBeVisible({ timeout: 30_000 });
    expect(calls.service).toHaveLength(1);
    expect(calls.service[0]).toMatchObject({ service: 'beat-drop', audio_url: `${CDN}/motion-song.wav`, video_url: `${CDN}/motion-clip.mp4` });
    expect(calls.service[0].params?.preset).toBeUndefined();
  });

  test('motion-score treats the song as optional and can drop it again', async ({ page }) => {
    const calls = await mockBackend(page, { service: 'motion-score' });
    await page.goto('/tools/motion-score');
    await addClip(page);
    await upload(page, 'audio-drop', SONG);
    await page.getByRole('button', { name: 'Remove track' }).click();
    await page.getByTestId('production-run').click();
    await expect(page.getByTestId('share-row')).toBeVisible({ timeout: 30_000 });
    expect(calls.service[0].audio_url).toBeUndefined();
    await expect(page.getByText('144 BPM martial arts action score')).toBeVisible();
    await expect(page.getByRole('link', { name: /Audio/ })).toHaveAttribute('href', `${CDN}/score.wav`);
    await expect(page.getByRole('link', { name: /cues\.json/ })).toHaveAttribute('href', `${CDN}/cues.json`);
  });

  test('motion-tracker shows downloads and flips between skeleton preview and guide', async ({ page }) => {
    const calls = await mockBackend(page, { service: 'motion-track' });
    await page.goto('/tools/motion-tracker');
    await expect(effectSelect(page)).toHaveCount(0);
    await runToResult(page);
    expect(calls.service[0].service).toBe('motion-track');
    expect(calls.service[0].params).toBeUndefined();
    for (const [label, href] of [['tracks.json', 'tracks.json'], ['signals.json', 'signals.json'], ['Skeleton MP4', 'preview.mp4'], ['Guide MP4', 'guide.mp4']]) {
      await expect(page.getByRole('link', { name: new RegExp(label.replace('.', '\\.')) })).toHaveAttribute('href', `${CDN}/${href}`);
    }
    const video = page.getByTestId('production-result');
    const view = page.getByRole('group', { name: 'Track view' });
    await expect(video).toHaveAttribute('src', `${CDN}/preview.mp4`);
    await expect(view.getByRole('button', { name: 'Skeleton preview' })).toHaveAttribute('aria-pressed', 'true');
    await view.getByRole('button', { name: 'Motion guide' }).click();
    await expect(video).toHaveAttribute('src', `${CDN}/guide.mp4`);
    await expect(view.getByRole('button', { name: 'Motion guide' })).toHaveAttribute('aria-pressed', 'true');
    await view.getByRole('button', { name: 'Skeleton preview' }).click();
    await expect(video).toHaveAttribute('src', `${CDN}/preview.mp4`);
    await expect(page.getByTestId('fight-stats')).toBeVisible();
    await expect(page.getByTestId('fight-stats-row-1')).toContainText('Fighter 1');
  });

  test('share row: social links carry the result URL and Share falls back to copying the link', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await mockBackend(page);
    await page.goto('/tools/lightning-fx');
    await runToResult(page);
    const row = page.getByTestId('share-row');
    for (const name of ['Share', 'Copy link', 'X', 'Reddit', 'WhatsApp']) await expect(row.getByRole(name === 'X' || name === 'Reddit' || name === 'WhatsApp' ? 'link' : 'button', { name, exact: true })).toBeVisible();
    const encoded = encodeURIComponent(`${CDN}/result.mp4`);
    await expect(row.getByRole('link', { name: 'X', exact: true })).toHaveAttribute('href', new RegExp(`twitter\\.com/intent/tweet.*${encoded}`));
    await expect(row.getByRole('link', { name: 'Reddit', exact: true })).toHaveAttribute('href', new RegExp(`reddit\\.com/submit\\?url=${encoded}`));
    await expect(row.getByRole('link', { name: 'WhatsApp', exact: true })).toHaveAttribute('href', /wa\.me\/\?text=/);
    for (const link of ['X', 'Reddit', 'WhatsApp']) await expect(row.getByRole('link', { name: link, exact: true })).toHaveAttribute('target', '_blank');
    await row.getByRole('button', { name: 'Share', exact: true }).click();
    await expect(row.getByRole('status')).toHaveText('Link copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${CDN}/result.mp4`);
    await page.evaluate(() => navigator.clipboard.writeText('x'));
    await row.getByRole('button', { name: 'Copy link' }).click();
    await expect(row.getByRole('status')).toHaveText('Link copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${CDN}/result.mp4`);
  });

  test('Continue with links carry video_url and the receiving page prefills it', async ({ page }) => {
    await mockBackend(page, { service: 'motion-fx' });
    await page.goto('/tools/motion-fx');
    await runToResult(page);
    const encoded = encodeURIComponent(`${CDN}/result.mp4`);
    await expect(page.getByRole('link', { name: 'Beat Drop', exact: true })).toHaveAttribute('href', `/tools/beat-drop-fx?video_url=${encoded}`);
    await expect(page.getByRole('link', { name: 'Score it', exact: true })).toHaveAttribute('href', `/tools/motion-score?video_url=${encoded}`);
    await expect(page.getByRole('link', { name: 'Clean up', exact: true })).toHaveAttribute('href', `/tools/shot-cleanup?video_url=${encoded}`);
    await expect(page.getByRole('link', { name: 'Captions', exact: true })).toHaveAttribute('href', `/tools/crazy-captions?src=${encoded}`);
    await expect(page.getByRole('link', { name: 'Add FX', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Open in Studio' })).toHaveAttribute('href', new RegExp(`^/studio\\?video_url=${encoded}`));
    await page.getByRole('link', { name: 'Score it', exact: true }).click();
    await expect(page).toHaveURL(/\/tools\/motion-score\?video_url=/);
    await expect(page.getByTestId('video-drop')).toContainText('result.mp4');
    await expect(page.getByTestId('production-price')).toContainText('$0.20');
  });

  test('motion-tracker results chain on the original clip, not the skeleton video', async ({ page }) => {
    await mockBackend(page, { service: 'motion-track' });
    await page.goto('/tools/motion-tracker');
    await runToResult(page);
    const source = encodeURIComponent(`${CDN}/motion-clip.mp4`);
    await expect(page.getByRole('link', { name: 'Add FX', exact: true })).toHaveAttribute('href', `/tools/motion-fx?video_url=${source}`);
    await expect(page.getByRole('link', { name: 'Captions', exact: true })).toHaveCount(0);
  });

  test('audio_url query prefills the song slot on beat-drop-fx', async ({ page }) => {
    await mockBackend(page, { service: 'beat-drop' });
    await page.goto(`/tools/beat-drop-fx?video_url=${encodeURIComponent(`${CDN}/a.mp4`)}&audio_url=${encodeURIComponent(`${CDN}/song.mp3`)}`);
    await expect(page.getByTestId('audio-drop')).toContainText('song.mp3');
    await expect(page.getByTestId('video-drop')).toContainText('a.mp4');
  });
});

test.describe('motion tools signed out', () => {
  test('the run button asks to sign in and sends nothing', async ({ page }) => {
    const calls = await mockBackend(page);
    await page.goto('/tools/motion-fx');
    await expect(page.getByTestId('production-run')).toHaveText('Sign in to run');
    expect(calls.service).toHaveLength(0);
  });
});

test.describe('tools index', () => {
  test('lists every motion tool card with its link', async ({ page }) => {
    await page.goto('/tools');
    for (const entry of MOTION_PAGES) {
      await expect(page.locator(`section[class*="grid"] a[href="/tools/${entry.slug}"]`).first()).toBeVisible();
    }
    await page.getByTestId('tools-search').fill('exaggerate');
    await expect(page.locator('section[class*="grid"] a[href="/tools/motion-exaggerate-fx"]')).toBeVisible();
    await expect(page.locator('section[class*="grid"] a[href="/tools/anime-fight-fx"]')).toBeHidden();
  });
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  for (const entry of MOTION_PAGES) {
    test(`${entry.slug} has no horizontal overflow before and after a result`, async ({ page }) => {
      await signIn(page);
      await mockBackend(page, { service: entry.service });
      await page.goto(`/tools/${entry.slug}`);
      await expect(page.getByTestId('production-run')).toBeVisible();
      const overflow = () => page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
      let size = await overflow();
      expect(size.scroll, `${entry.slug} idle`).toBeLessThanOrEqual(size.width);
      await runToResult(page, { audio: entry.service === 'beat-drop' });
      size = await overflow();
      expect(size.scroll, `${entry.slug} with result`).toBeLessThanOrEqual(size.width);
    });
  }
});
