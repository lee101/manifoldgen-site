const path = require('path');
const { chromium } = require('../frontend/node_modules/playwright');

const baseURL = process.env.VISUALBENCH_BASE_URL || 'http://127.0.0.1:3218';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/google-chrome';
const videoPath = path.resolve(__dirname, '../frontend/public/showcase/h3-loop-glass-torus.mp4');

const catalog = {
  kind: 'audio', count: 3, source: 'netwrck', results: [
    { id: 1353, title: 'Judge Jury', duration: 144.006, provider: 'opengameart', kind: 'music', license: 'cc0', attribution: 'iamoneabe', url: 'https://netwrckstatic.netwrck.com/static/audio/library/judge-jury.opus' },
    { id: 1877, title: 'Project Masscinematic', duration: 168.685, provider: 'opengameart', kind: 'music', license: 'cc0', attribution: 'Umplix', url: 'https://netwrckstatic.netwrck.com/static/audio/library/project-masscinematic.opus' },
    { id: 2011, title: 'Neon After Rain', duration: 92.4, provider: 'mixkit', kind: 'music', license: 'mixkit', attribution: 'Mixkit', url: 'https://netwrckstatic.netwrck.com/static/audio/library/neon-after-rain.opus' },
  ],
};

async function prepare(page) {
  await page.addInitScript(() => {
    localStorage.setItem('mg_api_key', 'visualbench-key');
    localStorage.setItem('mg_user', JSON.stringify({ id: 'visualbench', email: 'creator@manifold.studio', api_key: 'visualbench-key', credits: 12480, credits_usd: 124.8 }));
  });
  await page.route('**/api/pricing', (route) => route.fulfill({ status: 200, json: { credit_price_usd: 0.01, h3_video_estimate: { estimated_cost_usd: 1.01 }, studio: { extend_input_second_usd: 0.012, extend_output_second_usd: 0.084, upscale_base_usd: 0.10, upscale_output_mp_second_usd: 0.012 } } }));
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, json: { user: { id: 'visualbench', email: 'creator@manifold.studio', api_key: 'visualbench-key', credits: 12480, credits_usd: 124.8 } } }));
  await page.route('**/api/studio/audio-search**', (route) => route.fulfill({ status: 200, json: catalog }));
  await page.goto(`${baseURL}/studio`, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
  await page.locator('input[type=file]').setInputFiles(videoPath);
  await page.getByTestId('studio-tool-audio').click();
  await page.getByTestId('studio-audio-search').fill('cinematic neon');
  await page.getByRole('button', { name: 'Find' }).click();
  await page.getByText('Judge Jury').waitFor();
  await page.waitForTimeout(800);
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath });
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
  await prepare(desktop);
  await desktop.screenshot({ path: path.join(__dirname, 'studio-desktop.png'), fullPage: true });
  await desktop.getByTestId('studio-tool-ai').click();
  await desktop.getByTestId('studio-upscale-open').click();
  await desktop.getByTestId('studio-upscale-scales').getByRole('button', { name: '4×' }).click();
  await desktop.screenshot({ path: path.join(__dirname, 'studio-desktop-upscale.png'), fullPage: true });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await prepare(mobile);
  await mobile.screenshot({ path: path.join(__dirname, 'studio-mobile-audio.png'), fullPage: true });
  await mobile.getByRole('button', { name: 'Close tools' }).click();
  await mobile.waitForTimeout(250);
  await mobile.screenshot({ path: path.join(__dirname, 'studio-mobile-workspace.png'), fullPage: true });
  await mobile.getByTestId('studio-tool-ai').click();
  await mobile.getByTestId('studio-upscale-open').click();
  await mobile.getByTestId('studio-upscale-scales').getByRole('button', { name: '4×' }).click();
  await mobile.screenshot({ path: path.join(__dirname, 'studio-mobile-upscale.png'), fullPage: true });
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
