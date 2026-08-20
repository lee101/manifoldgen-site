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
