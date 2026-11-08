const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { CDN, signIn, mockBackend, upload, addClip, runToResult } = require('./helpers/motion-mocks.cjs');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const PAGES = [
  { slug: 'track-blur', service: 'track-blur', name: 'Tracked Blur', price: '$0.30' },
  { slug: 'sticky-overlay', service: 'sticky-overlay', name: 'Sticky Overlay', price: '$0.30' },
  { slug: 'flow-fx', service: 'flow-fx', name: 'Flow FX', price: '$0.40' },
  { slug: 'reactive-fx', service: 'reactive-fx', name: 'Music Reactive FX', price: '$0.40' },
  { slug: 'mask-propagate', service: 'mask-propagate', name: 'Mask Propagate', price: '$0.25' },
];
const pngFile = () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mask-')), 'mask.png');
  fs.writeFileSync(file, PNG);
  return file;
};

async function drag(page, from = [0.2, 0.2], to = [0.5, 0.6]) {
  const picker = page.getByTestId('region-picker');
  await picker.scrollIntoViewIfNeeded();
  const box = await picker.boundingBox();
  await page.mouse.move(box.x + box.width * from[0], box.y + box.height * from[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * ((from[0] + to[0]) / 2), box.y + box.height * ((from[1] + to[1]) / 2), { steps: 4 });
  await page.mouse.move(box.x + box.width * to[0], box.y + box.height * to[1], { steps: 4 });
  await page.mouse.up();
}

async function click(page, at = [0.6, 0.3]) {
  const picker = page.getByTestId('region-picker');
  await picker.scrollIntoViewIfNeeded();
  const box = await picker.boundingBox();
  await page.mouse.click(box.x + box.width * at[0], box.y + box.height * at[1]);
}

test.describe('tracked tool pages', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  for (const entry of PAGES) {
    test(`${entry.slug} renders hero, price quote and demos`, async ({ page }) => {
      await mockBackend(page, { service: entry.service });
      await page.goto(`/tools/${entry.slug}`);
      await expect(page.getByRole('heading', { level: 1 })).toContainText(entry.name);
      await expect(page.getByTestId('video-drop')).toBeVisible();
      await expect(page.getByTestId('production-price')).toContainText(entry.price);
      await expect(page.getByTestId('production-demos')).toBeVisible();
      await expect(page.getByTestId('audio-drop')).toHaveCount(entry.slug === 'reactive-fx' ? 1 : 0);
    });
  }

  test('track-blur needs a box, then sends region and the tuned look', async ({ page }) => {
    const calls = await mockBackend(page, { service: 'track-blur' });
    await page.goto('/tools/track-blur');
    await addClip(page);
    await expect(page.getByText('Drag a box over the target on the first frame').first()).toBeVisible();
    await page.getByTestId('production-run').click();
    await expect(page.locator('[role="alert"]:not([id="__next-route-announcer__"])')).toContainText('Drag a box');
    expect(calls.service).toHaveLength(0);
    await drag(page);
    await expect(page.getByTestId('region-box')).toBeVisible();
    await page.locator('label', { hasText: /^Cover/ }).locator('select').selectOption('pixelate');
    await page.getByTestId('production-run').click();
    await page.getByTestId('share-row').waitFor({ timeout: 30_000 });
    const body = calls.service[0];
    expect(body.service).toBe('track-blur');
    expect(body.params.style).toBe('pixelate');
    expect(body.params.shape).toBe('ellipse');
    expect(body.params.mode).toBe('region');
    const { x, y, w, h } = body.params.region;
    expect(x).toBeGreaterThan(0.15);
    expect(x).toBeLessThan(0.25);
    expect(w).toBeGreaterThan(0.2);
    expect(y + h).toBeLessThanOrEqual(1);
    expect(body.image_url).toBeUndefined();
    await expect(page.getByTestId('production-result')).toHaveAttribute('src', `${CDN}/result.mp4`);
  });

  test('a single click makes a default box and clear removes it', async ({ page }) => {
    await mockBackend(page, { service: 'track-blur' });
    await page.goto('/tools/track-blur');
    await addClip(page);
    await click(page, [0.5, 0.5]);
    await expect(page.getByTestId('region-box')).toBeVisible();
    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(page.getByTestId('region-box')).toHaveCount(0);
  });

  test('an uploaded mask replaces the box requirement', async ({ page }) => {
    const calls = await mockBackend(page, { service: 'track-blur' });
    await page.goto('/tools/track-blur');
    await addClip(page);
    await upload(page, 'image-drop', pngFile());
    await expect(page.getByRole('button', { name: 'Remove' })).toBeVisible();
    await page.getByTestId('production-run').click();
    await page.getByTestId('share-row').waitFor({ timeout: 30_000 });
    expect(calls.service[0].image_url).toBe(`${CDN}/mask.png`);
    expect(calls.service[0].params.region).toBeUndefined();
  });

  test('sticky-overlay sends the clicked anchor, text and look', async ({ page }) => {
    const calls = await mockBackend(page, { service: 'sticky-overlay' });
    await page.goto('/tools/sticky-overlay');
    await addClip(page);
    await page.getByTestId('production-run').click();
    await expect(page.locator('[role="alert"]:not([id="__next-route-announcer__"])')).toContainText('Click the spot');
    await click(page, [0.6, 0.3]);
    await expect(page.getByTestId('anchor-dot')).toBeVisible();
    await page.getByRole('textbox').first().fill('');
    await expect(page.getByText('Type the text or add a sticker').first()).toBeVisible();
    await page.getByRole('textbox').first().fill('POW');
    await page.getByTestId('production-run').click();
    await page.getByTestId('share-row').waitFor({ timeout: 30_000 });
    const params = calls.service[0].params;
    expect(params.text).toBe('POW');
    expect(params.color).toBe('#ffd21f');
    expect(params.x).toBeGreaterThan(0.5);
    expect(params.x).toBeLessThan(0.7);
    expect(params.y).toBeGreaterThan(0.2);
    expect(params.y).toBeLessThan(0.4);
    expect(params.width).toBe(0.15);
    expect(params.pop).toBe(true);
    expect(params.region).toBeUndefined();
  });

  test('flow-fx sends the selected effects and omits an empty selection', async ({ page }) => {
    const calls = await mockBackend(page, { service: 'flow-fx' });
    await page.goto('/tools/flow-fx');
    await page.getByRole('button', { name: 'Light trails' }).click();
    await page.getByRole('button', { name: 'Jelly wobble' }).click();
    await runToResult(page);
    expect(calls.service[0].params.effects).toEqual(['motion-blur', 'trails', 'jelly']);
    expect(calls.service[0].params.region).toBeUndefined();
    const second = await mockBackend(page, { service: 'flow-fx' });
    await page.getByRole('button', { name: 'Motion blur' }).click();
    await page.getByRole('button', { name: 'Jelly wobble' }).click();
    await page.getByRole('button', { name: 'Light trails' }).click();
    await page.getByTestId('production-run').click();
    await page.getByTestId('share-row').waitFor({ timeout: 30_000 });
    expect(second.service[0].params.effects).toBeUndefined();
  });

  test('reactive-fx takes a song and its start offset', async ({ page }) => {
    const calls = await mockBackend(page, { service: 'reactive-fx' });
    await page.goto('/tools/reactive-fx');
    await runToResult(page, { audio: true });
    const body = calls.service[0];
    expect(body.audio_url).toBe(`${CDN}/motion-song.wav`);
    expect(body.params.effects).toEqual(['glow', 'trails', 'sparks', 'warp', 'flash']);
    expect(body.params.audio_start).toBeUndefined();
    expect(body.params.intensity).toBe(1);
  });

  test('mask-propagate shows the preview and switches to the mask video', async ({ page }) => {
    const calls = await mockBackend(page, { service: 'mask-propagate' });
    await page.goto('/tools/mask-propagate');
    await addClip(page);
    await drag(page, [0.3, 0.15], [0.6, 0.85]);
    await page.getByTestId('production-run').click();
    await page.getByTestId('share-row').waitFor({ timeout: 30_000 });
    expect(calls.service[0].params.shape).toBe('ellipse');
    expect(calls.service[0].params.segment).toBe(40);
    await expect(page.getByTestId('production-result')).toHaveAttribute('src', `${CDN}/preview.mp4`);
    await page.getByRole('button', { name: 'Mask video' }).click();
    await expect(page.getByTestId('production-result')).toHaveAttribute('src', `${CDN}/mask.mp4`);
    await expect(page.getByRole('link', { name: /Mask MP4/ })).toHaveAttribute('href', `${CDN}/mask.mp4`);
  });
});

