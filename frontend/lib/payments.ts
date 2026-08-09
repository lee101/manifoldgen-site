export const PAYMENT_REQUIRED_EVENT = 'manifold:payment-required';
export const OPEN_PAYMENT_EVENT = 'manifold:open-payment';
export const CREDITS_UPDATED_EVENT = 'manifold:credits-updated';

export type PaymentDialogDetail = {
  message?: string;
};

export function openPaymentDialog(detail: PaymentDialogDetail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<PaymentDialogDetail>(OPEN_PAYMENT_EVENT, { detail }));
}
