import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const root = join(dirname(import.meta.path), '..');
const out = join(root, 'public/pose-studio');
await mkdir(out, { recursive: true });
const r = await Bun.build({
  entrypoints: [join(root, 'pose-studio-standalone/entry.ts')],
  outdir: out,
  naming: 'pose-studio.js',
  minify: true,
  target: 'browser',
  format: 'iife',
  define: { 'process.env.NODE_ENV': '"production"' },
});
if (!r.success) { for (const l of r.logs) console.error(l); process.exit(1); }
const css = (await readFile(join(root, 'pose-studio-standalone/pose-studio.css'), 'utf8').catch(() => ''))
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{};:,>])\s*/g, '$1').replace(/;}/g, '}').trim();
await writeFile(join(out, 'pose-studio.css'), css);
const js = Bun.file(join(out, 'pose-studio.js'));
console.log(`pose-studio.js ${(js.size / 1024).toFixed(1)} KB, pose-studio.css ${(css.length / 1024).toFixed(1)} KB`);
