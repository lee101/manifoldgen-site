const { test, expect } = require('@playwright/test');

test('free prompt page builds a render-ready Studio link without login', async ({ page }) => {
  await page.goto('/prompts/cinematic-ai-video-prompts');
  await expect(page.getByRole('heading', { name: 'Cinematic AI Video Prompts', level: 1 })).toBeVisible();
  await expect(page.getByText('Free · no login').first()).toBeVisible();

  await page.getByLabel('Subject').fill('A clockmaker opening a tiny mechanical moon');
  const render = page.getByRole('link', { name: /Generate this video/ });
  await expect(render).toHaveAttribute('href', /\/studio\?prompt=.*clockmaker/);
});

test('referral link is captured and invite page explains purchase-gated reward', async ({ page, context }) => {
  await page.goto('/prompts?ref=a1b2c3d4e5');
  await expect.poll(async () => (await context.cookies()).find((cookie) => cookie.name === 'mg_ref')?.value).toBe('a1b2c3d4e5');
  await page.goto('/invite');
  await expect(page.getByRole('heading', { name: /Give \$5\. Get \$5/ })).toBeVisible();
  await expect(page.getByText(/first purchase/i).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Sign in or create an account/ })).toHaveAttribute('href', '/account');
});
