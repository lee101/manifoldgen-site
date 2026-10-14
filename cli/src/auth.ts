import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import type { AddressInfo } from 'node:net';

export function newState(): string {
  return randomBytes(24).toString('base64url');
}

function sameState(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export interface CallbackServer {
  port: number;
  key: Promise<string>;
  close: () => void;
}

export function startCallbackServer(state: string, doneUrl: string): Promise<CallbackServer> {
  let resolveKey!: (key: string) => void;
  const key = new Promise<string>((r) => (resolveKey = r));
  const server = createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (url.pathname !== '/callback') {
      res.writeHead(404).end();
      return;
    }
    const got = url.searchParams.get('state') || '';
    const apiKey = (url.searchParams.get('key') || '').trim();
    if (!sameState(got, state) || !apiKey) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end('ManifoldGen CLI: state mismatch. Run `mg auth login` again.');
      return;
    }
    res.writeHead(302, { Location: doneUrl, 'Cache-Control': 'no-store' }).end();
    resolveKey(apiKey);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ port, key, close: () => server.close() });
    });
  });
}

export function openBrowser(url: string) {
  const [cmd, args] =
    process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url.replace(/&/g, '^&')]] : ['xdg-open', [url]];
  try {
    const child = spawn(cmd, args as string[], { stdio: 'ignore', detached: true });
    child.on('error', () => {});
    child.unref();
  } catch {}
}
