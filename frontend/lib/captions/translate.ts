import { paywallFromResponse } from '../paywall';

export type TranslateOptions = {
  apiKey: string;
  language: string;
  signal?: AbortSignal;
};

type TranslateReply = { lines?: string[]; error?: string };

/** Translate one subtitle line per caption page; the reply keeps the same order and length. */
export async function translateCaptionLines(lines: string[], options: TranslateOptions): Promise<string[]> {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch('/api/captions/translate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: options.language, lines }),
      signal: options.signal,
    });
    const data: TranslateReply = await response.json().catch(() => ({}));
    const paywall = paywallFromResponse(response, data, 'Crazy Captions');
    if (paywall) throw paywall;
    if (response.ok) {
      const out = data.lines || [];
      return lines.map((line, i) => (typeof out[i] === 'string' ? out[i] : ''));
    }
    if (attempt < 2 && (response.status === 429 || response.status >= 500)) {
      const { promise, resolve } = Promise.withResolvers<void>();
      setTimeout(resolve, 900 * (attempt + 1));
      await promise;
      continue;
    }
    throw new Error(data.error || `Translation failed (${response.status})`);
  }
}
