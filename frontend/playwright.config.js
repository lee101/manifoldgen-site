const { defineConfig, devices } = require('@playwright/test');

const port = process.env.PLAYWRIGHT_PORT || '3218';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`;
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1';
const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const gpuRun = process.env.PLAYWRIGHT_GPU === '1';

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  // Video encoding and WebGL fidelity checks need exclusive access to the
  // software renderer on most developer machines.
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL,
    ignoreHTTPSErrors: baseURL.startsWith('https://'),
    trace: 'retain-on-failure',
    headless: !gpuRun,
    launchOptions: {
      ...(chromiumExecutable ? { executablePath: chromiumExecutable } : {}),
      // Exercise the same GPU/WebCodecs path used by the studio instead of
      // silently benchmarking Chromium's SwiftShader software renderer.
      args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=gl', '--enable-features=VaapiVideoDecoder,VaapiVideoEncoder'],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: skipWebServer
    ? undefined
    : {
        command: `bunx next dev --turbopack --hostname 127.0.0.1 --port ${port}`,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
        env: {
          ...process.env,
          NEXT_DIST_DIR: process.env.NEXT_DIST_DIR || '.next-playwright',
          MANIFOLDGEN_API_ORIGIN: process.env.MANIFOLDGEN_API_ORIGIN || 'http://127.0.0.1:8116',
        },
      },
});
