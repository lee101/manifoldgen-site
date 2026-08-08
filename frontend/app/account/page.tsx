'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CreditCard, Loader2 } from 'lucide-react';

const API = '/api';

export default function AccountPage() {
  const [apiKey, setApiKey] = useState('');
  const [creditsUsd, setCreditsUsd] = useState(0);
  const [amount, setAmount] = useState('25');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const key = localStorage.getItem('mg_api_key') || '';
    setApiKey(key);
    if (!key) return;
    fetch(`${API}/balance`, { headers: { Authorization: `Bearer ${key}` } })
      .then((r) => r.json())
      .then((d) => setCreditsUsd(d.credits_usd ?? d.credits ?? 0))
      .catch(() => undefined);
  }, []);

  async function buyCredits(kind: 'credits' | 'monthly' | 'annual') {
    if (!apiKey) {
      setError('Sign in from the studio first');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const body: Record<string, unknown> = { type: kind };
      if (kind === 'credits') body.amount_usd = Number(amount);
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
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      if (data.client_secret) {
        setMessage('Checkout session created. Complete payment in Stripe.');
        return;
      }
      setMessage(JSON.stringify(data));
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
        <div className="glass mt-6 rounded-3xl p-5">
          <div className="text-sm text-[var(--color-mute)]">Balance</div>
          <div className="mt-1 text-3xl font-semibold">${creditsUsd.toFixed(2)}</div>
          <div className="mt-6 grid gap-2 sm:grid-cols-3">
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
              onClick={() => buyCredits('monthly')}
              className="rounded-full border border-white/15 px-4 py-2 text-sm"
            >
              Monthly plan
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => buyCredits('annual')}
              className="rounded-full border border-white/15 px-4 py-2 text-sm"
            >
              Annual plan
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
          {message && <p className="mt-3 text-sm text-[var(--color-accent-2)]">{message}</p>}
        </div>
      </div>
    </main>
  );
}
