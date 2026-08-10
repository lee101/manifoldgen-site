const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const { test, expect } = require('@playwright/test');

const VIDEO = path.resolve(__dirname, '../../public/showcase/h3-loop-glass-torus.webm');
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

async function installExportBlobCapture(page) {
  await page.addInitScript(() => {
    const createObjectURL = URL.createObjectURL.bind(URL);
    window.__MANIFOLD_EXPORTED_VIDEO_BLOBS__ = [];
    URL.createObjectURL = (blob) => {
      if (blob.type.startsWith('video/')) window.__MANIFOLD_EXPORTED_VIDEO_BLOBS__.push(blob);
      return createObjectURL(blob);
    };
  });
}

async function captureEditorFrame(page, timestamp) {
  await page.waitForFunction(() => {
    const video = document.querySelector('[data-testid="studio-stage-element"] video');
    return video instanceof HTMLVideoElement && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
  }, null, { timeout: 10_000 });
  // Seek through the real timeline UI. Directly mutating video.currentTime is
  // intentionally overridden by React's playhead state and is not an E2E test.
  await page.getByTestId('studio-timeline-ruler').click({ position: { x: timestamp * 64, y: 8 } });
  try {
    await page.waitForFunction((time) => {
      window.__MANIFOLD_STUDIO_PERF__?.redrawPreview?.();
      const renderedTime = window.__MANIFOLD_STUDIO_PERF__?.previewMediaTime;
      return typeof renderedTime === 'number' && Math.abs(renderedTime - time) < 0.06;
    }, timestamp, { timeout: 10_000 });
  } catch (reason) {
    const state = await page.evaluate(() => {
      const video = document.querySelector('[data-testid="studio-stage-element"] video');
      return {
        hasRedrawHook: typeof window.__MANIFOLD_STUDIO_PERF__?.redrawPreview === 'function',
        previewMediaTime: window.__MANIFOLD_STUDIO_PERF__?.previewMediaTime,
        currentTime: video instanceof HTMLVideoElement ? video.currentTime : null,
        readyState: video instanceof HTMLVideoElement ? video.readyState : null,
      };
    });
    throw new Error(`Editor preview did not render ${timestamp}s: ${JSON.stringify(state)}`, { cause: reason });
  }
  return page.getByTestId('studio-stage-element').locator('canvas').screenshot({ animations: 'disabled' });
}

async function compareLatestExportWithEditorFrames(page, editorFrames) {
  return page.evaluate(async ({ frames }) => {
    const blobs = window.__MANIFOLD_EXPORTED_VIDEO_BLOBS__ || [];
    const blob = blobs.at(-1);
    if (!blob) throw new Error('The export did not create a video blob');
    const url = URL.createObjectURL(blob);
    try {
      const video = document.createElement('video');
      video.muted = true;
      video.preload = 'auto';
      video.src = url;
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = () => reject(new Error('The exported video could not be decoded'));
      });

      const decodeImage = (source) => new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('An editor reference frame could not be decoded'));
        image.src = source;
      });
      const seek = (time) => new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error(`Export seek to ${time}s timed out`)), 10_000);
        video.onseeked = () => {
          window.clearTimeout(timeout);
          requestAnimationFrame(resolve);
        };
        video.onerror = () => reject(new Error('An exported video frame could not be decoded'));
        video.currentTime = time;
      });

      const width = 192;
      const height = 108;
      const exportedCanvas = document.createElement('canvas');
      const editorCanvas = document.createElement('canvas');
      exportedCanvas.width = editorCanvas.width = width;
      exportedCanvas.height = editorCanvas.height = height;
      const exportedContext = exportedCanvas.getContext('2d', { willReadFrequently: true });
      const editorContext = editorCanvas.getContext('2d', { willReadFrequently: true });
      const metrics = [];
      const exportedImages = [];
      const exportedPixelSets = [];

      for (const frame of frames) {
        const editorImage = await decodeImage(frame.image);
        editorContext.clearRect(0, 0, width, height);
        editorContext.drawImage(editorImage, 0, 0, width, height);
        const editorPixels = editorContext.getImageData(0, 0, width, height).data;
        let best = null;
        let bestImage = '';
        let bestPixels = null;
        // Browser seeks and encoded 24 fps timestamps can resolve to adjacent
        // frames. Compare a two-frame cadence window and retain the closest
        // visual match instead of treating seek rounding as image corruption.
        for (const frameOffset of [-2, -1, 0, 1, 2]) {
          const matchedTimestamp = Math.max(0, Math.min(video.duration - 0.001, frame.timestamp + frameOffset / 24));
          await seek(matchedTimestamp);
          exportedContext.drawImage(video, 0, 0, width, height);
          const exportedPixels = exportedContext.getImageData(0, 0, width, height).data;
          let absoluteError = 0;
          let squaredError = 0;
          let editorLumaSum = 0;
          let exportedLumaSum = 0;
          let editorLumaSquared = 0;
          let exportedLumaSquared = 0;
          let lumaProduct = 0;
          let maximum = 0;
          const pixelCount = width * height;
          for (let index = 0; index < exportedPixels.length; index += 4) {
            for (let channel = 0; channel < 3; channel += 1) {
              const difference = exportedPixels[index + channel] - editorPixels[index + channel];
              absoluteError += Math.abs(difference);
              squaredError += difference * difference;
            }
            const editorLuma = 0.2126 * editorPixels[index] + 0.7152 * editorPixels[index + 1] + 0.0722 * editorPixels[index + 2];
            const exportedLuma = 0.2126 * exportedPixels[index] + 0.7152 * exportedPixels[index + 1] + 0.0722 * exportedPixels[index + 2];
            editorLumaSum += editorLuma;
            exportedLumaSum += exportedLuma;
            editorLumaSquared += editorLuma * editorLuma;
            exportedLumaSquared += exportedLuma * exportedLuma;
            lumaProduct += editorLuma * exportedLuma;
            maximum = Math.max(maximum, exportedLuma);
          }
          const channels = pixelCount * 3;
          const meanAbsoluteError = absoluteError / channels;
          const meanSquaredError = squaredError / channels;
          const covariance = lumaProduct - editorLumaSum * exportedLumaSum / pixelCount;
          const editorVariance = editorLumaSquared - editorLumaSum * editorLumaSum / pixelCount;
          const exportedVariance = exportedLumaSquared - exportedLumaSum * exportedLumaSum / pixelCount;
          const candidate = {
            timestamp: frame.timestamp,
            matchedTimestamp,
            frameOffset,
            similarity: 1 - meanAbsoluteError / 255,
            meanAbsoluteError,
            psnr: meanSquaredError === 0 ? 99 : 10 * Math.log10(255 * 255 / meanSquaredError),
            lumaCorrelation: covariance / Math.sqrt(Math.max(1e-9, editorVariance * exportedVariance)),
            maximumLuma: maximum,
          };
          if (!best || candidate.similarity > best.similarity) {
            best = candidate;
            bestImage = exportedCanvas.toDataURL('image/png');
            bestPixels = new Uint8ClampedArray(exportedPixels);
          }
        }
        metrics.push(best);
        exportedImages.push(bestImage);
        exportedPixelSets.push(bestPixels);
      }

      const temporalDifferences = [];
      for (let frame = 1; frame < exportedPixelSets.length; frame += 1) {
        let difference = 0;
        const previous = exportedPixelSets[frame - 1];
        const current = exportedPixelSets[frame];
        for (let index = 0; index < current.length; index += 4) {
          difference += Math.abs(current[index] - previous[index]);
          difference += Math.abs(current[index + 1] - previous[index + 1]);
          difference += Math.abs(current[index + 2] - previous[index + 2]);
        }
        temporalDifferences.push(difference / (width * height * 3 * 255));
      }
      return {
        byteLength: blob.size,
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        metrics,
        temporalDifferences,
        exportedImages,
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  }, { frames: editorFrames.map((frame) => ({ timestamp: frame.timestamp, image: `data:image/png;base64,${frame.image.toString('base64')}` })) });
}

async function installMocks(page, hooks = {}) {
  await page.addInitScript(({ apiKey }) => {
    localStorage.setItem('mg_api_key', apiKey);
    localStorage.setItem('mg_user', JSON.stringify({ id: 'studio-user', email: 'studio@example.com', api_key: apiKey, credits: 10000, credits_usd: 100 }));
  }, { apiKey: API_KEY });
  await page.route('**/api/pricing', (route) => route.fulfill({ status: 200, json: {
    credit_price_usd: 0.01,
    video_estimate: { estimated_cost_usd: 1.01 },
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
  await page.route('**/api/video-jobs', (route) => route.fulfill({ status: 200, json: { jobs: [] } }));
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

test('homepage gallery art imports through the same-origin gallery endpoint', async ({ page }) => {
  await installMocks(page);
  const assetPath = 'originals/homepage-art.webp';
  const assetURL = `https://manifoldgenstatic.manifoldgen.com/gallery/${assetPath}`;
  let proxyRequest = false;
  await page.route(`**/api/gallery-assets/${assetPath}?v=1`, async (route) => {
    proxyRequest = true;
    await route.fulfill({ status: 200, contentType: 'image/png', body: PNG_FIXTURE });
  });
  await page.route(`https://manifoldgenstatic.manifoldgen.com/gallery/${assetPath}`, (route) => route.abort());

  await page.goto(`/studio?image_url=${encodeURIComponent(assetURL)}&name=Homepage%20art`);

  await expect(page.getByTestId('studio-panel').getByRole('button', { name: /Homepage art\.png/ })).toBeVisible();
  expect(proxyRequest).toBe(true);
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

test('a stale queued generation reconciles into a video tile and reuses its prompt', async ({ page }) => {
  const prompt = 'A silver fox running through luminous alpine grass at blue hour';
  let listChecks = 0;
  await installMocks(page);
  await page.route('**/api/video-jobs', (route) => {
    listChecks += 1;
    const completed = listChecks > 1;
    return route.fulfill({ status: 200, json: { jobs: [{
      job_id: 'generation-finished-1', status: completed ? 'completed' : 'processing', prompt,
      ...(completed ? { result: { video_url: 'https://studio-result.example/generation.webm' } } : {}),
      created_at: '2026-08-10T00:00:00Z', updated_at: completed ? '2026-08-10T00:00:02Z' : '2026-08-10T00:00:01Z',
    }] } });
  });
  await page.route('https://studio-result.example/generation.webm', (route) => route.fulfill({
    status: 200, contentType: 'video/webm', body: fs.readFileSync(VIDEO),
  }));

  await page.goto('/studio');
  const tile = page.getByTestId('studio-generation-generation-finished-1');
  await expect(tile.getByText('Ready', { exact: true })).toBeVisible();
  await expect(tile.locator('video')).toHaveAttribute('src', 'https://studio-result.example/generation.webm');
  expect(listChecks).toBeGreaterThan(1);

  await tile.click({ button: 'right' });
  await expect(page.getByTestId('studio-generation-copy-prompt')).toBeVisible();
  await page.getByTestId('studio-generation-copy-prompt').click();
  await expect(page.getByText('Generation prompt copied')).toBeVisible();
  await tile.click({ button: 'right' });
  await page.getByTestId('studio-generation-similar').click();
  await expect(page.getByRole('heading', { name: 'Generate videos' })).toBeVisible();
  await expect(page.getByTestId('studio-video-generate-prompt')).toHaveValue(prompt);
});

test('video generation exposes native and chained timings through one request', async ({ page }) => {
  const videoRequests = [];
  await installMocks(page);
  await page.route('**/api/images?**', (route) => route.fulfill({ status: 200, json: { images: [] } }));
  await page.route('**/api/videos/featured?**', (route) => route.fulfill({ status: 200, json: { results: [] } }));
  await page.route('**/api/search?**', (route) => route.fulfill({ status: 200, json: { results: [] } }));
  await page.route('**/api/service', async (route) => {
    videoRequests.push(route.request().postDataJSON());
    await route.fulfill({ status: 202, json: { result: { job_id: 'long-video-job', status: 'queued' } } });
  });

  await page.goto('/studio');
  await page.getByTestId('studio-generate-media').click();
  await page.getByTestId('studio-video-generate-prompt').fill('A continuous minute-long orbit around a lighthouse in a storm');
  await expect(page.getByTestId('studio-video-generate-duration').locator('option')).toHaveCount(6);
  await page.getByTestId('studio-video-generate-duration').selectOption('15');
  await page.getByTestId('studio-video-generate-loop').check();
  await page.getByTestId('studio-video-generate-duration').selectOption('60');
  await expect(page.getByTestId('studio-video-generate-loop')).toBeDisabled();
  await expect(page.getByTestId('studio-video-generate-audio')).toBeDisabled();
  await expect(page.getByText(/Long videos chain shots/)).toBeVisible();
  await page.getByTestId('studio-video-generate-submit').click();
  await expect.poll(() => videoRequests.length).toBe(1);
  expect(videoRequests[0]).toMatchObject({ service: 'h3_video', duration: 60, loop: false, include_audio: false });
});

test('video generation stays live for repeated background launches', async ({ page }) => {
  const videoRequests = [];
  let releaseRequests;
  const requestGate = new Promise((resolve) => { releaseRequests = resolve; });
  await installMocks(page);
  await page.route('**/api/search?**', (route) => route.fulfill({ status: 200, json: { results: [] } }));
  await page.route('**/api/service', async (route) => {
    videoRequests.push(route.request().postDataJSON());
    await requestGate;
    await route.fulfill({ status: 202, json: { result: { job_id: `repeat-job-${videoRequests.length}`, status: 'queued' } } });
  });

  await page.goto('/studio');
  await page.getByTestId('studio-generate-media').click();
  await page.getByTestId('studio-video-generate-prompt').fill('A monochrome manifold folding through soft studio light');
  const launch = page.getByTestId('studio-video-generate-submit');
  await launch.click();
  await expect(launch).toBeEnabled();
  await launch.click();
  await expect.poll(() => videoRequests.length).toBe(2);
  await expect(page.getByTestId('studio-background-activity')).toContainText('2 tasks running');
  releaseRequests();
  await expect(page.getByTestId('studio-video-generate-status')).toContainText('queued');
});

test('Studio searches community video and image libraries while generating with the selected image engine', async ({ page }) => {
  const imagePrompt = 'opal glass greenhouse in dawn fog';
  const imageRequests = [];
  await installMocks(page);
  await page.route('**/api/images?**', (route) => route.fulfill({ status: 200, json: { images: [] } }));
  await page.route('**/api/images/semantic?**', (route) => route.fulfill({ status: 200, json: { results: [{
    id: 'similar-image-1', prompt: 'Opal conservatory', image_url: '/images/similar.png', thumb_url: '/images/similar.png', model: 'zimage', similarity: 0.91,
  }] } }));
  await page.route('**/api/search?**', (route) => route.fulfill({ status: 200, json: { results: [{
    job_id: 'community-video-1', prompt: 'Fog moving through a glass greenhouse', video_url: 'https://studio-result.example/community.webm', service: 'h3_video', similarity: 0.88,
  }] } }));
  await page.route('**/api/videos/featured?**', (route) => route.fulfill({ status: 200, json: { results: [] } }));
  await page.route('**/api/service', async (route) => {
    imageRequests.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, json: { images: [{ image_url: 'https://studio-result.example/generated.png' }], engine: 'omniserve-native' } });
  });
  await page.route('https://studio-result.example/generated.png', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG_FIXTURE }));
  await page.route('**/gallery/similar.png', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG_FIXTURE }));
  await page.route('https://studio-result.example/community.webm', (route) => route.fulfill({ status: 200, contentType: 'video/webm', body: fs.readFileSync(VIDEO) }));

  await page.goto('/studio');
  await page.getByTestId('studio-media-images').click();
  await page.getByTestId('studio-image-prompt').fill(imagePrompt);
  await page.getByTestId('studio-image-engine-omniserve').click();
  await page.getByTestId('studio-image-count').selectOption('1');
  await page.getByTestId('studio-image-generate').click();
  await expect(page.getByText('1 image added')).toBeVisible();
  await expect(page.getByTestId('studio-image-hit-similar-image-1')).toBeVisible();
  expect(imageRequests[0]).toMatchObject({ service: 'zimage', prompt: imagePrompt, n: 1, num_images: 1, image_backend: 'omniserve' });
  await page.getByTestId('studio-image-engine-images3').click();
  await page.getByTestId('studio-image-generate').click();
  await expect.poll(() => imageRequests.length).toBe(2);
  expect(imageRequests[1]).toMatchObject({ service: 'zimage', image_backend: 'images3' });

  await page.getByTestId('studio-media-videos').click();
  await page.getByTestId('studio-media-search').fill('glass greenhouse fog');
  await page.getByTestId('studio-media-search').press('Enter');
  await expect(page.getByTestId('studio-video-hit-community-video-1')).toBeVisible();
  await page.getByTestId('studio-video-hit-community-video-1').click();
  await expect(page.getByText('Community video added to the timeline')).toBeVisible();
});

test('text layers stay editable and are persisted in the project document', async ({ page }) => {
  const saves = [];
  await installMocks(page, { onProjectSave: (project) => saves.push(project) });
  await page.goto('/studio');
  await page.getByTestId('studio-tool-text').click();
  await page.getByTestId('studio-add-title').click();
  await expect(page.getByTestId('studio-text-content')).toHaveValue('Add a title');
  await page.getByTestId('studio-text-content').fill('Launch night');
  await page.getByTestId('studio-text-apply').click();
  await expect(page.getByText('Text updated')).toBeVisible();
  await expect(page.getByTestId('studio-save-status')).toHaveText('Saved to cloud', { timeout: 20_000 });
  const latest = saves.at(-1);
  expect(latest.document.assets).toHaveLength(1);
  expect(latest.document.assets[0].text).toMatchObject({ content: 'Launch night', fontSize: 132, fontWeight: 800, align: 'center' });
  expect(latest.document.assets[0].contentType).toBe('image/png');
  await page.reload();
  await page.getByTestId('studio-tool-text').click();
  await expect(page.getByTestId('studio-text-content')).toHaveValue('Launch night');
});

test('persisted history keeps distinct media revisions and restores the old text render after reload', async ({ page }) => {
  const saves = [];
  await installMocks(page, { onProjectSave: (project) => saves.push(project) });
  await page.goto('/studio');
  await page.getByTestId('studio-tool-text').click();
  await page.getByTestId('studio-add-title').click();
  await page.getByTestId('studio-text-content').fill('A completely different historical title');
  await page.getByTestId('studio-text-apply').click();
  await expect.poll(() => {
    const saved = saves.at(-1)?.document;
    const prior = saved?.history?.undo?.at(-1)?.assets?.[0];
    return saved?.assets?.[0]?.text?.content === 'A completely different historical title' && saved.assets[0].cloudURL && prior?.cloudURL;
  }, { timeout: 20_000 }).toBeTruthy();

  const document = saves.at(-1).document;
  const previous = document.history.undo.at(-1).assets[0];
  const current = document.assets[0];
  expect(document.version).toBe(4);
  expect(previous.mediaID).toBeTruthy();
  expect(current.mediaID).toBeTruthy();
  expect(previous.mediaID).not.toBe(current.mediaID);
  expect(previous.cloudURL).not.toBe(current.cloudURL);

  const storedRevisions = await page.evaluate(async () => {
    const projectID = localStorage.getItem('mg_studio_project_id');
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('manifold-studio');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction('assets', 'readonly');
    const rows = await new Promise((resolve, reject) => {
      const request = transaction.objectStore('assets').index('projectID').getAll(IDBKeyRange.only(projectID));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return rows.map((row) => ({ mediaID: row.assetID, name: row.file.name, size: row.file.size }));
  });
  expect(storedRevisions).toEqual(expect.arrayContaining([
    expect.objectContaining({ mediaID: previous.mediaID, name: previous.name }),
    expect.objectContaining({ mediaID: current.mediaID, name: current.name }),
  ]));

  await page.reload();
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.getByTestId('studio-tool-text').click();
  await expect(page.getByTestId('studio-text-content')).toHaveValue('Add a title');
});

test('right click keeps browser actions and opens contextual image and audio prompt windows', async ({ page }) => {
  await installMocks(page);
  await page.goto('/studio');

  await page.locator('main').click({ button: 'right', position: { x: 700, y: 300 } });
  const menu = page.getByTestId('studio-context-menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByText('Back', { exact: true })).toBeVisible();
  await expect(menu.getByText('Forward', { exact: true })).toBeVisible();
  await expect(menu.getByText('Reload', { exact: true })).toBeVisible();
  await page.getByTestId('studio-context-generate-sfx').click();
  await expect(page.getByRole('heading', { name: 'Generate sound' })).toBeVisible();
  await page.getByRole('button', { name: 'Close Generate sound' }).click();

  await page.locator('main').click({ button: 'right', position: { x: 700, y: 300 } });
  await page.getByTestId('studio-context-generate-music').click();
  await expect(page.getByRole('heading', { name: 'Generate music' })).toBeVisible();
  await page.getByRole('button', { name: 'Close Generate music' }).click();

  await page.locator('main').click({ button: 'right', position: { x: 700, y: 300 } });
  await page.getByTestId('studio-context-generate-voice').click();
  await expect(page.getByRole('heading', { name: 'Text to speech' })).toBeVisible();
  await page.getByRole('button', { name: 'Close Text to speech' }).click();

  await page.locator('input[type=file]').setInputFiles({ name: 'opal-conservatory.png', mimeType: 'image/png', buffer: PNG_FIXTURE });
  const imageCard = page.getByTestId('studio-panel').getByRole('button', { name: /opal-conservatory\.png/ });
  await imageCard.click({ button: 'right' });
  await page.getByTestId('studio-context-similar').click();
  await expect(page.getByRole('heading', { name: 'Generate images' })).toBeVisible();
  await expect(page.getByTestId('studio-image-modal-prompt')).toHaveValue('opal conservatory');
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
  const card = page.getByTestId('studio-panel').getByRole('button', { name: /h3-loop-glass-torus\.webm/ });
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
  // The isolated browser test runner is intentionally headless. It is not a
  // useful environment for either 2K playback or hardware encoding, and can
  // wedge on a video `play()` call before the hardware assertions run.
  test.skip(process.env.PLAYWRIGHT_GPU !== '1', 'Run 2K preview and hardware export with PLAYWRIGHT_GPU=1');
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
  await page.getByRole('dialog', { name: 'Export' }).getByRole('button', { name: 'Export', exact: true }).click();
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

test('Help opens the Studio shortcut reference', async ({ page }) => {
  await installMocks(page);
  await page.goto('/studio');

  await page.getByTestId('studio-help').click();
  await expect(page.getByRole('heading', { name: 'Keyboard shortcuts' })).toBeVisible();
  await expect(page.getByText('Move selected visual clips between layers')).toBeVisible();
  await expect(page.getByText('Drag clips left or right to retime them')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Keyboard shortcuts' })).toBeHidden();
  await page.keyboard.press('Shift+Slash');
  await expect(page.getByRole('heading', { name: 'Keyboard shortcuts' })).toBeVisible();
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

test('common timeline edits participate in undo and redo history', async ({ page }) => {
  await installMocks(page);
  await page.goto('/studio');
  await page.locator('input[type=file]').setInputFiles([
    { name: 'history-one.png', mimeType: 'image/png', buffer: PNG_FIXTURE },
    { name: 'history-two.png', mimeType: 'image/png', buffer: PNG_FIXTURE },
  ]);
  const clips = page.locator('[data-testid^="timeline-clip-"]');
  await expect(clips).toHaveCount(2);

  await page.getByTitle('Duplicate selected clips').click();
  await expect(clips).toHaveCount(3);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(clips).toHaveCount(2);
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(clips).toHaveCount(3);

  await page.getByTitle('Delete selected clips').click();
  await expect(clips).toHaveCount(2);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(clips).toHaveCount(3);

  await clips.nth(0).click({ position: { x: 100, y: 30 } });
  await page.keyboard.press('s');
  await expect(clips).toHaveCount(4);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(clips).toHaveCount(3);
});

test('Shift-drag draws a timeline marquee and selects every intersecting clip', async ({ page }) => {
  await installMocks(page);
  await page.goto('/studio');
  await page.locator('input[type=file]').setInputFiles([
    { name: 'marquee-one.png', mimeType: 'image/png', buffer: PNG_FIXTURE },
    { name: 'marquee-two.png', mimeType: 'image/png', buffer: PNG_FIXTURE },
    { name: 'marquee-three.png', mimeType: 'image/png', buffer: PNG_FIXTURE },
  ]);

  const clips = page.locator('[data-testid^="timeline-clip-"]');
  await expect(clips).toHaveCount(3);
  await clips.nth(0).click();
  const canvas = await page.getByTestId('studio-timeline-canvas').boundingBox();
  await page.keyboard.down('Shift');
  await page.mouse.move(canvas.x + 5, canvas.y + 32);
  await page.mouse.down();
  await page.mouse.move(canvas.x + 630, canvas.y + 158, { steps: 6 });
  const marquee = page.getByTestId('studio-timeline-marquee');
  await expect(marquee).toBeVisible();
  const marqueeBox = await marquee.boundingBox();
  expect(marqueeBox.width).toBeGreaterThan(600);
  expect(marqueeBox.height).toBeGreaterThan(100);
  await page.mouse.up();
  await page.keyboard.up('Shift');

  await expect(marquee).toBeHidden();
  await expect(clips.nth(0)).toHaveAttribute('aria-selected', 'true');
  await expect(clips.nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(clips.nth(2)).toHaveAttribute('aria-selected', 'false');
  await expect(page.getByText('2 selected')).toBeVisible();
});

test('overlapping visual clips stack into ordered lanes and bracket shortcuts swap their layer order', async ({ page }) => {
  await installMocks(page);
  await page.goto('/studio');
  await page.locator('input[type=file]').setInputFiles([
    { name: 'base-layer.png', mimeType: 'image/png', buffer: PNG_FIXTURE },
    { name: 'overlay-layer.png', mimeType: 'image/png', buffer: PNG_FIXTURE },
  ]);

  const clips = page.locator('[data-testid^="timeline-clip-"]');
  const overlay = clips.nth(1);
  const overlayBox = await overlay.boundingBox();
  await page.mouse.move(overlayBox.x + overlayBox.width / 2, overlayBox.y + overlayBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(overlayBox.x + overlayBox.width / 2 - 280, overlayBox.y + overlayBox.height / 2, { steps: 6 });
  await page.mouse.up();

  await expect(clips.nth(0)).toHaveAttribute('data-visual-track', '0');
  await expect(overlay).toHaveAttribute('data-visual-track', '1');
  await expect(page.getByTestId('timeline-track-label-v2')).toBeVisible();

  await page.keyboard.press('Control+BracketLeft');
  await expect(overlay).toHaveAttribute('data-visual-track', '0');
  await expect(clips.nth(0)).toHaveAttribute('data-visual-track', '1');
  await page.keyboard.press('Control+BracketRight');
  await expect(overlay).toHaveAttribute('data-visual-track', '1');
  await expect(clips.nth(0)).toHaveAttribute('data-visual-track', '0');

  await page.getByTestId('studio-timeline-ruler').click({ position: { x: 64, y: 10 } });
  const baseStage = page.getByRole('button', { name: 'Move base-layer.png' });
  const overlayStage = page.getByRole('button', { name: 'Move overlay-layer.png' });
  expect(Number(await overlayStage.evaluate((item) => item.style.zIndex))).toBeGreaterThan(Number(await baseStage.evaluate((item) => item.style.zIndex)));
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
  expect(saves.at(-1).document.version).toBe(4);
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

test('drop import indicators clear when a drag exits or is canceled', async ({ page }) => {
  await installMocks(page);
  await page.goto('/studio');

  await page.evaluate(() => {
    const target = document.querySelector('[data-testid="studio-empty"]');
    target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() }));
  });
  await expect(page.getByTestId('studio-drop-overlay')).toBeVisible();

  await page.evaluate(() => {
    const target = document.querySelector('[data-testid="studio-empty"]');
    target.dispatchEvent(new DragEvent('dragleave', { bubbles: true, cancelable: true, relatedTarget: null, dataTransfer: new DataTransfer() }));
  });
  await expect(page.getByTestId('studio-drop-overlay')).toBeHidden();

  await page.evaluate(() => {
    const dropzone = document.querySelector('[data-testid="studio-timeline-dropzone"]');
    const rect = dropzone.getBoundingClientRect();
    dropzone.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientX: rect.left + 96, clientY: rect.top + 40, dataTransfer: new DataTransfer() }));
  });
  await expect(page.getByTestId('studio-timeline-drop-marker')).toBeVisible();
  await expect(page.getByTestId('studio-drop-overlay')).toBeHidden();

  await page.evaluate(() => window.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true })));
  await expect(page.getByTestId('studio-timeline-drop-marker')).toBeHidden();
  await expect(page.getByTestId('studio-drop-overlay')).toBeHidden();
});

test('rejected URL drops show a useful error and clear every drag indicator', async ({ page }) => {
  await installMocks(page);
  await page.goto('/studio');

  await page.getByTestId('studio-timeline-dropzone').evaluate((dropzone) => {
    const transfer = new DataTransfer();
    transfer.setData('text/uri-list', 'ftp://media.example/unsafe-video.mp4');
    const rect = dropzone.getBoundingClientRect();
    const init = { bubbles: true, cancelable: true, clientX: rect.left + 96, clientY: rect.top + 40, dataTransfer: transfer };
    dropzone.dispatchEvent(new DragEvent('dragover', init));
    dropzone.dispatchEvent(new DragEvent('drop', init));
  });

  await expect(page.getByTestId('studio-notice')).toContainText('Unsupported media URL. Try downloading the media and dropping the file.');
  await expect(page.getByTestId('studio-timeline-drop-marker')).toBeHidden();
  await expect(page.getByTestId('studio-drop-overlay')).toBeHidden();
});

test('editor shortcuts stay inactive while typing in search fields', async ({ page }) => {
  await installMocks(page);
  await page.goto('/studio');
  await page.locator('input[type=file]').setInputFiles([
    { name: 'shortcut-video.webm', mimeType: 'video/webm', buffer: fs.readFileSync(VIDEO) },
    { name: 'shortcut-guard.png', mimeType: 'image/png', buffer: PNG_FIXTURE },
  ]);
  await expect(page.locator('[data-testid^="timeline-clip-"]')).toHaveCount(2);
  await page.getByTestId('studio-tool-media').click();
  await page.getByTestId('studio-panel').getByRole('button', { name: /shortcut-video\.webm/ }).click();
  await expect(page.getByRole('button', { name: 'Play' })).toBeEnabled();

  await page.getByTestId('studio-tool-audio').click();
  const search = page.getByTestId('studio-audio-search');
  await search.fill('ambient');
  await search.press('Space');
  await search.press('s');
  await search.press('Delete');
  await search.press('Control+a');

  await expect(page.locator('[data-testid^="timeline-clip-"]')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  await expect(page.getByText('2 selected')).toBeHidden();
});

test('dialogs trap focus, close with Escape, and restore focus to their trigger', async ({ page }) => {
  await installMocks(page);
  await page.goto('/studio');
  await page.locator('input[type=file]').setInputFiles({ name: 'dialog-frame.png', mimeType: 'image/png', buffer: PNG_FIXTURE });
  const trigger = page.getByTestId('studio-export');
  await trigger.click();

  const dialog = page.getByRole('dialog', { name: 'Export' });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close Export' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Export', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close Export' })).toBeFocused();
  await page.keyboard.press('Escape');

  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('audio volume and fades are persisted in the cloud project document', async ({ page }) => {
  const saves = [];
  await installMocks(page, { onProjectSave: (project) => saves.push(project) });
  await page.goto('/studio');
  await page.locator('input[type=file]').setInputFiles({ name: 'editable-audio.wav', mimeType: 'audio/wav', buffer: wavFixture(2) });
  await page.getByTestId('studio-tool-audio').click();

  await page.getByTestId('studio-audio-volume').fill('0.65');
  await page.getByTestId('studio-audio-fade-in').fill('0.4');
  await page.getByTestId('studio-audio-fade-out').fill('0.6');
  await expect(page.getByTestId('studio-audio-volume').locator('xpath=..')).toContainText('65%');
  await expect(page.getByTestId('studio-audio-fade-in').locator('xpath=..')).toContainText('0.4s');
  await expect(page.getByTestId('studio-audio-fade-out').locator('xpath=..')).toContainText('0.6s');
  await expect.poll(() => saves.at(-1)?.document?.assets?.[0]).toMatchObject({ volume: 0.65, fadeIn: 0.4, fadeOut: 0.6 });
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
  const stageBox = await page.getByTestId('studio-stage').boundingBox();
  const box = await element.boundingBox();
  // The preview should fill the stage as far as its aspect ratio permits. This
  // catches a regression where the canvas used its 300px default size instead.
  const expectedHeight = Math.min(stageBox.height - 24, (stageBox.width - 24) / (1024 / 690));
  expect(box.height).toBeGreaterThan(expectedHeight - 3);
  expect(Math.abs((box.x + box.width / 2) - (stageBox.x + stageBox.width / 2))).toBeLessThan(2);
  expect(Math.abs((box.y + box.height / 2) - (stageBox.y + stageBox.height / 2))).toBeLessThan(2);
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

  await page.getByTestId('studio-tool-crop').click();
  await page.getByTestId('studio-transform-scale').fill('1.5');
  await page.getByTestId('studio-transform-rotation').fill('30');
  await expect(element).toHaveAttribute('data-scale', '1.5000');
  await expect(element).toHaveAttribute('data-rotation', '30.00');
  await page.getByTestId('studio-transform-reset').click();
  await expect(element).toHaveAttribute('data-scale', '1.0000');
  await expect(element).toHaveAttribute('data-rotation', '0.00');
});

test('a gallery image handoff loads through the same-origin proxy and fills the Studio stage', async ({ page }) => {
  await installMocks(page);
  let proxyRequest = '';
  await page.route('**/api/gallery-assets/originals/gallery-fixture.webp?**', (route) => {
    proxyRequest = route.request().url();
    return route.fulfill({ status: 200, contentType: 'image/png', body: PNG_FIXTURE });
  });
  const sourceURL = 'https://manifoldgenstatic.manifoldgen.com/gallery/originals/gallery-fixture.webp';
  await page.goto(`/studio?image_url=${encodeURIComponent(sourceURL)}&name=${encodeURIComponent('Gallery fixture')}`);
  const element = page.getByTestId('studio-stage-element');
  await expect(element).toBeVisible();
  await expect(page.getByText('Gallery image added to the studio')).toBeVisible();
  expect(proxyRequest).toContain('/api/gallery-assets/originals/gallery-fixture.webp?v=1');

  const stageBox = await page.getByTestId('studio-stage').boundingBox();
  const box = await element.boundingBox();
  const expectedSize = Math.min(stageBox.width - 24, stageBox.height - 24);
  expect(box.width).toBeGreaterThan(expectedSize - 3);
  expect(box.height).toBeGreaterThan(expectedSize - 3);
});

test('multiple PNGs export the complete slideshow as a local WebM video', async ({ page }) => {
  test.setTimeout(120_000);
  await installMocks(page);
  await page.goto('/studio');
  await page.locator('input[type=file]').setInputFiles([
    { name: 'slide-one.png', mimeType: 'image/png', buffer: PNG_FIXTURE },
    { name: 'slide-two.png', mimeType: 'image/png', buffer: PNG_FIXTURE },
  ]);
  await expect(page.locator('[data-testid^="timeline-clip-"]')).toHaveCount(2);
  await page.getByTestId('studio-export').click();
  await expect(page.getByRole('heading', { name: 'Export' })).toBeVisible();
  await expect(page.getByText(/Complete .* timeline/)).toBeVisible();
  await page.getByTestId('export-format-webm-vp9').click();
  await page.getByTestId('export-frame-rate').selectOption('24');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('dialog', { name: 'Export' }).getByRole('button', { name: 'Export', exact: true }).click();
  const download = await Promise.race([
    downloadPromise,
    page.getByTestId('studio-notice').waitFor({ state: 'visible' }).then(async () => { throw new Error(await page.getByTestId('studio-notice').innerText()); }),
  ]);
  expect(download.suggestedFilename()).toMatch(/-studio\.webm$/);
  const outputPath = await download.path();
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-show_entries', 'stream=codec_name,codec_type', '-of', 'json', outputPath], { encoding: 'utf8' }));
  expect(probe.streams).toContainEqual(expect.objectContaining({ codec_type: 'video', codec_name: 'vp9' }));
  expect(Number(probe.format.duration)).toBeGreaterThan(9.8);
});

for (const { format, codec, extension } of [
  { format: 'mp4-h264', codec: 'h264', extension: 'mp4' },
  { format: 'webm-vp9', codec: 'vp9', extension: 'webm' },
  { format: 'webm-av1', codec: 'av1', extension: 'webm' },
]) {
  test(`${format} visual fidelity benchmark matches the real editor video`, async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    // AV1 WebCodecs support is not consistently available in headless Chromium
    // and can hang while seeking an exported file. Keep it as an explicit
    // opt-in benchmark instead of turning the normal suite into a 3-minute
    // timeout on otherwise healthy runners.
    test.skip(format === 'webm-av1' && process.env.PLAYWRIGHT_AV1 !== '1', 'Run AV1 export fidelity only on an AV1-capable runner (PLAYWRIGHT_AV1=1)');
    await installExportBlobCapture(page);
    await installMocks(page);
    await page.goto('/studio');
    await page.locator('input[type=file]').setInputFiles(VIDEO);
    await expect(page.getByTestId('studio-render-status')).toContainText('1184 × 672 · GPU preview');
    const timestamps = [0.5, 1.8, 3.6];
    const editorFrames = [];
    for (const timestamp of timestamps) {
      const image = await captureEditorFrame(page, timestamp);
      editorFrames.push({ timestamp, image });
      await testInfo.attach(`editor-${timestamp.toFixed(1)}s.png`, { body: image, contentType: 'image/png' });
    }
    await page.getByTestId('studio-export').click();
    await page.getByTestId(`export-format-${format}`).click();
    await page.getByTestId('export-resolution').selectOption('720p');
    await page.getByTestId('export-frame-rate').selectOption('24');
    await page.getByTestId('export-quality').selectOption('draft');
    const startedAt = Date.now();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('dialog', { name: 'Export' }).getByRole('button', { name: 'Export', exact: true }).click();
    const download = await downloadPromise;
    const elapsedSeconds = (Date.now() - startedAt) / 1000;
    expect(download.suggestedFilename()).toMatch(new RegExp(`-studio\\.${extension}$`));
    const outputPath = await download.path();
    await testInfo.attach(download.suggestedFilename(), {
      path: outputPath,
      contentType: extension === 'mp4' ? 'video/mp4' : 'video/webm',
    });
    const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size', '-show_entries', 'stream=codec_name,codec_type,width,height', '-of', 'json', outputPath], { encoding: 'utf8' }));
    expect(probe.streams).toContainEqual(expect.objectContaining({ codec_type: 'video', codec_name: codec }));
    expect(Number(probe.format.duration)).toBeGreaterThan(4.3);
    expect(Number(probe.format.size)).toBeGreaterThan(10_000);

    const visual = await compareLatestExportWithEditorFrames(page, editorFrames);
    for (let index = 0; index < visual.exportedImages.length; index += 1) {
      await testInfo.attach(`export-${timestamps[index].toFixed(1)}s.png`, {
        body: Buffer.from(visual.exportedImages[index].split(',')[1], 'base64'),
        contentType: 'image/png',
      });
    }
    const benchmark = {
      format, codec, elapsedSeconds,
      realtimeFactor: elapsedSeconds / visual.duration,
      byteLength: visual.byteLength,
      width: visual.width,
      height: visual.height,
      duration: visual.duration,
      frames: visual.metrics,
      temporalDifferences: visual.temporalDifferences,
    };
    await testInfo.attach('visual-benchmark.json', { body: Buffer.from(JSON.stringify(benchmark, null, 2)), contentType: 'application/json' });
    console.log(`[visualbench] ${format}: ${elapsedSeconds.toFixed(2)}s, ${(elapsedSeconds / visual.duration).toFixed(2)}x realtime, min similarity ${Math.min(...visual.metrics.map((metric) => metric.similarity)).toFixed(4)}`);

    expect(visual.width).toBe(1184);
    expect(visual.height).toBe(672);
    expect(visual.duration).toBeGreaterThan(4.3);
    expect(visual.byteLength).toBeGreaterThan(10_000);
    for (const metric of visual.metrics) {
      expect(metric.maximumLuma, `exported frame at ${metric.timestamp}s must be visible`).toBeGreaterThan(24);
      expect(metric.similarity, `exported frame at ${metric.timestamp}s must resemble the editor`).toBeGreaterThan(0.88);
      expect(metric.lumaCorrelation, `exported structure at ${metric.timestamp}s must resemble the editor`).toBeGreaterThan(0.75);
      expect(metric.psnr, `exported frame at ${metric.timestamp}s must retain visual fidelity`).toBeGreaterThan(18);
    }
    for (const difference of visual.temporalDifferences) {
      expect(difference, 'exported samples must contain changing motion frames').toBeGreaterThan(0.001);
    }
    expect(elapsedSeconds).toBeLessThan(45);
  });
}

test('Media Music searches real catalog-shaped results, imports a track, and generates music', async ({ page }) => {
  await installMocks(page);
  const wav = wavFixture();
  let searchRequest;
  let generationRequest;
  await page.route('**/api/studio/audio-search**', async (route) => {
    searchRequest = new URL(route.request().url());
    await route.fulfill({ status: 200, json: { results: [{
      id: 4283, title: 'Midnight Moon', url: 'https://audio.example/midnight-moon.wav', duration: 207.279,
      provider: 'opengameart', kind: 'music', description: 'Cinematic ambient C minor',
      license: 'cc0', attribution: 'iamoneabe', source_url: 'https://opengameart.org/content/midnight-moon',
    }] } });
  });
  await page.route('**/api/studio/generate-music', async (route) => {
    generationRequest = route.request().postDataJSON();
    await route.fulfill({ status: 200, json: {
      audio_url: 'https://audio.example/generated-score.wav', credits_used: 80, credits_remain: 9920,
    } });
  });
  await page.route('https://audio.example/**', (route) => route.fulfill({ status: 200, contentType: 'audio/wav', body: wav }));

  await page.goto('/studio');
  await page.getByTestId('studio-media-music').click();
  const result = page.getByTestId('studio-music-hit-4283');
  await expect(result).toContainText('Midnight Moon');
  await expect(result).toContainText('CC0');
  expect(searchRequest.searchParams.get('kind')).toBe('music');
  expect(searchRequest.searchParams.get('limit')).toBe('24');
  await result.getByRole('button', { name: 'Add Midnight Moon to timeline' }).click();
  await expect(page.locator('[data-timeline-asset]')).toHaveCount(1);
  await expect(page.getByText('Midnight Moon added · CC0')).toBeVisible();

  await page.getByTestId('studio-music-create').click();
  await expect(page.getByRole('heading', { name: 'Generate music' })).toBeVisible();
  await page.getByTestId('studio-audio-prompt').fill('Warm analog synth pulse with glass harmonics');
  await page.getByTestId('studio-audio-generate').click();
  await expect(page.locator('[data-timeline-asset]')).toHaveCount(2);
  expect(generationRequest).toEqual({ prompt: 'Warm analog synth pulse with glass harmonics', duration: 30 });
  await expect(page.getByText('Music added · 80 credits')).toBeVisible();
});

test('licensed Netwrck catalog result imports as an editable audio clip for free', async ({ page }) => {
  await installMocks(page);
  const wav = wavFixture(2);
  await page.route('**/api/studio/audio-search**', (route) => route.fulfill({ status: 200, json: { results: [{
    id: 44, title: 'Night Pulse', url: 'https://audio.example/night-pulse.wav', duration: 2,
    provider: 'opengameart', kind: 'music', license: 'cc0', attribution: 'Example Artist',
  }] } }));
  await page.route('https://audio.example/night-pulse.wav', (route) => route.fulfill({ status: 200, contentType: 'audio/wav', body: wav }));
  await page.goto('/studio');
  await page.getByTestId('studio-tool-audio').click();
  await page.getByTestId('studio-audio-search').fill('night pulse');
  await page.getByRole('button', { name: 'Find' }).click();
  const card = page.getByTestId('studio-audio-hit-44');
  await expect(card).toContainText('CC0');
  await expect(card).toHaveAttribute('draggable', 'true');
  await expect(page.getByTestId('studio-audio-waveform-44')).toBeVisible();
  await card.getByRole('button', { name: 'Preview Night Pulse' }).click();
  await expect(card.getByRole('button', { name: 'Pause Night Pulse' })).toBeVisible();
  await card.getByRole('button', { name: 'Pause Night Pulse' }).click();
  const scrubber = page.getByTestId('studio-audio-scrubber-44');
  await scrubber.evaluate((input) => {
    input.value = '1.2';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(scrubber).toHaveValue('1.2');
  await scrubber.dispatchEvent('pointerup');
  await expect(card.getByRole('button', { name: 'Pause Night Pulse' })).toBeVisible();

  await page.evaluate(() => {
    const cardElement = document.querySelector('[data-testid="studio-audio-hit-44"]');
    const dropzone = document.querySelector('[data-testid="studio-timeline-dropzone"]');
    const transfer = new DataTransfer();
    const rect = dropzone.getBoundingClientRect();
    cardElement.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    const init = { bubbles: true, cancelable: true, clientX: rect.left + 192, clientY: rect.top + 50, dataTransfer: transfer };
    dropzone.dispatchEvent(new DragEvent('dragover', init));
    dropzone.dispatchEvent(new DragEvent('drop', init));
    cardElement.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  });
  const clip = page.locator('[data-timeline-asset][title^="Night Pulse.wav"]');
  await expect(clip).toBeVisible();
  const droppedLeft = await clip.evaluate((item) => Number.parseFloat(item.style.left));
  expect(droppedLeft).toBeGreaterThan(182);
  expect(droppedLeft).toBeLessThan(202);
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
  await expect(page.getByRole('heading', { name: /voice-f1-\d+\.wav/ })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Export' })).toBeVisible();
  await expect(page.getByText('MP4 · H.264')).toBeVisible();
  await page.getByRole('button', { name: 'Close Export' }).click();
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
  await page.getByRole('dialog', { name: 'Export' }).getByRole('button', { name: 'Export', exact: true }).click();
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
  await expect(page.getByRole('heading', { name: 'Export' })).toBeVisible();
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
  await page.getByTestId('studio-panel').getByRole('button', { name: /h3-loop-glass-torus\.webm/ }).click();
  await page.getByTestId('studio-export').click();
  await page.getByRole('button', { name: /MP4 · H\.264/ }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('dialog', { name: 'Export' }).getByRole('button', { name: 'Export', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/-studio\.mp4$/);
  const outputPath = await download.path();
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'json', outputPath], { encoding: 'utf8' }));
  expect(probe.streams.map((stream) => stream.codec_type).sort()).toEqual(['audio', 'video']);
});
