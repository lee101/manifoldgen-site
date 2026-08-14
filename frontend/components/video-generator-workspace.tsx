'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Check, Clapperboard, Code2, Copy, Loader2, Play, SlidersHorizontal, WandSparkles } from 'lucide-react';
import { loadStoredUser } from '@/lib/auth';
import { generatorRequest, type VideoGenerator } from '@/lib/video-generators';

type JobPayload = {
  status?: string;
  result?: unknown;
  job?: { status?: string; result?: unknown; error?: string };
  error?: string;
};

function videoURL(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const row = value as Record<string, unknown>;
  if (typeof row.video_url === 'string') return row.video_url;
  if (row.result) return videoURL(row.result);
  return '';
}

function jobID(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const row = value as Record<string, unknown>;
  if (typeof row.job_id === 'string') return row.job_id;
  if (row.result) return jobID(row.result);
  return '';
}

async function responseJSON(response: Response) {
  const data = await response.json().catch(() => ({})) as JobPayload;
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export function VideoGeneratorWorkspace({ generator, apiOnly = false }: { generator: VideoGenerator; apiOnly?: boolean }) {
  const defaultPrompt = generator.example?.prompt || 'A cinematic tracking shot through a rain-soaked night market, natural motion, rich reflections';
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [imageURL, setImageURL] = useState(generator.example?.imageURL || '');
  const [duration, setDuration] = useState(generator.durations[0]);
  const [aspectRatio, setAspectRatio] = useState(generator.aspectRatios[0]);
  const [resolution, setResolution] = useState(generator.resolutions[0]);
  const [includeAudio, setIncludeAudio] = useState(generator.audio);
  const [seed, setSeed] = useState('');
  const [status, setStatus] = useState(generator.example ? 'Example output' : '');
  const [outputURL, setOutputURL] = useState(generator.example?.outputURL || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const stopped = useRef(false);

  useEffect(() => {
    setPrompt(generator.example?.prompt || 'A cinematic tracking shot through a rain-soaked night market, natural motion, rich reflections');
    setImageURL(generator.example?.imageURL || '');
    setStatus(generator.example ? 'Example output' : '');
    setOutputURL(generator.example?.outputURL || '');
    setError('');
  }, [generator]);

  const request = useMemo(() => generatorRequest(generator, {
    prompt, imageURL, duration, aspectRatio, resolution, includeAudio,
    seed: seed.trim() ? Number(seed) : undefined,
  }), [aspectRatio, duration, generator, imageURL, includeAudio, prompt, resolution, seed]);
  const curl = `curl https://manifoldgen.com/api/service \\\n+  -X POST \\\n+  -H "Authorization: Bearer $MANIFOLDGEN_API_KEY" \\\n+  -H "Content-Type: application/json" \\\n+  -d '${JSON.stringify(request, null, 2)}'`;
  const displayCurl = curl.replace(/\n\+/g, '\n');

  async function generate() {
    const user = loadStoredUser();
    if (!user?.api_key) {
      setError('Sign in and create an API key to run this generator.');
      return;
    }
    if (!prompt.trim()) { setError('Add a prompt first.'); return; }
    if (generator.mode !== 'text' && !imageURL.trim()) { setError('Add a public HTTPS image URL for this generator.'); return; }
    stopped.current = false;
    setBusy(true); setError(''); setOutputURL(''); setStatus('Queueing generation…');
    try {
      const response = await fetch('/api/service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.api_key}` },
        body: JSON.stringify(request),
      });
      const queued = await responseJSON(response);
      const immediateURL = videoURL(queued);
      if (immediateURL) { setOutputURL(immediateURL); setStatus('Completed'); return; }
      const id = jobID(queued);
      if (!id) throw new Error('The generation service returned no job ID.');
      setStatus('Rendering video…');
      for (let attempt = 0; attempt < 360 && !stopped.current; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 2500));
        const poll = await fetch(`/api/video-jobs/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${user.api_key}` } });
        const data = await responseJSON(poll);
        const state = String(data.job?.status || data.status || '').toLowerCase();
        const url = videoURL(data.job?.result || data.result);
        if (url || state === 'completed') {
          if (!url) throw new Error('Generation completed without a video URL.');
          setOutputURL(url); setStatus('Completed'); return;
        }
        if (['failed', 'cancelled', 'payment_required'].includes(state)) throw new Error(data.job?.error || `Generation ${state.replace('_', ' ')}.`);
        setStatus(state === 'queued' ? 'Waiting for a worker…' : 'Rendering video…');
      }
      if (!stopped.current) throw new Error('Generation is still running. You can recover it from the Studio video library.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Generation failed.');
      setStatus('');
    } finally {
      setBusy(false);
    }
  }

  async function copyCurl() {
    await navigator.clipboard.writeText(displayCurl);
    setStatus('API request copied');
  }

  return (
    <div className={`grid overflow-hidden rounded-3xl border border-white/15 bg-[#151824] ${apiOnly ? '' : 'lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]'}`}>
      {!apiOnly && (
        <section className="border-b border-white/15 bg-white/[0.025] p-5 sm:p-7 lg:border-b-0 lg:border-r">
          <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
            <SlidersHorizontal size={14} /> Generator controls
          </div>
          <label className="block text-sm font-semibold text-white/75">Describe the shot</label>
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={5} className="mt-2 w-full resize-none rounded-2xl border border-white/15 bg-[#171b27] p-4 text-sm leading-6 outline-none transition focus:border-white/35" />
          {generator.mode !== 'text' && (
            <div className="mt-5">
              <label htmlFor={`${generator.slug}-source-image`} className="block text-sm font-semibold text-white/75">{generator.mode === 'reference' ? 'Reference image URL' : 'Starting image URL'}</label>
              <input id={`${generator.slug}-source-image`} value={imageURL} onChange={(event) => setImageURL(event.target.value)} placeholder="https://…/image.webp" className="mt-2 w-full rounded-xl border border-white/15 bg-[#171b27] px-4 py-3 text-sm outline-none focus:border-white/35" />
              <p className="mt-2 text-xs leading-5 text-white/50">Use a public HTTPS URL. Uploads from the homepage and Studio provide one automatically.</p>
            </div>
          )}
          {generator.manifold && (
            <div className="mt-5">
              <label className="block text-sm font-semibold text-white/75">Optional starting image URL</label>
              <input value={imageURL} onChange={(event) => setImageURL(event.target.value)} placeholder="https://…/first-frame.webp" className="mt-2 w-full rounded-xl border border-white/15 bg-[#171b27] px-4 py-3 text-sm outline-none focus:border-white/35" />
            </div>
          )}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Field label="Duration"><select value={duration} onChange={(event) => setDuration(Number(event.target.value))}>{generator.durations.map((value) => <option key={value} value={value}>{value} seconds</option>)}</select></Field>
            <Field label="Aspect ratio"><select value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value)}>{generator.aspectRatios.map((value) => <option key={value}>{value}</option>)}</select></Field>
            <Field label="Resolution"><select value={resolution} onChange={(event) => setResolution(event.target.value)}>{generator.resolutions.map((value) => <option key={value}>{value}</option>)}</select></Field>
            <Field label="Seed"><input value={seed} onChange={(event) => setSeed(event.target.value.replace(/[^0-9]/g, ''))} placeholder="Random" inputMode="numeric" /></Field>
          </div>
          {generator.audio && <label className="mt-4 flex items-center gap-3 text-sm text-white/65"><input type="checkbox" checked={includeAudio} onChange={(event) => setIncludeAudio(event.target.checked)} className="accent-[var(--color-accent)]" /> Generate audio</label>}
          <button onClick={generate} disabled={busy} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-black transition hover:bg-white/90 disabled:opacity-55">
            {busy ? <Loader2 className="animate-spin" size={17} /> : <WandSparkles size={17} />} {busy ? status || 'Generating…' : `Generate with ${generator.shortName}`}
          </button>
          {error && <div className="mt-4 rounded-xl border border-red-300/15 bg-red-400/[0.06] p-3 text-sm text-red-100/75">{error} {error.startsWith('Sign in') && <Link href="/account" className="ml-1 underline">Open account</Link>}</div>}
        </section>
      )}

      <section className="min-w-0 p-5 sm:p-7">
        {!apiOnly && (
          <>
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40"><Play size={14} /> Output</div>
              {status && <span className="text-xs text-white/45">{status}</span>}
            </div>
            <div className="flex aspect-video items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-[#0d1018]">
              {outputURL ? <video data-testid="video-generator-output" src={outputURL} controls playsInline className="h-full w-full object-contain" /> : <div className="max-w-xs p-8 text-center"><Clapperboard className="mx-auto text-white/20" size={36} /><p className="mt-4 text-sm leading-6 text-white/35">Your generated shot will appear here, ready to download or place on the Studio timeline.</p></div>}
            </div>
            {outputURL && <div className="mt-4 flex flex-wrap gap-3"><Link href={`/studio?video_url=${encodeURIComponent(outputURL)}&name=${encodeURIComponent(`${generator.shortName} generation`)}`} className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold"><Clapperboard size={16} /> Edit in Studio</Link><a href={outputURL} download className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/65 hover:text-white">Open video <ArrowUpRight size={15} /></a></div>}
          </>
        )}
        <div className={apiOnly ? '' : 'mt-8 border-t border-white/10 pt-7'}>
          <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40"><Code2 size={14} /> API request</div><button onClick={copyCurl} className="inline-flex items-center gap-1.5 text-xs text-white/45 hover:text-white"><Copy size={13} /> Copy</button></div>
          <pre className="max-h-[430px] overflow-auto rounded-2xl border border-white/15 bg-[#0d1018] p-4 text-xs leading-5 text-white/75"><code>{displayCurl}</code></pre>
          <div className="mt-4 flex items-start gap-2 text-xs leading-5 text-white/55"><Check size={14} className="mt-0.5 shrink-0 text-[var(--color-accent-2)]" /> The API and this tester use the same request. Provider routing stays behind ManifoldGen.</div>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactElement<{ className?: string }> }) {
  return <label className="text-xs font-semibold text-white/55">{label}{children && <span className="mt-2 block [&>input]:w-full [&>input]:rounded-xl [&>input]:border [&>input]:border-white/15 [&>input]:bg-[#171b27] [&>input]:px-3 [&>input]:py-2.5 [&>input]:text-sm [&>input]:text-white [&>input]:outline-none [&>select]:w-full [&>select]:rounded-xl [&>select]:border [&>select]:border-white/15 [&>select]:bg-[#171b27] [&>select]:px-3 [&>select]:py-2.5 [&>select]:text-sm [&>select]:text-white [&>select]:outline-none">{children}</span>}</label>;
}
