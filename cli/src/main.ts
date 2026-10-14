import { resolve } from 'node:path';
import { parseArgs, coerce, flagList, flagString, type FlagValue } from './args';
import { Api, ApiError, hintFor, type Fetch } from './api';
import { clearConfigKey, configPath, readConfig, resolveCredentials, writeConfig, type Env } from './config';
import { newState, startCallbackServer } from './auth';
import { downloadAll, isRemote, mediaUrls, uploadFile } from './media';

export const VERSION = '0.1.0';

export interface Io {
  env: Env;
  fetch: Fetch;
  out: (s: string) => void;
  err: (s: string) => void;
  open: (url: string) => void;
  prompt: (question: string) => Promise<string>;
  sleep: (ms: number) => Promise<void>;
  loginTimeoutMs?: number;
}

interface Ctx {
  io: Io;
  api: Api;
  flags: Record<string, FlagValue>;
  args: string[];
  json: boolean;
}

class UsageError extends Error {}

export const HELP = `manifoldgen (mg) ${VERSION} - ManifoldGen from the terminal

Usage
  mg auth login [--no-browser]      Approve this computer in the browser, store a key
  mg auth status | logout | token
  mg pricing [service]              Live prices
  mg services                       Service names with prices
  mg generate <service> [--prompt ..] [--image|--video|--audio|--model f|url]
              [--param k=v ...] [--params '{json}'] [--key=value ...]
              [--wait] [--out dir] [--dry-run]
  mg job <id> [--wait] [--out dir]
  mg jobs [--kind video|audio] [--limit n]
  mg search <query> [--kind images|videos|audio] [--limit n]
  mg mcp config [--client claude|codex|cursor] [--show-key]

Global
  --json                 Machine-readable output for agents
  MANIFOLDGEN_API_KEY    Overrides the stored key
  MANIFOLDGEN_BASE_URL   Defaults to https://manifoldgen.com

Examples
  mg generate image --prompt "neon koi, ink wash" --width 1024 --height 1024 --out .
  mg generate video --prompt "rain on a glass roof" --duration 5 --wait --out clips
  mg generate destruction-studio --image vase.png --param pieces=80 --param impact=ball --wait --out fx
  mg generate vectorize --image logo.png --wait --out vector`;

const ACTIVE = new Set(['queued', 'pending', 'processing', 'running', 'starting', 'in_progress', 'submitted']);
const MEDIA_ALIASES: Record<string, string> = {
  image: 'image_url', video: 'video_url', audio: 'audio_url', mask: 'mask_url', model: 'model_url', models: 'model_urls',
  'first-frame': 'first_frame', 'last-frame': 'last_frame',
  'ref-image': 'reference_image_urls', 'ref-video': 'reference_video_urls', 'ref-audio': 'reference_audio_urls',
};
const RESERVED = new Set(['json', 'wait', 'out', 'dry-run', 'help', 'version', 'timeout', 'interval', 'yes', 'quiet']);

export async function run(argv: string[], io: Io): Promise<number> {
  const { _: args, flags } = parseArgs(argv);
  const json = flags.json === true;
  const creds = resolveCredentials(io.env);
  const api = new Api(creds.baseUrl, creds.apiKey, io.fetch);
  const ctx: Ctx = { io, api, flags, args, json };
  try {
    if (flags.version === true && !args.length) {
      io.out(VERSION);
      return 0;
    }
    const [cmd, sub] = args;
    if (!cmd || cmd === 'help' || flags.help === true) {
      io.out(HELP);
      return 0;
    }
    switch (cmd) {
      case 'auth':
        if (sub === 'login') return await login(ctx);
        if (sub === 'status') return await authStatus(ctx);
        if (sub === 'logout') return authLogout(ctx);
        if (sub === 'token') return authToken(ctx);
        throw new UsageError('Usage: mg auth login|status|logout|token');
      case 'login':
        return await login(ctx);
      case 'logout':
        return authLogout(ctx);
      case 'pricing':
        return await pricing(ctx, sub);
      case 'services':
        return await services(ctx);
      case 'generate':
      case 'gen':
        return await generate(ctx);
      case 'job':
        return await job(ctx);
      case 'jobs':
        return await jobs(ctx);
      case 'search':
        return await search(ctx);
      case 'mcp':
        if (!sub || sub === 'config') return mcpConfig(ctx);
        throw new UsageError('Usage: mg mcp config [--client claude|codex|cursor]');
      default:
        throw new UsageError(`Unknown command: ${cmd}. Run \`mg help\`.`);
    }
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    const message = (err as Error).message || String(err);
    const hint = hintFor(status);
    if (json) io.out(JSON.stringify({ error: message, status: status || undefined, hint: hint || undefined }));
    else io.err(`error: ${message}${hint ? `\n${hint}` : ''}`);
    return err instanceof UsageError ? 2 : 1;
  }
}

function emit(ctx: Ctx, data: unknown, text: string | string[]) {
  if (ctx.json) ctx.io.out(JSON.stringify(data, null, 2));
  else ctx.io.out(Array.isArray(text) ? text.join('\n') : text);
}

function usd(n: unknown): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return '-';
  return `$${v.toFixed(3).replace(/0$/, '')}`;
}

function normService(s: string): string {
  return s.trim().toLowerCase().replace(/_/g, '-');
}

async function login(ctx: Ctx): Promise<number> {
  const { io } = ctx;
  const noBrowser = ctx.flags['no-browser'] === true;
  const state = newState();
  const base = ctx.api.baseUrl;
  const server = await startCallbackServer(state, `${base}/cli-auth?status=done`);
  const url = `${base}/cli-auth?port=${server.port}&state=${encodeURIComponent(state)}${noBrowser ? '&paste=1' : ''}`;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    if (noBrowser) io.err(`Open this URL in any browser and approve:\n  ${url}\nThen paste the key it shows.`);
    else {
      io.err(`Opening browser to approve this computer...\n  ${url}`);
      io.open(url);
    }
    const sources: Promise<string>[] = [server.key];
    if (noBrowser) sources.push(io.prompt('API key: ').then((k) => k.trim() || new Promise<string>(() => {})));
    sources.push(
      new Promise<string>((_, reject) => {
        timer = setTimeout(() => reject(new ApiError('Login timed out. Run `mg auth login` again.', 0)), io.loginTimeoutMs ?? 300_000);
      }),
    );
    const key = await Promise.race(sources);
    if (!key) throw new ApiError('No key received.', 0);
    const session = await new Api(base, key, io.fetch).raw('GET', '/api/auth/session');
    if (session.status !== 200) throw new ApiError('That key was rejected by ManifoldGen.', 401);
    const email: string | undefined = session.data?.user?.email || undefined;
    const config = readConfig(io.env);
    writeConfig(io.env, { ...config, api_key: key, email });
    if (io.env.MANIFOLDGEN_API_KEY && !ctx.json) io.err('note: MANIFOLDGEN_API_KEY is set and overrides the stored key.');
    emit(ctx, { signed_in: true, email, config_path: configPath(io.env) }, `Signed in${email ? ` as ${email}` : ''}. Key saved to ${configPath(io.env)}`);
    return 0;
  } finally {
    if (timer) clearTimeout(timer);
    server.close();
  }
}

async function authStatus(ctx: Ctx): Promise<number> {
  const creds = resolveCredentials(ctx.io.env);
  if (!creds.apiKey) {
    emit(ctx, { signed_in: false, base_url: creds.baseUrl }, 'Not signed in. Run `mg auth login`.');
    return 1;
  }
  const session = await ctx.api.raw('GET', '/api/auth/session');
  if (session.status === 401) {
    emit(ctx, { signed_in: false, source: creds.source, error: 'invalid API key' }, `Stored key (${creds.source}) is invalid. Run \`mg auth login\`.`);
    return 1;
  }
  if (session.status >= 400) throw new ApiError(session.data?.error || `HTTP ${session.status}`, session.status);
  const email = session.data?.user?.email;
  const credits = session.data?.credits_usd;
  emit(
    ctx,
    { signed_in: true, source: creds.source, email, credits_usd: credits, base_url: creds.baseUrl, config_path: configPath(ctx.io.env) },
    `Signed in${email ? ` as ${email}` : ''} (${creds.source === 'env' ? 'MANIFOLDGEN_API_KEY' : configPath(ctx.io.env)})\nBalance ${usd(credits)}  ${creds.baseUrl}`,
  );
  return 0;
}

function authLogout(ctx: Ctx): number {
  const removed = clearConfigKey(ctx.io.env);
  const envNote = ctx.io.env.MANIFOLDGEN_API_KEY ? ' MANIFOLDGEN_API_KEY is still set in your environment.' : '';
  emit(ctx, { signed_out: true, removed }, (removed ? 'Signed out; stored key removed.' : 'No stored key.') + envNote);
  return 0;
}

function authToken(ctx: Ctx): number {
  ctx.api.requireKey();
  emit(ctx, { api_key: ctx.api.apiKey }, ctx.api.apiKey!);
  return 0;
}

interface PriceRow {
  service: string;
  price_usd: number;
  price_cute?: number;
  unit?: string;
}

async function fetchPricing(api: Api): Promise<{ rows: PriceRow[]; data: any }> {
  const data = await api.request('GET', '/api/pricing', undefined, false);
  return { rows: Array.isArray(data?.pricing) ? data.pricing : [], data };
}

function findPrice(rows: PriceRow[], service: string): PriceRow | undefined {
  const want = normService(service);
  return rows.find((r) => normService(r.service) === want);
}

async function pricing(ctx: Ctx, service?: string): Promise<number> {
  const { rows, data } = await fetchPricing(ctx.api);
  if (service) {
    const row = findPrice(rows, service);
    if (!row) throw new ApiError(`No listed price for ${service}. Run \`mg services\`.`, 404);
    emit(ctx, row, `${row.service}  ${usd(row.price_usd)}  ${row.unit || ''}`.trim());
    return 0;
  }
  const width = Math.max(...rows.map((r) => r.service.length), 8);
  const lines = rows.map((r) => `${r.service.padEnd(width)}  ${usd(r.price_usd).padStart(7)}  ${r.unit || ''}`);
  const credit = data?.credit_price_usd ? `1 credit = ${usd(data.credit_price_usd)}; ` : '';
  emit(ctx, data, [...lines, '', `${credit}video prices are estimates settled from measured time.`]);
  return 0;
}

async function services(ctx: Ctx): Promise<number> {
  const { rows } = await fetchPricing(ctx.api);
  const width = Math.max(...rows.map((r) => r.service.length), 8);
  emit(
    ctx,
    rows.map((r) => ({ service: r.service, price_usd: r.price_usd, unit: r.unit })),
    rows.map((r) => `${r.service.padEnd(width)}  ${usd(r.price_usd).padStart(7)}`),
  );
  return 0;
}

function parseParams(name: string, raw: FlagValue): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const item of Array.isArray(raw) ? raw : [raw]) {
    if (typeof item !== 'string') throw new UsageError(`--${name} needs a value`);
    if (item.trim().startsWith('{')) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(item);
      } catch {
        throw new UsageError(`--${name} is not valid JSON: ${item}`);
      }
      Object.assign(out, parsed);
      continue;
    }
    const eq = item.indexOf('=');
    if (eq < 1) throw new UsageError(`--${name} expects key=value or a JSON object`);
    out[item.slice(0, eq).trim()] = coerce(item.slice(eq + 1));
  }
  return out;
}

export function buildServiceBody(service: string, flags: Record<string, FlagValue>, extra: string[]): Record<string, unknown> {
  const body: Record<string, unknown> = { service };
  if (extra.length && flags.prompt === undefined) body.prompt = extra.join(' ');
  for (const [name, raw] of Object.entries(flags)) {
    if (RESERVED.has(name)) continue;
    if (name === 'params' || name === 'param') {
      body.params = { ...((body.params as Record<string, unknown>) || {}), ...parseParams(name, raw) };
      continue;
    }
    const list = Array.isArray(raw);
    const key = name === 'model' && list ? 'model_urls' : MEDIA_ALIASES[name] || name.replace(/-/g, '_');
    if (key.endsWith('_urls')) {
      const items = (list ? raw : typeof raw === 'string' ? raw.split(',') : []).map((s) => s.trim()).filter(Boolean);
      body[key] = [...((body[key] as string[]) || []), ...items];
    } else if (key.endsWith('_url') || key === 'first_frame' || key === 'last_frame' || key === 'prompt' || key === 'lyrics' || key === 'text') {
      body[key] = list ? raw[raw.length - 1] : raw === true ? '' : raw;
    } else if (list) body[key] = raw.map(coerce);
    else body[key] = typeof raw === 'boolean' ? raw : coerce(raw);
  }
  return body;
}

function isUploadKey(key: string): boolean {
  return key.endsWith('_url') || key.endsWith('_urls') || key === 'first_frame' || key === 'last_frame';
}

export function localFiles(body: Record<string, unknown>): string[] {
  const files: string[] = [];
  for (const [key, value] of Object.entries(body)) {
    if (!isUploadKey(key)) continue;
    for (const v of Array.isArray(value) ? value : [value]) if (typeof v === 'string' && v && !isRemote(v)) files.push(v);
  }
  return files;
}

async function uploadLocal(ctx: Ctx, body: Record<string, unknown>) {
  const cache = new Map<string, string>();
  const up = async (v: string) => {
    if (!v || isRemote(v)) return v;
    if (!cache.has(v)) {
      if (!ctx.json) ctx.io.err(`uploading ${v}`);
      cache.set(v, await uploadFile(ctx.api, ctx.io.fetch, v));
    }
    return cache.get(v)!;
  };
  for (const [key, value] of Object.entries(body)) {
    if (!isUploadKey(key)) continue;
    if (Array.isArray(value)) body[key] = await Promise.all(value.map((v) => (typeof v === 'string' ? up(v) : v)));
    else if (typeof value === 'string') body[key] = await up(value);
  }
}

function jobIdOf(data: any): string | undefined {
  return data?.result?.job_id || data?.job_id || data?.job?.job_id || undefined;
}

function statusPathOf(data: any, id: string, base: string): string {
  const raw: string = data?.result?.status_url || data?.status_url || '';
  if (raw.startsWith('/')) return raw;
  if (raw.startsWith(base + '/')) return raw.slice(base.length);
  return `/api/video-jobs/${encodeURIComponent(id)}`;
}

function seconds(flags: Record<string, FlagValue>, key: string, fallback: number): number {
  const v = Number(flagString(flags, key));
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

async function poll(ctx: Ctx, id: string, path: string): Promise<any> {
  const started = Date.now();
  const timeoutMs = seconds(ctx.flags, 'timeout', 1800) * 1000;
  let delay = seconds(ctx.flags, 'interval', 3) * 1000;
  let last = '';
  let transient = 0;
  for (;;) {
    let res: { status: number; data: any };
    try {
      res = await ctx.api.raw('GET', path);
    } catch (err) {
      res = { status: 0, data: { error: (err as Error).message } };
    }
    const { status, data } = res;
    if ((status === 0 || status === 429 || status >= 502) && ++transient <= 5) {
      await ctx.io.sleep(delay);
      continue;
    }
    if (status === 0 || status === 401 || status === 404 || status === 429 || status >= 500) throw new ApiError(data?.error || `HTTP ${status}`, status);
    transient = 0;
    const job = data?.job || data;
    const state = String(job?.status || '').toLowerCase();
    if (!ACTIVE.has(state)) return job;
    if (!ctx.json && state !== last) ctx.io.err(`${id} ${state}`);
    last = state;
    if (Date.now() - started > timeoutMs) throw new ApiError(`Still ${state} after ${Math.round(timeoutMs / 1000)}s. Resume: mg job ${id} --wait`, 0);
    await ctx.io.sleep(delay);
    delay = Math.min(delay * 1.25, 10_000);
  }
}

async function finish(ctx: Ctx, service: string, response: any, jobObj: any | undefined): Promise<number> {
  const source = jobObj ?? response;
  const outputs = mediaUrls(jobObj ? jobObj.result ?? jobObj : response).map((u) => ctx.api.url(u));
  const outDir = flagString(ctx.flags, 'out');
  const files = outDir && outputs.length ? await downloadAll(ctx.io.fetch, outputs, resolve(outDir)) : [];
  const status = jobObj ? String(jobObj.status || '') : 'completed';
  const cost = jobObj ? jobObj.charged_usd : response?.usd_equivalent ?? response?.estimated_cost_usd;
  const failed = !!jobObj && status !== 'completed';
  const lines = [
    `${jobObj ? `job ${jobObj.job_id} ` : ''}${status}${cost !== undefined ? `  ${usd(cost)}` : ''}`,
    ...(failed && jobObj.error ? [`error: ${jobObj.error}`] : []),
    ...outputs,
    ...files.map((f) => `saved ${f}`),
  ];
  if (!outputs.length && !failed && !ctx.json) lines.push(JSON.stringify(source?.result ?? source, null, 2));
  emit(ctx, { service, job_id: jobObj?.job_id, status, cost_usd: cost, outputs, files, response: source }, lines);
  return failed ? 1 : 0;
}

async function generate(ctx: Ctx): Promise<number> {
  const [, service, ...extra] = ctx.args;
  if (!service) throw new UsageError('Usage: mg generate <service> [--prompt ..] [--key=value ...]. Run `mg services`.');
  const body = buildServiceBody(service, ctx.flags, extra);
  if (ctx.flags['dry-run'] === true) {
    let price: PriceRow | undefined;
    try {
      price = findPrice((await fetchPricing(ctx.api)).rows, service);
    } catch {}
    emit(ctx, { dry_run: true, request: body, uploads: localFiles(body), price }, [
      `POST ${ctx.api.baseUrl}/api/service`,
      JSON.stringify(body, null, 2),
      price ? `price ${usd(price.price_usd)} ${price.unit || ''}`.trim() : 'price not listed; check `mg pricing`',
    ]);
    return 0;
  }
  ctx.api.requireKey();
  await uploadLocal(ctx, body);
  const response = await ctx.api.request('POST', '/api/service', body);
  const id = jobIdOf(response);
  if (!id) return finish(ctx, service, response, undefined);
  if (ctx.flags.wait !== true && !flagString(ctx.flags, 'out')) {
    emit(
      ctx,
      { service, job_id: id, status: 'queued', estimated_cost_usd: response?.estimated_cost_usd, response },
      `queued job ${id}${response?.estimated_cost_usd !== undefined ? `  est ${usd(response.estimated_cost_usd)}` : ''}\nmg job ${id} --wait`,
    );
    return 0;
  }
  const final = await poll(ctx, id, statusPathOf(response, id, ctx.api.baseUrl));
  return finish(ctx, service, response, final);
}

async function job(ctx: Ctx): Promise<number> {
  const id = ctx.args[1];
  if (!id) throw new UsageError('Usage: mg job <id> [--wait] [--out dir]');
  ctx.api.requireKey();
  const path = `/api/video-jobs/${encodeURIComponent(id)}`;
  if (ctx.flags.wait === true || flagString(ctx.flags, 'out')) {
    const final = await poll(ctx, id, path);
    return finish(ctx, final?.service || '', final, final);
  }
  const { status, data } = await ctx.api.raw('GET', path);
  if (status === 401 || status === 404 || status >= 500) throw new ApiError(data?.error || `HTTP ${status}`, status);
  const j = data?.job || data;
  const state = String(j?.status || '').toLowerCase();
  if (ACTIVE.has(state)) {
    emit(ctx, j, `job ${j.job_id} ${state}\nmg job ${j.job_id} --wait`);
    return 0;
  }
  return finish(ctx, j?.service || '', j, j);
}

async function jobs(ctx: Ctx): Promise<number> {
  ctx.api.requireKey();
  const kind = flagString(ctx.flags, 'kind') || 'video';
  if (kind !== 'video' && kind !== 'audio') throw new UsageError('--kind must be video or audio');
  const limit = seconds(ctx.flags, 'limit', 20);
  const data = await ctx.api.request('GET', kind === 'audio' ? '/api/audio-jobs' : '/api/video-jobs');
  const list: any[] = (Array.isArray(data?.jobs) ? data.jobs : []).slice(0, limit);
  const lines = list.map((j) => `${j.job_id}  ${String(j.status).padEnd(10)}  ${String(j.service || '').padEnd(14)}  ${String(j.created_at || '').slice(0, 16)}  ${String(j.prompt || '').slice(0, 50)}`);
  emit(ctx, list, lines.length ? lines : 'No jobs.');
  return 0;
}

async function search(ctx: Ctx): Promise<number> {
  const query = ctx.args.slice(1).join(' ').trim() || flagString(ctx.flags, 'q') || '';
  if (!query) throw new UsageError('Usage: mg search <query> [--kind images|videos|audio]');
  const kind = flagString(ctx.flags, 'kind') || 'images';
  const limit = seconds(ctx.flags, 'limit', 10);
  const q = `q=${encodeURIComponent(query)}&top_k=${limit}`;
  const path = { images: '/api/images/semantic', image: '/api/images/semantic', videos: '/api/search', video: '/api/search', audio: '/api/audio/search' }[kind];
  if (!path) throw new UsageError('--kind must be images, videos or audio');
  const data = await ctx.api.request('GET', `${path}?${q}`);
  const results: any[] = (Array.isArray(data?.results) ? data.results : []).map((r: any) => {
    const url = r.image_url || r.video_url || r.audio_url || r.url || '';
    return { ...r, url: url ? ctx.api.url(url) : '' };
  });
  emit(ctx, { query, kind, results }, results.length ? results.map((r) => `${r.url}  ${String(r.prompt || r.title || '').slice(0, 70)}`) : 'No results.');
  return 0;
}

export function mcpSnippets(baseUrl: string, key?: string) {
  const url = `${baseUrl}/api/mcp`;
  const token = key || '$MANIFOLDGEN_API_KEY';
  const claude = `claude mcp add --transport http manifoldgen ${url} --header "Authorization: Bearer ${token}"`;
  const codex = `[mcp_servers.manifoldgen]\nurl = "${url}"\nbearer_token_env_var = "MANIFOLDGEN_API_KEY"\ntool_timeout_sec = 600`;
  const cursor = { mcpServers: { manifoldgen: { url, headers: { Authorization: `Bearer ${key || '${env:MANIFOLDGEN_API_KEY}'}` } } } };
  return { url, claude, codex, cursor };
}

function mcpConfig(ctx: Ctx): number {
  const showKey = ctx.flags['show-key'] === true;
  if (showKey) ctx.api.requireKey();
  const s = mcpSnippets(ctx.api.baseUrl, showKey ? ctx.api.apiKey : undefined);
  const client = flagString(ctx.flags, 'client') || 'all';
  const blocks: Record<string, string> = {
    claude: `# Claude Code\n${s.claude}`,
    codex: `# Codex (~/.codex/config.toml)\n${s.codex}`,
    cursor: `# Cursor (~/.cursor/mcp.json)\n${JSON.stringify(s.cursor, null, 2)}`,
  };
  if (client !== 'all' && !blocks[client]) throw new UsageError('--client must be claude, codex or cursor');
  const text = client === 'all' ? Object.values(blocks).join('\n\n') : blocks[client];
  const note = showKey ? '' : '\n\nexport MANIFOLDGEN_API_KEY="$(mg auth token)"';
  emit(ctx, client === 'all' ? s : { url: s.url, [client]: s[client as 'claude' | 'codex' | 'cursor'] }, text + note);
  return 0;
}
