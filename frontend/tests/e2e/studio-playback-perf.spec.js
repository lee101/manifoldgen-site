const path = require('path');
const { test, expect } = require('@playwright/test');

const VIDEO = path.resolve(__dirname, '../../public/showcase/h3-loop-glass-torus.webm');

// Guards against the whole Studio tree re-rendering heavily while the playhead
// ticks. Budgets are loose enough for software rendering in CI.
test('playback keeps main-thread work per second low on a busy timeline', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('mg_user', JSON.stringify({ id: 'u', email: 'u@example.com', api_key: 'k', credits: 1, credits_usd: 1 }));
  });
  await page.route('**/api/**', (route) => route.fulfill({ status: 200, json: { jobs: [], projects: [], results: [] } }));
  await page.goto('/studio');
  await page.locator('input[type=file]').setInputFiles(Array.from({ length: 12 }, () => VIDEO));
  await expect(page.locator('[data-testid^="timeline-clip-"]')).toHaveCount(12);
  await page.keyboard.press('Home');
  await page.evaluate(() => {
    window.__longTaskMs = 0;
    window.__frames = [];
    new PerformanceObserver((list) => { for (const entry of list.getEntries()) window.__longTaskMs += entry.duration; }).observe({ entryTypes: ['longtask'] });
    let last = performance.now();
    const loop = (now) => { window.__frames.push(now - last); last = now; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  });
  const rendersBefore = await page.evaluate(() => window.__MANIFOLD_STUDIO_PERF__.renders);
  await page.keyboard.press('Space');
  await page.waitForTimeout(4000);
  const rendersDuring = (await page.evaluate(() => window.__MANIFOLD_STUDIO_PERF__.renders)) - rendersBefore;
  await page.keyboard.press('Space');
  const stats = await page.evaluate(() => {
    const frames = window.__frames.slice(5).sort((a, b) => a - b);
    return { longTaskMsPerSecond: window.__longTaskMs / 4, p50: frames[Math.floor(frames.length * 0.5)], p95: frames[Math.floor(frames.length * 0.95)], count: frames.length };
  });
  stats.rendersPerSecond = rendersDuring / 4;
  stats.playheadCommits = await page.evaluate(() => window.__MANIFOLD_STUDIO_PERF__.playheadCommits);
  console.log('PLAYBACK_PERF', JSON.stringify(stats));
  // The clock commits to React ~10 Hz. Dev StrictMode renders twice, so the
  // ceiling is 2x that plus boundary commits; per-frame state (60/s) must fail.
  expect(stats.rendersPerSecond).toBeLessThanOrEqual(30);
  expect(stats.count).toBeGreaterThan(20);
});
