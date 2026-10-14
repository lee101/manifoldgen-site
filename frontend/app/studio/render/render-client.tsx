'use client';

import { useEffect, useState } from 'react';
import { blobChunks, renderStudioDocument, type StudioRenderRequest } from '../../../lib/studio-render-job';

type RenderWindow = Window & {
  __manifoldRender?: (request: StudioRenderRequest) => Promise<{ mime: string; bytes: number; chunks: string[] }>;
  __manifoldRenderState?: { status: string; progress: number; error?: string };
};

export default function RenderClient() {
  const [state, setState] = useState({ status: 'idle', progress: 0, error: '' });

  useEffect(() => {
    const target = window as RenderWindow;
    const update = (next: { status: string; progress: number; error?: string }) => {
      target.__manifoldRenderState = next;
      setState({ ...next, error: next.error || '' });
    };
    const render = async (request: StudioRenderRequest, sameOrigin: boolean, report?: (value: number) => void) => {
      update({ status: 'rendering', progress: 0 });
      try {
        const blob = await renderStudioDocument(request, {
          base: window.location.href,
          sameOrigin,
          onProgress: (progress) => {
            update({ status: 'rendering', progress });
            report?.(progress);
          },
        });
        update({ status: 'done', progress: 1 });
        return blob;
      } catch (reason) {
        const error = reason instanceof Error ? reason.message : String(reason);
        update({ status: 'failed', progress: 0, error });
        throw reason;
      }
    };
    target.__manifoldRender = async (request) => {
      const blob = await render(request, false);
      return { mime: blob.type, bytes: blob.size, chunks: await blobChunks(blob) };
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== 'manifold-render') return;
      const reply = (message: Record<string, unknown>) => (event.source as Window | null)?.postMessage({ ...message, id: event.data.id }, { targetOrigin: window.location.origin });
      render({ document: event.data.document, settings: event.data.settings }, false)
        .then((blob) => reply({ type: 'manifold-render-result', blob }))
        .catch((reason) => reply({ type: 'manifold-render-error', error: reason instanceof Error ? reason.message : String(reason) }));
    };
    window.addEventListener('message', onMessage);

    const job = new URLSearchParams(window.location.search).get('job');
    if (job && /^[a-f0-9]{16,64}$/.test(job)) {
      const base = `/job/${job}`;
      let reported = 0;
      let reportedAt = 0;
      const status = (body: Record<string, unknown>) => fetch(`${base}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => undefined);
      void (async () => {
        try {
          const response = await fetch(`${base}/document`, { cache: 'no-store' });
          if (!response.ok) throw new Error(`Render job unavailable (${response.status})`);
          const request = await response.json() as StudioRenderRequest;
          const blob = await render(request, true, (progress) => {
            const now = Date.now();
            if (progress - reported < 0.02 && now - reportedAt < 2000) return;
            reported = progress;
            reportedAt = now;
            void status({ progress });
          });
          const uploaded = await fetch(`${base}/result`, { method: 'PUT', headers: { 'Content-Type': blob.type }, body: blob });
          if (!uploaded.ok) throw new Error(`Result upload failed (${uploaded.status})`);
        } catch (reason) {
          await status({ error: reason instanceof Error ? reason.message : String(reason) });
        }
      })();
    }
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <div data-testid="studio-render" data-status={state.status} style={{ position: 'fixed', inset: 0, zIndex: 2147483647, background: '#000', color: '#9ca3af', font: '12px monospace', padding: 16 }}>
      {state.status === 'failed' ? state.error : `${state.status} ${Math.round(state.progress * 100)}%`}
    </div>
  );
}
