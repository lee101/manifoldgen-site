'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Copy, Loader2, ShieldCheck, Terminal, TriangleAlert } from 'lucide-react';
import { loadStoredUser, refreshUser, type StoredUser } from '../../lib/auth';
import { cliCallbackURL, parseCliAuthRequest, type CliAuthRequest } from '../../lib/cli-auth';

type Step = 'loading' | 'invalid' | 'signin' | 'confirm' | 'sending' | 'paste' | 'done' | 'cancelled';

export default function CliAuth() {
  const [step, setStep] = useState<Step>('loading');
  const [request, setRequest] = useState<CliAuthRequest | null>(null);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [signInHref, setSignInHref] = useState('/account');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const search = window.location.search;
    if (new URLSearchParams(search).get('status') === 'done') {
      setStep('done');
      return;
    }
    const parsed = parseCliAuthRequest(search);
    if (!parsed) {
      setStep('invalid');
      return;
    }
    setRequest(parsed);
    setSignInHref(`/account?next=${encodeURIComponent(`/cli-auth${search}`)}`);
    const stored = loadStoredUser();
    if (!stored?.api_key) {
      setStep('signin');
      return;
    }
    let live = true;
    refreshUser(stored.api_key).then((fresh) => {
      if (!live) return;
      setUser(fresh || stored);
      setStep('confirm');
    });
    return () => {
      live = false;
    };
  }, []);

  function send() {
    if (!request || !user?.api_key) return;
    setStep('sending');
    window.location.assign(cliCallbackURL(request, user.api_key));
  }

  async function copyKey() {
    if (!user?.api_key) return;
    try {
      await navigator.clipboard.writeText(user.api_key);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[var(--color-ink)] px-4 py-10 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/40 sm:p-8" data-testid="cli-auth-card">
        <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-accent)]/20 text-[var(--color-accent-2)]">
          {step === 'invalid' ? <TriangleAlert size={20} /> : step === 'done' ? <Check size={20} /> : <Terminal size={20} />}
        </div>

        {step === 'loading' && (
          <p className="flex items-center gap-2 text-sm text-white/60"><Loader2 size={16} className="animate-spin" /> Checking your account…</p>
        )}

        {step === 'invalid' && (
          <>
            <h1 className="font-display text-2xl font-700">This link is not valid</h1>
            <p className="mt-2 text-sm leading-6 text-white/55">Run <code className="rounded bg-white/10 px-1.5 py-0.5 text-white">mg auth login</code> again to get a fresh link.</p>
          </>
        )}

        {step === 'signin' && (
          <>
            <h1 className="font-display text-2xl font-700">Sign in to connect the CLI</h1>
            <p className="mt-2 text-sm leading-6 text-white/55">You will come back here to approve this computer.</p>
            <Link href={signInHref} className="mt-6 flex w-full items-center justify-center rounded-full bg-[var(--color-accent-solid)] px-5 py-3 text-sm font-semibold" data-testid="cli-auth-signin">
              Sign in or create an account
            </Link>
          </>
        )}

        {(step === 'confirm' || step === 'sending') && (
          <>
            <h1 className="font-display text-2xl font-700 leading-tight">Authorize ManifoldGen CLI on this computer?</h1>
            <p className="mt-2 text-sm leading-6 text-white/55">
              {user?.email ? <>Signed in as <span className="text-white">{user.email}</span>. </> : null}
              The CLI and agents using it can generate media and spend your credits.
            </p>
            <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-white/10 bg-black/30 p-3.5 text-xs leading-5 text-white/55">
              <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[var(--color-accent-2)]" />
              <span>Only approve if you just ran <code className="text-white">mg auth login</code>. Your key goes only to 127.0.0.1:{request?.port}.</span>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row">
              <button type="button" onClick={() => setStep('cancelled')} className="flex-1 rounded-full border border-white/15 px-5 py-3 text-sm text-white/75 hover:bg-white/5" disabled={step === 'sending'}>
                Cancel
              </button>
              {request?.paste ? (
                <button type="button" onClick={() => setStep('paste')} className="flex-1 rounded-full bg-[var(--color-accent-solid)] px-5 py-3 text-sm font-semibold" data-testid="cli-auth-approve">
                  Authorize
                </button>
              ) : (
                <button type="button" onClick={send} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[var(--color-accent-solid)] px-5 py-3 text-sm font-semibold" disabled={step === 'sending'} data-testid="cli-auth-approve">
                  {step === 'sending' && <Loader2 size={15} className="animate-spin" />} Authorize
                </button>
              )}
            </div>
          </>
        )}

        {step === 'paste' && (
          <>
            <h1 className="font-display text-2xl font-700">Paste this key into your terminal</h1>
            <p className="mt-2 text-sm leading-6 text-white/55">Treat it like a password. Rotate it anytime on Account.</p>
            <div className="mt-5 flex gap-2">
              <input readOnly value={user?.api_key || ''} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 font-mono text-xs text-white" aria-label="API key" />
              <button type="button" onClick={copyKey} className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-accent-solid)] px-3.5 text-sm font-semibold">
                {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <button type="button" onClick={send} className="mt-4 text-xs text-white/50 underline-offset-4 hover:text-white hover:underline">
              CLI running on this computer? Send it directly
            </button>
          </>
        )}

        {step === 'done' && (
          <>
            <h1 className="font-display text-2xl font-700">CLI connected</h1>
            <p className="mt-2 text-sm leading-6 text-white/55">Return to your terminal. Try <code className="rounded bg-white/10 px-1.5 py-0.5 text-white">mg services</code>.</p>
            <Link href="/api#cli" className="mt-6 inline-block text-sm text-[var(--color-accent-2)] hover:underline">CLI and agent docs</Link>
          </>
        )}

        {step === 'cancelled' && (
          <>
            <h1 className="font-display text-2xl font-700">Not authorized</h1>
            <p className="mt-2 text-sm leading-6 text-white/55">Nothing was shared. You can close this tab.</p>
          </>
        )}
      </section>
    </main>
  );
}
