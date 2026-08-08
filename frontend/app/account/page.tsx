'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CreditCard, KeyRound, Loader2, LogOut, UserPlus } from 'lucide-react';

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

type AuthMode = 'signup' | 'signin';

export default function AccountPage() {
  const [apiKey, setApiKey] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [authMode, setAuthMode] = useState<AuthMode>('signup');
  const [creditsUsd, setCreditsUsd] = useState(0);
  const [amount, setAmount] = useState('25');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [publishableKey, setPublishableKey] = useState('');
  const [checkoutMeta, setCheckoutMeta] = useState('');
  const checkoutMountRef = useRef<HTMLDivElement | null>(null);
  const embeddedCheckoutRef = useRef<StripeEmbeddedCheckout | null>(null);

  const refreshSession = useCallback(async (key: string) => {
    const res = await fetch(`${API}/session`, { headers: { Authorization: `Bearer ${key}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Session expired');
    localStorage.setItem('mg_api_key', data.api_key || key);
    setApiKey(data.api_key || key);
    setEmail(data.user?.email || data.email || '');
    setCreditsUsd(data.credits_usd ?? data.user?.credits ?? 0);
    return data;
  }, []);

  useEffect(() => {
    const key = localStorage.getItem('mg_api_key') || '';
    if (!key) return;
    refreshSession(key).catch(() => {
      localStorage.removeItem('mg_api_key');
      setApiKey('');
    });
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
      if (authMode === 'signup' && password !== password2) {
        throw new Error('Passwords do not match');
      }
      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }
      const res = await fetch(`${API}/auth/email-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Auth failed');
      localStorage.setItem('mg_api_key', data.api_key);
      setApiKey(data.api_key);
      setCreditsUsd(data.credits_usd ?? 0);
      setMessage(data.created ? 'Account created.' : 'Signed in.');
      setPassword('');
      setPassword2('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auth failed');
    } finally {
      setBusy(false);
    }
  }

  function signOut() {
    localStorage.removeItem('mg_api_key');
    setApiKey('');
    setEmail('');
    setCreditsUsd(0);
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
            <div className="mb-4 flex rounded-full bg-white/5 p-1 text-sm">
              <button
                type="button"
                data-testid="account-auth-signup-tab"
                onClick={() => {
                  setAuthMode('signup');
                  setError('');
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
                }}
                className={`flex-1 rounded-full py-2 font-medium transition ${
                  authMode === 'signin' ? 'bg-white/15 text-white' : 'text-white/50'
                }`}
              >
                Sign in
              </button>
            </div>
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
            <label className="mb-3 block text-sm text-white/70">
              Password
              <input
                required
                data-testid="account-password"
                type="password"
                autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-[var(--color-accent)]"
                placeholder="At least 8 characters"
              />
            </label>
            {authMode === 'signup' && (
              <label className="mb-3 block text-sm text-white/70">
                Confirm password
                <input
                  required
                  data-testid="account-password-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  className="mt-1.5 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-[var(--color-accent)]"
                />
              </label>
            )}
            {error && <p className="mb-3 text-sm text-red-300">{error}</p>}
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
              {authMode === 'signup' ? 'Create account' : 'Sign in'}
            </button>
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

            <h2 className="mt-6 text-lg font-semibold">Checkout</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {['10', '25', '100'].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAmount(v)}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    amount === v ? 'border-[var(--color-accent)]' : 'border-white/10'
                  }`}
                >
                  ${v}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={busy}
              data-testid="account-buy-credits"
              onClick={() => buyCredits('credits')}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-4 py-2.5 font-semibold disabled:opacity-50"
            >
              {busy ? <Loader2 className="animate-spin" size={16} /> : <CreditCard size={16} />}
              Buy credits
            </button>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={busy}
                data-testid="account-buy-monthly"
                onClick={() => buyCredits('monthly')}
                className="rounded-full border border-white/15 px-4 py-2 text-sm"
              >
                Monthly plan
              </button>
              <button
                type="button"
                disabled={busy}
                data-testid="account-buy-annual"
                onClick={() => buyCredits('annual')}
                className="rounded-full border border-white/15 px-4 py-2 text-sm"
              >
                Annual plan
              </button>
            </div>
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
