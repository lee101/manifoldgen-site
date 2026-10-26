import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  PRODKIT_PRICES, PRODUCTION_TOOLS, SCENE_TEMPLATES, apiBody, formatSpec, controlDefaults, controlParams, mcpArguments, productionPriceUSD, snippets, validateSceneSpec,
  type ProductionRequest,
} from '../lib/production-tools';

const FRONTEND = resolve(import.meta.dir, '..');
const ROOT = resolve(FRONTEND, '..');
const read = (rel: string) => readFileSync(join(FRONTEND, rel), 'utf8');
const server = readFileSync(join(ROOT, 'server/prodkit.go'), 'utf8');
const mcp = readFileSync(join(ROOT, 'server/mcp_production.go'), 'utf8');

const req = (service: ProductionRequest['service'], extra: Partial<ProductionRequest> = {}): ProductionRequest => ({ service, params: {}, ...extra });

describe('production price parity with server prodkitPriceUSD', () => {
  test('base prices match the server tool table', () => {
    for (const tool of PRODUCTION_TOOLS) {
      const row = new RegExp(`"${tool.service}", "[^"]+", "\\w+", ([0-9.]+|prodkitEraserUSDSec),`).exec(server);
      expect(row).toBeTruthy();
      const base = row![1] === 'prodkitEraserUSDSec' ? PRODKIT_PRICES.eraserPerSecond : Number(row![1]);
      expect(PRODKIT_PRICES.base[tool.service]).toBe(base);
    }
    expect(server).toContain(`prodkitEraserUSDSec = ${PRODKIT_PRICES.eraserPerSecond}`);
    expect(server).toContain(`prodkitEraserMaxSec = ${PRODKIT_PRICES.eraserMaxSeconds}.0`);
    expect(server).toContain(`prodkitEraserChunk  = ${PRODKIT_PRICES.eraserChunkSeconds}`);
    expect(server).toContain('price += 0.06');
    expect(server).toContain('price += 0.20');
    expect(server).toContain('return 0.45');
    expect(server).toContain('return 0.03');
  });

  test('parity numbers', () => {
    const cases: [ProductionRequest, number][] = [
      [req('destruction-studio', { params: { subject: 'tower' } }), 0.40],
      [req('destruction-studio', { image_url: 'https://x/a.png' }), 0.46],
      [req('destruction-studio', { image_url: 'https://x/a.png', params: { quality: 'high' } }), 0.66],
      [req('destruction-studio', { image_url: 'https://x/a.png', model_url: 'https://x/m.glb' }), 0.40],
      [req('exploded-view', { params: { demo: 'camera', quality: 'high' } }), 0.60],
      [req('toon-shader', { model_url: 'https://x/m.glb' }), 0.30],
      [req('toon-shader', { image_url: 'https://x/a.png' }), 0.36],
      [req('blender-scene', { image_url: 'https://x/a.png', params: { quality: 'high' } }), 0.50],
      [req('blender-scene'), 0.30],
      [req('image-to-3d', { image_url: 'https://x/a.png' }), 0.06],
      [req('image-to-3d', { params: { quality: 'high' } }), 0.45],
      [req('vectorize'), 0.02],
      [req('vectorize', { params: { engine: 'ai' } }), 0.03],
      [req('shot-cleanup', { duration: 4 }), 0.96],
      [req('shot-cleanup', { duration: 12 }), 2.88],
      [req('shot-cleanup', { duration: 45 }), 7.20],
      [req('shot-cleanup'), 1.20],
    ];
    for (const [input, expected] of cases) expect(productionPriceUSD(input)).toBe(expected);
  });
});

describe('production request building', () => {
  test('only server-allowed params are sent', () => {
    const lines = server.split('\n');
    for (const tool of PRODUCTION_TOOLS) {
      const index = lines.findIndex((line) => line.includes(`"${tool.service}", "`));
      expect(index).toBeGreaterThan(-1);
      const row = lines[index].includes('[]string{') ? lines[index].slice(lines[index].indexOf('[]string{')) : lines[index + 1];
      const allowed = [...row.matchAll(/"(\w+)"/g)].map((match) => match[1]);
      const extra = tool.input === 'model' ? (tool.presets ? ['subject', 'text'] : ['demo']) : tool.input === 'scene' ? ['spec'] : tool.input === 'video' ? ['points'] : [];
      const params = controlParams(tool.controls, { ...controlDefaults(tool.controls), seed: '7', palette: ['#ffffff'] });
      for (const key of [...Object.keys(params), ...extra]) expect(allowed).toContain(key);
    }
  });

  test('body, MCP args and snippets', () => {
    const body = req('destruction-studio', { image_url: 'https://x/a.png', params: { pieces: 60, duration: 6 } });
    expect(apiBody(body)).toEqual({ service: 'destruction-studio', image_url: 'https://x/a.png', params: { pieces: 60, duration: 6 } });
    expect(mcpArguments(body)).toEqual({ image_url: 'https://x/a.png', pieces: 60, duration: 6 });
    const code = snippets(body, 'blender_destruction');
    expect(code.cli).toBe(`manifoldgen generate destruction-studio --image 'https://x/a.png' --params '{"pieces":60,"duration":6}' --wait --out .`);
    expect(mcp).toContain('"colors":    mcpNumber(2, 32,');
    expect(code.curl).toContain('https://manifoldgen.com/api/service');
    for (const tool of PRODUCTION_TOOLS) expect(mcp).toContain(`Name: "${tool.mcp}"`);
  });

  test('scene spec validation', () => {
    expect(validateSceneSpec('{', 0).error).toContain('Invalid JSON');
    expect(validateSceneSpec('{"objects":[]}', 0).error).toContain('1-64');
    expect(validateSceneSpec('{"objects":[{"type":"model","model_index":1}]}', 1).error).toContain('model #1');
    expect(validateSceneSpec('{"objects":[{"type":"cube"}]}', 0).spec).toBeTruthy();
    for (const template of SCENE_TEMPLATES) {
      expect(JSON.parse(formatSpec(template.spec))).toEqual(template.spec);
      expect(validateSceneSpec(formatSpec(template.spec), template.id === 'product' ? 1 : 0).spec).toBeTruthy();
    }
  });
});

describe('production registrations', () => {
  test('pages, catalog, sitemap, footer and docs', () => {
    const catalog = read('lib/tools-catalog.ts');
    const sitemap = read('app/sitemap.ts');
    const footer = read('lib/footer-links.ts');
    const goSitemap = readFileSync(join(ROOT, 'server/sitemap.go'), 'utf8');
    for (const tool of PRODUCTION_TOOLS) {
      expect(read(`app/tools/${tool.slug}/page.tsx`)).toContain(`slug="${tool.slug}"`);
      expect(catalog).toContain(`href: '/tools/${tool.slug}'`);
      expect(sitemap).toContain(`'${tool.slug}'`);
      expect(footer).toContain(`'/tools/${tool.slug}'`);
      expect(goSitemap).toContain(`"/tools/${tool.slug}"`);
    }
    expect(read('app/api/page.tsx')).toContain('id="production"');
  });

  test('public copy avoids vendor names', () => {
    const copy = [read('lib/production-tools.ts'), read('components/production/ProductionToolWorkspace.tsx'), read('components/production/ProductionViews.tsx'), read('app/tools/production/page.tsx')].join('\n');
    for (const vendor of ['Trellis', 'trellis', 'Bria', 'bria', 'vtracer', 'Recraft', 'recraft', 'fal-ai']) expect(copy).not.toContain(vendor);
  });
});
