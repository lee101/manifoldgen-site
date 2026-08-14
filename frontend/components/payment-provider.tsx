'use client';

import Link from 'next/link';
import { Check, Loader2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadStoredUser, refreshUser } from '../lib/auth';
import {
  CREDITS_UPDATED_EVENT,
  OPEN_PAYMENT_EVENT,
  PAYMENT_REQUIRED_EVENT,
  type PaymentDialogDetail,
} from '../lib/payments';
import styles from './payment-provider.module.css';

type CheckoutKind = 'credits' | 'creator_monthly' | 'creator_annual' | 'pro_monthly' | 'pro_annual';

const planLabels: Record<Exclude<CheckoutKind, 'credits'>, string> = {
  creator_monthly: 'Creator monthly · $14.99/month',
  creator_annual: 'Creator annual · $149/year',
  pro_monthly: 'Pro monthly · $49/month',
  pro_annual: 'Pro annual · $490/year',
};
type DialogStep = 'choose' | 'checkout' | 'success';

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

type StripeWindow = Window & {
  Stripe?: (publishableKey: string) => StripeBrowserClient;
};

let stripeJsPromise: Promise<void> | null = null;

function loadStripeJS() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Stripe.js requires a browser'));
  if ((window as StripeWindow).Stripe) return Promise.resolve();
  if (stripeJsPromise) return stripeJsPromise;
  stripeJsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://js.stripe.com/v3/"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load secure checkout')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load secure checkout'));
    document.head.appendChild(script);
  });
  return stripeJsPromise;
}

export default function PaymentProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [step, setStep] = useState<DialogStep>('choose');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [publishableKey, setPublishableKey] = useState('');
  const [checkoutLabel, setCheckoutLabel] = useState('');
  const checkoutMountRef = useRef<HTMLDivElement | null>(null);
  const checkoutRef = useRef<StripeEmbeddedCheckout | null>(null);

  const close = useCallback(() => {
    checkoutRef.current?.destroy();
    checkoutRef.current = null;
    setClientSecret('');
    setPublishableKey('');
    setStep('choose');
    setOpen(false);
  }, []);

  useEffect(() => {
    const show = (event: Event) => {
      const detail = (event as CustomEvent<PaymentDialogDetail>).detail;
      setReason(detail?.message || 'Add credits or choose a plan to continue.');
      setError('');
      setStep('choose');
      setOpen(true);
    };
    window.addEventListener(PAYMENT_REQUIRED_EVENT, show);
    window.addEventListener(OPEN_PAYMENT_EVENT, show);
    return () => {
      window.removeEventListener(PAYMENT_REQUIRED_EVENT, show);
      window.removeEventListener(OPEN_PAYMENT_EVENT, show);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      close();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [close, open]);

  useEffect(() => {
    if (!clientSecret || !publishableKey || !checkoutMountRef.current) return;
    let cancelled = false;
    const mount = async () => {
      try {
        await loadStripeJS();
        if (cancelled) return;
        const stripe = (window as StripeWindow).Stripe?.(publishableKey);
        if (!stripe) throw new Error('Secure checkout did not initialize');
        const checkout = await stripe.initEmbeddedCheckout({
          clientSecret,
          onComplete: async () => {
            checkoutRef.current?.destroy();
            checkoutRef.current = null;
            setClientSecret('');
            setStep('success');
            const stored = loadStoredUser();
            const next = stored ? await refreshUser(stored.api_key) : null;
            window.dispatchEvent(new CustomEvent(CREDITS_UPDATED_EVENT, { detail: { user: next } }));
          },
        });
        if (cancelled) {
          checkout.destroy();
          return;
        }
        checkout.mount(checkoutMountRef.current!);
        checkoutRef.current = checkout;
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Could not open secure checkout');
      }
    };
    void mount();
    return () => {
      cancelled = true;
      checkoutRef.current?.destroy();
      checkoutRef.current = null;
    };
  }, [clientSecret, publishableKey]);

  async function startCheckout(kind: CheckoutKind, amountUSD = 25) {
    const stored = loadStoredUser();
    if (!stored?.api_key) {
      setError('Sign in to add credits or start a subscription.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/stripe-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${stored.api_key}` },
        body: JSON.stringify(kind === 'credits'
          ? { type: 'credits', amount_usd: amountUSD, return_url: window.location.href }
          : { type: 'subscription', plan: kind, return_url: window.location.href }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Checkout failed');
      if (data.url && !data.client_secret) {
        window.location.assign(data.url);
        return;
      }
      if (!data.client_secret || !data.publishable_key) throw new Error('Secure checkout is unavailable');
      setCheckoutLabel(kind === 'credits' ? `$${amountUSD} credit top-up` : planLabels[kind]);
      setPublishableKey(data.publishable_key);
      setClientSecret(data.client_secret);
      setStep('checkout');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Checkout failed');
    } finally {
      setBusy(false);
    }
  }

  return <>
    {children}
    {open && <div className={styles.backdrop} data-testid="payment-dialog" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="payment-dialog-title">
        <header className={styles.header}>
          <div><span className={styles.eyebrow}>Keep creating</span><h2 id="payment-dialog-title">Add credits or subscribe</h2><p>{reason}</p></div>
          <button type="button" className={styles.close} onClick={close} aria-label="Close payment dialog"><X size={17} /></button>
        </header>
        <div className={styles.body}>
          {step === 'choose' && <>
            <div className={styles.plans}>
              <button type="button" className={`${styles.plan} ${styles.planRecommended}`} disabled={busy} onClick={() => void startCheckout('creator_monthly')}>
                <span className={styles.tag}>Recommended</span><b>Creator monthly · $14.99/month</b><small>Unlimited images plus $25 of rollover generation credits each month.</small>
              </button>
              <button type="button" className={styles.plan} disabled={busy} onClick={() => void startCheckout('creator_annual')}>
                <b>Creator · $149/year</b><small>Two months free, plus $300 of rollover generation credits for the year.</small>
              </button>
              <button type="button" className={styles.plan} disabled={busy} onClick={() => void startCheckout('pro_monthly')}>
                <b>Pro · $49/month</b><small>Unlimited images and a higher-volume creator workspace.</small>
              </button>
              <button type="button" className={styles.plan} disabled={busy} onClick={() => void startCheckout('pro_annual')}>
                <b>Pro · $490/year</b><small>Two months free on a full year of Pro.</small>
              </button>
            </div>
            <div className={styles.divider}>Or make a one-time top-up</div>
            <div className={styles.creditOptions}>{[10, 25, 50].map((amount) => <button type="button" key={amount} disabled={busy} onClick={() => void startCheckout('credits', amount)}>${amount}</button>)}</div>
            {busy && <div className={styles.busy}><Loader2 className={styles.spin} size={15} /> Preparing secure checkout…</div>}
            {error && <p className={styles.error} role="alert">{error} {!loadStoredUser() && <Link href="/account">Sign in</Link>}</p>}
          </>}
          {step === 'checkout' && <>
            <div className={styles.checkoutHeader}><div><b>Secure checkout</b><div className={styles.checkoutLabel}>{checkoutLabel}</div></div><button type="button" onClick={() => { setClientSecret(''); setPublishableKey(''); setStep('choose'); }}>Change</button></div>
            {error && <p className={styles.error} role="alert">{error}</p>}
            <div ref={checkoutMountRef} className={styles.checkoutMount} data-testid="global-checkout-mount" />
          </>}
          {step === 'success' && <div className={styles.success}><span className={styles.successIcon}><Check size={25} /></span><h3>Payment complete</h3><p>Your balance is refreshed. You can continue where you left off.</p><button type="button" className={styles.done} onClick={close}>Continue creating</button></div>}
        </div>
      </section>
    </div>}
  </>;
}
