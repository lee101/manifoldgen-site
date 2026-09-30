import { loadStoredUser, type StoredUser } from './auth';
import { PAYMENT_REQUIRED_EVENT, type PaymentDialogDetail } from './payments';

export class PaywallError extends Error {
  status: number;
  code: string;
  subscribeURL: string;

  constructor(message: string, status: number, code: string, subscribeURL = '') {
    super(message);
    this.name = 'PaywallError';
    this.status = status;
    this.code = code;
    this.subscribeURL = subscribeURL;
  }
}

export function isPaywallError(value: unknown): value is PaywallError {
  return value instanceof PaywallError;
}

export function promptSubscribe(detail: PaymentDialogDetail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<PaymentDialogDetail>(PAYMENT_REQUIRED_EVENT, { detail }));
}

type ErrorBody = { error?: unknown; code?: unknown; message?: unknown; subscribe_url?: unknown };

/** Reads {"error":"msg"} and the gateway contract {"error":{"code","message","subscribe_url"}}. */
export function errorFields(data: unknown) {
  const body = (data && typeof data === 'object' ? data : {}) as ErrorBody;
  const nested = body.error && typeof body.error === 'object' ? body.error as ErrorBody : null;
  const str = (value: unknown) => typeof value === 'string' ? value.trim() : '';
  return {
    message: str(nested ? nested.message : body.error) || str(body.message),
    code: str(nested?.code) || str(body.code),
    subscribeURL: str(nested?.subscribe_url) || str(body.subscribe_url),
  };
}

/** 401 auth_required / 402 → subscribe prompt instead of an error; returns the thrown-able error. */
export function paywallFromResponse(response: Response, data: unknown, feature?: string): PaywallError | null {
  const fields = errorFields(data);
  const auth = response.status === 401 && (fields.code === 'auth_required' || !loadStoredUser()?.api_key);
  if (response.status !== 402 && !auth) return null;
  const subscribeURL = fields.subscribeURL || response.headers.get('X-Subscribe-URL') || '';
  const reason = auth ? 'auth' : 'subscription';
  const message = auth ? `Sign in and subscribe to use ${feature || 'this tool'}.` : fields.message || 'Add credits or choose a plan to continue.';
  promptSubscribe({ reason, feature, message });
  return new PaywallError(message, response.status, fields.code || (auth ? 'auth_required' : 'subscription_required'), subscribeURL);
}

/** Client-side gate before spending GPU: signed-out or out-of-credit users get the subscribe prompt. */
export function ensurePaidAccess(feature: string, credits = 0, knownCredits?: number): StoredUser | null {
  const user = loadStoredUser();
  if (!user?.api_key) {
    promptSubscribe({ reason: 'auth', feature, message: `Sign in and subscribe to use ${feature}.` });
    return null;
  }
  const balance = knownCredits ?? user.credits;
  if (credits > 0 && knownCredits !== undefined && balance < credits) {
    promptSubscribe({ reason: 'subscription', feature, message: `${feature} needs ${credits} credit${credits === 1 ? '' : 's'}. Subscribe or top up to keep editing.` });
    return null;
  }
  return user;
}
