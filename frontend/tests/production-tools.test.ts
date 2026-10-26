import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  MOTION_PRICING, MOTION_TOOLS, PRODUCTION_DEMO_BASE, cliCommand, formatFightStats, isMotionService, modelContentType, posterPlaceholder, PRODKIT_PRICES, PRODUCTION_TOOLS, SCENE_TEMPLATES, demoMedia, productionTool, apiBody, formatSpec, controlDefaults, controlParams, mcpArguments, productionPriceUSD, snippets, validateSceneSpec,
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

describe('motion tools', () => {
  test('per-second pricing with minimum and cap', () => {
    const cases: [ProductionRequest, number][] = [
      [req('motion-fx', { duration: 1 }), 0.15],
      [req('motion-fx', { duration: 5 }), 0.30],
      [req('motion-fx', { duration: 45 }), 1.20],
      [req('motion-fx'), 0.30],
      [req('beat-drop', { duration: 2 }), 0.10],
      [req('beat-drop', { duration: 30 }), 1.20],
      [req('motion-track', { duration: 10 }), 0.20],
      [req('motion-track', { duration: 120 }), 1.20],
      [req('motion-score', { duration: 3 }), 0.20],
      [req('motion-score', { duration: 20 }), 1.00],
    ];
    for (const [input, expected] of cases) expect(productionPriceUSD(input)).toBe(expected);
    for (const [service, rule] of Object.entries(MOTION_PRICING)) expect(PRODKIT_PRICES.base[service as keyof typeof PRODKIT_PRICES.base]).toBe(rule.rate);
  });

  test('locked presets, names, tri-state and audio travel in the request', () => {
    const fx = productionTool('anime-fight-fx')!;
    expect(fx.service).toBe('motion-fx');
    expect(fx.controls.some((control) => control.key === 'preset')).toBe(false);
    const params = controlParams(fx.controls, { ...controlDefaults(fx.controls), names: ' Sensei , Rival ,, ', slowmo: 'false', sfx: '', intensity: 1.2 });
    expect(params).toEqual({ intensity: 1.2, names: ['Sensei', 'Rival'], slowmo: false });
    const body = apiBody({ service: 'beat-drop', video_url: 'https://x/a.mp4', audio_url: 'https://x/s.mp3', duration: 8, params: {} });
    expect(body).toEqual({ service: 'beat-drop', video_url: 'https://x/a.mp4', audio_url: 'https://x/s.mp3', duration: 8 });
    expect(snippets({ service: 'beat-drop', video_url: 'https://x/a.mp4', audio_url: 'https://x/s.mp3', params: {} }, 'beat_drop_video').cli).toContain("--audio 'https://x/s.mp3'");
    expect(productionTool('beat-drop-fx')!.audio).toBe('required');
    expect(productionTool('motion-score')!.audio).toBe('optional');
  });

  test('demos resolve to the service folder for locked variants', () => {
    expect(demoMedia(productionTool('lightning-fx')!, 0).output).toEndWith('/motion-fx/3-output.mp4');
    expect(demoMedia(productionTool('motion-tracker')!, 1).poster).toEndWith('/motion-track/2-poster.jpg');
    expect(demoMedia(productionTool('motion-score')!, 0).input).toEndWith('/motion-score/1-input.mp4');
  });

  test('pages, catalog, sitemap and footer', () => {
    const catalog = read('lib/tools-catalog.ts');
    const sitemap = read('app/sitemap.ts');
    const footer = read('lib/footer-links.ts');
    for (const tool of MOTION_TOOLS) {
      expect(read(`app/tools/${tool.slug}/page.tsx`)).toContain(`slug="${tool.slug}"`);
      expect(catalog).toContain(`href: '/tools/${tool.slug}'`);
      expect(sitemap).toContain(`'${tool.slug}'`);
      expect(footer).toContain(`'/tools/${tool.slug}'`);
    }
  });

  test('public copy names no third-party models', () => {
    const copy = JSON.stringify(MOTION_TOOLS);
    for (const vendor of ['LTX', 'Lightricks', 'YOLO', 'RTMPose', 'MMPose', 'MiniMax', 'FLUX']) expect(copy).not.toContain(vendor);
    expect(copy).not.toMatch(/\b(SAM|H3|fal)\b/);
  });
});

describe('motion tools: edge cases and server parity', () => {
  const goMotion = readFileSync(join(ROOT, 'server/prodkit_motion.go'), 'utf8');
  const goSitemap = readFileSync(join(ROOT, 'server/sitemap.go'), 'utf8');
  const goList = (name: string) => [...(new RegExp(`${name} = \\[\\]string\\{([^}]*)\\}`).exec(goMotion)?.[1] || '').matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const fxPresets = (() => {
    const control = productionTool('motion-fx')!.controls.find((c) => c.key === 'preset');
    return control && control.type === 'select' ? control.options.map((o) => o[0]) : [];
  })();

  test('rounding: fractional, zero, negative and NaN durations', () => {
    expect(productionPriceUSD(req('motion-fx', { duration: 2.2 }))).toBe(0.18);
    expect(productionPriceUSD(req('motion-fx', { duration: 0 }))).toBe(0.30);
    expect(productionPriceUSD(req('motion-fx', { duration: -4 }))).toBe(0.30);
    expect(productionPriceUSD(req('motion-track', { duration: 0.2 }))).toBe(0.05);
    expect(productionPriceUSD(req('motion-score', { duration: 30.4 }))).toBe(1.50);
    for (const [service, rule] of Object.entries(MOTION_PRICING)) {
      expect(productionPriceUSD(req(service as ProductionRequest['service'], { duration: rule.max + 500 }))).toBe(Math.round(rule.rate * rule.max * 100) / 100);
      expect(isMotionService(service)).toBe(true);
    }
    expect(isMotionService('shot-cleanup')).toBe(false);
  });

  test('prices and caps in the docs strings match the pricing table and the server', () => {
    for (const tool of MOTION_TOOLS) {
      const rule = MOTION_PRICING[tool.service as keyof typeof MOTION_PRICING];
      expect(tool.priceDoc).toBe(`$${rule.rate.toFixed(2)} / s (min $${rule.min.toFixed(2)}, max ${rule.max} s)`);
    }
    for (const [service, rule] of Object.entries(MOTION_PRICING)) {
      expect(goMotion).toContain(String(rule.max));
      expect(server).toContain(`"${service}"`);
    }
  });

  test('every motion param is allowed by the server and every preset is a server preset', () => {
    const lines = server.split('\n');
    for (const tool of MOTION_TOOLS) {
      const index = lines.findIndex((line) => line.includes(`"${tool.service}", "`));
      expect(index).toBeGreaterThan(-1);
      const allowed = [...lines[index + 1].matchAll(/"(\w+)"/g)].map((match) => match[1]);
      const params = controlParams(tool.controls, { ...controlDefaults(tool.controls), names: 'A', slowmo: 'true', sfx: 'true', text: 'true', seed: '5', keep_audio: true, intensity: 1.1 });
      for (const key of [...Object.keys(params), ...Object.keys(tool.fixedParams || {})]) expect(allowed).toContain(key);
    }
    const serverPresets = goList('prodkitMotionPresets');
    expect(serverPresets.length).toBeGreaterThan(5);
    for (const preset of fxPresets) expect(serverPresets).toContain(preset);
    for (const tool of MOTION_TOOLS) if (tool.fixedParams?.preset) expect(serverPresets).toContain(tool.fixedParams.preset as string);
    const palettes = productionTool('motion-fx')!.controls.find((c) => c.key === 'palette');
    const options = palettes && palettes.type === 'select' ? palettes.options.map((o) => o[0]).filter(Boolean) : [];
    expect(goList('prodkitMotionPalettes').sort()).toEqual([...options].sort());
  });

  test('intensity control bounds match the server clamp', () => {
    const control = productionTool('motion-fx')!.controls.find((c) => c.key === 'intensity');
    expect(control && control.type === 'range' ? [control.min, control.max] : []).toEqual([0.3, 1.6]);
    expect(goMotion).toContain('math.Max(0.3, math.Min(1.6');
  });

  test('locked variants: one preset each, unique slugs, demos map to existing indexes', () => {
    const slugs = MOTION_TOOLS.map((tool) => tool.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const variants = MOTION_TOOLS.filter((tool) => tool.variantOf === 'motion-fx');
    expect(variants.map((tool) => tool.fixedParams?.preset)).toEqual(['anime-fight', 'ki-aura', 'lightning', 'game-hud', 'exaggerate', 'echo', 'anime-fight']);
    const parent = productionTool('motion-fx')!;
    for (const tool of variants) {
      expect(tool.service).toBe('motion-fx');
      expect(tool.controls.map((c) => c.key)).not.toContain('preset');
      for (const key of Object.keys(tool.fixedParams || {})) expect(tool.controls.map((c) => c.key)).not.toContain(key);
      expect(tool.demos).toHaveLength(1);
      expect(tool.demoIndexes).toHaveLength(1);
      const index = tool.demoIndexes![0];
      expect(parent.demos[index - 1].caption).toBe(tool.demos[0].caption);
      expect(demoMedia(tool, 0).output).toEndWith(`/motion-fx/${index}-output.mp4`);
      expect(demoMedia(tool, 0).input).toEndWith(`/motion-fx/${index}-input.mp4`);
    }
    for (const tool of MOTION_TOOLS) expect(demoMedia(tool, 0).poster.startsWith(PRODUCTION_DEMO_BASE)).toBe(true);
  });

  test('new presets travel as locked params and reach the CLI, MCP and API', () => {
    for (const [slug, preset] of [['motion-exaggerate-fx', 'exaggerate'], ['afterimage-fx', 'echo']] as const) {
      const tool = productionTool(slug)!;
      const params = { ...controlParams(tool.controls, { ...controlDefaults(tool.controls), intensity: 1.4 }), ...tool.fixedParams };
      expect(params).toEqual({ intensity: 1.4, preset });
      const input: ProductionRequest = { service: 'motion-fx', video_url: 'https://x/a.mp4', duration: 6, params };
      expect(apiBody(input)).toEqual({ service: 'motion-fx', video_url: 'https://x/a.mp4', duration: 6, params });
      expect(mcpArguments(input)).toEqual({ video_url: 'https://x/a.mp4', duration: 6, intensity: 1.4, preset });
      expect(cliCommand(input)).toContain(`--video 'https://x/a.mp4' --duration 6 --params`);
      expect(productionPriceUSD(input)).toBe(0.36);
      expect(mcp).toContain(`Name: "${tool.mcp}"`);
      expect(goSitemap).toContain(`"/tools/${slug}"`);
    }
    for (const tool of MOTION_TOOLS) expect(goSitemap).toContain(`"/tools/${tool.slug}"`);
  });

  test('control param edge cases: seeds, names, tri-state and palettes', () => {
    const controls = productionTool('motion-fx')!.controls;
    expect(controlParams(controls, { seed: 'abc' }).seed).toBeUndefined();
    expect(controlParams(controls, { seed: '12.9' }).seed).toBe(12);
    expect(controlParams(controls, { names: 'a,b,c,d,e,f' }).names).toEqual(['a', 'b', 'c', 'd']);
    expect(controlParams(controls, { names: 'x'.repeat(40) }).names).toEqual(['x'.repeat(16)]);
    expect(controlParams(controls, { slowmo: 'maybe' }).slowmo).toBeUndefined();
    const palette = [{ key: 'palette', label: 'P', type: 'palette' as const, default: ['#111111'] }];
    expect(controlParams(palette, { palette: ['#1', 2, '#3', '#4', '#5', '#6', '#7', '#8', '#9', '#10'] }).palette).toEqual(['#1', '#3', '#4', '#5', '#6', '#7', '#8', '#9']);
    expect(controlParams(palette, { palette: [] }).palette).toBeUndefined();
    const defaults = controlDefaults(palette);
    (defaults.palette as string[]).push('#222222');
    expect(palette[0].default).toEqual(['#111111']);
  });

  test('audio slots: beat-drop requires, score is optional, others have none', () => {
    expect(MOTION_TOOLS.filter((tool) => tool.audio).map((tool) => [tool.slug, tool.audio])).toEqual([['motion-fx', 'optional'], ['beat-drop-fx', 'required'], ['motion-score', 'optional']]);
    expect(snippets({ service: 'motion-score', video_url: 'https://x/a.mp4', params: { keep_audio: true } }, 'score_motion_video').mcp).toBe('score_motion_video({"video_url":"https://x/a.mp4","keep_audio":true})');
  });

  test('small helpers', () => {
    expect(modelContentType('Chair.GLB')).toBe('model/gltf-binary');
    expect(modelContentType('x.obj')).toBe('model/obj');
    expect(modelContentType('x.zip')).toBe('');
    expect(modelContentType('noext')).toBe('');
    expect(posterPlaceholder('motion-fx')).toBe(`${PRODUCTION_DEMO_BASE}/motion-fx/1-poster.jpg`);
  });

  test('reframe: aspect control matches the server enum, and the reframe page locks 9:16', () => {
    const aspects = goList('prodkitMotionAspects');
    for (const slug of ['motion-fx', 'beat-drop-fx', 'anime-fight-fx']) {
      const control = productionTool(slug)!.controls.find((c) => c.key === 'aspect');
      expect(control && control.type === 'select' ? control.options.map((o) => o[0]).filter(Boolean) : []).toEqual(aspects);
      expect(controlParams(productionTool(slug)!.controls, controlDefaults(productionTool(slug)!.controls)).aspect).toBeUndefined();
      expect(controlParams(productionTool(slug)!.controls, { aspect: '4:5' }).aspect).toBe('4:5');
    }
    const reel = productionTool('fight-reel-reframe')!;
    expect(reel.fixedParams).toEqual({ preset: 'anime-fight', aspect: '9:16' });
    expect(reel.controls.map((c) => c.key)).not.toContain('aspect');
    expect(reel.controls.map((c) => c.key)).toContain('intensity');
    expect(demoMedia(reel, 0).output).toEndWith('/motion-fx/9-output.mp4');
    expect(productionTool('motion-score')!.controls.some((c) => c.key === 'aspect')).toBe(false);
    expect(productionTool('motion-tracker')!.controls.some((c) => c.key === 'aspect')).toBe(false);
  });
});

describe('fight stats formatting', () => {
  const stats = {
    fighters: {
      2: { strikes: 3, impacts: 1, hits_taken: 2, avg_power: 0.8, top_speed: 2.1, best_combo: 1, active_seconds: 4.9 },
      1: { strikes: 4, impacts: 2, hits_taken: 1, avg_power: 1.104, top_speed: 3.449, best_combo: 2, active_seconds: 5 },
    },
    total_strikes: 7, total_impacts: 3, peak_intensity_t: 2.14, bpm: 84.7, most_active: '1',
  };

  test('orders fighters by id, formats numbers and flags the most active', () => {
    const view = formatFightStats(stats)!;
    expect(view.rows.map((row) => row.id)).toEqual(['1', '2']);
    expect(view.rows[0]).toEqual({ id: '1', label: 'Fighter 1', strikes: 4, impacts: 2, hitsTaken: 1, avgPower: '1.10', topSpeed: '3.4', bestCombo: 2, activeSeconds: '5.0', mostActive: true });
    expect(view.rows[1].mostActive).toBe(false);
    expect(view.totals).toEqual({ strikes: 7, impacts: 3, peakAt: '2.1', bpm: '85' });
  });

  test('uses entered names by track id and falls back for blanks', () => {
    expect(formatFightStats(stats, ['Sensei', '  '])!.rows.map((row) => row.label)).toEqual(['Sensei', 'Fighter 2']);
    expect(formatFightStats(stats, [])!.rows[0].label).toBe('Fighter 1');
  });

  test('derives totals when missing and hides tempo when unknown', () => {
    const view = formatFightStats({ fighters: stats.fighters, bpm: 0 })!;
    expect(view.totals).toEqual({ strikes: 7, impacts: 3, peakAt: '0.0', bpm: '' });
  });

  test('is defensive about malformed or empty payloads', () => {
    for (const bad of [null, undefined, 'x', 3, [], {}, { fighters: {} }, { fighters: { 1: null } }, { fighters: [] }]) expect(formatFightStats(bad)).toBeNull();
    const view = formatFightStats({ fighters: { x: { strikes: -2, impacts: Number.NaN, avg_power: 'high', top_speed: Infinity, best_combo: 2.6 } } })!;
    expect(view.rows[0]).toMatchObject({ id: 'x', label: 'Fighter x', strikes: 0, impacts: 0, avgPower: '0.00', topSpeed: '0.0', bestCombo: 3, mostActive: false });
  });

  test('caps the table at eight fighters', () => {
    const fighters = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), { strikes: i }]));
    expect(formatFightStats({ fighters })!.rows).toHaveLength(8);
    expect(formatFightStats({ fighters })!.rows.map((row) => row.id)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
  });
});
