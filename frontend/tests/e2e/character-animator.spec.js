const { test, expect } = require('@playwright/test');

test('character animator exposes deterministic speed tiers', async ({ page }) => {
  await page.goto('/tools/character-animator');

  await expect(page.getByRole('button', { name: /Standard 1×/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('$0.75 fixed price')).toBeVisible();

  await page.getByRole('button', { name: /Fast 2×/ }).click();
  await expect(page.getByRole('button', { name: /Fast 2×/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('$1.50 fixed price')).toBeVisible();

  await page.getByRole('button', { name: /XFast 4×/ }).click();
  await expect(page.getByRole('button', { name: /XFast 4×/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('$3.00 fixed price')).toBeVisible();

  await page.getByLabel('Length').selectOption('1');
  await expect(page.getByText('$3.00 fixed price · 5s minimum')).toBeVisible();
});
