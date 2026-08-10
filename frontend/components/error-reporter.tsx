'use client';

import { useEffect } from 'react';

type BrowserConnection = {
  downlink?: number;
  effectiveType?: string;
  rtt?: number;
  saveData?: boolean;
};

function getSessionID() {
  const key = 'manifoldgen-error-session';
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const value = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  window.sessionStorage.setItem(key, value);
  return value;
}

function asError(reason: unknown) {
  if (reason instanceof Error) return reason;
  if (typeof reason === 'string') return new Error(reason);
  try {
    return new Error(JSON.stringify(reason));
  } catch {
    return new Error(String(reason));
  }
}

export default function ErrorReporter() {
  useEffect(() => {
    const sent = new Set<string>();
    const sessionID = getSessionID();

    const report = (source: string, error: Error, location = '') => {
      const message = (error.message || String(error)).slice(0, 2000);
      const stack = (error.stack || '').slice(0, 12000);
      const fingerprint = `${source}|${error.name}|${message}|${stack.split('\n')[1] || location}`.slice(0, 200);
      if (!message || sent.has(fingerprint)) return;
      sent.add(fingerprint);

      const navigatorWithConnection = navigator as Navigator & { connection?: BrowserConnection };
      const connection = navigatorWithConnection.connection;
      const payload = {
        level: 'error',
        message,
        name: error.name || 'Error',
        stack,
        source,
        component: 'window',
        url: window.location.href,
        referrer: document.referrer,
        userAgent: navigator.userAgent,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        screen: { width: window.screen.width, height: window.screen.height },
        connection: connection
          ? {
              downlink: connection.downlink,
              effectiveType: connection.effectiveType,
              rtt: connection.rtt,
              saveData: connection.saveData,
            }
          : {},
        appVersion: process.env.NEXT_PUBLIC_APP_VERSION || 'production',
        buildId: process.env.NEXT_PUBLIC_BUILD_ID || '',
        sessionId: sessionID,
        occurredAt: new Date().toISOString(),
        fingerprint,
      };

      void fetch('/api/frontend-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'same-origin',
        keepalive: true,
      }).catch(() => {});
    };

    const onError = (event: ErrorEvent) => {
      const error = event.error instanceof Error ? event.error : new Error(event.message || 'Unknown window error');
      report('window.error', error, `${event.filename}:${event.lineno}:${event.colno}`);
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      report('unhandledrejection', asError(event.reason));
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  return null;
}
