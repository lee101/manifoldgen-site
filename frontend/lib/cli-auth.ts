export interface CliAuthRequest {
  port: number;
  state: string;
  paste: boolean;
}

export function parseCliAuthRequest(search: string): CliAuthRequest | null {
  const params = new URLSearchParams(search);
  const rawPort = params.get('port') || '';
  const state = params.get('state') || '';
  if (!/^\d{4,5}$/.test(rawPort) || !/^[A-Za-z0-9_-]{16,128}$/.test(state)) return null;
  const port = Number(rawPort);
  if (port < 1024 || port > 65535) return null;
  return { port, state, paste: params.get('paste') === '1' };
}

export function cliCallbackURL(request: CliAuthRequest, apiKey: string): string {
  const url = new URL(`http://127.0.0.1:${request.port}/callback`);
  url.searchParams.set('state', request.state);
  url.searchParams.set('key', apiKey);
  return url.toString();
}
