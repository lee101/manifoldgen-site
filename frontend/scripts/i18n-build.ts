// Post-export localization pass. Reads the English static export in out/, and
// for every language with translations produces a fully precomputed HTML tree
// under out/<lang>/…: translated title/description/headings/body copy,
// rewritten internal links, localized canonical/og:url, html lang attribute,
// and a reciprocal hreflang cluster on both localized and English pages.
//
//   bun scripts/i18n-build.ts            # uses frontend/out
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LANG_CODES, SITE_URL } from './i18n-config';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.I18N_OUT_DIR ?? join(ROOT, 'out');
const TDIR = join(ROOT, 'translations');

type Routes = Record<string, Record<string, string>>;

// en.json wraps routes under a "routes" key; lang files are bare route maps.
const enRoutes = (JSON.parse(readFileSync(join(TDIR, 'en.json'), 'utf8')).routes ?? {}) as Routes;
const allRoutes = Object.keys(enRoutes).filter((r) => r !== '_shared');
const localizablePaths = new Set(allRoutes.map((r) => (r === '/' ? '/' : r)));
const availableLangs = LANG_CODES.filter((code) => code !== 'en' && existsSync(join(TDIR, `${code}.json`)));
const translations = new Map<string, Routes>();
for (const lang of availableLangs) {
  translations.set(lang, JSON.parse(readFileSync(join(TDIR, `${lang}.json`), 'utf8')) as Routes);
}

function escapeHtml(s: string): string {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#x27;');
}

// Flight payload embedding: strings live inside JS string literals.
function escapeJs(s: string): string {
  return s.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
    .replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('\n', '\\n');
}

// Values containing markup/quote characters are only safe to swap in their
// escaped forms; plain forms are swapped everywhere they can occur verbatim.
const RAW_UNSAFE = /[<>"'\\]/;

function applyReplacements(html: string, pairs: [string, string][]): string {
  let out = html;
  const ordered = [...pairs].filter(([e, t]) => e !== t).sort((a, b) => b[0].length - a[0].length);
  for (const [enValue, trValue] of ordered) {
    if (!RAW_UNSAFE.test(enValue) && !RAW_UNSAFE.test(trValue)) {
      out = out.split(enValue).join(trValue);
    }
    out = out.split(escapeHtml(enValue)).join(escapeHtml(trValue));
    out = out.split(escapeJs(enValue)).join(escapeJs(trValue));
  }
  return out;
}
const HREF_ATTR = /href="(\/[^"#?]*)"/g;
const HREF_ABS = /(rel="canonical" href="https:\/\/manifoldgen\.com)(\/[^"#?]*)"/g;
const HREF_JSON = /"href":"(\/[^"#?]*)"/g;
const OG_URL = /(property="og:url" content="https:\/\/manifoldgen\.com)(\/[^"]*)"/g;

function localizedHref(path: string, lang: string): string | null {
  const bare = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  if (!localizablePaths.has(bare)) return null;
  return bare === '/' ? `/${lang}/` : `/${lang}${bare}`;
}

function rewriteLinks(html: string, lang: string): string {
  const attr = (m: string, p: string) => {
    const to = localizedHref(p, lang);
    return to ? `href="${to}"` : m;
  };
  const json = (m: string, p: string) => {
    const to = localizedHref(p, lang);
    return to ? `"href":"${to}"` : m;
  };
  const abs = (m: string, pre: string, p: string) => {
    const to = localizedHref(p, lang);
    return to ? `${pre}${to}"` : m;
  };
  const og = (m: string, pre: string, p: string) => {
    const to = localizedHref(p, lang);
    return to ? `${pre}${to}"` : m;
  };
  return html
    .replaceAll(HREF_ATTR, attr)
    .replaceAll(HREF_JSON, json)
    .replaceAll(HREF_ABS, abs)
    .replaceAll(OG_URL, og);
}

function langsForRoute(route: string): string[] {
  return availableLangs.filter((lg) => Boolean(translations.get(lg)?.[route]));
}

function hreflangBlock(route: string, routeLangs: string[]): string {
  const canonicalRoute = route === '/' ? '/' : route;
  const lines = [`<link rel="alternate" hreflang="en" href="${SITE_URL}${canonicalRoute}"/>`];
  for (const lang of routeLangs) {
    const loc = `${SITE_URL}/${lang}${route === '/' ? '/' : route}`;
    lines.push(`<link rel="alternate" hreflang="${lang}" href="${loc}"/>`);
  }
  lines.push(`<link rel="alternate" hreflang="x-default" href="${SITE_URL}${canonicalRoute}"/>`);
  return lines.join('');
}

// Idempotent: strips any previously injected block before adding the fresh one.
const HREFLANG_MARK = /<!--i18n:hreflang-->[\s\S]*?<!--\/i18n:hreflang-->/;

function injectBeforeHeadClose(html: string, block: string): string {
  if (!html.includes('</head>')) return html;
  const stripped = html.replace(HREFLANG_MARK, '');
  return stripped.replace('</head>', `<!--i18n:hreflang-->${block}<!--/i18n:hreflang-->\n</head>`);
}

function resolveEnglishFile(route: string): string | null {
  const file = route === '/' ? 'index.html' : `${route.replace(/^\/+/, '')}.html`;
  const path = join(OUT, file);
  return existsSync(path) ? path : null;
}

let written = 0;
let missingFiles = 0;
const manifestRoutes: Record<string, string[]> = {};

for (const lang of availableLangs) {
  const langRoutes = translations.get(lang)!;
  const dir = join(OUT, lang);
  mkdirSync(dir, { recursive: true });
  for (const route of Object.keys(langRoutes)) {
    if (route === '_shared') continue;
    const srcPath = resolveEnglishFile(route);
    if (!srcPath) {
      missingFiles++;
      continue;
    }
    const shared = langRoutes['_shared'] ?? {};
    // Lang files map structural keys to translations; the English source
    // lives in en.json. Only pairs with a known source can be applied.
    const routeStrings = langRoutes[route] ?? {};
    const pairs: [string, string][] = [];
    for (const [key, tr] of Object.entries(routeStrings)) {
      const src = enRoutes[route]?.[key];
      if (typeof src === 'string') pairs.push([src, tr]);
    }
    for (const [key, tr] of Object.entries(shared)) {
      const src = enRoutes['_shared']?.[key];
      if (typeof src === 'string') pairs.push([src, tr]);
    }
    let html = readFileSync(srcPath, 'utf8');
    html = applyReplacements(html, pairs);
    html = rewriteLinks(html, lang);
    html = html.replace('<html lang="en"', `<html lang="${lang}"`);
    html = injectBeforeHeadClose(html, hreflangBlock(route, langsForRoute(route)));
    const dest = join(dir, route === '/' ? 'index.html' : `${route.replace(/^\/+/, '')}.html`);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, html);
    written++;
  }
}

// Reciprocal hreflang on the English pages.
let englishPatched = 0;
for (const route of allRoutes) {
  const routeLangs = langsForRoute(route);
  if (!routeLangs.length) continue;
  const srcPath = resolveEnglishFile(route);
  if (!srcPath) continue;
  const html = readFileSync(srcPath, 'utf8');
  writeFileSync(srcPath, injectBeforeHeadClose(html, hreflangBlock(route, routeLangs)));
  englishPatched++;
  manifestRoutes[route] = routeLangs;
}

writeFileSync(
  join(OUT, 'i18n-manifest.json'),
  JSON.stringify({ langs: availableLangs, routes: manifestRoutes }, null, 2) + '\n',
);

console.log(`i18n-build: langs=${availableLangs.length} localizedPages=${written} englishPatched=${englishPatched} missingFiles=${missingFiles}`);
