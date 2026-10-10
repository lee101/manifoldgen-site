import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resizePrice, utilityImageURLs, validResizeSize } from '../lib/image-utilities';

describe('image utilities', () => {
  test('bounds exact dimensions', () => {
    for (const size of ['1024x1024', '1080x1920', '64x2048']) expect(validResizeSize(size)).toBe(true);
    for (const size of ['0x100', '63x100', '4096x4096', '100 x 100', '1e3x100', '0100x100', '100X100']) expect(validResizeSize(size)).toBe(false);
  });
  test('prices every target, including request overhead', () => {
    expect(resizePrice(1)).toBe(0.24);
    expect(resizePrice(6)).toBe(1.14);
  });
  test('prefers durable outputs only when the complete ordered batch is stored', () => {
    const result = { data: [{ url: 'https://fal/one.png' }, { url: 'https://fal/two.png' }] };
    expect(utilityImageURLs({ result, saved_image_urls: ['https://gallery/one.png', 'https://gallery/two.png'] })).toEqual(['https://gallery/one.png', 'https://gallery/two.png']);
    expect(utilityImageURLs({ result, saved_image_urls: ['https://gallery/two.png'] })).toEqual(['https://fal/one.png', 'https://fal/two.png']);
    expect(utilityImageURLs({})).toEqual([]);
  });
  test('registers native tools with canonicals, sitemaps and footer', () => {
    for (const slug of ['smart-resize', 'image-background-remover']) {
      for (const file of ['lib/tools-catalog.ts', 'lib/footer-links.ts', 'app/sitemap.ts']) expect(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')).toContain(slug);
      expect(readFileSync(new URL(`../app/tools/${slug}/page.tsx`, import.meta.url), 'utf8')).toContain(`canonical: '/tools/${slug}'`);
      expect(readFileSync(new URL('../../server/sitemap.go', import.meta.url), 'utf8')).toContain(`/tools/${slug}`);
    }
  });
});
