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
  test('component takes a reference|exact lane', () => {
    expect(tool).toContain("CharacterSwapTool({ lane }: { lane: 'reference' | 'exact' })");
  });

  test('exact lane posts kind, resolution and characters without reference-only keys', () => {
    const bodies = [...tool.matchAll(/body: JSON\.stringify\(exact\s*\?([\s\S]*?): \{/g)];
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
    expect(tool).toMatch(/\{!exact && <label[\s\S]{0,300}swap-video-prompt/);
    expect(tool).toMatch(/\{!exact && <label[\s\S]{0,300}swap-per-shot/);
    expect(tool).toMatch(/\{!exact && <label[\s\S]{0,300}swap-audio/);
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

  test('api docs describe the exact motion lane', () => {
    const docs = read('app/api/page.tsx');
    expect(docs).toContain('Exact motion lane:');
    expect(docs).toContain('result.pose_error');
    expect(docs).toContain('$0.24 per source second per performer at 720p and $0.18 at 580p');
  });
});
