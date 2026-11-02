'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Download, LoaderCircle, Search, Sparkles, X } from 'lucide-react';
import { loadStoredUser, refreshUser, saveUser, type StoredUser } from '../../lib/auth';
import { parseJSONResponse } from '../../lib/http';
import { ANIME_TOOLS, blobToDataURL, seedValue } from '../../lib/anime-control';
import {
  POSE_STYLES, VIEW_LABELS, absoluteURL, availableViews, poseMapURL, poseSearchURL, styledEditPrompt,
  type PoseFacets, type PoseMap, type PoseRecord, type PoseSearchResponse, type PoseView,
} from '../../lib/pose-library';

type Lane = 'edit' | 'depth' | 'pose';
type Phase = 'idle' | 'working' | 'done' | 'error';
const PAGE = 48;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function PoseLibrary() {
  const [q, setQ] = useState('');
  const [source, setSource] = useState('');
  const [category, setCategory] = useState('');
  const [body, setBody] = useState('');
  const [people, setPeople] = useState(0);
  const [items, setItems] = useState<PoseRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [mode, setMode] = useState('');
  const [facets, setFacets] = useState<PoseFacets | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState<PoseRecord | null>(null);
  const seq = useRef(0);

  const run = useCallback(async (offset: number) => {
    const my = ++seq.current;
    setLoading(true); setErr('');
    try {
      const res = await parseJSONResponse<PoseSearchResponse>(await fetch(poseSearchURL({ q, source, category, body, people, offset, limit: PAGE })), 'Could not search poses');
      if (my !== seq.current) return;
      setItems((prev) => (offset ? [...prev, ...res.results] : res.results));
      setTotal(res.total); setMode(res.mode);
    } catch (e) {
      if (my === seq.current) setErr(e instanceof Error ? e.message : 'Search failed');
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [q, source, category, body, people]);

  useEffect(() => { const t = setTimeout(() => void run(0), q ? 250 : 0); return () => clearTimeout(t); }, [run, q]);
  useEffect(() => { void fetch('/api/poses/facets').then((r) => r.json()).then(setFacets).catch(() => undefined); }, []);

  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-xs font-semibold ${on ? 'border-emerald-300 bg-emerald-300/15 text-emerald-100' : 'border-white/15 text-white/70 hover:border-white/40'}`;
  const cats = Object.entries(facets?.categories ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <div data-testid="pose-library">
      <section className="py-8">
        <h1 className="font-display text-4xl font-700">Pose library</h1>
        <p className="mt-2 max-w-3xl text-white/65">Search {facets?.total ?? '2,000+'} mannequin poses by meaning, from every angle. Open one in the 3D puppet to edit it, then draw it in any style.</p>
        <div className="mt-5 flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.05] px-4 py-3">
          <Search size={16} className="text-white/50" />
          <input data-testid="pose-query" className="w-full bg-transparent text-sm outline-none placeholder:text-white/40" value={q} onChange={(e) => setQ(e.target.value)} placeholder="sitting cross-legged looking over the shoulder, two people dancing, running, arms raised…" />
          {q && <button type="button" aria-label="Clear" onClick={() => setQ('')}><X size={15} /></button>}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[['', 'All'], ['generated', 'Generated'], ['shisei', 'Shisei CC0']].map(([v, l]) => <button key={v} type="button" className={chip(source === v)} onClick={() => setSource(v)}>{l}</button>)}
          <span className="mx-1 w-px bg-white/15" />
          {[[0, 'Any count'], [1, 'Solo'], [2, 'Duo'], [3, 'Trio']].map(([v, l]) => <button key={String(v)} type="button" className={chip(people === v)} onClick={() => setPeople(Number(v))}>{l}</button>)}
          <span className="mx-1 w-px bg-white/15" />
          <select aria-label="Body type" className="rounded-full border border-white/15 bg-transparent px-3 py-1 text-xs" value={body} onChange={(e) => setBody(e.target.value)}>
            <option value="">Any body</option>
            {Object.keys(facets?.bodies ?? {}).map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={chip(!category)} onClick={() => setCategory('')}>Every category</button>
          {cats.map(([c, n]) => <button key={c} type="button" className={chip(category === c)} onClick={() => setCategory(category === c ? '' : c)}>{c} <span className="opacity-50">{n}</span></button>)}
        </div>
      </section>

      <div className="mb-3 text-xs text-white/50" role="status">{loading && !items.length ? 'Searching…' : `${total} poses${mode === 'semantic' ? ' · semantic match' : ''}`}</div>
      {err && <div className="mb-3 rounded-xl border border-red-400/40 bg-red-400/10 p-3 text-sm">{err}</div>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6" data-testid="pose-grid">
        {items.map((p) => {
          const thumb = p.views.front || Object.values(p.views)[0];
          return (
            <button key={p.id} type="button" data-testid="pose-card" onClick={() => setOpen(p)} className="group overflow-hidden rounded-2xl border border-white/10 bg-white text-left transition hover:border-emerald-300/60">
              <img src={thumb} alt={p.name} loading="lazy" className="aspect-[3/4] w-full bg-white object-contain" />
              <div className="bg-[var(--color-ink)] p-2 text-xs"><div className="line-clamp-2 font-semibold">{p.name}</div><div className="text-white/45">{p.category}{p.people > 1 ? ` · ${p.people} people` : ''}</div></div>
            </button>
          );
        })}
      </div>
      {!loading && !items.length && !err && <p className="py-16 text-center text-white/50">No poses match. Try fewer filters.</p>}
      {items.length < total && (
        <div className="py-8 text-center"><button type="button" className={chip(false)} disabled={loading} onClick={() => void run(items.length)}>{loading ? 'Loading…' : 'Load more'}</button></div>
      )}
      {open && <PoseDetail pose={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function PoseDetail({ pose: listed, onClose }: { pose: PoseRecord; onClose: () => void }) {
  const [pose, setPose] = useState<PoseRecord>(listed);
  useEffect(() => {
    if (!listed.has_pose || listed.pose) return;
    void fetch(`/api/poses/${encodeURIComponent(listed.id)}`).then((r) => (r.ok ? r.json() : null)).then((full: PoseRecord | null) => { if (full?.id === listed.id) setPose(full); }).catch(() => undefined);
  }, [listed]);
  const views = availableViews(pose);
  const [view, setView] = useState<PoseView>(views[0] ?? 'front');
  const [map, setMap] = useState<PoseMap>('image');
  const [lane, setLane] = useState<Lane>('edit');
  const [style, setStyle] = useState(POSE_STYLES[0].id);
  const [subject, setSubject] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [user, setUser] = useState<StoredUser | null>(null);
  const hasDepth = Boolean(pose.depth && Object.keys(pose.depth).length);
  const hasSkel = Boolean(pose.skeleton && Object.keys(pose.skeleton).length);
  const shown = poseMapURL(pose, view, map) || poseMapURL(pose, view, 'image');
  const busy = phase === 'working';

  useEffect(() => { setUser(loadStoredUser()); }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);

  async function generate() {
    const current = user || loadStoredUser();
    if (!current?.api_key) { setPhase('error'); setError('Sign in to generate.'); return; }
    setPhase('working'); setError(''); setResult('');
    const styleDef = POSE_STYLES.find((s) => s.id === style) ?? POSE_STYLES[0];
    const headers = { Authorization: `Bearer ${current.api_key}`, 'Content-Type': 'application/json' };
    try {
      const portrait = pose.framing === 'upper' || pose.people === 1;
      const [width, height] = portrait ? [832, 1216] : [1216, 832];
      let body: Record<string, unknown>;
      if (lane === 'edit') {
        const src = poseMapURL(pose, view, 'image');
        if (!src) throw new Error('No image for this view.');
        body = { service: 'image_edit', prompt: styledEditPrompt(subject, styleDef.prompt), width, height, n: 1, num_images: 1, image_url: absoluteURL(src), model: 'gpt-image-2' };
      } else {
        const mapURL = lane === 'depth' ? poseMapURL(pose, view, 'depth') : poseMapURL(pose, view, 'image');
        if (!mapURL) throw new Error('This pose has no map for that lane.');
        const mapRes = await fetch(mapURL);
        if (!mapRes.ok) throw new Error('Could not load the pose map.');
        const data = await blobToDataURL(await mapRes.blob());
        const tool = lane === 'depth' ? ANIME_TOOLS.depth : ANIME_TOOLS.pose;
        const prompt = `${subject.trim() || '1girl, standing'}, ${styleDef.prompt}, masterpiece, best quality`;
        body = { service: tool.service, prompt, width, height, seed: seedValue(''), strength: 1, control_images: lane === 'depth' ? { depth_image: data } : { pose_map: data } };
      }
      const queued = await parseJSONResponse<Record<string, any>>(await fetch('/api/service', { method: 'POST', headers, body: JSON.stringify(body) }), 'Could not start the image');
      const direct = findImage(queued);
      if (direct) { setResult(direct); setPhase('done'); return; }
      const jobID = queued.result?.job_id;
      if (!jobID) throw new Error('The service returned no image');
      const rawStatus = String(queued.result?.status_url || '');
      const statusURL = rawStatus.startsWith('/api/') ? rawStatus : `/api/video-jobs/${encodeURIComponent(jobID)}`;
      for (let i = 0; i < 600; i++) {
        const payload = await parseJSONResponse<{ job?: { status?: string; error?: string; result?: Record<string, any> } }>(await fetch(statusURL, { headers: { Authorization: headers.Authorization } }), 'Could not read the job status');
        const st = payload.job?.status;
        if (st === 'completed') { const u = findImage(payload.job?.result); if (!u) throw new Error('Completed without an image'); setResult(u); setPhase('done'); void refreshUser(current.api_key).then((f) => { if (f) { setUser(f); saveUser(f); } }); return; }
        if (st === 'failed' || st === 'payment_required') throw new Error(payload.job?.error || 'Generation failed');
        await sleep(2000);
      }
      throw new Error('The job is still running; it stays in your account.');
    } catch (e) { setPhase('error'); setError(e instanceof Error ? e.message : 'Generation failed'); }
  }

  const lanes: { id: Lane; label: string; note: string; ok: boolean }[] = [
    { id: 'edit', label: 'Any style', note: 'Image edit · $0.30', ok: true },
    { id: 'depth', label: 'Anime · depth', note: `$${ANIME_TOOLS.depth.priceUSD.toFixed(2)}`, ok: hasDepth },
    { id: 'pose', label: 'Anime · pose', note: `$${ANIME_TOOLS.pose.priceUSD.toFixed(2)}`, ok: pose.source === 'generated' },
  ];
  const btn = (on: boolean) => `rounded-lg border px-3 py-1.5 text-xs font-semibold ${on ? 'border-emerald-300 bg-emerald-300/15' : 'border-white/15 hover:border-white/40'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4" role="dialog" aria-label={pose.name} onClick={onClose}>
      <div className="grid w-full max-w-5xl gap-6 rounded-3xl border border-white/15 bg-[var(--color-ink)] p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" onClick={(e) => e.stopPropagation()} data-testid="pose-detail">
        <div>
          <div className="overflow-hidden rounded-2xl bg-white"><img data-testid="pose-detail-image" src={shown} alt={pose.name} className="max-h-[70vh] w-full object-contain" /></div>
          <div className="mt-3 flex flex-wrap gap-2">
            {views.map((v) => <button key={v} type="button" className={btn(view === v)} onClick={() => setView(v)}>{VIEW_LABELS[v]}</button>)}
            <span className="w-px bg-white/15" />
            <button type="button" className={btn(map === 'image')} onClick={() => setMap('image')}>Drawing</button>
            {hasDepth && <button type="button" className={btn(map === 'depth')} onClick={() => setMap('depth')}>Depth</button>}
            {hasSkel && <button type="button" className={btn(map === 'skeleton')} onClick={() => setMap('skeleton')}>Skeleton</button>}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {shown && <a className={btn(false)} href={shown} download target="_blank" rel="noreferrer"><Download size={12} className="mr-1 inline" />Download {map}</a>}
            {pose.has_pose && pose.pose && <Link className={btn(true)} href={`/tools/pose-puppet#pose=${encodeURIComponent(pose.pose)}`}><Box size={12} className="mr-1 inline" />Edit in 3D puppet</Link>}
          </div>
          <p className="mt-3 text-xs leading-5 text-white/50">{pose.license} · {pose.credit}</p>
        </div>
        <div>
          <div className="flex items-start justify-between gap-3"><div><h2 className="font-display text-2xl font-700">{pose.name}</h2><p className="mt-1 text-sm text-white/60">{pose.description}</p></div><button type="button" aria-label="Close" onClick={onClose}><X size={18} /></button></div>
          <div className="mt-5 text-xs font-bold uppercase tracking-widest text-white/45">Draw this pose</div>
          <div className="mt-2 flex flex-wrap gap-2">{lanes.filter((l) => l.ok).map((l) => <button key={l.id} type="button" className={btn(lane === l.id)} onClick={() => setLane(l.id)}>{l.label} <span className="opacity-50">{l.note}</span></button>)}</div>
          <label className="mt-3 block text-xs text-white/60">Who or what is it?
            <textarea data-testid="pose-subject" rows={3} className="mt-1 w-full rounded-xl border border-white/15 bg-white/[0.04] p-3 text-sm text-white" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="a knight in silver armour, an astronaut, a girl in a red raincoat…" />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">{POSE_STYLES.map((s) => <button key={s.id} type="button" className={btn(style === s.id)} onClick={() => setStyle(s.id)}>{s.label}</button>)}</div>
          {user?.api_key
            ? <button data-testid="pose-generate" type="button" disabled={busy} onClick={() => void generate()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-4 py-3 text-sm font-bold text-black disabled:opacity-60">{busy ? <LoaderCircle size={15} className="animate-spin" /> : <Sparkles size={15} />}{busy ? 'Drawing…' : 'Generate'}</button>
            : <Link href="/account" className="mt-4 inline-flex rounded-xl bg-emerald-300 px-4 py-3 text-sm font-bold text-black">Sign in to generate</Link>}
          {error && <div className="mt-3 rounded-xl border border-red-400/40 bg-red-400/10 p-3 text-sm" data-testid="pose-error">{error}</div>}
          {result && <div className="mt-4"><img data-testid="pose-result" src={result} alt="Generated" className="w-full rounded-2xl" /><a className={`${btn(false)} mt-2 inline-block`} href={result} download target="_blank" rel="noreferrer"><Download size={12} className="mr-1 inline" />Download</a></div>}
        </div>
      </div>
    </div>
  );
}

function findImage(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const d = payload as Record<string, any>;
  if (d.result) return findImage(d.result);
  const list = Array.isArray(d.images) ? d.images : Array.isArray(d.data) ? d.data : null;
  if (list) for (const it of list) { const u = findImage(it); if (u) return u; }
  const url = [d.image_url, d.url].find((v) => typeof v === 'string' && v);
  if (url) return url;
  const b64 = [d.image_base64, d.b64_json].find((v) => typeof v === 'string' && v);
  return b64 ? `data:image/webp;base64,${String(b64).replace(/^data:[^,]+,/, '')}` : '';
}
