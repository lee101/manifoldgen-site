import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const FRONTEND = resolve(import.meta.dir, '..');
const ROOT = resolve(import.meta.dir, '..', '..');
const read = (rel: string) => readFileSync(join(FRONTEND, rel), 'utf8');
const readRoot = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

describe('orbit video tool', () => {
  const tool = read('app/tools/orbit-video/OrbitVideoTool.tsx');
  test('posts the orbit_video service with the recommended prompt', () => {
    expect(tool).toContain("service: 'orbit_video'");
    expect(tool).toContain('One frozen instant. Only the camera moves. In a continuous 360 orbit.');
    expect(tool).toContain('data-testid="orbit-example-input"');
    expect(tool).toContain('data-testid="orbit-example-output"');
  });
  test('prompt and price match the server', () => {
    const server = readRoot('server/video_orbit.go');
    const prompt = /ORBIT_PROMPT = '([^']+)'/.exec(tool)?.[1];
    expect(prompt).toBeTruthy();
    expect(server).toContain(`const orbitDefaultPrompt = "${prompt}"`);
    expect(tool).toContain('PRICE_USD = 0.50');
    expect(server).toContain('orbitPriceUSD          = 0.50');
  });
  test('is registered in catalog, sitemap and footer', () => {
    expect(read('lib/tools-catalog.ts')).toContain("href: '/tools/orbit-video'");
    expect(read('app/sitemap.ts')).toContain("'orbit-video'");
    expect(read('lib/footer-links.ts')).toContain("'/tools/orbit-video'");
    expect(readRoot('server/sitemap.go')).toContain('"/tools/orbit-video"');
    expect(read('app/tools/orbit-video/page.tsx')).toContain("canonical: '/tools/orbit-video'");
  });
});
