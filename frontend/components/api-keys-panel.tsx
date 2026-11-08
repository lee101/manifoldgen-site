'use client';

import { useCallback, useEffect, useState } from 'react';
import { friendlyError, parseJSONResponse } from '../lib/http';

interface KeyScope { name: string; description: string }
interface ManagedKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  is_management: boolean;
}

const API = '/api/keys';

function keyState(key: ManagedKey) {
  const now = Date.now();
  if (key.revoked_at && new Date(key.revoked_at).getTime() <= now) return 'revoked';
  if (key.expires_at && new Date(key.expires_at).getTime() <= now) return 'expired';
  if (key.revoked_at) return `rotating, ends ${new Date(key.revoked_at).toLocaleString()}`;
  return 'active';
}

export default function ApiKeysPanel({ apiKey }: { apiKey: string }) {
  const [keys, setKeys] = useState<ManagedKey[]>([]);
  const [scopes, setScopes] = useState<KeyScope[]>([]);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [expiresInDays, setExpiresInDays] = useState('');
  const [grace, setGrace] = useState('0');
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const headers = useCallback(() => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }), [apiKey]);

  const load = useCallback(async () => {
    try {
      const data = await parseJSONResponse<{ keys: ManagedKey[] }>(await fetch(API, { headers: headers() }), 'Could not load keys');
      setKeys(data.keys);
    } catch (err) {
      setError(friendlyError(err, 'Could not load keys'));
    }
  }, [headers]);

  useEffect(() => {
    if (!apiKey) return;
    void load();
    fetch(`${API}/scopes`)
      .then((res) => res.json())
      .then((data: { scopes: KeyScope[] }) => setScopes(data.scopes))
      .catch(() => undefined);
  }, [apiKey, load]);

  async function run(request: () => Promise<Response>, fallback: string) {
    setBusy(true);
    setError('');
    try {
      const data = await parseJSONResponse<{ secret?: string }>(await request(), fallback);
      setSecret(data.secret || '');
      await load();
      return true;
    } catch (err) {
      setError(friendlyError(err, fallback));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    const body: Record<string, unknown> = { name, scopes: selected };
    if (expiresInDays) body.expires_in_days = Number(expiresInDays);
    const ok = await run(() => fetch(API, { method: 'POST', headers: headers(), body: JSON.stringify(body) }), 'Could not create key');
    if (ok) {
      setName('');
      setSelected([]);
      setExpiresInDays('');
    }
  }

  const rotate = (id: string) =>
    run(() => fetch(`${API}/${id}/rotate`, { method: 'POST', headers: headers(), body: JSON.stringify({ grace_seconds: Number(grace) || 0 }) }), 'Could not rotate key');
  const revoke = (id: string) => run(() => fetch(`${API}/${id}`, { method: 'DELETE', headers: headers() }), 'Could not revoke key');

  function toggle(scope: string) {
    setSelected((current) => (current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope]));
  }

  return (
    <section className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-3" data-testid="account-api-keys">
      <div className="text-xs text-[var(--color-mute)]">Scoped API keys</div>
      <p className="mt-1 text-xs text-white/55">
        Limit a key to the scopes a job needs. A key with keys:manage is a management key and is the only key that can manage keys.
      </p>
      {secret ? (
        <div className="mt-3 rounded-xl border border-white/15 p-2" data-testid="account-new-key-secret">
          <div className="text-xs text-[var(--color-mute)]">Copy this key now, it is shown once</div>
          <div className="mt-1 break-all font-mono text-xs">{secret}</div>
          <div className="mt-2 flex gap-3 text-xs text-[var(--color-accent-2)]">
            <button type="button" onClick={() => navigator.clipboard.writeText(secret)}>Copy</button>
            <button type="button" onClick={() => setSecret('')}>Dismiss</button>
          </div>
        </div>
      ) : null}
      {error ? <div className="mt-3 text-xs text-red-300" role="alert">{error}</div> : null}

      <ul className="mt-3 space-y-2">
        {keys.map((key) => {
          const state = keyState(key);
          return (
            <li key={key.id} className="rounded-xl border border-white/10 p-2 text-xs" data-testid={`account-key-${key.id}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{key.name}{key.is_management ? ' (management)' : ''}</span>
                <span className="font-mono text-white/55">{key.prefix}…</span>
              </div>
              <div className="mt-1 text-white/55">{key.scopes.join(', ')}</div>
              <div className="mt-1 text-white/55">
                {state}
                {key.expires_at ? ` · expires ${new Date(key.expires_at).toLocaleDateString()}` : ''}
                {key.last_used_at ? ` · used ${new Date(key.last_used_at).toLocaleString()}` : ' · never used'}
              </div>
              {state === 'active' ? (
                <div className="mt-2 flex gap-3 text-[var(--color-accent-2)]">
                  <button type="button" disabled={busy} onClick={() => rotate(key.id)}>Rotate</button>
                  <button type="button" disabled={busy} onClick={() => revoke(key.id)}>Revoke</button>
                </div>
              ) : null}
            </li>
          );
        })}
        {keys.length === 0 ? <li className="text-xs text-white/55">No scoped keys yet.</li> : null}
      </ul>

      <div className="mt-3 flex items-center gap-2 text-xs text-white/55">
        <label htmlFor="key-grace">Rotation grace (seconds)</label>
        <input id="key-grace" type="number" min={0} max={86400} value={grace} onChange={(event) => setGrace(event.target.value)}
          className="w-24 rounded-lg border border-white/15 bg-transparent px-2 py-1 text-white" />
      </div>

      <div className="mt-4 border-t border-white/10 pt-3">
        <div className="flex flex-wrap gap-2">
          <input aria-label="Key name" placeholder="Key name" value={name} maxLength={64} onChange={(event) => setName(event.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-white/15 bg-transparent px-2 py-1 text-xs" />
          <input aria-label="Expires in days" placeholder="Expires in days" type="number" min={1} max={3650} value={expiresInDays}
            onChange={(event) => setExpiresInDays(event.target.value)} className="w-32 rounded-lg border border-white/15 bg-transparent px-2 py-1 text-xs" />
        </div>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          {scopes.map((scope) => (
            <label key={scope.name} className="flex items-start gap-2 text-xs" title={scope.description}>
              <input type="checkbox" checked={selected.includes(scope.name)} onChange={() => toggle(scope.name)} className="mt-0.5" />
              <span><span className="font-mono">{scope.name}</span><span className="block text-white/45">{scope.description}</span></span>
            </label>
          ))}
        </div>
        <button type="button" disabled={busy || !name.trim() || selected.length === 0} onClick={create}
          className="mt-3 rounded-full border border-white/15 px-3 py-1.5 text-xs disabled:opacity-50" data-testid="account-create-key">
          Create key
        </button>
      </div>
    </section>
  );
}
