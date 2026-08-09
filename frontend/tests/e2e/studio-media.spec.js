const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const { test, expect } = require('@playwright/test');

const VIDEO = path.resolve(__dirname, '../../public/showcase/h3-loop-glass-torus.mp4');
const IMAGE = path.resolve(__dirname, '../../public/images/logo.png');
const API_KEY = 'mg_studio_e2e_key';
const PERF_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'manifold-studio-perf-'));
const PERF_VIDEO = path.join(PERF_DIR, '2k-performance.mp4');

test.beforeAll(() => {
  const common = ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=2048x1080:rate=30', '-t', '1.5'];
  try {
    execFileSync('ffmpeg', [...common, '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', PERF_VIDEO], { timeout: 60_000, stdio: 'pipe' });
  } catch {
    execFileSync('ffmpeg', [...common, '-c:v', 'h264_nvenc', '-preset', 'p1', '-tune', 'ull', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', PERF_VIDEO], { timeout: 60_000, stdio: 'pipe' });
  }
});

test.afterAll(() => fs.rmSync(PERF_DIR, { recursive: true, force: true }));

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

const PNG_FIXTURE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP4z8DAwMDAxMDAwMAAAAwBAQDJ/pLvAAAAAElFTkSuQmCC', 'base64');

async function installMocks(page, hooks = {}) {
  await page.addInitScript(({ apiKey }) => {
    localStorage.setItem('mg_api_key', apiKey);
    localStorage.setItem('mg_user', JSON.stringify({ id: 'studio-user', email: 'studio@example.com', api_key: apiKey, credits: 10000, credits_usd: 100 }));
  }, { apiKey: API_KEY });
  await page.route('**/api/pricing', (route) => route.fulfill({ status: 200, json: {
    credit_price_usd: 0.01,
    h3_video_estimate: { estimated_cost_usd: 1.01 },
    studio: {
      extend_input_second_usd: 0.012,
      extend_output_second_usd: 0.084,
      upscale_base_usd: 0.10,
      upscale_output_mp_second_usd: 0.012,
    },
  } }));
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, json: {
    user: { id: 'studio-user', email: 'studio@example.com', api_key: API_KEY, credits: 10000, credits_usd: 100 },
  } }));
  await page.route('**/api/studio/projects', (route) => route.fulfill({ status: 200, json: { projects: hooks.cloudProjects || [] } }));
  await page.route('**/api/studio/projects/*', async (route) => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON();
      const id = new URL(route.request().url()).pathname.split('/').pop();
      const now = new Date().toISOString();
      const project = { id, name: body.name, document: body.document, revision: 1, created_at: now, updated_at: now };
      hooks.onProjectSave?.(project);
      await route.fulfill({ status: 200, json: { project } });
      return;
    }
    const id = new URL(route.request().url()).pathname.split('/').pop();
    const existing = hooks.cloudProjects?.find((project) => project.id === id);
    if (existing) {
      await route.fulfill({ status: 200, json: { project: existing } });
      return;
    }
    await route.fulfill({ status: 404, json: { error: 'project not found' } });
  });
  await page.route('**/api/studio/assets/presign', async (route) => {
    const body = route.request().postDataJSON();
    hooks.onAssetPresign?.(body);
    await route.fulfill({ status: 200, json: {
      upload_url: `https://studio-upload.example/${body.project_id}/${body.asset_id}`,
      public_url: `https://studio-media.example/${body.project_id}/${body.asset_id}/${encodeURIComponent(body.filename)}`,
      object_key: `gallery/studio/test/${body.project_id}/${body.asset_id}/${body.filename}`,
    } });
  });
  await page.route('https://studio-upload.example/**', async (route) => {
    hooks.onAssetUpload?.(route.request());
    await route.fulfill({ status: 200 });
  });
}

test('signed-in projects autosave locally while assets upload and save to the account cloud', async ({ page }) => {
  const presigns = [];
  const saves = [];
  await installMocks(page, { onAssetPresign: (value) => presigns.push(value), onProjectSave: (value) => saves.push(value) });
  await page.goto('/studio');
  await page.locator('input[type=file]').setInputFiles({ name: 'cloud-frame.png', mimeType: 'image/png', buffer: PNG_FIXTURE });
  await expect(page.getByTestId('studio-save-status')).toHaveText('Saved to cloud', { timeout: 20_000 });
  expect(presigns).toHaveLength(1);
  expect(presigns[0]).toMatchObject({ filename: 'cloud-frame.png', content_type: 'image/png', size: PNG_FIXTURE.length });
  expect(saves.at(-1).document.assets[0].cloudURL).toContain('studio-media.example');

  await page.reload();
  await expect(page.getByTestId('studio-panel').getByRole('button', { name: /cloud-frame\.png/ })).toBeVisible();
  await expect(page.getByTestId('studio-save-status')).toHaveText('Saved to cloud', { timeout: 20_000 });
  expect(presigns).toHaveLength(1);
});

test('an account project restores its R2 media on a device without a local copy', async ({ page }) => {
  const projectID = '7cd844da-0b82-48c2-a8b2-2c20107b4cb0';
  const assetID = '923ef911-cf5f-446f-9a21-da355553b5fc';
  const now = new Date().toISOString();
  const cloudProjects = [{
    id: projectID, name: 'Cloud restored', revision: 4, created_at: now, updated_at: now,
    document: { version: 1, selectedID: assetID, assets: [{
      id: assetID, name: 'remote-frame.png', kind: 'image', duration: 5, width: 2, height: 2,
      trimStart: 0, trimEnd: 5, timelineStart: 0, volume: 1, fadeIn: 0, fadeOut: 0,
      stageX: 0, stageY: 0, adjustments: {}, contentType: 'image/png', size: PNG_FIXTURE.length,
      lastModified: 1, cloudURL: 'https://studio-media.example/cloud/remote-frame.png', objectKey: 'gallery/studio/cloud/remote-frame.png',
    }] },
  }];
  await installMocks(page, { cloudProjects });
  await page.route('https://studio-media.example/cloud/remote-frame.png', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG_FIXTURE }));
  await page.goto('/studio');
  await expect(page.getByTestId('studio-project-menu')).toContainText('Cloud restored');
  await expect(page.getByTestId('studio-panel').getByRole('button', { name: /remote-frame\.png/ })).toBeVisible();
  await expect(page.getByTestId('studio-render-status')).toContainText('2 × 2 · GPU preview');
});

test('video assets open the shared restyle modal and completed jobs return to the timeline', async ({ page }) => {
  let submitted;
  await installMocks(page);
  await page.route('**/api/service', async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ status: 202, json: { result: { job_id: 'video_restyle_test', status_url: '/api/video-jobs/video_restyle_test' } } });
  });
  await page.route('**/api/video-jobs/video_restyle_test', (route) => route.fulfill({ status: 200, json: {
    job: { status: 'completed', result: { video_url: 'https://studio-result.example/restyled.mp4' } },
  } }));
  await page.route('https://studio-result.example/restyled.mp4', (route) => route.fulfill({ status: 200, contentType: 'video/mp4', body: fs.readFileSync(VIDEO) }));

  await page.goto('/studio');
  await page.locator('input[type=file]').setInputFiles(VIDEO);
  const card = page.getByTestId('studio-panel').getByRole('button', { name: /h3-loop-glass-torus\.mp4/ });
  await card.click({ button: 'right' });
  await page.getByRole('button', { name: /Restyle video Transform look/ }).click();
  await expect(page.getByRole('heading', { name: 'Restyle video' })).toBeVisible();
  await expect(page.getByText('Transformation strength')).toBeVisible();
  await page.getByTestId('studio-restyle-prompt').fill('Turn Video 1 into luminous watercolor while preserving motion.');
  await page.getByTestId('studio-restyle-submit').click();
  await expect(page.getByText('Restyled video added to the timeline')).toBeVisible({ timeout: 20_000 });
  expect(submitted).toMatchObject({
    service: 'video_restyle', model: 'wan-2.2', strength: 0.85,
    num_frames: 81, frames_per_second: 16, resolution: '720p',
  });
  await expect(page.locator('[data-testid^="timeline-clip-"]')).toHaveCount(2);
});

test('2K preview stays frame-driven on WebGL and export requests GPU and hardware codecs', async ({ page }) => {
  test.setTimeout(120_000);
  await installMocks(page);
  await page.goto('/studio');
  await page.locator('input[type=file]').setInputFiles(PERF_VIDEO);
  await expect(page.getByTestId('studio-render-status')).toContainText('2048 × 1080 · GPU preview');
  await page.getByRole('button', { name: 'Play' }).click();
  await page.waitForTimeout(1700);
  const preview = await page.evaluate(() => window.__MANIFOLD_STUDIO_PERF__);
  const previewSeconds = (preview.previewLastAt - preview.previewStartedAt) / 1000;
  expect(preview.renderer.api).toBe('webgl2');
  expect(preview.renderer.maxTextureSize).toBeGreaterThanOrEqual(2048);
  // Headless Chrome frequently uses a software compositor; 15 fps is the
  // regression floor here, while production GPU runs remain frame-rate bound.
  expect(preview.previewFrames / previewSeconds).toBeGreaterThanOrEqual(15);
  test.skip(preview.renderer.renderer.includes('SwiftShader'), 'Hardware export benchmark requires PLAYWRIGHT_GPU=1 on a GPU runner');

  await page.getByTestId('studio-export').click();
  await page.getByRole('button', { name: /MP4 · H\.264/ }).click();
  const startedAt = Date.now();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export locally' }).click();
  await downloadPromise;
  const elapsedSeconds = (Date.now() - startedAt) / 1000;
  const exported = await page.evaluate(() => window.__MANIFOLD_STUDIO_PERF__.export);
  expect(exported).toMatchObject({ sourceWidth: 2048, sourceHeight: 1080, hardwareRequested: 'prefer-hardware', frames: 45 });
  if (exported.hardwareAcceleration === 'prefer-hardware') {
    expect(exported).toMatchObject({ width: 2048, height: 1080 });
  } else {
    expect(exported.width).toBeLessThanOrEqual(1920);
    expect(exported.height).toBeLessThanOrEqual(1080);
  }
  expect(exported.completedAt).toBeGreaterThan(exported.startedAt);
  expect(elapsedSeconds).toBeLessThan(45);
});

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

test('timeline supports grouped dragging, click seeking, keyboard split, and handle trimming', async ({ page }) => {
  await installMocks(page);
  await page.goto('/studio');
  await page.locator('input[type=file]').setInputFiles([
    { name: 'first.png', mimeType: 'image/png', buffer: PNG_FIXTURE },
    { name: 'second.png', mimeType: 'image/png', buffer: PNG_FIXTURE },
  ]);

  const clips = page.locator('[data-testid^="timeline-clip-"]');
  await expect(clips).toHaveCount(2);
  await clips.nth(1).click({ modifiers: ['Shift'] });
  await expect(page.getByText('2 selected')).toBeVisible();

  const before = await clips.evaluateAll((items) => items.map((item) => Number.parseFloat(item.style.left)));
  const firstBox = await clips.nth(0).boundingBox();
  await page.mouse.move(firstBox.x + Math.min(80, firstBox.width / 2), firstBox.y + firstBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(firstBox.x + Math.min(80, firstBox.width / 2) + 48, firstBox.y + firstBox.height / 2, { steps: 4 });
  await page.mouse.up();
  const after = await clips.evaluateAll((items) => items.map((item) => Number.parseFloat(item.style.left)));
  expect(after[0] - before[0]).toBeGreaterThan(35);
  expect(Math.abs((after[0] - before[0]) - (after[1] - before[1]))).toBeLessThan(1);

  await clips.nth(0).click({ position: { x: 100, y: 30 } });
  await page.keyboard.press('s');
  await expect(clips).toHaveCount(3);

  const splitClip = clips.nth(0);
  const widthBeforeTrim = await splitClip.evaluate((item) => Number.parseFloat(item.style.width));
  const trimHandle = splitClip.locator('[title="Trim end"]');
  const trimBox = await trimHandle.boundingBox();
  await page.mouse.move(trimBox.x + trimBox.width / 2, trimBox.y + trimBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(trimBox.x - 32, trimBox.y + trimBox.height / 2, { steps: 3 });
  await page.mouse.up();
  const widthAfterTrim = await splitClip.evaluate((item) => Number.parseFloat(item.style.width));
  expect(widthAfterTrim).toBeLessThan(widthBeforeTrim - 20);
});

test('visual clips stack across timeline layers with vertical dragging and bracket shortcuts', async ({ page }) => {
  const saves = [];
  await installMocks(page, { onProjectSave: (value) => saves.push(value) });
  await page.goto('/studio');
  await page.locator('input[type=file]').setInputFiles([
    { name: 'lower-layer.png', mimeType: 'image/png', buffer: PNG_FIXTURE },
    { name: 'upper-layer.png', mimeType: 'image/png', buffer: PNG_FIXTURE },
  ]);

  const clips = page.locator('[data-testid^="timeline-clip-"]');
  await expect(clips).toHaveCount(2);
  await expect(page.getByTestId('timeline-track-label-v2')).toBeVisible();
  await expect(clips.nth(0)).toHaveAttribute('data-visual-track', '0');

  const firstBox = await clips.nth(0).boundingBox();
  await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(firstBox.x + firstBox.width / 2 + 24, firstBox.y + firstBox.height / 2 - 70, { steps: 5 });
  await page.mouse.up();
  await expect(clips.nth(0)).toHaveAttribute('data-visual-track', '1');

  await clips.nth(1).click({ modifiers: ['Shift'] });
  await expect(page.getByText('2 selected')).toBeVisible();
  const secondBox = await clips.nth(1).boundingBox();
  await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2 - 70, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByTestId('timeline-track-label-v3')).toBeVisible();
  await expect(clips.nth(0)).toHaveAttribute('data-visual-track', '2');
  await expect(clips.nth(1)).toHaveAttribute('data-visual-track', '1');

  await page.keyboard.press('Control+BracketLeft');
  await expect(clips.nth(0)).toHaveAttribute('data-visual-track', '1');
  await expect(clips.nth(1)).toHaveAttribute('data-visual-track', '0');
  await page.keyboard.press('Control+BracketRight');
  await expect(clips.nth(0)).toHaveAttribute('data-visual-track', '2');
  await expect(clips.nth(1)).toHaveAttribute('data-visual-track', '1');

  await page.getByTestId('studio-panel').getByRole('button', { name: /upper-layer\.png/ }).click();
  const overlapBox = await clips.nth(1).boundingBox();
  await page.mouse.move(overlapBox.x + overlapBox.width / 2, overlapBox.y + overlapBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(overlapBox.x + overlapBox.width / 2 - 300, overlapBox.y + overlapBox.height / 2, { steps: 6 });
  await page.mouse.up();
  await page.getByTestId('studio-timeline-ruler').click({ position: { x: 64, y: 10 } });
  await expect(page.locator('[data-stage-asset]')).toHaveCount(2);
  const lowerStage = page.getByRole('button', { name: 'Move lower-layer.png' });
  const upperStage = page.getByRole('button', { name: 'Move upper-layer.png' });
  expect(Number(await lowerStage.evaluate((item) => item.style.zIndex))).toBeGreaterThan(Number(await upperStage.evaluate((item) => item.style.zIndex)));
  await page.keyboard.press('Control+BracketRight');
  expect(Number(await upperStage.evaluate((item) => item.style.zIndex))).toBeGreaterThan(Number(await lowerStage.evaluate((item) => item.style.zIndex)));
  await page.keyboard.press('Control+BracketLeft');

  await expect.poll(() => saves.at(-1)?.document?.assets?.map((asset) => asset.visualTrack)).toEqual([2, 1]);
  expect(saves.at(-1).document.version).toBe(2);
});

test('timeline copy paste aligns groups to the playhead and accepts dropped media', async ({ page }) => {
  await installMocks(page);
  await page.goto('/studio');
  await page.locator('input[type=file]').setInputFiles([
    { name: 'copy-one.png', mimeType: 'image/png', buffer: PNG_FIXTURE },
    { name: 'copy-two.png', mimeType: 'image/png', buffer: PNG_FIXTURE },
  ]);
  const clips = page.locator('[data-testid^="timeline-clip-"]');
  await expect(clips).toHaveCount(2);
  await clips.nth(1).click({ modifiers: ['Shift'] });
  await page.keyboard.press('Control+c');

  const ruler = page.getByTestId('studio-timeline-ruler');
  await ruler.click({ position: { x: 160, y: 10 } });
  await page.keyboard.press('Control+v');
  await expect(clips).toHaveCount(4);
  await expect(clips.nth(2)).toHaveAttribute('aria-selected', 'true');
  await expect(clips.nth(3)).toHaveAttribute('aria-selected', 'true');
  const pastedLeft = await clips.nth(2).evaluate((item) => Number.parseFloat(item.style.left));
  expect(pastedLeft).toBeGreaterThan(150);
  expect(pastedLeft).toBeLessThan(170);

  await page.getByTestId('studio-timeline-dropzone').evaluate((dropzone, base64) => {
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    const transfer = new DataTransfer();
    transfer.items.add(new File([bytes], 'dropped-at-four.png', { type: 'image/png' }));
    const rect = dropzone.getBoundingClientRect();
    const init = { bubbles: true, cancelable: true, clientX: rect.left + 256, clientY: rect.top + 50, dataTransfer: transfer };
    dropzone.dispatchEvent(new DragEvent('dragover', init));
    dropzone.dispatchEvent(new DragEvent('drop', init));
  }, PNG_FIXTURE.toString('base64'));
  await expect(clips).toHaveCount(5);
  const droppedLeft = await clips.nth(4).evaluate((item) => Number.parseFloat(item.style.left));
  expect(droppedLeft).toBeGreaterThan(246);
  expect(droppedLeft).toBeLessThan(266);
});

test('spacebar toggles timeline playback even after the file input had focus', async ({ page }) => {
  await installMocks(page);
  await page.goto('/studio');
  await page.locator('input[type=file]').setInputFiles(VIDEO);
  await expect(page.getByRole('button', { name: 'Play' })).toBeEnabled();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
});

test('visual elements can be dragged and nudged around the stage', async ({ page }) => {
  await installMocks(page);
  await page.goto('/studio');
  await page.locator('input[type=file]').setInputFiles(IMAGE);
  const element = page.getByTestId('studio-stage-element');
  await expect(element).toBeVisible();
  await expect(element).toHaveAttribute('data-position-x', '0.0000');
  const box = await element.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 70, box.y + box.height / 2 + 35, { steps: 5 });
  await page.mouse.up();
  expect(Number(await element.getAttribute('data-position-x'))).toBeGreaterThan(0.05);
  expect(Number(await element.getAttribute('data-position-y'))).toBeGreaterThan(0.03);
  await element.focus();
  const beforeNudge = Number(await element.getAttribute('data-position-x'));
  await page.keyboard.press('ArrowRight');
  expect(Number(await element.getAttribute('data-position-x'))).toBeGreaterThan(beforeNudge);
  await element.dblclick();
  await expect(element).toHaveAttribute('data-position-x', '0.0000');
  await expect(element).toHaveAttribute('data-position-y', '0.0000');
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
  let previewRequested = false;
  await page.route('**/static/voice-samples/f1.opus', (route) => {
    previewRequested = true;
    return route.fulfill({ status: 200, contentType: 'audio/wav', body: wav });
  });
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
  await page.getByTestId('studio-voice-preview-F1').click();
  await expect(page.getByRole('radio', { name: /Clear/ })).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => previewRequested).toBe(true);
  await page.getByTestId('studio-speech-text').fill('A short line for the timeline.');
  await page.getByTestId('studio-audio-generate').click();
  await expect(page.getByRole('heading', { name: /speech-\d+\.wav/ })).toBeVisible();
  expect(request).toMatchObject({ service: 'tts', text: 'A short line for the timeline.', voice: 'F1', language: 'en' });
});

test('insufficient credits opens the shared payment chooser without leaving Studio', async ({ page }) => {
  await installMocks(page);
  await page.route('**/api/service', (route) => route.fulfill({
    status: 402,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'insufficient credits: need 0.05 credits ($0.0005), have 0.00' }),
  }));
  await page.goto('/studio');
  await page.getByTestId('studio-tool-audio').click();
  await page.getByRole('button', { name: /Speech/ }).click();
  await page.getByTestId('studio-speech-text').fill('hi');
  await page.getByTestId('studio-audio-generate').click();

  const dialog = page.getByTestId('payment-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('need 0.05 credits');
  await expect(dialog.getByRole('button', { name: /Creator monthly/ })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '$25', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close payment dialog' }).click();

  await page.getByRole('button', { name: /Top up/ }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('without leaving the Studio');
});

test('video import exposes local MP4 export and priced Grok extension', async ({ page }) => {
  test.setTimeout(120_000);
  await installMocks(page);
  let uploadContentType = '';
  let extensionRequest;
  await page.route('**/api/uploads/presign**', async (route) => {
    const requested = new URL(route.request().url());
    expect(requested.searchParams.get('filename')).toMatch(/-grok-source\.mp4$/);
    expect(requested.searchParams.get('content_type')).toBe('video/mp4');
    await route.fulfill({ status: 200, json: {
      upload_url: 'https://upload.example/grok-source.mp4?signature=test',
      public_url: 'https://media.example/grok-source.mp4',
    } });
  });
  await page.route('https://upload.example/**', async (route) => {
    uploadContentType = await route.request().headerValue('content-type');
    await route.fulfill({ status: 200 });
  });
  await page.route('**/api/studio/extend-video', async (route) => {
    extensionRequest = route.request().postDataJSON();
    await route.fulfill({ status: 202, json: { job_id: 'extend-1', status_url: '/api/video-jobs/extend-1', credits_remain: 9900 } });
  });
  await page.route('**/api/video-jobs/extend-1', (route) => route.fulfill({ status: 200, json: {
    job: { status: 'completed', result: { video_url: 'https://media.example/extended.mp4', duration: 10 } },
  } }));
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
  await page.getByRole('button', { name: 'Extend video', exact: true }).click();
  await expect(page.getByText('Extension ready')).toBeVisible({ timeout: 90_000 });
  expect(uploadContentType).toBe('video/mp4');
  expect(extensionRequest).toMatchObject({
    video_url: 'https://media.example/grok-source.mp4',
    duration: 6,
  });
  expect(extensionRequest.source_duration).toBeGreaterThan(4);
  expect(extensionRequest.source_duration).toBeLessThan(5);
});

test('export dialog offers renderer presets and remembers them across reloads', async ({ page }) => {
  await installMocks(page);
  await page.goto('/studio');
  await page.locator('input[type=file]').setInputFiles(VIDEO);
  await page.getByTestId('studio-export').click();

  await expect(page.getByTestId('export-format-webm-vp9')).toBeVisible();
  await page.getByTestId('export-format-webm-vp9').click();
  await page.getByTestId('export-resolution').selectOption('720p');
  await page.getByTestId('export-frame-rate').selectOption('24');
  await page.getByTestId('export-quality').selectOption('high');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('mg_studio_export_settings_v1'))).toContain('webm-vp9');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export locally' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/-studio\.webm$/);
  const outputPath = await download.path();
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,r_frame_rate,width,height', '-of', 'json', outputPath], { encoding: 'utf8' }));
  expect(probe.streams[0]).toMatchObject({ codec_name: 'vp9', r_frame_rate: '24/1' });
  expect(probe.streams[0].height).toBeLessThanOrEqual(720);

  await page.reload();
  await expect(page.getByTestId('studio-export')).toBeEnabled({ timeout: 20_000 });
  await page.getByTestId('studio-export').click();
  await expect(page.getByTestId('export-format-webm-vp9')).toHaveClass(/optionSelected/);
  await expect(page.getByTestId('export-resolution')).toHaveValue('720p');
  await expect(page.getByTestId('export-frame-rate')).toHaveValue('24');
  await expect(page.getByTestId('export-quality')).toHaveValue('high');
  await expect(page.getByText('Local download')).toBeVisible();
});

test('video upscale previews price, queues Real-ESRGAN, and adds the result', async ({ page }) => {
  test.setTimeout(120_000);
  await installMocks(page);
  let upscaleRequest;
  await page.route('**/api/uploads/presign**', async (route) => route.fulfill({ status: 200, json: {
    upload_url: 'https://upload.example/upscale-source.mp4?signature=test',
    public_url: 'https://media.example/upscale-source.mp4',
  } }));
  await page.route('https://upload.example/**', (route) => route.fulfill({ status: 200 }));
  await page.route('**/api/studio/upscale-video', async (route) => {
    upscaleRequest = route.request().postDataJSON();
    await route.fulfill({ status: 202, json: { job_id: 'upscale-1', status_url: '/api/video-jobs/upscale-1', credits_remain: 9800 } });
  });
  await page.route('**/api/video-jobs/upscale-1', (route) => route.fulfill({ status: 200, json: {
    job: { status: 'completed', result: { video_url: 'https://media.example/upscaled.mp4', scale: 4 } },
  } }));
  await page.route('https://media.example/upscaled.mp4', (route) => route.fulfill({ status: 200, contentType: 'video/mp4', body: fs.readFileSync(VIDEO) }));

  await page.goto('/studio');
  await page.locator('input[type=file]').setInputFiles(VIDEO);
  await page.getByTestId('studio-tool-ai').click();
  await page.getByTestId('studio-upscale-open').click();
  await expect(page.getByRole('heading', { name: 'Upscale video' })).toBeVisible();
  await page.getByTestId('studio-upscale-scales').getByRole('button', { name: '4×' }).click();
  await expect(page.getByText(/credits/).last()).toBeVisible();
  await page.getByTestId('studio-upscale-submit').click();
  await expect(page.getByText('Real-ESRGAN 4× clip added to the timeline')).toBeVisible({ timeout: 90_000 });
  expect(upscaleRequest).toMatchObject({ video_url: 'https://media.example/upscale-source.mp4', scale: 4 });
  expect(upscaleRequest.width).toBeGreaterThan(0);
  expect(upscaleRequest.height).toBeGreaterThan(0);
  expect(upscaleRequest.duration).toBeGreaterThan(4);
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
