'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, CreditCard, Download, Film, KeyRound, Loader2, LogOut, Sparkles, UserPlus, X } from 'lucide-react';
import {
  clearUser,
  loadStoredUser,
  refreshUser,
  saveUser,
  userFromAuthResponse,
} from '../../lib/auth';
import { friendlyError, parseJSONResponse } from '../../lib/http';

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

type RemakeEstimate = {
  exact?: boolean; shot_count?: number; total_images?: number; motion_clips?: number;
  motion_billable_seconds?: number; estimated_cost_usd?: number; estimated_credits?: number;
};
type RemakeAccountResult = {
  agent_kind?: string; _agent_label?: string; video_url?: string; project_url?: string;
  duration?: number; charged_usd?: number; estimate?: RemakeEstimate;
  plan?: { shots?: unknown[] };
};
type RemakeAccountJob = {
  job_id: string; service: string; status: string; prompt?: string; error?: string;
  charged_usd?: number; credits_used?: number; created_at: string; updated_at: string;
  result?: RemakeAccountResult;
};

export default function AccountPage() {
  const [apiKey, setApiKey] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<AuthMode>('signup');
  const [resetToken, setResetToken] = useState('');
  const [creditsUsd, setCreditsUsd] = useState(0);
  const [amount, setAmount] = useState('50');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [cancellationOpen, setCancellationOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancellationBusy, setCancellationBusy] = useState(false);
  const [clientSecret, setClientSecret] = useState('');
  const [publishableKey, setPublishableKey] = useState('');
  const [checkoutMeta, setCheckoutMeta] = useState('');
  const [remakeJobs, setRemakeJobs] = useState<RemakeAccountJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const checkoutMountRef = useRef<HTMLDivElement | null>(null);
  const embeddedCheckoutRef = useRef<StripeEmbeddedCheckout | null>(null);

  const closeCheckout = useCallback(() => {
    embeddedCheckoutRef.current?.destroy();
    embeddedCheckoutRef.current = null;
    setClientSecret('');
    setPublishableKey('');
  }, []);

  const refreshSession = useCallback(async (key: string) => {
    const next = await refreshUser(key);
    if (!next) return null;
    setApiKey(next.api_key);
    setEmail(next.email || '');
    const price = next.credit_price_usd || 0.01;
    setCreditsUsd(next.credits_usd ?? next.credits * price);
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
    setCreditsUsd(stored.credits_usd ?? stored.credits * price);
    void refreshSession(stored.api_key);
  }, [refreshSession]);

  useEffect(() => {
    if (!apiKey) { setRemakeJobs([]); return; }
    let active = true;
    let timer = 0;
    const loadJobs = async () => {
      try {
        setJobsLoading(true);
        const payload = await parseJSONResponse<{ jobs?: RemakeAccountJob[] }>(
          await fetch(`${API}/video-jobs`, { headers: { Authorization: `Bearer ${apiKey}` } }),
          'Could not load generation jobs',
        );
        if (!active) return;
        setRemakeJobs((payload.jobs || []).filter((job) => job.result?.agent_kind === 'remake'));
      } catch {
        // Account and billing remain usable if generation history is temporarily unavailable.
      } finally {
        if (active) {
          setJobsLoading(false);
          timer = window.setTimeout(loadJobs, 5000);
        }
      }
    };
    void loadJobs();
    return () => { active = false; window.clearTimeout(timer); };
  }, [apiKey]);

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

  useEffect(() => {
    if (!clientSecret) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeCheckout();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [clientSecret, closeCheckout]);

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
          setMessage('Dev reset token ready. Set a new password.');
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
		setCreditsUsd(next.credits_usd ?? 0);
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
      setCreditsUsd(next.credits_usd ?? 0);
      setMessage(data.created ? 'Account created.' : 'Signed in.');
      setPassword('');
    } catch (err) {
      setError(friendlyError(err, 'Auth failed'));
    } finally {
      setBusy(false);
    }
  }

  function signOut() {
    clearUser();
    setApiKey('');
    setEmail('');
    setCreditsUsd(0);
    setClientSecret('');
    setPublishableKey('');
    setCheckoutMeta('');
    setRemakeJobs([]);
    setMessage('');
    setError('');
    embeddedCheckoutRef.current?.destroy();
    embeddedCheckoutRef.current = null;
  }

  async function buyCredits(kind: 'credits' | 'creator_monthly' | 'creator_annual' | 'pro_monthly' | 'pro_annual') {
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
      const data = await parseJSONResponse<{ url?: string; client_secret?: string; publishable_key?: string }>(res, 'Checkout failed');
      if (data.url && !data.client_secret) {
        window.location.href = data.url;
        return;
      }
      if (!data.client_secret || !data.publishable_key) {
        throw new Error('Stripe checkout response missing client_secret');
      }
      setCheckoutMeta(kind === 'credits' ? `Credits: $${Number(amount).toFixed(0)}` : `Plan: ${kind.replace('_', ' ')}`);
      setPublishableKey(data.publishable_key);
      setClientSecret(data.client_secret);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setBusy(false);
    }
  }

  async function openBillingPortal() {
    if (!apiKey) {
      setError('Sign in first');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`${API}/stripe/portal`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const data = await parseJSONResponse<{ url?: string }>(res, 'Unable to open billing portal');
      if (!data.url) throw new Error('Billing portal URL missing');
      window.location.assign(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to open billing portal');
      setBusy(false);
    }
  }

  async function applyRetentionOffer() {
    setCancellationBusy(true);
    setError('');
    try {
      const res = await fetch(`${API}/stripe/retention`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      await parseJSONResponse(res, 'Unable to apply discount');
      setCancellationOpen(false);
      setMessage('Your 50% discount is active for the next 3 months. Thanks for staying with us!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to apply discount');
    } finally {
      setCancellationBusy(false);
    }
  }

  async function confirmCancellation() {
    setCancellationBusy(true);
    setError('');
    try {
      const res = await fetch(`${API}/stripe/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancellationReason }),
      });
      await parseJSONResponse(res, 'Unable to cancel subscription');
      setCancellationOpen(false);
      setMessage('Your subscription will remain active until the end of the current billing period.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to cancel subscription');
    } finally {
      setCancellationBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--color-ink)] px-4 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <Link href="/studio" className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--color-mute)]">
          <ArrowLeft size={16} /> Back to studio
        </Link>
        <h1 className="font-display text-3xl font-700">Account</h1>
        <p className="mt-2 text-[var(--color-mute)]">Balance, billing, and API access.</p>

        {!apiKey ? (
          <form onSubmit={submitAuth} className="glass mt-6 rounded-3xl p-5" data-testid="account-auth-form">
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
            {(authMode === 'signup' || authMode === 'signin') && (
              <p className="mt-4 text-center text-sm text-white/60">
                {authMode === 'signup' ? 'Already have an account?' : 'New to Manifold?'}{' '}
                <button
                  type="button"
                  data-testid={authMode === 'signup' ? 'account-auth-signin-tab' : 'account-auth-signup-tab'}
                  className="font-medium text-[var(--color-accent-2)] transition hover:text-white"
                  onClick={() => {
                    setAuthMode(authMode === 'signup' ? 'signin' : 'signup');
                    setError('');
                    setMessage('');
                  }}
                >
                  {authMode === 'signup' ? 'Sign in' : 'Sign up'}
                </button>
              </p>
            )}
          </form>
        ) : (
          <div className="glass mt-6 rounded-3xl p-5">
            <div>
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

            <section className="mt-6" data-testid="account-remake-jobs">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Video remake agent</h2>
                  <p className="mt-1 text-sm text-[var(--color-mute)]">Queued jobs stay here while you leave the tool or close the browser.</p>
                </div>
                <Link href="/tools/video-remake" className="shrink-0 text-sm text-[var(--color-accent-2)]">New remake</Link>
              </div>
              <div className="mt-3 space-y-3">
                {jobsLoading && remakeJobs.length === 0 ? <div className="flex items-center gap-2 rounded-2xl border border-white/10 p-4 text-sm text-white/60"><Loader2 className="animate-spin" size={16} /> Loading remake jobs…</div> : null}
                {!jobsLoading && remakeJobs.length === 0 ? <div className="rounded-2xl border border-dashed border-white/15 p-4 text-sm text-white/55">No remake jobs yet. Upload a film and approve its shot estimate to start one.</div> : null}
                {remakeJobs.map((job) => {
                  const activeJob = ['queued', 'processing', 'running', 'accepted'].includes(job.status.toLowerCase());
                  const completed = job.status.toLowerCase() === 'completed';
                  const estimate = job.result?.estimate;
                  const shots = estimate?.shot_count || job.result?.plan?.shots?.length || 0;
                  const displayedUSD = completed ? (job.charged_usd || job.result?.charged_usd || 0) : (estimate?.estimated_cost_usd || 0);
                  return <article key={job.job_id} className="rounded-2xl border border-white/10 bg-black/20 p-4" data-testid={`account-remake-job-${job.job_id}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/55">
                          {activeJob ? <Loader2 className="animate-spin text-[var(--color-accent-2)]" size={14} /> : completed ? <Check className="text-emerald-300" size={14} /> : <Film size={14} />}
                          {job.status.replace('_', ' ')}
                        </div>
                        <h3 className="mt-2 line-clamp-2 text-sm font-medium text-white/90">{job.prompt || 'Guided video remake'}</h3>
                        <p className="mt-1 text-xs text-white/55">{activeJob ? job.result?._agent_label || 'Queued for the remake agent' : completed ? 'Finished remake' : job.error || 'The job stopped before completion'}</p>
                      </div>
                      <div className="text-right text-xs text-white/60">
                        <b className="block text-base text-white">{displayedUSD > 0 ? `$${displayedUSD.toFixed(2)}` : 'Estimating…'}</b>
                        <span>{completed ? 'final charge' : 'current ceiling'}</span>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/55">
                      <span>{shots || '—'} shots</span>
                      {estimate?.total_images ? <span>{estimate.total_images} max images</span> : null}
                      {estimate?.motion_clips ? <span>{estimate.motion_clips} H3 clips</span> : null}
                      {estimate?.motion_billable_seconds ? <span>{estimate.motion_billable_seconds}s H3 billing</span> : null}
                      <span>{new Date(job.created_at).toLocaleString()}</span>
                    </div>
                    {(job.result?.video_url || job.result?.project_url) ? <div className="mt-3 flex flex-wrap gap-2">
                      {job.result.video_url ? <a href={job.result.video_url} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs"><Download size={13} /> Download remake</a> : null}
                      {job.result.project_url ? <Link href={job.result.project_url} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold"><Sparkles size={13} /> Open timeline</Link> : null}
                    </div> : null}
                  </article>;
                })}
              </div>
            </section>

            <section id="credits" className="scroll-mt-24">
              <h2 className="mt-6 text-lg font-semibold">Add funds</h2>
              <p className="mt-1 text-sm text-[var(--color-mute)]">
                $5 minimum. Images are $0.04 each.
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
                Custom amount
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
              <button
                type="button"
                disabled={busy}
                data-testid="account-buy-credits"
                onClick={() => buyCredits('credits')}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-4 py-2.5 font-semibold disabled:opacity-50"
              >
                {busy ? <Loader2 className="animate-spin" size={16} /> : <CreditCard size={16} />}
                Add ${Number(amount) || 0}
              </button>
            </section>
            <h2 className="mt-6 text-lg font-semibold">Checkout</h2>
            <p className="mt-1 text-sm text-[var(--color-mute)]">
              Unlimited images, plus $25/month or $300/year for video.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={busy}
                data-testid="account-buy-monthly"
                onClick={() => buyCredits('creator_monthly')}
                className="rounded-full border border-white/15 px-4 py-2 text-sm"
              >
                Creator · $14.99/mo + ∞ images
              </button>
              <button
                type="button"
                disabled={busy}
                data-testid="account-buy-annual"
                onClick={() => buyCredits('creator_annual')}
                className="rounded-full border border-white/15 px-4 py-2 text-sm"
              >
                Creator annual · $149/yr
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => buyCredits('pro_monthly')}
                className="rounded-full border border-white/15 px-4 py-2 text-sm"
              >
                Pro · $49/mo
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => buyCredits('pro_annual')}
                className="rounded-full border border-white/15 px-4 py-2 text-sm"
              >
                Pro annual · $490/yr
              </button>
            </div>

            <button
              type="button"
              disabled={busy}
              data-testid="account-manage-billing"
              onClick={openBillingPortal}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-sm font-medium text-white/85 disabled:opacity-50"
            >
              {busy ? <Loader2 className="animate-spin" size={16} /> : <CreditCard size={16} />}
              Manage billing & subscriptions
            </button>

            <button
              type="button"
              data-testid="account-cancel-subscription"
              disabled={busy}
              onClick={() => { setCancellationReason(''); setCancellationOpen(true); }}
              className="mt-3 inline-flex w-full items-center justify-center rounded-full border border-red-300/30 px-4 py-2.5 text-sm font-medium text-red-200 disabled:opacity-50"
            >
              Cancel subscription
            </button>

            <button
              type="button"
              data-testid="account-sign-out"
              onClick={signOut}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-sm font-medium text-white/85"
            >
              <LogOut size={16} />
              Sign out
            </button>

            {cancellationOpen ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" role="dialog" aria-modal="true" aria-labelledby="cancel-subscription-title">
                <div className="glass w-full max-w-md rounded-3xl p-6">
                  <h2 id="cancel-subscription-title" className="text-xl font-semibold">Before you go</h2>
                  <p className="mt-2 text-sm text-[var(--color-mute)]">What is the main reason you’re cancelling?</p>
                  <select
                    value={cancellationReason}
                    onChange={(event) => setCancellationReason(event.target.value)}
                    className="mt-4 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white"
                  >
                    <option value="">Select a reason</option>
                    <option value="too_expensive">Too expensive</option>
                    <option value="not_using">I’m not using it enough</option>
                    <option value="missing_features">Missing features</option>
                    <option value="other">Other</option>
                  </select>
                  <div className="mt-6 rounded-2xl border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 p-4 text-center">
                    <p className="font-semibold">Stay with us at 50% off</p>
                    <p className="mt-1 text-sm text-[var(--color-mute)]">We’ll apply half-price billing for your next 3 months.</p>
                    <button type="button" disabled={!cancellationReason || cancellationBusy} onClick={() => void applyRetentionOffer()} className="mt-4 inline-flex w-full justify-center rounded-full bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
                      {cancellationBusy ? 'Applying…' : 'Accept 50% discount'}
                    </button>
                  </div>
                  <div className="mt-4 flex gap-3">
                    <button type="button" disabled={cancellationBusy} onClick={() => setCancellationOpen(false)} className="flex-1 rounded-full border border-white/15 px-4 py-2.5 text-sm">Keep subscription</button>
                    <button type="button" disabled={!cancellationReason || cancellationBusy} onClick={() => void confirmCancellation()} className="flex-1 rounded-full border border-red-300/30 px-4 py-2.5 text-sm text-red-200 disabled:opacity-50">Continue cancelling</button>
                  </div>
                </div>
              </div>
            ) : null}

            <h2 className="mt-6 text-lg font-semibold">API</h2>
            <pre
              className="mt-2 overflow-x-auto rounded-2xl border border-white/10 bg-black/40 p-3 text-[11px] leading-relaxed text-white/80"
              data-testid="account-api-snippet"
            >{`# Image gen: $0.04 (4 credits), n images at once
curl -X POST https://manifoldgen.com/api/service \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"service":"zimage","prompt":"teal ribbon logo","n":2,"width":1024,"height":1024}'

# Native video: price shown before rendering
curl -X POST https://manifoldgen.com/api/service \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"service":"h3_video","prompt":"cinematic neon alley","aspect_ratio":"16:9","size":"native","duration":5,"num_steps":20}'`}</pre>
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
          </div>
        )}
      </div>

      {clientSecret && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/80 p-0 backdrop-blur-sm md:items-center md:p-6" onMouseDown={(event) => event.target === event.currentTarget && closeCheckout()}>
          <div
            className="relative flex h-full w-full max-w-xl flex-col overflow-hidden bg-white text-black md:h-auto md:max-h-[92dvh] md:rounded-3xl"
            data-testid="embedded-checkout-container"
            role="dialog"
            aria-modal="true"
            aria-label="Checkout"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <div className="font-semibold">Checkout</div>
                {checkoutMeta && <div className="text-xs text-slate-500">{checkoutMeta}</div>}
              </div>
              <button
                type="button"
                onClick={closeCheckout}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-black"
                aria-label="Close checkout"
              >
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto p-3">
              <div ref={checkoutMountRef} data-testid="embedded-checkout-mount" />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
