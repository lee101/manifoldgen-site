import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const FRONTEND = resolve(import.meta.dir, '..');
const ROOT = resolve(import.meta.dir, '..', '..');

function read(rel: string): string {
  return readFileSync(join(FRONTEND, rel), 'utf8');
}

function readRoot(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

const tool = read('app/tools/character-swap/CharacterSwapTool.tsx');

describe('character swap lane prop', () => {
  test('component takes a reference|exact|lora lane', () => {
    expect(tool).toContain("type Lane = 'reference' | 'exact' | 'lora'");
    expect(tool).toContain('CharacterSwapTool({ lane }: { lane: Lane })');
  });

  test('exact lane posts kind, resolution and characters without reference-only keys', () => {
    const bodies = [...tool.matchAll(/: exact\s*\?\s*\{([\s\S]*?)\}\s*: \{/g)];
    expect(bodies.length).toBe(2);
    for (const body of bodies) {
      expect(body[1]).toContain("kind: 'exact'");
      expect(body[1]).not.toContain('include_audio');
      expect(body[1]).not.toContain('max_quality');
      expect(body[1]).not.toContain('prompt_expansion_mode');
    }
    expect(bodies[0][1]).toContain('characters');
    expect(bodies[1][1]).toContain('characters');
  });

  test('reference lane keeps its existing body', () => {
    expect(tool).toContain('include_audio: audioReference');
    expect(tool).toContain('max_quality: perShotFrames');
    expect(tool).toContain("prompt_expansion_mode: 'disabled'");
  });

  test('exact lane copy, resolutions and performers input', () => {
    expect(tool).toContain('GPT IMAGE 2 FRAME · WAN 2.2 ANIMATE · EXACT MOTION · ORIGINAL AUDIO');
    expect(tool).toContain('Swap the performers. Keep every frame.');
    expect(tool).toContain('pose-exact motion transfer, one performer at a time');
    expect(tool).toContain('Replace the performers with Wan 2.2 Animate');
    expect(tool).toContain("['720p', '580p']");
    expect(tool).toContain('Performers to replace');
    expect(tool).toContain('data-testid="swap-characters"');
    expect(tool).toContain('$0.24 per second per performer at 720P, $0.18 at 580P');
    expect(tool).toContain('rapvid-elon-optimus-exact.mp4');
    expect(tool).toContain('Frame-exact: same dance, same cuts, same room');
  });

  test('exact lane hides prompt and reference-only checkboxes', () => {
    expect(tool).toMatch(/\{\(!exact\) && <label[\s\S]{0,300}swap-video-prompt/);
    expect(tool).toMatch(/\{!exact && !lora && <label[\s\S]{0,300}swap-per-shot/);
    expect(tool).toMatch(/\{!exact && !lora && <label[\s\S]{0,300}swap-audio/);
  });

  test('exact lane stage labels and estimate line', () => {
    expect(tool).toContain('Tracking the performers');
    expect(tool).toContain('Replacing performer passes ${done}/${total}');
    expect(tool).toContain('Compositing and laying the soundtrack back on');
    expect(tool).toContain('performers · ${Math.round(estimate.source_seconds');
  });

  test('exact lane reports pose error as motion match', () => {
    expect(tool).toContain('pose_error');
    expect(tool).toContain('Motion match:');
    expect(tool).toContain('joint error');
  });

  test('lanes cross-link each other', () => {
    expect(tool).toContain('href="/tools/character-swap-exact"');
    expect(tool).toContain('Try the Exact Motion lane');
    expect(tool).toContain('href="/tools/character-swap"');
    expect(tool).toContain('Character Swap (H3)');
  });

  test('lora lane posts kind, tier and resolution without reference-only keys', () => {
    const body = tool.match(/body: JSON\.stringify\(lora\s*\?\s*\{\s*service: 'character_swap_video'([\s\S]*?)\}\s*: exact/);
    expect(body).not.toBeNull();
    expect(body![1]).toContain("kind: 'lora'");
    expect(body![1]).toContain('service_tier: tier');
    expect(body![1]).toContain('resolution');
    expect(body![1]).not.toContain('include_audio');
    expect(body![1]).not.toContain('max_quality');
    expect(tool).toContain("kind: 'lora', resolution, service_tier: tier");
  });

  test('lora lane copy, resolutions, tiers and pricing', () => {
    expect(tool).toContain('RA2 CHARACTER FRAME · MINIMAX H3 + SWAP LORA · ORIGINAL AUDIO');
    expect(tool).toContain('Swap the characters. Keep the scene.');
    expect(tool).toContain("['480p', '768p']");
    expect(tool).toContain('data-testid="swap-tier"');
    expect(tool).toContain('rapvid-elon-optimus-lora.mp4');
    expect(tool).toContain('Swapping clip ${done}/${total} with H3 + swap LoRA');
    expect(tool).toContain('per source second at');
    expect(tool).toContain('href="/tools/character-swap-lora"');
  });

  test('reference copy is unchanged', () => {
    expect(tool).toContain('GPT IMAGE 2 FRAME · MINIMAX H3 RE-PERFORMANCE · ORIGINAL AUDIO');
    expect(tool).toContain('Swap the performers, keep the performance.');
    expect(tool).toContain('Re-perform the video with MiniMax H3');
  });
});

describe('character swap page registrations', () => {
  test('reference page renders the reference lane', () => {
    expect(read('app/tools/character-swap/page.tsx')).toContain('<CharacterSwapTool lane="reference" />');
  });

  test('exact page renders the exact lane with its metadata', () => {
    const page = read('app/tools/character-swap-exact/page.tsx');
    expect(page).toContain('<CharacterSwapTool lane="exact" />');
    expect(page).toContain('Exact Motion Character Swap — ManifoldGen');
    expect(page).toContain('pose-exact motion transfer');
    expect(page).toContain('/tools/character-swap-exact');
    expect(page).toContain("from '../character-swap/CharacterSwapTool'");
  });

  test('lora page renders the lora lane with its metadata', () => {
    const page = read('app/tools/character-swap-lora/page.tsx');
    expect(page).toContain('<CharacterSwapTool lane="lora" />');
    expect(page).toContain('Character Swap LoRA — ManifoldGen');
    expect(page).toContain('/tools/character-swap-lora');
    expect(page).toContain("from '../character-swap/CharacterSwapTool'");
  });

  test('tools catalog, sitemaps and footer list the lora lane', () => {
    expect(read('lib/tools-catalog.ts')).toContain("href: '/tools/character-swap-lora'");
    expect(read('app/sitemap.ts')).toContain("'character-swap-lora'");
    expect(read('lib/footer-links.ts')).toContain("'/tools/character-swap-lora'");
    expect(readRoot('server/sitemap.go')).toContain('"/tools/character-swap-lora"');
  });

  test('tools catalog lists the exact lane after the reference entry', () => {
    const catalog = read('lib/tools-catalog.ts');
    expect(catalog.indexOf('/tools/character-swap-exact')).toBeGreaterThan(catalog.indexOf("href: '/tools/character-swap'"));
    expect(catalog).toContain('Exact Motion Character Swap');
    expect(catalog).toContain('FRAME-EXACT SWAP');
    expect(catalog).toContain('rapvid-elon-optimus-exact.mp4');
    expect(catalog).toContain('Wan 2.2 Animate per performer');
  });

  test('frontend sitemap and footer link the exact lane', () => {
    expect(read('app/sitemap.ts')).toContain("'character-swap', 'character-swap-exact'");
    expect(read('lib/footer-links.ts')).toContain("'/tools/character-swap', '/tools/character-swap-exact'");
  });

  test('go sitemap serves the exact lane', () => {
    expect(readRoot('server/sitemap.go')).toContain('"/tools/character-swap", "/tools/character-swap-exact"');
  });

  test('api docs describe the lora lane', () => {
    const docs = read('app/api/page.tsx');
    expect(docs).toContain('LoRA lane:');
    expect(docs).toContain('"kind":"lora"');
    expect(docs).toContain('$0.14 per source second at 480p');
  });

  test('api docs describe the exact motion lane', () => {
    const docs = read('app/api/page.tsx');
    expect(docs).toContain('Exact motion lane:');
    expect(docs).toContain('result.pose_error');
    expect(docs).toContain('$0.24 per source second per performer at 720p and $0.18 at 580p');
  });
});

describe('character recast tool', () => {
  const recast = read('app/tools/character-recast/CharacterRecastTool.tsx');

  test('posts kind recast with reference photos and no frame keys', () => {
    expect(recast).toContain("kind: 'recast'");
    expect(recast).toContain('reference_image_urls: cleanPhotos');
    expect(recast).not.toContain('image_url:');
    expect(recast).not.toContain('include_audio');
    expect(recast).toContain("kind: 'recast', reference_image_urls: cleanPhotos, resolution");
  });

  test('caps people at four and shows the per-second rates', () => {
    expect(recast).toContain('const MAX_PEOPLE = 4');
    expect(recast).toContain("{ '768P': 0.62, '1080P': 0.70 }");
  });

  test('page, catalog, footer and sitemaps register the route', () => {
    expect(read('app/tools/character-recast/page.tsx')).toContain('<CharacterRecastTool />');
    expect(read('lib/tools-catalog.ts')).toContain("href: '/tools/character-recast'");
    expect(read('lib/footer-links.ts')).toContain('/tools/character-recast');
    expect(read('app/sitemap.ts')).toContain("'character-recast'");
    expect(readRoot('server/sitemap.go')).toContain('"/tools/character-recast"');
  });

  test('example input, photo and output are the uploaded samples', () => {
    expect(recast).toContain('${SAMPLE_BASE}/dance-source.webm');
    expect(recast).toContain('${SAMPLE_BASE}/cat-reference.webp');
    expect(recast).toContain('${SAMPLE_BASE}/cat-recast.webm');
    expect(read('lib/tools-catalog.ts')).toContain('static/tools/character-recast/cat-recast.webm');
  });

  test('server prices match the page rates', () => {
    const server = readRoot('server/character_swap_recast.go');
    expect(server).toContain('{"768P": 0.62, "1080P": 0.70}');
  });
});
