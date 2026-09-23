'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, Film, Loader2, Play, Upload, WandSparkles } from 'lucide-react';
import { loadStoredUser, refreshUser, saveUser } from '@/lib/auth';
import type { VideoControlTool } from '@/lib/video-controls';

type Payload = { error?: string; result?: unknown; allowed?: boolean; archived?: boolean; country?: string; job?: { status?: string; result?: unknown; error?: string } };

function deepString(value: unknown, key: string): string {
  if (!value || typeof value !== 'object') return '';
  const row = value as Record<string, unknown>;
  if (typeof row[key] === 'string') return row[key] as string;
  for (const child of Object.values(row)) { const found = deepString(child, key); if (found) return found; }
  return '';
}

async function json(response: Response, fallback: string) {
  const data = await response.json().catch(() => ({})) as Payload;
  if (!response.ok) throw new Error(data.error || fallback);
  return data;
}

async function upload(file: File, apiKey: string, dataset: string) {
  const query = new URLSearchParams({ filename: file.name, content_type: file.type || 'application/octet-stream', dataset });
  const prepared = await json(await fetch(`/api/uploads/presign?${query}`, { headers: { Authorization: `Bearer ${apiKey}` } }), 'Could not prepare upload') as Payload & { upload_url?: string; public_url?: string };
  if (!prepared.upload_url || !prepared.public_url) throw new Error('Upload service returned no destination');
  const sent = await fetch(prepared.upload_url, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
  if (!sent.ok) throw new Error(`Upload failed (${sent.status})`);
  return prepared.public_url;
}

function Drop({ file, mask, accent, onFile }: { file: File | null; mask?: boolean; accent: string; onFile: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState('');
  useEffect(() => { if (!file) { setPreview(''); return; } const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }, [file]);
  const image = Boolean(file?.type.startsWith('image/'));
  return <button type="button" onClick={() => input.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const next = event.dataTransfer.files[0]; if (next) onFile(next); }} className="group relative flex min-h-40 sm:min-h-52 overflow-hidden rounded-2xl border border-dashed border-white/20 bg-black/25">
    <input ref={input} hidden type="file" accept={mask ? 'video/*,image/*' : 'video/*'} onChange={(event) => { const next = event.target.files?.[0]; if (next) onFile(next); event.target.value = ''; }} />
    {preview ? image ? <img src={preview} alt="Mask preview" className="absolute inset-0 h-full w-full object-contain" /> : <video src={preview} muted playsInline className="absolute inset-0 h-full w-full object-contain" /> : null}
    <span className={`relative z-10 m-auto flex max-w-64 flex-col items-center p-6 text-center ${preview ? 'rounded-2xl bg-black/75 opacity-0 backdrop-blur transition group-hover:opacity-100' : ''}`}><Upload size={24} style={{ color: accent }} /><b className="mt-3 text-sm">{file ? 'Replace file' : mask ? 'Upload mask' : 'Upload source video'}</b><small className="mt-2 leading-5 text-white/45">{file?.name || (mask ? 'White regenerates · black stays unchanged' : 'MP4, WebM or MOV · up to 15 seconds')}</small></span>
  </button>;
}

export function VideoControlWorkspace({ tool }: { tool: VideoControlTool }) {
  const [video, setVideo] = useState<File | null>(null);
  const [mask, setMask] = useState<File | null>(null);
  const [prompt, setPrompt] = useState(tool.prompt);
  const [resolution, setResolution] = useState('480p');
  const [duration, setDuration] = useState(5);
  const [strength, setStrength] = useState(1);
  const [seed, setSeed] = useState('');
  const [preprocess, setPreprocess] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [output, setOutput] = useState('');
  const [territoryAllowed, setTerritoryAllowed] = useState<boolean | null>(null);
  const [archived, setArchived] = useState(false);
  useEffect(() => {
    let current = true;
    fetch('/api/h3-control-eligibility', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data: Payload) => { if (current) { setArchived(data.archived === true); setTerritoryAllowed(data.allowed === true); } })
      .catch(() => { if (current) setTerritoryAllowed(false); });
    return () => { current = false; };
  }, []);
  const estimate = useMemo(() => Math.ceil((.60 + duration * .12) * ({ '480p': 1, '576p': 1.35, '720p': 2 }[resolution] || 1) * 1.2 * 100) / 100, [duration, resolution]);

  async function generate() {
    if (archived) { setError('H3 Control is archived: its model weights are in cold storage and must be restored before it can run.'); return; }
    if (territoryAllowed !== true) { setError('MiniMax H3 is unavailable in this territory.'); return; }
    const user = loadStoredUser();
    if (!user?.api_key) { setError('Sign in to generate a controlled video.'); return; }
    if (!video || (tool.type === 'inpaint' && !mask)) { setError(tool.type === 'inpaint' ? 'Add both a source video and a mask.' : 'Add a source video.'); return; }
    if (!prompt.trim()) { setError('Describe the new subject and visual world.'); return; }
    if (!accepted) { setError('Accept the MiniMax H3 license and use restrictions to continue.'); return; }
    setBusy(true); setError(''); setOutput(''); setStatus('Uploading source media…');
    try {
      const [videoURL, maskURL] = await Promise.all([upload(video, user.api_key, `h3-control-${tool.type}`), mask ? upload(mask, user.api_key, 'h3-control-mask') : Promise.resolve('')]);
      setStatus(preprocess && tool.type !== 'inpaint' ? `Extracting ${tool.type.toUpperCase()} control…` : 'Queueing controlled generation…');
      const queued = await json(await fetch('/api/service', { method: 'POST', headers: { Authorization: `Bearer ${user.api_key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ service: 'video_restyle', model: 'h3-control', video_url: videoURL, mask_video_url: maskURL, control_type: tool.type, control_scale: strength, control_preprocess: preprocess, prompt: prompt.trim(), resolution, duration, num_steps: 20, accept_h3_license: true, ...(seed ? { seed: Number(seed) } : {}) }) }), 'Could not start controlled video generation');
      const id = deepString(queued, 'job_id');
      if (!id) throw new Error('Generation returned no job ID');
      for (let attempt = 0; attempt < 1440; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 2500));
        const data = await json(await fetch(`/api/video-jobs/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${user.api_key}` } }), 'Could not read generation status');
        const state = String(data.job?.status || '').toLowerCase();
        const url = deepString(data.job?.result, 'video_url') || deepString(data.job?.result, 'url');
        if (url) { setOutput(url); setStatus('Controlled video ready'); const refreshed = await refreshUser(user.api_key).catch(() => null); if (refreshed) saveUser(refreshed); return; }
        if (['failed', 'cancelled', 'canceled', 'payment_required'].includes(state)) throw new Error(data.job?.error || `Generation ${state.replace('_', ' ')}`);
        setStatus(state === 'queued' ? 'Waiting for a high-memory worker…' : 'Following the control video frame by frame…');
      }
      throw new Error('The job is still running and remains recoverable in Studio.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Generation failed'); setStatus(''); } finally { setBusy(false); }
  }

  return <div className="grid overflow-hidden rounded-3xl border border-white/15 bg-[#151824] lg:grid-cols-[minmax(0,.94fr)_minmax(0,1.06fr)]">
    <section className="flex flex-col border-b border-white/15 bg-white/[.025] p-5 sm:p-7 lg:block lg:border-b-0 lg:border-r">
      <div className={tool.type === 'inpaint' ? 'order-1 grid gap-3 sm:grid-cols-2' : 'order-1'}><Drop file={video} accent={tool.accent} onFile={setVideo} />{tool.type === 'inpaint' && <Drop file={mask} mask accent={tool.accent} onFile={setMask} />}</div>
      <label className="order-2 mt-4 block text-sm font-semibold text-white/75">Describe the replacement</label><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={3}  className="mt-2 w-full resize-none rounded-2xl border border-white/15 bg-[#171b27] p-4 text-sm leading-6 outline-none focus:border-white/35" />
      <div className="order-8 mt-4 grid grid-cols-2 gap-3"><label className="text-xs font-semibold text-white/55">OUTPUT SIZE<select value={resolution} onChange={(event) => setResolution(event.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-[#171b27] px-3 py-3 text-sm text-white"><option>480p</option><option>576p</option><option>720p</option></select></label><label className="text-xs font-semibold text-white/55">MAX DURATION<select value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-white/15 bg-[#171b27] px-3 py-3 text-sm text-white">{[3,5,8,10,15].map((n) => <option key={n} value={n}>{n} seconds</option>)}</select></label><label className="text-xs font-semibold text-white/55">CONTROL STRENGTH <span className="float-right">{strength.toFixed(2)}</span><input type="range" min="0.1" max="1" step="0.05" value={strength} onChange={(event) => setStrength(Number(event.target.value))} className="mt-4 w-full" style={{ accentColor: tool.accent }} /></label><label className="text-xs font-semibold text-white/55">SEED<input value={seed} onChange={(event) => setSeed(event.target.value.replace(/\D/g, ''))} placeholder="Random" className="mt-2 w-full rounded-xl border border-white/15 bg-[#171b27] px-3 py-3 text-sm text-white outline-none" /></label></div>
      {tool.type !== 'inpaint' && <label className="order-4 mt-4 flex items-start gap-3 text-sm leading-5 text-white/60"><input type="checkbox" checked={preprocess} onChange={(event) => setPreprocess(event.target.checked)} className="mt-1" style={{ accentColor: tool.accent }} /><span>Extract {tool.type.toUpperCase()} from my normal video<small className="mt-1 block text-white/35">Turn this off only when the upload is already a prepared control pass.</small></span></label>}
      <label className="order-5 mt-4 flex items-start gap-3 rounded-xl border border-amber-200/15 bg-amber-200/[.04] p-3 text-xs leading-5 text-white/55"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-1" /><span>I accept the <a className="underline" target="_blank" rel="noreferrer" href="https://huggingface.co/alibaba-pai/MiniMax-H3-Fun-Controlnet-Union/blob/main/LICENSE">MiniMax H3 Community License</a> and its use restrictions. This model is unavailable in the US, EU, UK, and South Korea.</span></label>
      <div className="order-7 mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/[.025] px-4 py-2.5"><span><b className="block text-sm">Estimated price</b><small className="text-white/40">Final price is 1.2× measured compute</small></span><strong className="text-right text-lg">~{Math.ceil(estimate * 100)} credits<small className="block text-xs font-normal text-white/35">${estimate.toFixed(2)}</small></strong></div>
      <button onClick={() => void generate()} disabled={busy || territoryAllowed !== true} className="order-6 mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-bold text-black disabled:opacity-55" style={{ background: tool.accent }}>{busy ? <Loader2 className="animate-spin" size={17} /> : <WandSparkles size={17} />}{busy ? status || 'Generating…' : archived ? 'Unavailable: model archived' : territoryAllowed === false ? 'Unavailable in this territory' : territoryAllowed === null ? 'Checking availability…' : `Generate with ${tool.type.toUpperCase()} control`}</button>
      {error && <div role="alert" className="order-9 mt-4 rounded-xl border border-red-300/15 bg-red-400/[.06] p-3 text-sm text-red-100/75">{error} {error.startsWith('Sign in') && <Link href="/account" className="underline">Open account</Link>}</div>}
    </section>
    <section className="min-w-0 p-5 sm:p-7"><div className="mb-5 flex items-center justify-between"><span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-white/55"><Play size={14} /> Output</span>{status && <small className="text-white/60">{status}</small>}</div><div className="flex aspect-video items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-[#0d1018]">{output ? <video src={output} controls autoPlay loop playsInline className="h-full w-full object-contain" /> : <div className="max-w-sm p-8 text-center"><Film className="mx-auto text-white/25" size={38} /><p className="mt-4 text-sm leading-6 text-white/55">Your new world follows the source clip’s {tool.type === 'pose' ? 'body performance' : tool.type === 'depth' ? 'depth and camera motion' : tool.type === 'inpaint' ? 'unmasked pixels and timing' : 'controlled geometry and timing'}.</p></div>}</div>{output && <div className="mt-4 flex gap-3"><Link href={`/studio?video_url=${encodeURIComponent(output)}&name=${encodeURIComponent(tool.name)}`} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-black">Open in Studio <ArrowRight size={15} /></Link><a href={output} download className="rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-white/70">Download</a></div>}
      {territoryAllowed === true && tool.exampleInput && tool.exampleOutput && <div className="mt-8"><div className="mb-3 text-xs font-semibold uppercase tracking-[.16em] text-white/40">Published model example · real generation</div><div className="grid gap-2 sm:grid-cols-2"><div><video src={tool.exampleInput} controls muted loop playsInline className="aspect-video w-full rounded-xl bg-black object-contain" /><small className="mt-2 block text-white/35">Control input</small></div><div><video src={tool.exampleOutput} controls muted loop playsInline className="aspect-video w-full rounded-xl bg-black object-contain" /><small className="mt-2 block text-white/35">Generated output</small></div></div></div>}
      <div className="mt-8 grid gap-3 sm:grid-cols-3">{tool.bestFor.map((label) => <div key={label} className="flex gap-2 rounded-xl border border-white/10 p-3 text-xs leading-5 text-white/45"><Check size={14} className="mt-0.5 shrink-0" style={{ color: tool.accent }} />{label}</div>)}</div>
    </section>
  </div>;
}
