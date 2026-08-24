const { test, expect } = require('@playwright/test');

const gridCard = (page, name) => page.locator('section[class*="grid"]').getByRole('link', { name });

test('tools index lists the song generator and voice studio cards', async ({ page }) => {
  await page.goto('/tools');
  await expect(gridCard(page, /Song Generator/)).toHaveAttribute('href', '/tools/music-generator');
  await expect(gridCard(page, /Voice Studio/)).toHaveAttribute('href', '/voice');

  await page.getByTestId('tools-search').fill('speech');
  await expect(gridCard(page, /Voice Studio/)).toBeVisible();
  await expect(gridCard(page, /Song Generator/)).toBeHidden();

  await page.getByTestId('tools-search').fill('music');
  await expect(gridCard(page, /Song Generator/)).toBeVisible();
});
