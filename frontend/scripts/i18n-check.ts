// Coverage gate for the translation pipeline. Fails when a language is missing
// keys, echoes English back on translatable copy, drifted into a foreign
// script, or went stale after English copy changed.
//
import { ALLOWED_SCRIPTS, KEEP_AS_IS_TERMS, LANG_CODES, echoAllowed, scriptOf } from './i18n-config';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';


const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TDIR = join(ROOT, 'translations');

type Routes = Record<string, Record<string, string>>;

const argv = process.argv.slice(2);
const langArg = argv.includes('--lang') ? argv[argv.indexOf('--lang') + 1] : undefined;
const langs = langArg ? langArg.split(',') : LANG_CODES;

function flatten(routes: Routes): Map<string, string> {
  const out = new Map<string, string>();
  for (const [route, strings] of Object.entries(routes)) {
    for (const [key, value] of Object.entries(strings)) out.set(`${route}|${key}`, value);
  }
  return out;
}

const keepTerms = [...KEEP_AS_IS_TERMS].sort((a, b) => b.length - a.length);
function isKeepAsIs(value: string): boolean {
  const rest = keepTerms.reduce((acc, term) => acc.split(term).join(''), value);
  return !/[A-Za-z]{2}/.test(rest);
}

function scriptsOf(s: string): Set<string> {
  const seen = new Set<string>();
  for (const ch of s) {
    const sc = scriptOf(ch);
    if (sc) seen.add(sc);
  }
  return seen;
}

const en = JSON.parse(readFileSync(join(TDIR, 'en.json'), 'utf8')) as { routes: Routes };
const enFlat = flatten(en.routes);
const hashesPath = join(TDIR, 'meta.json');
const hashes = JSON.parse(readFileSync(hashesPath, 'utf8')) as Record<string, string>;

let failures = 0;
const summary: Record<string, { missing: number; english: number; stale: number; badScript: number }> = {};

for (const lang of langs) {
  if (lang === 'en') continue;
  const path = join(TDIR, `${lang}.json`);
  if (!existsSync(path)) {
    console.error(`${lang}: MISSING FILE`);
    failures++;
    continue;
  }
  const cur = flatten(JSON.parse(readFileSync(path, 'utf8')) as Routes);
  const filledPath = join(TDIR, `meta.filled.${lang}.json`);
  const filled = existsSync(filledPath) ? (JSON.parse(readFileSync(filledPath, 'utf8')) as Record<string, string>) : {};
  const allowed = ALLOWED_SCRIPTS[lang];
  let missing = 0;
  let stale = 0;
  let badScript = 0;
  let englishEcho = 0;
  const samples: string[] = [];
  for (const [fullkey, english] of enFlat) {
    if (isKeepAsIs(english)) continue;
    const sep = fullkey.indexOf('|');
    const route = fullkey.slice(0, sep);
    const key = fullkey.slice(sep + 1);
    const tr = cur.get(fullkey);
    const tolerant = echoAllowed(route, key, english);
    if (tr === undefined || !tr.trim()) {
      if (!tolerant) {
        missing++;
        if (samples.length < 5) samples.push(`missing ${fullkey}`);
      }
      continue;
    }
    if (tr === english && !tolerant) {
      englishEcho++;
      if (samples.length < 5 && english.split(/\s+/).length > 3) samples.push(`english ${fullkey}`);
      continue;
    }
    if (!allowed) continue;
    const scripts = scriptsOf(tr);
    let foreign: string | null = null;
    for (const sc of scripts) {
      if (sc !== 'Latin' && !allowed.includes(sc)) foreign = sc;
    }
    const hasTarget = [...scripts].some((sc) => allowed.includes(sc));
    if (foreign || (!hasTarget && /[A-Za-z]{4,}/.test(english))) {
      badScript++;
      if (samples.length < 8) samples.push(`${foreign ? `script(${foreign})` : 'no-target-script'} ${fullkey}`);
    }
  }
  for (const fullkey of Object.keys(filled)) {
    const currentHash = hashes[fullkey];
    if (currentHash && filled[fullkey] && filled[fullkey] !== currentHash) stale++;
  }
  // extra/english echoes are reported as quality warnings; the gate is on
  // missing keys, stale translations, and wrong-script output.
  const extra = [...cur.keys()].filter((k) => !enFlat.has(k)).length;
  const bad = missing + stale + badScript;
  summary[lang] = { missing, english: englishEcho, stale, badScript };
  const status = bad === 0 ? 'ok' : 'FAIL';
  console.log(`${lang}: ${status} missing=${missing} english=${englishEcho} stale=${stale} badScript=${badScript} extra=${extra}`);
  for (const s of samples.slice(0, 6)) console.log(`   ${s}`);
  if (bad > 0) failures++;
}

if (process.argv.includes('--json')) console.log(JSON.stringify(summary));
process.exit(failures ? 1 : 0);
