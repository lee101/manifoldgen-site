import { errorFields, paywallFromResponse } from './paywall';

export class HTTPResponseError extends Error {
  status: number;
  statusText: string;
  data: unknown;

  constructor(message: string, res: Response, data: unknown) {
    super(message);
    this.name = 'HTTPResponseError';
    this.status = res.status;
    this.statusText = res.statusText;
    this.data = data;
  }
}

function messageFromData(data: unknown): string | null {
  const { message } = errorFields(data);
  if (message && !['not found', '404 not found'].includes(message.toLowerCase())) return message;
  return null;
}

function textFallback(text: string): string | null {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  if (
    !trimmed ||
    lower === 'not found' ||
    lower === '404 not found' ||
    lower.startsWith('<!doctype') ||
    lower.startsWith('<html')
  ) return null;
  return trimmed.slice(0, 200);
}

export function friendlyError(err: unknown, fallback: string): string {
  if (err instanceof TypeError) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return 'You are offline. Check your connection and try again.';
    }
    return 'Cannot reach the server. You may be offline, or the service is temporarily unavailable.';
  }
  return err instanceof Error ? err.message : fallback;
}

export async function parseJSONResponse<T>(res: Response, fallback: string): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();
  let data: unknown = {};

  if (text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }
  }

  if (!res.ok) {
    const message =
      messageFromData(data) ||
      textFallback(text) ||
      `${fallback} (${res.status}${res.statusText ? ` ${res.statusText}` : ''})`;
    if (res.status === 402 || (res.status === 401 && errorFields(data).code === 'auth_required')) {
      paywallFromResponse(res, data);
    }
    throw new HTTPResponseError(message, res, data);
  }

  const parsedEmptyObject =
    data !== null &&
    typeof data === 'object' &&
    !Array.isArray(data) &&
    Object.keys(data).length === 0;
  if (!contentType.includes('application/json') && text.trim() && parsedEmptyObject) {
    throw new Error(`${fallback}: expected JSON response`);
  }

  return data as T;
}
