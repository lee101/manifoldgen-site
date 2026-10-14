import { createInterface } from 'node:readline';
import { openBrowser } from './auth';
import { run } from './main';

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr, terminal: process.stdin.isTTY === true });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
    rl.on('close', () => resolve(''));
  });
}

run(process.argv.slice(2), {
  env: process.env,
  fetch: (input, init) => fetch(input, init),
  out: (s) => process.stdout.write(s + '\n'),
  err: (s) => process.stderr.write(s + '\n'),
  open: openBrowser,
  prompt,
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
}).then(
  (code) => {
    process.exitCode = code;
    setTimeout(() => process.exit(code), 100).unref();
  },
  (err) => {
    process.stderr.write(`error: ${err?.message || err}\n`);
    process.exit(1);
  },
);
