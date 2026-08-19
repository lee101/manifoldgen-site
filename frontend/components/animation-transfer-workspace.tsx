'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, Film, Image as ImageIcon, Loader2, Play, Upload, WandSparkles } from 'lucide-react';
import { loadStoredUser, refreshUser, saveUser } from '@/lib/auth';

type JobResponse = {
  error?: string;
  result?: unknown;
  job?: { status?: string; result?: unknown; error?: string };
};

function findJobID(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const row = value as Record<string, unknown>;
  if (typeof row.job_id === 'string') return row.job_id;
  return findJobID(row.result);
}

function findVideoURL(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const row = value as Record<string, unknown>;
  if (typeof row.video_url === 'string') return row.video_url;
  if (typeof row.url === 'string') return row.url;
  return findVideoURL(row.result);
}

async function responseJSON(response: Response, fallback: string) {
  const data = await response.json().catch(() => ({})) as JobResponse;
  if (!response.ok) throw new Error(data.error || fallback);
  return data;
}

async function uploadPublic(file: File, apiKey: string) {
  const query = new URLSearchParams({ filename: file.name, content_type: file.type || 'application/octet-stream', dataset: 'animation-transfer' });
  const preparedResponse = await fetch(`/api/uploads/presign?${query}`, { headers: { Authorization: `Bearer ${apiKey}` } });
  const prepared = await responseJSON(preparedResponse, 'Could not prepare media upload') as JobResponse & { upload_url?: string; public_url?: string };
  if (!prepared.upload_url || !prepared.public_url) throw new Error('Upload service returned no destination');
  const upload = await fetch(prepared.upload_url, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
  if (!upload.ok) throw new Error(`Media upload failed (${upload.status})`);
  return prepared.public_url;
}

function FileDrop({ kind, file, onFile }: { kind: 'image' | 'video'; file: File | null; onFile: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState('');
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const isImage = kind === 'image';
  return (
    <button type="button" data-testid={`animate-${kind}-drop`} onClick={() => input.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const next = event.dataTransfer.files[0]; if (next) onFile(next); }} className="group relative flex min-h-56 overflow-hidden rounded-2xl border border-dashed border-white/15 bg-black/25 text-left transition hover:border-white/35">
      <input ref={input} hidden type="file" accept={isImage ? 'image/*' : 'video/*'} onChange={(event) => { const next = event.target.files?.[0]; if (next) onFile(next); event.target.value = ''; }} />
      {preview ? isImage ? <img src={preview} alt="Reference subject preview" className="absolute inset-0 h-full w-full object-contain bg-black/40" /> : <video src={preview} muted playsInline className="absolute inset-0 h-full w-full object-contain bg-black/40" /> : null}
      <span className={`relative z-10 m-auto flex max-w-56 flex-col items-center p-6 text-center ${preview ? 'rounded-2xl bg-black/70 opacity-0 backdrop-blur transition group-hover:opacity-100' : ''}`}>
        {isImage ? <ImageIcon size={25} className="text-[#ff9c72]" /> : <Film size={25} className="text-[#8c7cff]" />}
        <b className="mt-3 text-sm">{file ? 'Replace file' : isImage ? 'Choose subject image' : 'Choose driving video'}</b>
        <small className="mt-2 leading-5 text-white/40">{file?.name || (isImage ? 'A clear, full-body character works best' : 'Motion, expression, timing, and audio transfer')}</small>
      </span>
    </button>
  );
}

export function AnimationTransferWorkspace() {
  const [image, setImage] = useState<File | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [prompt, setPrompt] = useState('A full-body dancer in a detailed contemporary outfit, natural face, cinematic studio lighting, clean background');
  const [quality, setQuality] = useState<'preview' | 'balanced' | 'high'>('preview');
  const [duration, setDuration] = useState(5);
  const [fps, setFPS] = useState(24);
  const [seed, setSeed] = useState('');
  const [preserveAudio, setPreserveAudio] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [outputURL, setOutputURL] = useState('');
  const stopped = useRef(false);

  const estimateUSD = useMemo(() => Math.ceil(duration * (quality === 'preview' ? .20 : quality === 'balanced' ? .32 : .60) * 100) / 100, [duration, quality]);
  const estimateCredits = Math.ceil(estimateUSD * 100);

  async function generate() {
    const user = loadStoredUser();
    if (!user?.api_key) { setError('Sign in to run Animation Transfer.'); return; }
    if (!image || !video) { setError('Add both a subject image and a driving video.'); return; }
    if (!prompt.trim()) { setError('Describe the subject and scene.'); return; }
    stopped.current = false;
    setBusy(true); setError(''); setOutputURL(''); setStatus('Uploading source media…');
    try {
      const [imageURL, videoURL] = await Promise.all([uploadPublic(image, user.api_key), uploadPublic(video, user.api_key)]);
      setStatus('Queueing Animation Transfer…');
      const response = await fetch('/api/service', {
        method: 'POST', headers: { Authorization: `Bearer ${user.api_key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: 'video_restyle', model: 'wan-animate-2', image_url: imageURL, video_url: videoURL,
          prompt: prompt.trim(), resolution: quality, duration, frames_per_second: fps,
          num_frames: 37, num_steps: 10, include_audio: preserveAudio,
          ...(seed.trim() ? { seed: Number(seed) } : {}),
        }),
      });
      const queued = await responseJSON(response, 'Could not start Animation Transfer');
      const id = findJobID(queued);
      if (!id) throw new Error('Animation Transfer returned no job ID');
      for (let attempt = 0; attempt < 1440 && !stopped.current; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 2500));
        const poll = await fetch(`/api/video-jobs/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${user.api_key}` } });
        const data = await responseJSON(poll, 'Could not read Animation Transfer status');
        const state = String(data.job?.status || '').toLowerCase();
        const url = findVideoURL(data.job?.result);
        if (url || state === 'completed') {
          if (!url) throw new Error('Animation Transfer completed without a video');
          setOutputURL(url); setStatus('Animation ready');
          const refreshed = await refreshUser(user.api_key).catch(() => null);
          if (refreshed) saveUser(refreshed);
          return;
        }
        if (['failed', 'cancelled', 'canceled', 'payment_required'].includes(state)) throw new Error(data.job?.error || `Animation Transfer ${state.replace('_', ' ')}`);
        setStatus(state === 'queued' ? 'Waiting for an economical GPU worker…' : 'Transferring motion frame by frame…');
      }
      throw new Error('The job is still running and remains recoverable from your Studio library.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Animation Transfer failed');
      setStatus('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid overflow-hidden rounded-3xl border border-white/15 bg-[#151824] lg:grid-cols-[minmax(0,.92fr)_minmax(0,1.08fr)]">
        <section className="border-b border-white/15 bg-white/[0.025] p-5 sm:p-7 lg:border-b-0 lg:border-r">
        <div className="grid gap-3 sm:grid-cols-2"><FileDrop kind="image" file={image} onFile={setImage} /><FileDrop kind="video" file={video} onFile={setVideo} /></div>
        <label className="mt-6 block text-sm font-semibold text-white/75">Describe the subject and scene</label>
        <textarea data-testid="animate-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={4} className="mt-2 w-full resize-none rounded-2xl border border-white/15 bg-[#171b27] p-4 text-sm leading-6 outline-none focus:border-white/35" />
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-white/55">QUALITY<select data-testid="animate-quality" value={quality} onChange={(event) => setQuality(event.target.value as typeof quality)} className="mt-2 w-full rounded-xl border border-white/15 bg-[#171b27] px-3 py-3 text-sm text-white"><option value="preview">Preview · 640×480 area</option><option value="balanced">Balanced · 800×640 area</option><option value="high">High · 1280×720 area</option></select></label>
          <label className="text-xs font-semibold text-white/55">DURATION<select data-testid="animate-duration" value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-white/15 bg-[#171b27] px-3 py-3 text-sm text-white">{[3, 5, 10, 15].map((value) => <option key={value} value={value}>{value} seconds</option>)}</select></label>
          <label className="text-xs font-semibold text-white/55">FRAME RATE<select value={fps} onChange={(event) => setFPS(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-white/15 bg-[#171b27] px-3 py-3 text-sm text-white">{[12, 16, 24, 30].map((value) => <option key={value} value={value}>{value} fps</option>)}</select></label>
          <label className="text-xs font-semibold text-white/55">SEED<input value={seed} onChange={(event) => setSeed(event.target.value.replace(/[^0-9]/g, ''))} placeholder="Random" inputMode="numeric" className="mt-2 w-full rounded-xl border border-white/15 bg-[#171b27] px-3 py-3 text-sm text-white outline-none" /></label>
        </div>
        <label className="mt-4 flex items-center gap-3 text-sm text-white/60"><input type="checkbox" checked={preserveAudio} onChange={(event) => setPreserveAudio(event.target.checked)} className="accent-[#8c7cff]" /> Preserve the driving video audio</label>
        <div className="mt-5 flex items-center justify-between rounded-xl border border-white/10 bg-white/[.025] px-4 py-3"><span><b className="block text-sm">Estimated price</b><small className="text-white/40">Final charge is 2× measured compute</small></span><strong data-testid="animate-estimate" className="text-right text-lg">~{estimateCredits} credits<small className="block text-xs font-normal text-white/35">${estimateUSD.toFixed(2)}</small></strong></div>
        <button data-testid="animate-submit" onClick={() => void generate()} disabled={busy} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-black transition hover:bg-white/90 disabled:opacity-55">{busy ? <Loader2 className="animate-spin" size={17} /> : <WandSparkles size={17} />}{busy ? status || 'Animating…' : 'Transfer animation'}</button>
        {error && <div role="alert" className="mt-4 rounded-xl border border-red-300/15 bg-red-400/[.06] p-3 text-sm text-red-100/75">{error} {error.startsWith('Sign in') && <Link href="/account" className="underline">Open account</Link>}</div>}
      </section>
      <section className="min-w-0 p-5 sm:p-7">
        <div className="mb-5 flex items-center justify-between"><span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-white/55"><Play size={14} /> Output</span>{status && <small className="text-white/60">{status}</small>}</div>
        <div className="flex aspect-video items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-[#0d1018]">{outputURL ? <video data-testid="animate-output" src={outputURL} controls playsInline className="h-full w-full object-contain" /> : <div className="max-w-sm p-8 text-center"><Film className="mx-auto text-white/25" size={38} /><p className="mt-4 text-sm leading-6 text-white/55">The reference subject will follow the driving performance while keeping detailed identity and clean frame-to-frame motion.</p></div>}</div>
        {outputURL && <div className="mt-4 flex flex-wrap gap-3"><Link href={`/studio?video_url=${encodeURIComponent(outputURL)}&name=${encodeURIComponent('Animation Transfer')}`} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-black">Open in Studio <ArrowRight size={15} /></Link><a href={outputURL} download className="rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-white/70">Download MP4</a></div>}
        <div className="mt-8 grid gap-3 sm:grid-cols-3">{['Motion + expression transfer', 'Reference identity control', 'Frame-by-frame quality'].map((label) => <div key={label} className="flex gap-2 rounded-xl border border-white/10 p-3 text-xs leading-5 text-white/45"><Check size={14} className="mt-0.5 shrink-0 text-[#8c7cff]" />{label}</div>)}</div>
      </section>
    </div>
  );
}
