const { test, expect } = require('@playwright/test');

const PNG_FIXTURE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

test('homepage gallery cache-busts restored originals after additive deployment', async ({ page }) => {
  await page.route('**/api/pricing', (route) => route.fulfill({ status: 200, json: {} }));
  await page.route('**/api/videos/featured?**', (route) => route.fulfill({ status: 200, json: { results: [] } }));
  await page.route('**/api/images?**', (route) => route.fulfill({ status: 200, json: { images: [{
    id: 'restored-gallery-image',
    prompt: 'Restored gallery image',
    file_path: 'originals/restored-gallery-image.webp',
  }] } }));

  let galleryRequestURL = '';
  await page.route('https://manifoldgenstatic.manifoldgen.com/gallery/originals/restored-gallery-image.webp?**', (route) => {
    galleryRequestURL = route.request().url();
    return route.fulfill({ status: 200, contentType: 'image/png', body: PNG_FIXTURE });
  });

  await page.goto('/');
  await expect(page.getByAltText('Restored gallery image')).toBeVisible();
  expect(galleryRequestURL).toContain('?v=20260817-gallery-index-refresh');
});

test('homepage search interleaves matching images and videos', async ({ page }) => {
  await page.route('**/api/pricing', (route) => route.fulfill({ status: 200, json: {} }));
  await page.route('**/api/videos/featured?**', (route) => route.fulfill({ status: 200, json: { results: [] } }));
  await page.route('**/api/search?**', (route) => route.fulfill({ status: 200, json: { results: [{
    job_id: 'search-video-1',
    prompt: 'Glass greenhouse in silver fog',
    video_url: '/showcase/h3-loop-glass-torus.webm',
    service: 'h3_video',
    similarity: 0.94,
  }] } }));
  await page.route('**/api/images**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/images/semantic') {
      return route.fulfill({ status: 200, json: { results: [{
        id: 'search-image-1',
        prompt: 'Glass greenhouse in blue morning fog',
        image_url: 'https://manifoldgenstatic.manifoldgen.com/gallery/originals/search-image.webp',
        similarity: 0.91,
      }] } });
    }
    return route.fulfill({ status: 200, json: { images: [] } });
  });

  await page.goto('/');
  await page.getByPlaceholder('Search videos and gallery by prompt…').fill('glass greenhouse fog');
  await page.getByRole('button', { name: 'Search', exact: true }).click();

  const results = page.getByTestId('home-search-results');
  await expect(results).toContainText('Results for “glass greenhouse fog”');
  await expect(page.getByTestId('home-search-video-search-video-1')).toBeVisible();
  await expect(page.getByTestId('home-search-image-search-image-1')).toBeVisible();
  await expect(results.getByText('Video', { exact: true })).toBeVisible();
  await expect(results.getByText('Image', { exact: true })).toBeVisible();
  await expect(page.getByTestId('showcase-reel')).toHaveCount(0);
  await expect(page.getByTestId('still-gallery')).toHaveCount(0);
});

test('homepage search automatically loads more relevance-ranked mixed media', async ({ page }) => {
  await page.route('**/api/pricing', (route) => route.fulfill({ status: 200, json: {} }));
  await page.route('**/api/videos/featured?**', (route) => route.fulfill({ status: 200, json: { results: [] } }));
  await page.route('**/api/search?**', (route) => {
    const limit = Number(new URL(route.request().url()).searchParams.get('top_k'));
    const results = Array.from({ length: limit }, (_, index) => ({
      job_id: `video-${index}`, prompt: `Relevant motion ${index}`,
      video_url: '/showcase/h3-loop-glass-torus.webm', similarity: 1 - index / 1000,
    }));
    return route.fulfill({ status: 200, json: { results } });
  });
  await page.route('**/api/images/semantic?**', (route) => {
    const limit = Number(new URL(route.request().url()).searchParams.get('top_k'));
    const results = Array.from({ length: limit }, (_, index) => ({
      id: `image-${index}`, prompt: `Relevant still ${index}`,
      image_url: `https://images.example/${index}.webp`, similarity: 1 - index / 1000,
    }));
    return route.fulfill({ status: 200, json: { results } });
  });

  await page.goto('/');
  await page.getByPlaceholder('Search videos and gallery by prompt…').fill('relevant art');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByTestId('home-search-video-video-23')).toBeVisible();
  await page.getByTestId('home-search-video-video-23').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('home-search-video-video-47')).toBeVisible();
  await expect(page.getByTestId('home-search-image-image-47')).toBeVisible();
});

test('homepage packs images and videos together and autoloads both feeds', async ({ page }) => {
  await page.route('**/api/pricing', (route) => route.fulfill({ status: 200, json: {} }));
  await page.route('**/api/videos/featured?**', (route) => {
    const url = new URL(route.request().url());
    const offset = Number(url.searchParams.get('offset') || 0);
    return route.fulfill({ status: 200, json: {
      results: [{ job_id: `gallery-video-${offset}`, prompt: `Gallery motion ${offset}`, video_url: '/showcase/h3-loop-glass-torus.webm' }],
      has_more: offset === 0,
    } });
  });
  await page.route('**/api/images?**', (route) => {
    const url = new URL(route.request().url());
    const after = url.searchParams.get('after');
    return route.fulfill({ status: 200, json: {
      images: [{ id: `gallery-image-${after ? 24 : 0}`, prompt: `Gallery still ${after ? 24 : 0}`, image_url: 'https://images.example/still.webp' }],
      ...(after ? {} : { next_cursor: 0.24 }),
    } });
  });

  await page.goto('/');
  await expect(page.getByTestId('gallery-video-gallery-video-0')).toBeVisible();
  await expect(page.getByAltText('Gallery still 0')).toBeVisible();
  await page.getByTestId('gallery-video-gallery-video-0').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('gallery-video-gallery-video-1')).toBeVisible();
  await expect(page.getByAltText('Gallery still 24')).toBeVisible();
});

test('gallery image actions copy the prompt, choose a start frame, and open Studio', async ({ page }) => {
  await page.route('**/api/pricing', (route) => route.fulfill({ status: 200, json: {} }));
  await page.route('**/api/videos/featured?**', (route) => route.fulfill({ status: 200, json: { results: [] } }));
  await page.route('**/api/images?**', (route) => route.fulfill({ status: 200, json: { images: [{
    id: 'gallery-action-image',
    prompt: 'A copper moon over a quiet ocean',
    image_url: 'https://manifoldgenstatic.manifoldgen.com/gallery/originals/action-image.webp',
  }] } }));
  await page.route('**/api/gallery-assets/originals/action-image.webp?**', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG_FIXTURE }));

  await page.goto('/');
  const card = page.getByAltText('A copper moon over a quiet ocean').locator('..').locator('..');
  await card.hover();
  await card.getByRole('button', { name: 'Use as start frame' }).click();
  await expect(page.getByTestId('home-frame-tray')).toContainText('Frame 1 anchors the shot');
  await expect(page.locator('textarea').first()).toHaveValue('A copper moon over a quiet ocean');

  await card.hover();
  await card.getByRole('button', { name: 'Prompt for similar' }).click();
  await expect(page.getByTestId('home-frame-tray')).toHaveCount(0);
  await expect(page.locator('textarea').first()).toHaveValue('A copper moon over a quiet ocean');

  await card.hover();
  await card.getByRole('button', { name: 'Open in editor' }).click();
  await expect(page).toHaveURL(/\/studio\?image_url=https%3A%2F%2Fmanifoldgenstatic\.manifoldgen\.com%2Fgallery%2Foriginals%2Faction-image\.webp/);
});

test('right click opens a cursor-anchored gallery menu with browser and clipboard actions', async ({ page }) => {
  await page.route('**/api/pricing', (route) => route.fulfill({ status: 200, json: {} }));
  await page.route('**/api/videos/featured?**', (route) => route.fulfill({ status: 200, json: { results: [] } }));
  await page.route('**/api/images?**', (route) => route.fulfill({ status: 200, json: { images: [{
    id: 'gallery-menu-image',
    prompt: 'A copper moon over a quiet ocean',
    image_url: 'https://manifoldgenstatic.manifoldgen.com/gallery/originals/action-image.webp',
  }] } }));
  await page.route('**/api/gallery-assets/originals/action-image.webp?**', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG_FIXTURE }));
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

  await page.goto('/');
  const img = page.getByAltText('A copper moon over a quiet ocean');
  await img.scrollIntoViewIfNeeded();
  const box = await img.boundingBox();
  const cursor = { x: box.x + box.width / 2, y: box.y + Math.min(30, box.height / 2) };
  const menu = page.getByTestId('media-context-menu');

  // A right-click dispatched before React hydrates is lost, so retry until the
  // menu mounts instead of assuming the first event lands.
  for (let attempt = 0; attempt < 30 && (await menu.count()) === 0; attempt += 1) {
    await page.mouse.click(cursor.x, cursor.y, { button: 'right' });
    await page.waitForTimeout(200);
  }
  await expect(menu).toBeVisible();
  const menuBox = await menu.boundingBox();
  expect(menuBox.width).toBeLessThan(320);
  expect(menuBox.height).toBeLessThan(page.viewportSize().height * 0.9);
  expect(Math.abs(menuBox.x + menuBox.width / 2 - cursor.x)).toBeLessThan(240);
  expect(Math.abs(menuBox.y - cursor.y)).toBeLessThan(40);
  for (const label of ['Back', 'Forward', 'Reload', 'Copy image', 'Copy prompt', 'Open in editor']) {
    await expect(menu.getByText(label, { exact: true })).toBeVisible();
  }

  await menu.getByText('Copy prompt', { exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('A copper moon over a quiet ocean');

  await img.click({ button: 'right' });
  await expect(menu).toBeVisible();
  await menu.getByText('Copy image', { exact: true }).click();
  const clipboardTypes = await page.evaluate(async () => (await navigator.clipboard.read()).flatMap((item) => [...item.types]));
  expect(clipboardTypes).toContain('image/png');

  await img.click({ button: 'right' });
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
});
