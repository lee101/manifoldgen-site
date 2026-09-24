export const PAYMENT_REQUIRED_EVENT = 'manifold:payment-required';
export const OPEN_PAYMENT_EVENT = 'manifold:open-payment';
export const CREDITS_UPDATED_EVENT = 'manifold:credits-updated';

export type PaymentDialogDetail = {
  message?: string;
  feature?: string;
  reason?: 'auth' | 'subscription';
};

export type SubscriptionPlanKind = 'creator_monthly' | 'creator_annual' | 'pro_monthly' | 'pro_annual';

export const SUBSCRIPTION_PLANS: { kind: SubscriptionPlanKind; title: string; label: string; detail: string; recommended?: boolean }[] = [
  { kind: 'creator_monthly', title: 'Creator monthly · $14.99/month', label: 'Creator monthly · $14.99/month', detail: 'Unlimited images plus $25 of rollover generation credits each month.', recommended: true },
  { kind: 'creator_annual', title: 'Creator · $149/year', label: 'Creator annual · $149/year', detail: 'Two months free, plus $300 of rollover generation credits for the year.' },
  { kind: 'pro_monthly', title: 'Pro · $49/month', label: 'Pro monthly · $49/month', detail: 'Unlimited images and a higher-volume creator workspace.' },
  { kind: 'pro_annual', title: 'Pro · $490/year', label: 'Pro annual · $490/year', detail: 'Two months free on a full year of Pro.' },
];

export const CREDIT_TOPUPS_USD = [10, 25, 50];

export function openPaymentDialog(detail: PaymentDialogDetail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<PaymentDialogDetail>(OPEN_PAYMENT_EVENT, { detail }));
}
