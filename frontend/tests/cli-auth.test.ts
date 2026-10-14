import { describe, expect, test } from 'bun:test';
import { cliCallbackURL, parseCliAuthRequest } from '../lib/cli-auth';

const state = 'abcdefghijklmnopqrstuvwxyz012345';

describe('cli auth', () => {
  test('accepts a valid local request', () => {
    expect(parseCliAuthRequest(`?port=53123&state=${state}&paste=1`)).toEqual({ port: 53123, state, paste: true });
  });

  test('rejects bad ports and states', () => {
    for (const q of [`?port=80&state=${state}`, `?port=70000&state=${state}`, `?port=1e4&state=${state}`, `?port=5000&state=short`, `?port=5000&state=${state}%26x`, `?state=${state}`]) {
      expect(parseCliAuthRequest(q)).toBeNull();
    }
  });

  test('always targets loopback', () => {
    const url = new URL(cliCallbackURL({ port: 53123, state, paste: false }, 'sk-mg-a&b'));
    expect(url.origin).toBe('http://127.0.0.1:53123');
    expect(url.pathname).toBe('/callback');
    expect(url.searchParams.get('key')).toBe('sk-mg-a&b');
    expect(url.searchParams.get('state')).toBe(state);
  });
});
