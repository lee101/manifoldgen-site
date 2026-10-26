import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = process.argv[2] || join(ROOT, 'testvids/motion/showcase');
const DEST = process.argv[3] || join(ROOT, 'testvids/motion/cdn/static/tools/production');
const SERVICES = ['motion-fx', 'beat-drop', 'motion-track', 'motion-score'];
const EXPECTED: Record<string, number> = { 'motion-fx': 9, 'beat-drop': 2, 'motion-track': 2, 'motion-score': 2 };
const FILE = /^\d+-(input\.mp4|output\.mp4|poster\.jpg|guide\.mp4|signals\.json|tracks\.json)$/;

let copied = 0;
for (const service of SERVICES) {
  const from = join(SRC, service);
  if (!existsSync(from)) { console.warn(`missing ${from}`); continue; }
  const to = join(DEST, service);
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from).filter((file) => FILE.test(file))) {
    copyFileSync(join(from, name), join(to, name));
    copied += 1;
  }
  for (let n = 1; n <= EXPECTED[service]; n += 1) {
    if (!existsSync(join(from, `${n}-output.mp4`))) console.warn(`${service}: demo ${n} not rendered yet`);
  }
}
console.log(`staged ${copied} files into ${DEST}`);
console.log(`upload: rsync -av ${DEST}/ <static host>:static/tools/production/`);
