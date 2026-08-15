const { test, expect } = require('@playwright/test');

test('API docs show concrete video resolution and duration prices', async ({ page }) => {
  await page.route('**/api/pricing', (route) => route.fulfill({ status: 200, json: {
    credit_price_usd: 0.01,
    image_price_usd: 0.04,
    image_credits: 4,
    image_high_step_price_usd: 0.10,
    image_high_step_credits: 10,
    video_pricing: {
      basis_steps: 20,
      tiers: [
        { size: 'preview', label: 'Preview', resolution_16_9: '1024 × 576', prices: [{ duration_seconds: 5, price_usd: .46, credits: 46 }, { duration_seconds: 10, price_usd: .91, credits: 91 }] },
        { size: 'balanced', label: 'Balanced', resolution_16_9: '1184 × 672', prices: [{ duration_seconds: 5, price_usd: .71, credits: 71 }, { duration_seconds: 10, price_usd: 1.42, credits: 142 }] },
        { size: 'native', label: 'Native', resolution_16_9: '1344 × 768', prices: [{ duration_seconds: 5, price_usd: 1.01, credits: 101 }, { duration_seconds: 10, price_usd: 2.02, credits: 202 }] },
      ],
    },
    pricing: [{ service: 'speech', price_usd: .005, price_cute: .5, unit: 'per 100 characters' }],
    studio: { music_generation_credits: 190, music_generation_base_usd: 1.50, music_generation_minimum_usd: 1.80, music_generation_minute_usd: .80 },
  } }));

  await page.goto('/api#pricing');
  const table = page.getByTestId('api-video-pricing');
  await expect(table).toContainText('1024 × 576');
  await expect(table).toContainText('1184 × 672');
  await expect(table).toContainText('1344 × 768');
  await expect(table).toContainText('$0.46');
  await expect(table).toContainText('$1.42');
  await expect(table).toContainText('$2.02');
  await expect(page.getByText('from $1.80')).toBeVisible();
  await expect(page.getByText('$0.80/minute + base')).toBeVisible();
  await expect(page.getByText('4 credits per image')).toBeVisible();
  await expect(page.getByText('estimate returned by API')).toHaveCount(0);
  await expect(page.getByText(/Fetch current estimates/)).toHaveCount(0);
  const docs = await page.locator('body').innerText();
  expect(docs).toContain('"service": "video"');
  expect(docs).toContain('"service": "image"');
  expect(docs).not.toMatch(/zimage|h3_video|\bH3\b|OmniServe|backend/i);
});
