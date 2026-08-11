/** Netwrck-style local auth: API key + cached profile. Never auto-logout. */

const authScope = process.env.NEXT_PUBLIC_MANIFOLDGEN_AUTH_SCOPE?.trim();

// Local and production APIs issue independent keys. Scope the browser cache
// when a dev frontend targets production so a valid local key cannot make the
// UI appear signed in while every production request receives a 401.
export const MG_API_KEY = authScope ? `mg_api_key:${authScope}` : 'mg_api_key';
export const MG_USER = authScope ? `mg_user:${authScope}` : 'mg_user';

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

function storedAPIKey(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object') return '';
  const record = value as { api_key?: unknown; apiKey?: unknown; user?: unknown };
  return storedAPIKey(record.api_key) || storedAPIKey(record.apiKey) || storedAPIKey(record.user);
}

function loadLegacyUser(): Partial<StoredUser> | null {
  // Earlier clients used userData. Preserve that account data on upgrade rather
  // than silently treating a returning user as signed out.
  const raw = localStorage.getItem('userData');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredUser> & { user?: Partial<StoredUser> };
    const apiKey = storedAPIKey(parsed);
    if (!apiKey) return null;
    const profile = parsed.user || parsed;
    return {
      email: profile.email || parsed.email,
      api_key: apiKey,
      credits: Number(profile.credits ?? parsed.credits) || 0,
      credits_usd: profile.credits_usd ?? parsed.credits_usd,
      credit_price_usd: profile.credit_price_usd ?? parsed.credit_price_usd,
    };
  } catch {
    return null;
  }
}

export function loadStoredUser(): StoredUser | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(MG_USER);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredUser>;
      // MG_API_KEY is the canonical credential. The profile is only a cache,
      // so it must never override a newer key written by sign-in or rotation.
      const apiKey = String(localStorage.getItem(MG_API_KEY) || parsed.api_key || '').trim();
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
  if (key) return { api_key: key, credits: 0 };
  const legacy = loadLegacyUser();
  if (!legacy?.api_key) return null;
  const user: StoredUser = { api_key: legacy.api_key, credits: legacy.credits || 0, email: legacy.email, credits_usd: legacy.credits_usd, credit_price_usd: legacy.credit_price_usd };
  saveUser(user);
  return user;
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
  const fallbackKeys = canUseStorage()
    ? [localStorage.getItem(MG_API_KEY), loadLegacyUser()?.api_key]
    : [];
  const candidates = [...new Set([key, ...fallbackKeys].map((candidate) => String(candidate || '').trim()).filter(Boolean))];
  try {
    for (const candidate of candidates) {
      const res = await fetch('/api/auth/session', {
        headers: { Authorization: `Bearer ${candidate}` },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const next = userFromAuthResponse({ ...data, api_key: data.api_key || candidate });
      if (next) saveUser(next);
      return next;
    }
    return null;
  } catch {
    return null;
  }
}
