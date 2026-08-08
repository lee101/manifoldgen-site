/** Netwrck-style local auth: API key + cached profile. Never auto-logout. */

export const MG_API_KEY = 'mg_api_key';
export const MG_USER = 'mg_user';

export interface StoredUser {
  email?: string;
  api_key: string;
  credits: number;
  credits_usd?: number;
  credit_price_usd?: number;
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

export function loadStoredUser(): StoredUser | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(MG_USER);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredUser>;
      const apiKey = String(parsed.api_key || localStorage.getItem(MG_API_KEY) || '').trim();
      if (apiKey) {
        return {
          email: parsed.email || undefined,
          api_key: apiKey,
          credits: Number(parsed.credits) || 0,
          credits_usd: parsed.credits_usd,
          credit_price_usd: parsed.credit_price_usd,
        };
      }
    }
  } catch {
    // ignore corrupt cache
  }
  const key = localStorage.getItem(MG_API_KEY)?.trim();
  if (!key) return null;
  return { api_key: key, credits: 0 };
}

export function saveUser(user: StoredUser) {
  if (!canUseStorage() || !user.api_key) return;
  localStorage.setItem(MG_API_KEY, user.api_key);
  localStorage.setItem(
    MG_USER,
    JSON.stringify({
      email: user.email || '',
      api_key: user.api_key,
      credits: user.credits ?? 0,
      credits_usd: user.credits_usd,
      credit_price_usd: user.credit_price_usd,
    }),
  );
}

export function clearUser() {
  if (!canUseStorage()) return;
  localStorage.removeItem(MG_API_KEY);
  localStorage.removeItem(MG_USER);
}

export function userFromAuthResponse(data: {
  api_key?: string;
  email?: string;
  credits_usd?: number;
  cute_price_usd?: number;
  credit_price_usd?: number;
  user?: { email?: string; credits?: number };
}): StoredUser | null {
  const apiKey = String(data.api_key || '').trim();
  if (!apiKey) return null;
  const price = data.cute_price_usd || data.credit_price_usd || 0.01;
  return {
    email: data.user?.email || data.email || undefined,
    api_key: apiKey,
    credits: data.user?.credits ?? 0,
    credits_usd: data.credits_usd,
    credit_price_usd: price,
  };
}

/** Soft refresh. Never clears storage — network/404/500 must not sign people out. */
export async function refreshUser(apiKey: string): Promise<StoredUser | null> {
  const key = apiKey.trim();
  if (!key) return null;
  try {
    const res = await fetch('/api/auth/session', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const next = userFromAuthResponse({ ...data, api_key: data.api_key || key });
    if (next) saveUser(next);
    return next;
  } catch {
    return null;
  }
}
