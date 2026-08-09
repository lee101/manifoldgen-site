'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CreditCard, KeyRound, Loader2, LogOut, UserPlus } from 'lucide-react';
import {
  clearUser,
  loadStoredUser,
  refreshUser,
  saveUser,
  userFromAuthResponse,
} from '../../lib/auth';
import { parseJSONResponse } from '../../lib/http';

const API = '/api';

interface StripeEmbeddedCheckout {
  mount: (target: string | HTMLElement) => void;
  destroy: () => void;
}

interface StripeBrowserClient {
  initEmbeddedCheckout: (options: {
    clientSecret: string;
    onComplete?: () => void;
  }) => Promise<StripeEmbeddedCheckout>;
}

declare global {
  interface Window {
    Stripe?: (publishableKey: string) => StripeBrowserClient;
  }
}

let stripeJsPromise: Promise<void> | null = null;

function loadStripeJS() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Stripe.js requires a browser'));
  if (window.Stripe) return Promise.resolve();
  if (stripeJsPromise) return stripeJsPromise;

  stripeJsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://js.stripe.com/v3/"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Stripe.js')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Stripe.js'));
    document.head.appendChild(script);
  });

  return stripeJsPromise;
}

type AuthMode = 'signup' | 'signin' | 'forgot' | 'reset';
type AuthResponse = Parameters<typeof userFromAuthResponse>[0] & {
  created?: boolean;
  error?: string;
  reset_token?: string;
};

export default function AccountPage() {
  const [apiKey, setApiKey] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<AuthMode>('signup');
  const [resetToken, setResetToken] = useState('');
  const [creditsUsd, setCreditsUsd] = useState(0);
  const [credits, setCredits] = useState(0);
  const [creditPrice, setCreditPrice] = useState(0.01);
  const [amount, setAmount] = useState('50');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [publishableKey, setPublishableKey] = useState('');
  const [checkoutMeta, setCheckoutMeta] = useState('');
  const checkoutMountRef = useRef<HTMLDivElement | null>(null);
  const embeddedCheckoutRef = useRef<StripeEmbeddedCheckout | null>(null);

  const refreshSession = useCallback(async (key: string) => {
    const next = await refreshUser(key);
    if (!next) return null;
    setApiKey(next.api_key);
    setEmail(next.email || '');
    const price = next.credit_price_usd || 0.01;
    setCreditPrice(price);
    setCreditsUsd(next.credits_usd ?? next.credits * price);
    setCredits(next.credits);
    return next;
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('reset_token') || '';
    if (token) {
      setResetToken(token);
      setAuthMode('reset');
      setMessage('Choose a new password for your account.');
    }
  }, []);

  useEffect(() => {
    const stored = loadStoredUser();
    if (!stored) return;
    setApiKey(stored.api_key);
    setEmail(stored.email || '');
    const price = stored.credit_price_usd || 0.01;
    setCreditPrice(price);
    setCreditsUsd(stored.credits_usd ?? stored.credits * price);
    setCredits(stored.credits);
    void refreshSession(stored.api_key);
  }, [refreshSession]);

  useEffect(() => {
    if (!clientSecret || !publishableKey || !checkoutMountRef.current) return;

    let cancelled = false;
    const mountCheckout = async () => {
      try {
        embeddedCheckoutRef.current?.destroy();
        embeddedCheckoutRef.current = null;
        await loadStripeJS();
        if (cancelled) return;
        const stripe = window.Stripe?.(publishableKey);
        if (!stripe) throw new Error('Stripe.js did not initialize');
        const checkout = await stripe.initEmbeddedCheckout({
          clientSecret,
          onComplete: () => {
            setMessage('Payment complete. Credits will appear shortly.');
            setClientSecret('');
            if (apiKey) refreshSession(apiKey).catch(() => undefined);
          },
        });
        if (cancelled) {
          checkout.destroy();
          return;
        }
        checkout.mount(checkoutMountRef.current!);
        embeddedCheckoutRef.current = checkout;
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to mount Stripe checkout');
        }
      }
    };
    void mountCheckout();
    return () => {
      cancelled = true;
      embeddedCheckoutRef.current?.destroy();
      embeddedCheckoutRef.current = null;
    };
  }, [apiKey, clientSecret, publishableKey, refreshSession]);

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (authMode === 'forgot') {
        if (!email.includes('@')) throw new Error('valid email required');
        const res = await fetch(`${API}/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await parseJSONResponse<AuthResponse>(res, 'Reset request failed');
        setMessage('If that email exists, a reset link is on the way.');
        if (data.reset_token) {
          setResetToken(data.reset_token);
          setAuthMode('reset');
          setMessage('Dev reset token ready — set a new password.');
        }
        return;
      }

      if (authMode === 'reset') {
        if (password.length < 8) throw new Error('Password must be at least 8 characters');
        if (!resetToken) throw new Error('Reset token missing');
        const res = await fetch(`${API}/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: resetToken, password }),
        });
        const data = await parseJSONResponse<AuthResponse>(res, 'Reset failed');
        const next = userFromAuthResponse(data);
        if (!next) throw new Error('No API key returned');
        saveUser(next);
        setApiKey(next.api_key);
        setEmail(next.email || email);
        const price = next.credit_price_usd || 0.01;
        setCreditPrice(price);
        setCreditsUsd(next.credits_usd ?? 0);
        setCredits(next.credits);
        setPassword('');
        setResetToken('');
        setAuthMode('signin');
        setMessage('Password updated. You are signed in.');
        const url = new URL(window.location.href);
        url.searchParams.delete('reset_token');
        window.history.replaceState({}, '', url.pathname);
        return;
      }

      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }
      const res = await fetch(`${API}/auth/email-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await parseJSONResponse<AuthResponse>(res, 'Auth failed');
      const next = userFromAuthResponse(data);
      if (!next) throw new Error('No API key returned');
      saveUser(next);
      setApiKey(next.api_key);
      setEmail(next.email || email);
      const price = next.credit_price_usd || 0.01;
      setCreditPrice(price);
      setCreditsUsd(next.credits_usd ?? 0);
      setCredits(next.credits);
      setMessage(data.created ? 'Account created.' : 'Signed in.');
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auth failed');
    } finally {
      setBusy(false);
    }
  }

  function signOut() {
    clearUser();
    setApiKey('');
    setEmail('');
    setCreditsUsd(0);
    setCredits(0);
    setClientSecret('');
    setPublishableKey('');
    setCheckoutMeta('');
    setMessage('');
    setError('');
    embeddedCheckoutRef.current?.destroy();
    embeddedCheckoutRef.current = null;
  }

  async function buyCredits(kind: 'credits' | 'monthly' | 'annual') {
    if (!apiKey) {
      setError('Sign in first');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    setClientSecret('');
    setPublishableKey('');
    try {
      const body: Record<string, unknown> =
        kind === 'credits'
          ? { type: 'credits', amount_usd: Number(amount) }
          : { type: 'subscription', plan: kind };
      const res = await fetch(`${API}/stripe-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed');
      if (data.url && !data.client_secret) {
        window.location.href = data.url;
        return;
      }
      if (!data.client_secret || !data.publishable_key) {
        throw new Error('Stripe checkout response missing client_secret');
      }
      setCheckoutMeta(
        kind === 'credits' ? `Credits: $${Number(amount).toFixed(0)}` : `Plan: ${kind}`,
      );
      setPublishableKey(data.publishable_key);
      setClientSecret(data.client_secret);
      setMessage('Secure Stripe checkout ready.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--color-ink)] px-4 py-10 text-white">
      <div className="mx-auto max-w-lg">
        <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--color-mute)]">
          <ArrowLeft size={16} /> Back to studio
        </Link>
        <h1 className="font-display text-3xl font-700">Account</h1>
        <p className="mt-2 text-[var(--color-mute)]">
          Pay-as-you-go credits and subscriptions. H3 video is metered at app.nz + 20%.
        </p>

        {!apiKey ? (
          <form onSubmit={submitAuth} className="glass mt-6 rounded-3xl p-5" data-testid="account-auth-form">
            {authMode !== 'forgot' && authMode !== 'reset' && (
              <div className="mb-4 flex rounded-full bg-white/5 p-1 text-sm">
                <button
                  type="button"
                  data-testid="account-auth-signup-tab"
                  onClick={() => {
                    setAuthMode('signup');
                    setError('');
                    setMessage('');
                  }}
                  className={`flex-1 rounded-full py-2 font-medium transition ${
                    authMode === 'signup' ? 'bg-white/15 text-white' : 'text-white/50'
                  }`}
                >
                  Sign up
                </button>
                <button
                  type="button"
                  data-testid="account-auth-signin-tab"
                  onClick={() => {
                    setAuthMode('signin');
                    setError('');
                    setMessage('');
                  }}
                  className={`flex-1 rounded-full py-2 font-medium transition ${
                    authMode === 'signin' ? 'bg-white/15 text-white' : 'text-white/50'
                  }`}
                >
                  Sign in
                </button>
              </div>
            )}
            {(authMode === 'forgot' || authMode === 'reset') && (
              <div className="mb-4 text-sm font-medium text-white/80" data-testid="account-auth-mode-label">
                {authMode === 'forgot' ? 'Forgot password' : 'Set a new password'}
              </div>
            )}
            {authMode !== 'reset' && (
              <label className="mb-3 block text-sm text-white/70">
                Email
                <input
                  required
                  data-testid="account-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-[var(--color-accent)]"
                  placeholder="you@studio.com"
                />
              </label>
            )}
            {authMode !== 'forgot' && (
              <label className="mb-3 block text-sm text-white/70">
                {authMode === 'reset' ? 'New password' : 'Password'}
                <input
                  required
                  data-testid="account-password"
                  type="password"
                  autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1.5 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-[var(--color-accent)]"
                  placeholder="At least 8 characters"
                />
              </label>
            )}
            {error && (
              <p className="mb-3 text-sm text-red-300" data-testid="account-auth-error">
                {error}
              </p>
            )}
            {message && !apiKey && (
              <p className="mb-3 text-sm text-emerald-300" data-testid="account-auth-message">
                {message}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              data-testid="account-auth-submit"
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-4 py-3 font-semibold disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="animate-spin" size={16} />
              ) : authMode === 'signup' ? (
                <UserPlus size={16} />
              ) : (
                <KeyRound size={16} />
              )}
              {authMode === 'signup'
                ? 'Create account'
                : authMode === 'forgot'
                  ? 'Email reset link'
                  : authMode === 'reset'
                    ? 'Update password'
                    : 'Sign in'}
            </button>
            {authMode === 'signin' && (
              <button
                type="button"
                data-testid="account-forgot-password"
                className="mt-3 w-full text-center text-sm text-[var(--color-accent-2)]"
                onClick={() => {
                  setAuthMode('forgot');
                  setError('');
                  setMessage('');
                  setPassword('');
                }}
              >
                Forgot password?
              </button>
            )}
            {(authMode === 'forgot' || authMode === 'reset') && (
              <button
                type="button"
                data-testid="account-back-to-signin"
                className="mt-3 w-full text-center text-sm text-white/60"
                onClick={() => {
                  setAuthMode('signin');
                  setError('');
                  setMessage('');
                  setPassword('');
                }}
              >
                Back to sign in
              </button>
            )}
          </form>
        ) : (
          <div className="glass mt-6 rounded-3xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm text-[var(--color-mute)]">Signed in</div>
                <div className="mt-1 text-sm font-medium" data-testid="account-signed-in-email">
                  {email || 'Account'}
                </div>
                <div className="mt-4 text-sm text-[var(--color-mute)]">Balance</div>
                <div className="mt-1 text-3xl font-semibold" data-testid="account-balance">
                  ${creditsUsd.toFixed(2)}
                </div>
                <div className="mt-1 text-sm text-white/55" data-testid="account-credits">
                  {Math.round(credits).toLocaleString()} credits · ${creditPrice.toFixed(2)}/credit
                </div>
              </div>
              <button
                type="button"
                data-testid="account-sign-out"
                onClick={signOut}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-2 text-sm text-white/80"
              >
                <LogOut size={14} />
                Sign out
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-[var(--color-mute)]">API key</div>
              <div className="mt-1 break-all font-mono text-xs" data-testid="account-api-key">
                {apiKey}
              </div>
              <button
                type="button"
                data-testid="account-copy-api-key"
                className="mt-2 text-xs text-[var(--color-accent-2)]"
                onClick={() => navigator.clipboard.writeText(apiKey)}
              >
                Copy API key
              </button>
            </div>

            <h2 className="mt-6 text-lg font-semibold">Top up credits</h2>
            <p className="mt-1 text-sm text-[var(--color-mute)]">
              1 credit = ${creditPrice.toFixed(2)}. Images are 4 credits ($0.04). Min top-up $5.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {['25', '50', '100', '200'].map((v) => (
                <button
                  key={v}
                  type="button"
                  data-testid={`account-topup-${v}`}
                  onClick={() => setAmount(v)}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    amount === v ? 'border-[var(--color-accent)] bg-white/10' : 'border-white/10'
                  }`}
                >
                  ${v}
                </button>
              ))}
            </div>
            <label className="mt-3 block text-sm text-white/70">
              Custom amount (USD)
              <input
                data-testid="account-topup-custom"
                type="number"
                min={5}
                max={500}
                step={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1.5 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-[var(--color-accent)]"
              />
            </label>
            <p className="mt-2 text-xs text-white/45" data-testid="account-topup-credits-preview">
              ≈ {Math.round((Number(amount) || 0) / creditPrice).toLocaleString()} credits
            </p>
            <button
              type="button"
              disabled={busy}
              data-testid="account-buy-credits"
              onClick={() => buyCredits('credits')}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-4 py-2.5 font-semibold disabled:opacity-50"
            >
              {busy ? <Loader2 className="animate-spin" size={16} /> : <CreditCard size={16} />}
              Buy ${Number(amount) || 0} credits
            </button>
            <h2 className="mt-6 text-lg font-semibold">Checkout</h2>
            <p className="mt-1 text-sm text-[var(--color-mute)]">
              Monthly includes unlimited images + $25 H3 video credits; annual is 12× ($300).
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={busy}
                data-testid="account-buy-monthly"
                onClick={() => buyCredits('monthly')}
                className="rounded-full border border-white/15 px-4 py-2 text-sm"
              >
                Monthly · $25 video + ∞ images
              </button>
              <button
                type="button"
                disabled={busy}
                data-testid="account-buy-annual"
                onClick={() => buyCredits('annual')}
                className="rounded-full border border-white/15 px-4 py-2 text-sm"
              >
                Annual · $300 video + ∞ images
              </button>
            </div>

            <h2 className="mt-6 text-lg font-semibold">API</h2>
            <pre
              className="mt-2 overflow-x-auto rounded-2xl border border-white/10 bg-black/40 p-3 text-[11px] leading-relaxed text-white/80"
              data-testid="account-api-snippet"
            >{`# Image gen — $0.04 (4 credits), n images at once
curl -X POST https://manifoldgen.com/api/service \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"service":"zimage","prompt":"teal ribbon logo","n":2,"width":1024,"height":1024}'

# H3 video — metered credits (app.nz GPU $ + 20%)
curl -X POST https://manifoldgen.com/api/service \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"service":"h3_video","prompt":"cinematic neon alley","aspect_ratio":"16:9","size":"balanced","duration":5}'`}</pre>
            <button
              type="button"
              data-testid="account-copy-api-snippet"
              className="mt-2 text-xs text-[var(--color-accent-2)]"
              onClick={() => {
                const el = document.querySelector('[data-testid="account-api-snippet"]');
                if (el?.textContent) void navigator.clipboard.writeText(el.textContent);
              }}
            >
              Copy API examples
            </button>
            {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
            {message && (
              <p className="mt-3 text-sm text-[var(--color-accent-2)]" data-testid="account-checkout-message">
                {message}
              </p>
            )}
            {clientSecret && (
              <div
                className="mt-4 rounded-2xl border border-white/10 bg-white p-3 text-black"
                data-testid="embedded-checkout-container"
              >
                <div className="mb-2 text-sm font-semibold text-slate-700">Secure Stripe checkout</div>
                {checkoutMeta && <div className="mb-3 text-xs text-slate-500">{checkoutMeta}</div>}
                <div ref={checkoutMountRef} data-testid="embedded-checkout-mount" />
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
