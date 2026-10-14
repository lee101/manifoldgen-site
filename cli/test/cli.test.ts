import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { coerce, parseArgs } from '../src/args';
import { downloadAll, mediaUrls } from '../src/media';
import { buildServiceBody, localFiles, mcpSnippets, run, type Io } from '../src/main';
import { readConfig, writeConfig } from '../src/config';

type Route = (url: string, init?: RequestInit) => Response | Promise<Response>;

const realFetch = globalThis.fetch;
let dir = '';
let calls: { url: string; init?: RequestInit }[] = [];

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function harness(routes: Record<string, Route>, env: Record<string, string> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const opened: string[] = [];
  const io: Io = {
    env: { MANIFOLDGEN_CONFIG_DIR: dir, MANIFOLDGEN_BASE_URL: 'https://mg.test', ...env },
    fetch: async (url, init) => {
      calls.push({ url, init });
      const key = Object.keys(routes).find((k) => {
        const [method, path] = k.split(' ');
        return (init?.method || 'GET') === method && url.split('?')[0].endsWith(path);
      });
      if (!key) return json({ error: `unmocked ${init?.method || 'GET'} ${url}` }, 599);
      return routes[key](url, init);
    },
    out: (s) => out.push(s),
    err: (s) => err.push(s),
    open: (u) => opened.push(u),
    prompt: () => new Promise(() => {}),
    sleep: async () => {},
  };
  return { io, out, err, opened };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mg-cli-'));
  calls = [];
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('args', () => {
  test('parses flags, repeats, positionals and booleans', () => {
    const p = parseArgs(['generate', 'video', '--prompt', 'rain', '--duration=5', '--wait', '--ref-image', 'a.png', '--ref-image', 'b.png', '-o', 'out', '--json']);
    expect(p._).toEqual(['generate', 'video']);
    expect(p.flags).toEqual({ prompt: 'rain', duration: '5', wait: true, 'ref-image': ['a.png', 'b.png'], out: 'out', json: true });
  });

  test('coerces values', () => {
    expect(coerce('5')).toBe(5);
    expect(coerce('true')).toBe(true);
    expect(coerce('16:9')).toBe('16:9');
    expect(coerce('["a"]')).toEqual(['a']);
    expect(coerce('1234567890123456789')).toBe('1234567890123456789');
  });
});

describe('service body', () => {
  test('maps aliases and dashes', () => {
    const body = buildServiceBody('video', parseArgs(['--prompt', 'x', '--aspect-ratio', '16:9', '--duration', '5', '--image', 'a.png', '--ref-video', 'https://x/v.mp4,c.mp4', '--wait']).flags, []);
    expect(body).toEqual({ service: 'video', prompt: 'x', aspect_ratio: '16:9', duration: 5, image_url: 'a.png', reference_video_urls: ['https://x/v.mp4', 'c.mp4'] });
    expect(localFiles(body)).toEqual(['a.png', 'c.mp4']);
  });

  test('params, model and repeated models', () => {
    const body = buildServiceBody('destruction-studio', parseArgs(['--model', 'vase.glb', '--param', 'pieces=80', '--param', 'impact=ball', '--params', '{"quality":"draft"}']).flags, []);
    expect(body).toEqual({ service: 'destruction-studio', model_url: 'vase.glb', params: { pieces: 80, impact: 'ball', quality: 'draft' } });
    const scene = buildServiceBody('blender-scene', parseArgs(['--model', 'a.glb', '--model', 'https://x/b.obj']).flags, []);
    expect(scene.model_urls).toEqual(['a.glb', 'https://x/b.obj']);
    expect(localFiles(scene)).toEqual(['a.glb']);
  });

  test('--model keeps model selectors that are not 3D files', () => {
    expect(buildServiceBody('video', parseArgs(['--model', 'minimax/h3-max/text-to-video']).flags, [])).toEqual({ service: 'video', model: 'minimax/h3-max/text-to-video' });
  });

  test('bad params exit 2', async () => {
    const h = harness({}, { MANIFOLDGEN_API_KEY: 'k' });
    expect(await run(['generate', 'vectorize', '--params', '{bad'], h.io)).toBe(2);
  });

  test('uses positional prompt', () => {
    expect(buildServiceBody('image', {}, ['a', 'cat'])).toEqual({ service: 'image', prompt: 'a cat' });
  });
});

describe('mediaUrls', () => {
  test('prefers saved image urls', () => {
    expect(mediaUrls({ result: { data: [{ url: 'https://p/x.png' }] }, saved_image_urls: ['https://cdn/a.png'] })).toEqual(['https://cdn/a.png']);
  });

  test('walks nested results and skips status urls', () => {
    const urls = mediaUrls({ video_url: 'https://cdn/v.mp4', status_url: 'https://mg/api/video-jobs/1.json', files: [{ url: 'https://cdn/scene.blend' }, 'https://cdn/grade.cube'], page: 'https://mg/x' });
    expect(urls).toEqual(['https://cdn/v.mp4', 'https://cdn/scene.blend', 'https://cdn/grade.cube']);
  });
});

describe('downloads', () => {
  test('never overwrite existing files', async () => {
    writeFileSync(join(dir, 'a.png'), 'old');
    writeFileSync(join(dir, '1-a.png'), 'old1');
    const saved = await downloadAll(async () => new Response('new'), ['https://c/a.png', 'https://c/x/a.png'], dir);
    expect(saved).toEqual([join(dir, '2-a.png'), join(dir, '3-a.png')]);
    expect(readFileSync(join(dir, '1-a.png'), 'utf8')).toBe('old1');
  });
});

describe('commands', () => {
  test('help', async () => {
    const h = harness({});
    expect(await run([], h.io)).toBe(0);
    expect(h.out[0]).toContain('mg generate');
  });

  test('services lists prices', async () => {
    const h = harness({ 'GET /api/pricing': () => json({ pricing: [{ service: 'image', price_usd: 0.04, unit: 'per image' }, { service: 'video', price_usd: 1.01 }] }) });
    expect(await run(['services', '--json'], h.io)).toBe(0);
    expect(JSON.parse(h.out[0])).toEqual([{ service: 'image', price_usd: 0.04, unit: 'per image' }, { service: 'video', price_usd: 1.01 }]);
    expect(calls[0].init?.headers).not.toHaveProperty('Authorization');
  });

  test('pricing for one service accepts underscores', async () => {
    const h = harness({ 'GET /api/pricing': () => json({ pricing: [{ service: 'orbit-video', price_usd: 0.5, unit: 'per clip' }] }) });
    expect(await run(['pricing', 'orbit_video'], h.io)).toBe(0);
    expect(h.out[0]).toBe('orbit-video  $0.50  per clip');
  });

  test('generate requires a key', async () => {
    const h = harness({});
    expect(await run(['generate', 'image', '--prompt', 'x', '--json'], h.io)).toBe(1);
    expect(JSON.parse(h.out[0])).toMatchObject({ error: 'Not signed in.', status: 401 });
  });

  test('generate sync image downloads outputs', async () => {
    const out = join(dir, 'out');
    const h = harness(
      {
        'POST /api/service': () => json({ result: {}, usd_equivalent: 0.04, saved_image_urls: ['https://cdn.test/img/a.png'] }),
        'GET /img/a.png': () => new Response('PNG'),
      },
      { MANIFOLDGEN_API_KEY: 'sk-mg-1' },
    );
    expect(await run(['generate', 'image', '--prompt', 'koi', '--width', '1024', '--out', out, '--json'], h.io)).toBe(0);
    const res = JSON.parse(h.out[0]);
    expect(res.outputs).toEqual(['https://cdn.test/img/a.png']);
    expect(readFileSync(join(out, 'a.png'), 'utf8')).toBe('PNG');
    const sent = JSON.parse(String(calls[0].init?.body));
    expect(sent).toEqual({ service: 'image', prompt: 'koi', width: 1024 });
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer sk-mg-1');
  });

  test('generate uploads local file, queues and polls', async () => {
    const file = join(dir, 'clip.mp4');
    writeFileSync(file, 'MP4');
    let polls = 0;
    const h = harness(
      {
        'POST /api/studio/assets/presign': (_u, init) => {
          const b = JSON.parse(String(init?.body));
          expect(b).toMatchObject({ filename: 'clip.mp4', content_type: 'video/mp4', size: 3 });
          return json({ upload_url: 'https://r2.test/put', public_url: 'https://cdn.test/clip.mp4' });
        },
        'PUT /put': () => new Response('', { status: 200 }),
        'POST /api/service': (_u, init) => {
          expect(JSON.parse(String(init?.body)).video_url).toBe('https://cdn.test/clip.mp4');
          return json({ result: { job_id: 'j1', status: 'queued', status_url: '/api/video-jobs/j1' }, estimated_cost_usd: 1 }, 202);
        },
        'GET /api/video-jobs/j1': () =>
          ++polls < 3
            ? json({ job: { job_id: 'j1', status: 'processing' } }, 202)
            : json({ job: { job_id: 'j1', status: 'completed', charged_usd: 0.9, result: { video_url: 'https://cdn.test/out.mp4', blend_url: 'https://cdn.test/scene.blend', poster_url: 'https://cdn.test/p.jpg' } } }),
      },
      { MANIFOLDGEN_API_KEY: 'k' },
    );
    expect(await run(['generate', 'destruction-studio', '--video', file, '--wait'], h.io)).toBe(0);
    expect(polls).toBe(3);
    expect(h.out.join('\n')).toBe('job j1 completed  $0.90\nhttps://cdn.test/out.mp4\nhttps://cdn.test/scene.blend\nhttps://cdn.test/p.jpg');
    expect(h.err).toContain('j1 processing');
  });

  test('generate without wait returns job id', async () => {
    const h = harness({ 'POST /api/service': () => json({ result: { job_id: 'j2', status: 'queued' }, estimated_cost_usd: 0.5 }, 202) }, { MANIFOLDGEN_API_KEY: 'k' });
    expect(await run(['generate', 'orbit-video', '--image', 'https://x/a.png'], h.io)).toBe(0);
    expect(h.out[0]).toBe('queued job j2  est $0.50\nmg job j2 --wait');
  });

  test('dry run does not spend', async () => {
    const h = harness({ 'GET /api/pricing': () => json({ pricing: [{ service: 'video', price_usd: 1.01, unit: 'per video' }] }) });
    expect(await run(['generate', 'video', '--prompt', 'x', '--image', 'local.png', '--dry-run', '--json'], h.io)).toBe(0);
    expect(JSON.parse(h.out[0])).toMatchObject({ dry_run: true, uploads: ['local.png'], price: { price_usd: 1.01 } });
    expect(calls.every((c) => !c.url.includes('/api/service'))).toBe(true);
  });

  test('failed job exits 1 with error', async () => {
    const h = harness({ 'GET /api/video-jobs/j3': () => json({ job: { job_id: 'j3', status: 'failed', error: 'generation failed' } }) }, { MANIFOLDGEN_API_KEY: 'k' });
    expect(await run(['job', 'j3'], h.io)).toBe(1);
    expect(h.out[0]).toContain('error: generation failed');
  });

  test('402 shows credit hint', async () => {
    const h = harness({ 'POST /api/service': () => json({ error: 'insufficient credits' }, 402) }, { MANIFOLDGEN_API_KEY: 'k' });
    expect(await run(['generate', 'video', '--prompt', 'x'], h.io)).toBe(1);
    expect(h.err[0]).toContain('insufficient credits');
    expect(h.err[0]).toContain('/account');
  });

  test('search resolves relative urls', async () => {
    const h = harness({ 'GET /api/images/semantic': (u) => {
      expect(u).toContain('q=glass%20house');
      return json({ results: [{ image_url: '/images/a.png', prompt: 'glass' }] });
    } });
    expect(await run(['search', 'glass', 'house'], h.io)).toBe(0);
    expect(h.out[0]).toBe('https://mg.test/images/a.png  glass');
  });

  test('jobs lists audio jobs', async () => {
    const h = harness({ 'GET /api/audio-jobs': () => json({ jobs: [{ job_id: 'a1', status: 'completed', service: 'music', prompt: 'lofi' }] }) }, { MANIFOLDGEN_API_KEY: 'k' });
    expect(await run(['jobs', '--kind', 'audio', '--json'], h.io)).toBe(0);
    expect(JSON.parse(h.out[0])[0].job_id).toBe('a1');
  });

  test('mcp config snippets', () => {
    const s = mcpSnippets('https://manifoldgen.com');
    expect(s.claude).toBe('claude mcp add --transport http manifoldgen https://manifoldgen.com/api/mcp --header "Authorization: Bearer $MANIFOLDGEN_API_KEY"');
    expect(s.codex).toContain('bearer_token_env_var = "MANIFOLDGEN_API_KEY"');
    expect(s.cursor.mcpServers.manifoldgen.headers.Authorization).toBe('Bearer ${env:MANIFOLDGEN_API_KEY}');
  });
});

describe('auth', () => {
  test('login via browser callback verifies state and stores key 0600', async () => {
    const h = harness({ 'GET /api/auth/session': (_u, init) => {
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer sk-mg-new');
      return json({ user: { email: 'a@b.c' }, credits_usd: 3 });
    } });
    h.io.open = async (u) => {
      const url = new URL(u);
      expect(url.origin + url.pathname).toBe('https://mg.test/cli-auth');
      const port = url.searchParams.get('port');
      const state = url.searchParams.get('state')!;
      const bad = await realFetch(`http://127.0.0.1:${port}/callback?state=nope&key=evil`, { redirect: 'manual' });
      expect(bad.status).toBe(400);
      const ok = await realFetch(`http://127.0.0.1:${port}/callback?state=${encodeURIComponent(state)}&key=sk-mg-new`, { redirect: 'manual' });
      expect(ok.status).toBe(302);
      expect(ok.headers.get('location')).toBe('https://mg.test/cli-auth?status=done');
    };
    expect(await run(['auth', 'login'], h.io)).toBe(0);
    expect(readConfig(h.io.env)).toEqual({ api_key: 'sk-mg-new', email: 'a@b.c' });
    expect(statSync(join(dir, 'config.json')).mode & 0o777).toBe(0o600);
    expect(h.out[0]).toContain('Signed in as a@b.c');
  });

  test('login --no-browser accepts pasted key', async () => {
    const h = harness({ 'GET /api/auth/session': () => json({ user: { email: 'p@q.r' } }) });
    h.io.prompt = async () => '  sk-mg-paste \n';
    expect(await run(['auth', 'login', '--no-browser'], h.io)).toBe(0);
    expect(h.opened).toEqual([]);
    expect(h.err[0]).toContain('paste=1');
    expect(readConfig(h.io.env).api_key).toBe('sk-mg-paste');
  });

  test('login rejects invalid key', async () => {
    const h = harness({ 'GET /api/auth/session': () => json({ error: 'invalid API key' }, 401) });
    h.io.prompt = async () => 'bad';
    expect(await run(['auth', 'login', '--no-browser'], h.io)).toBe(1);
    expect(existsSync(join(dir, 'config.json'))).toBe(false);
  });

  test('login times out', async () => {
    const h = harness({});
    h.io.loginTimeoutMs = 20;
    expect(await run(['auth', 'login'], h.io)).toBe(1);
    expect(h.err.at(-1)).toContain('timed out');
  });

  test('status, env override and logout', async () => {
    writeConfig({ MANIFOLDGEN_CONFIG_DIR: dir }, { api_key: 'stored', email: 'a@b.c' });
    const h = harness({ 'GET /api/auth/session': (_u, init) => json({ user: { email: (init?.headers as Record<string, string>).Authorization }, credits_usd: 2.5 }) });
    expect(await run(['auth', 'status', '--json'], h.io)).toBe(0);
    expect(JSON.parse(h.out[0])).toMatchObject({ signed_in: true, source: 'config', email: 'Bearer stored', credits_usd: 2.5 });
    const e = harness({ 'GET /api/auth/session': (_u, init) => json({ user: { email: (init?.headers as Record<string, string>).Authorization } }) }, { MANIFOLDGEN_API_KEY: 'envkey' });
    expect(await run(['auth', 'status', '--json'], e.io)).toBe(0);
    expect(JSON.parse(e.out[0])).toMatchObject({ source: 'env', email: 'Bearer envkey' });
    expect(await run(['auth', 'logout'], h.io)).toBe(0);
    expect(existsSync(join(dir, 'config.json'))).toBe(false);
    const n = harness({});
    expect(await run(['auth', 'status'], n.io)).toBe(1);
    expect(n.out[0]).toContain('Not signed in');
  });
});
