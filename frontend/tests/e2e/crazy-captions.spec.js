const { test, expect } = require('@playwright/test');

test('crazy captions effects can be switched off for readable captions', async ({ page }) => {
  await page.goto('/tools/crazy-captions');
  await page.getByTestId('cc-tab-style').click();
  const panel = page.getByTestId('cc-readability');
  await expect(panel).toBeVisible();
  for (const key of ['glitch', 'camera', 'wobble', 'scatter']) await expect(page.getByTestId(`cc-fx-${key}`)).toHaveAttribute('aria-pressed', 'true');

  await page.getByTestId('cc-fx-glitch').click();
  await expect(page.getByTestId('cc-fx-glitch')).toHaveAttribute('aria-pressed', 'false');

  await page.getByTestId('cc-readable').click();
  for (const key of ['glitch', 'camera', 'wobble', 'scatter']) await expect(page.getByTestId(`cc-fx-${key}`)).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('cc-readable')).toHaveText('Restore effects');

  await page.waitForTimeout(700);
  await page.reload();
  await page.getByTestId('cc-tab-style').click();
  await expect(page.getByTestId('cc-fx-glitch')).toHaveAttribute('aria-pressed', 'false');
  await page.getByTestId('cc-readable').click();
  await expect(page.getByTestId('cc-fx-glitch')).toHaveAttribute('aria-pressed', 'true');
});

test('crazy captions style tab fits a phone without sideways scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto('/tools/crazy-captions');
  await page.getByTestId('cc-tab-style').click();
  await expect(page.getByTestId('cc-readability')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
