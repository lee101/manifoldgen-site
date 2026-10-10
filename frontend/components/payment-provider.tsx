'use client';

import Link from 'next/link';
import { Check, Layers3, Loader2, Sparkles, WandSparkles, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadStoredUser, refreshUser } from '../lib/auth';
import {
  CREDIT_TOPUPS_USD,
  CREDITS_UPDATED_EVENT,
  OPEN_PAYMENT_EVENT,
  SUBSCRIPTION_PLANS,
  PAYMENT_REQUIRED_EVENT,
  type PaymentDialogDetail,
  type SubscriptionPlanKind,
} from '../lib/payments';
import { parseJSONResponse } from '../lib/http';
import styles from './payment-provider.module.css';

type CheckoutKind = 'credits' | SubscriptionPlanKind;

const planLabels = Object.fromEntries(SUBSCRIPTION_PLANS.map((plan) => [plan.kind, plan.label])) as Record<Exclude<CheckoutKind, 'credits'>, string>;

function signInHref() {
  if (typeof window === 'undefined') return '/account';
  return `/account?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
}
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
  const [feature, setFeature] = useState('');
  const [signedIn, setSignedIn] = useState(false);
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
      setFeature(detail?.feature || '');
      setSignedIn(!!loadStoredUser()?.api_key && detail?.reason !== 'auth');
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
      window.location.assign(signInHref());
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
	      const data = await parseJSONResponse<{ url?: string; client_secret?: string; publishable_key?: string }>(response, 'Checkout failed');
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
          <div><span className={styles.eyebrow}>{feature ? `Unlock ${feature}` : 'Keep creating'}</span><h2 id="payment-dialog-title">{signedIn ? 'Add credits or subscribe' : 'Subscribe to start creating'}</h2><p>{reason}</p></div>
          <button type="button" className={styles.close} onClick={close} aria-label="Close payment dialog"><X size={17} /></button>
        </header>
        <div className={styles.body}>
          {step === 'choose' && <>
            {!signedIn && <div className={styles.valueProps} data-testid="subscribe-value-props">
              <span><Layers3 size={14} /> {feature === 'Image Editor' ? 'Split foregrounds, select any object, regenerate only what you choose' : 'Every ManifoldGen image, video, audio and editing tool on one account'}</span>
              <span><Sparkles size={14} /> Unlimited images on Creator and Pro, plus rollover credits for edits and video</span>
              <span><WandSparkles size={14} /> Failed GPU jobs refund automatically</span>
            </div>}
            <div className={styles.plans}>
              {SUBSCRIPTION_PLANS.map((plan) => <button type="button" key={plan.kind} className={`${styles.plan} ${plan.recommended ? styles.planRecommended : ''}`} disabled={busy} onClick={() => void startCheckout(plan.kind)}>
                {plan.recommended && <span className={styles.tag}>Recommended</span>}<b>{plan.title}</b><small>{plan.detail}</small>
              </button>)}
            </div>
            <div className={styles.divider}>Or make a one-time top-up</div>
            <div className={styles.creditOptions}>{CREDIT_TOPUPS_USD.map((amount) => <button type="button" key={amount} disabled={busy} onClick={() => void startCheckout('credits', amount)}>${amount}</button>)}</div>
            {!signedIn && <a className={styles.signinCta} href={signInHref()} data-testid="subscribe-signin-cta">Create a free account or sign in to subscribe</a>}
            {busy && <div className={styles.busy}><Loader2 className={styles.spin} size={15} /> Preparing secure checkout…</div>}
            {error && <p className={styles.error} role="alert">{error} {!loadStoredUser() && <Link href={signInHref()}>Sign in</Link>}</p>}
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
