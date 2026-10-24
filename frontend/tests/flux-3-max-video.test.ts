import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const FRONTEND = resolve(import.meta.dir, '..');
const ROOT = resolve(import.meta.dir, '..', '..');
const read = (rel: string) => readFileSync(join(FRONTEND, rel), 'utf8');
const readRoot = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

describe('flux 3 max video tool', () => {
  const tool = read('app/tools/flux-3-max-video/Flux3MaxVideoTool.tsx');
  const server = readRoot('server/flux3_max.go');
  test('posts the flux3_max_video service with every control', () => {
    expect(tool).toContain("service: 'flux3_max_video'");
    for (const field of ['image_url', 'last_frame', 'timed_keyframes', 'frame_index', 'duration', 'resolution', 'aspect_ratio', 'reasoning_level', 'include_audio', 'seed']) {
      expect(tool).toContain(field);
    }
  });
  test('rates and limits match the server', () => {
    expect(tool).toContain("'720p': 0.17, '1080p': 0.29");
    expect(server).toContain('flux3Max720USD       = 0.17');
    expect(server).toContain('flux3Max1080USD      = 0.29');
    expect(tool).toContain('MIN_SECONDS = 5');
    expect(tool).toContain('MAX_SECONDS = 20');
    expect(tool).toContain('FPS = 24');
    expect(tool).toContain('MAX_KEYFRAMES = 10');
    expect(server).toContain('flux3MaxFPS          = 24');
    expect(server).toContain('flux3MaxMaxKeyframes = 10');
    for (const ratio of ['auto', '21:9', '2:1', '16:9', '4:3', '1:1', '3:4', '9:16']) {
      expect(tool).toContain(`'${ratio}'`);
      expect(server).toContain(`"${ratio}"`);
    }
  });
  test('covers text, image and keyframes endpoints', () => {
    for (const mode of ['text-to-video', 'image-to-video', 'keyframes-to-video']) expect(server).toContain(`"${mode}"`);
    for (const mode of ['text', 'image', 'keyframes']) expect(tool).toContain(`data-testid={`+'`flux3-mode-${id}`'+`}`);
  });
  test('does not advertise promotional rates', () => {
    expect(tool.toLowerCase()).not.toContain('promo');
    expect(read('app/tools/flux-3-max-video/page.tsx').toLowerCase()).not.toContain('promo');
  });
  test('links real example inputs and outputs on the bucket', () => {
    for (const file of ['text-output.mp4', 'image-input.jpg', 'image-output.mp4', 'keyframes-input-1.jpg', 'keyframes-input-2.jpg', 'keyframes-output.mp4']) {
      expect(tool).toContain(`${file}`);
    }
    expect(tool).toContain('manifoldgenstatic.manifoldgen.com/static/tools/flux-3-max-video');
    expect(read('lib/tools-catalog.ts')).toContain("href: '/tools/flux-3-max-video'");
  });
  test('is registered in footer and sitemaps', () => {
    expect(read('lib/footer-links.ts')).toContain("'/tools/flux-3-max-video'");
    expect(read('app/sitemap.ts')).toContain("'flux-3-max-video'");
    expect(readRoot('server/sitemap.go')).toContain('"/tools/flux-3-max-video"');
  });
});
