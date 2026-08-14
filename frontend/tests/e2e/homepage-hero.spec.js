const { test, expect } = require('@playwright/test');

const HERO_PROMPT = 'An obsidian lighthouse fractures moonlight into spectral fog while black waves climb upward, slow impossible crane shot; sub-bass surf, distant glass harmonics';
const HERO_VIDEO = 'https://manifoldgenstatic.manifoldgen.com/gallery/03475ad6-41a/videos/add2e0dd-9f8f-4d6d-b0dc-41a210fecaa3.webm';

test('homepage keeps the featured lighthouse hero and prompt stable', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByTestId('home-hero-video')).toHaveAttribute('src', HERO_VIDEO);
  await expect(page.locator('textarea').first()).toHaveValue(HERO_PROMPT);
});

test('homepage video settings close with Escape or a backdrop click', async ({ page }) => {
  await page.goto('/');

  const settingsButton = page.getByRole('button', { name: 'Settings' }).first();
  const dialog = page.getByRole('dialog', { name: 'Video settings' });

  await settingsButton.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await settingsButton.click();
  await expect(dialog).toBeVisible();
  await page.getByTestId('homepage-settings-backdrop').click({ position: { x: 1, y: 1 } });
  await expect(dialog).toBeHidden();
});
