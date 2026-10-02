const { test, expect } = require('@playwright/test');
const fs = require('fs');

const SAMPLE_OUTPUT = 'https://manifoldgenstatic.manifoldgen.com/static/tools/character-recast/cat-recast.webm';

test('recast result offers WebM and converts MP4 locally', async ({ page, request }) => {
  const webm = await (await request.get(SAMPLE_OUTPUT)).body();
  await page.addInitScript(() => {
    localStorage.setItem('mg_api_key', 'mg_test_key');
    localStorage.setItem('mg_user', JSON.stringify({ api_key: 'mg_test_key', credits: 1000, credit_price_usd: 0.01 }));
  });
  await page.route('**/api/character-swap/estimate', (route) => route.fulfill({ json: { estimated_credits: 10, estimated_cost_usd: 1, source_seconds: 10, people: 1, estimated_generation_seconds: 120 } }));
  await page.route('**/api/service', (route) => route.fulfill({ json: { result: { job_id: 'job1', status_url: '/api/video-jobs/job1' } } }));
  await page.route('**/api/video-jobs/job1', (route) => route.fulfill({ json: { job: { status: 'completed', result: { video_url: 'https://cdn.test/out/recast.webm', charged_usd: 1, credits_used: 10 } } } }));
  await page.route('https://cdn.test/out/recast.webm', (route) => route.fulfill({ body: webm, contentType: 'video/webm', headers: { 'access-control-allow-origin': '*' } }));
  await page.goto('/tools/character-recast');
  await page.getByTestId('recast-run').click();
  await expect(page.getByTestId('recast-download-original')).toBeVisible();

  const [webmDownload] = await Promise.all([page.waitForEvent('download'), page.getByTestId('recast-download-original').click()]);
  expect(webmDownload.suggestedFilename()).toBe('manifoldgen-recast.webm');

  const [mp4Download] = await Promise.all([page.waitForEvent('download', { timeout: 45_000 }), page.getByTestId('recast-download-mp4').click()]);
  expect(mp4Download.suggestedFilename()).toBe('manifoldgen-recast.mp4');
  const bytes = fs.readFileSync(await mp4Download.path());
  expect(bytes.subarray(4, 8).toString()).toBe('ftyp');
  expect(bytes.length).toBeGreaterThan(10_000);
});
