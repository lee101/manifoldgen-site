import { expect, test } from '@playwright/test';

test('video background remover route renders the local-first tool', async ({ page }) => {
  await page.goto('/tools/video-background-remover');
  await expect(page.getByRole('heading', { name: /Remove a video background/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove background' })).toBeDisabled();
  await expect(page.getByLabel('Transparent output video')).toBeVisible();
  await page.getByRole('button', { name: 'Chroma green' }).click();
  await expect(page.getByRole('button', { name: 'Chroma green' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Transparent output video').locator('..')).toHaveCSS('background-color', 'rgb(0, 255, 0)');
  await page.getByRole('button', { name: 'New scene' }).click();
  await expect(page.getByRole('button', { name: 'New scene' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Use astronaut sample' }).click();
  await expect(page.getByRole('button', { name: 'Remove background' })).toBeEnabled();
  await expect(page.getByText('Local GPU first')).toBeVisible();
});
