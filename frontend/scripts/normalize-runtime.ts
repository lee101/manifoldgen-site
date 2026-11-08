// Make the Next/webpack runtime chunk deterministic.
//
// webpack-<hash>.js contains a map of loaded chunk ids whose key order varies from
// build to build, so its content hash (and every page that references it) changes
// even when nothing else did. Sort the map, re-hash the file, and rewrite references,
// so identical sources produce byte-identical output and deploys can skip unchanged files.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] || 'out';
const chunksDir = join(out, '_next/static/chunks');
const MAP = /var e=\{((?:\d+:0,?)+)\};r\.f\.j=/;

const runtimes = readdirSync(chunksDir).filter((n) => /^webpack-[0-9a-f]+\.js$/.test(n));
const renames = new Map<string, string>();
for (const name of runtimes) {
  const path = join(chunksDir, name);
  const src = readFileSync(path, 'utf8');
  const m = MAP.exec(src);
  if (!m) continue;
  const keys = m[1].split(',').filter(Boolean).map((k) => Number(k.split(':')[0])).sort((a, b) => a - b);
  const next = src.replace(MAP, `var e={${keys.map((k) => `${k}:0`).join(',')}};r.f.j=`);
  const hash = createHash('sha256').update(next).digest('hex').slice(0, 16);
  const newName = `webpack-${hash}.js`;
  writeFileSync(path, next);
  if (newName !== name) {
    renameSync(path, join(chunksDir, newName));
    renames.set(name, newName);
  }
}
if (renames.size === 0) {
  console.log('normalize-runtime: nothing to rewrite');
  process.exit(0);
}

let touched = 0;
const walk = (dir: string) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) { walk(path); continue; }
    if (!/\.(html|txt|js|json)$/.test(entry.name) || statSync(path).size > 20_000_000) continue;
    let text = readFileSync(path, 'utf8');
    let changed = false;
    for (const [from, to] of renames) {
      if (text.includes(from)) { text = text.split(from).join(to); changed = true; }
    }
    if (changed) { writeFileSync(path, text); touched++; }
  }
};
walk(out);
console.log(`normalize-runtime: ${[...renames].map(([a, b]) => `${a} -> ${b}`).join(', ')}; rewrote ${touched} files`);
