'use client';

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Download, Image as ImageIcon, LoaderCircle, ShieldCheck, Sparkles, Upload, WandSparkles } from 'lucide-react';
import Link from 'next/link';
import { loadStoredUser, refreshUser, saveUser, StoredUser } from '../../../lib/auth';
import styles from './page.module.css';

type Props = { editing?: boolean };
type Phase = 'idle' | 'uploading' | 'queued' | 'processing' | 'done' | 'error';
type Canvas = 'square' | 'portrait' | 'landscape';
type Asset = { url: string; preview: string; name: string };
type JobPayload = { job?: { status?: string; error?: string; result?: { image_url?: string; charged_usd?: number; is_nsfw?: boolean } } };

const CREATE_EXAMPLE = 'https://manifoldgenstatic.manifoldgen.com/gallery/originals/h3_dev_glass_hummingbird_20260816.png';
const EDIT_EXAMPLE = 'https://manifoldgenstatic.manifoldgen.com/gallery/originals/h3_dev_glass_hummingbird_greenhouse_20260816.png';

const CANVASES: Record<Canvas, [number, number, string]> = {
  square: [992, 992, '1:1'], portrait: [768, 1280, '3:5'], landscape: [1280, 768, '5:3'],
};

async function jsonResponse<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || fallback);
  return payload as T;
}

export default function H3ImageTool({ editing = false }: Props) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [source, setSource] = useState<Asset | null>(null);
  const [reference, setReference] = useState<Asset | null>(null);
  const [prompt, setPrompt] = useState('');
  const [canvas, setCanvas] = useState<Canvas>('square');
  const [steps, setSteps] = useState<12 | 20>(12);
  const [fidelity, setFidelity] = useState(.75);
  const [phase, setPhase] = useState<Phase>('idle');
  const [status, setStatus] = useState(editing ? 'Add an image to edit' : 'Describe an image');
  const [outputURL, setOutputURL] = useState('');
  const [cost, setCost] = useState<number | null>(null);
  const [privateResult, setPrivateResult] = useState(false);
  const sourceInput = useRef<HTMLInputElement>(null);
  const referenceInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = loadStoredUser();
    setUser(stored);
    if (stored?.api_key) void refreshUser(stored.api_key).then((fresh) => { if (fresh) { setUser(fresh); saveUser(fresh); } });
  }, []);

  async function upload(file: File, kind: 'source' | 'reference') {
    if (!user?.api_key) throw new Error('Sign in before uploading an image');
    if (!file.type.startsWith('image/')) throw new Error('Choose an image file');
    if (file.size > 32 * 1024 * 1024) throw new Error('Images must be 32 MB or smaller');
    setPhase('uploading'); setStatus('Uploading…');
    const query = new URLSearchParams({ filename: file.name, content_type: file.type, dataset: 'h3-image-edit' });
    const target = await jsonResponse<{ upload_url: string; public_url: string }>(
      await fetch(`/api/uploads/presign?${query}`, { headers: { Authorization: `Bearer ${user.api_key}` } }),
      'Could not prepare upload',
    );
    const sent = await fetch(target.upload_url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
    if (!sent.ok) throw new Error('Image upload failed');
    const asset = { url: target.public_url, preview: URL.createObjectURL(file), name: file.name };
    const setter = kind === 'source' ? setSource : setReference;
    setter((current) => { if (current?.preview.startsWith('blob:')) URL.revokeObjectURL(current.preview); return asset; });
    setPhase('idle'); setStatus('Ready');
  }

  async function choose(files: FileList | null, kind: 'source' | 'reference') {
    const file = files?.[0];
    if (!file) return;
    setOutputURL(''); setCost(null); setPrivateResult(false);
    try { await upload(file, kind); }
    catch (reason) { setPhase('error'); setStatus(reason instanceof Error ? reason.message : 'Upload failed'); }
  }

  function drop(event: DragEvent<HTMLDivElement>, kind: 'source' | 'reference') {
    event.preventDefault();
    void choose(event.dataTransfer.files, kind);
  }

  async function generate() {
    if (!user?.api_key) { setPhase('error'); setStatus('Sign in to generate an image'); return; }
    if (editing && !source) { setPhase('error'); setStatus('Add an image to edit'); return; }
    if (!prompt.trim()) { setPhase('error'); setStatus(editing ? 'Describe the edit' : 'Describe the image'); return; }
    const [width, height] = CANVASES[canvas];
    setOutputURL(''); setCost(null); setPrivateResult(false); setPhase('queued'); setStatus('Job added');
    try {
      const queued = await jsonResponse<{ result?: { job_id?: string; status_url?: string }; estimated_cost_usd?: number }>(
        await fetch('/api/service', {
          method: 'POST', headers: { Authorization: `Bearer ${user.api_key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service: editing ? 'h3_image_edit' : 'h3_image', prompt: prompt.trim(), width, height,
            num_steps: steps, strength: fidelity, image_url: source?.url,
            reference_image_urls: reference ? [reference.url] : [], quant: 'int8_convrot',
          }),
        }),
        'Could not start H3 image generation',
      );
      const jobID = queued.result?.job_id;
      if (!jobID) throw new Error('The H3 service returned no job');
      const statusURL = queued.result?.status_url || `/api/video-jobs/${encodeURIComponent(jobID)}`;
      for (let attempt = 0; attempt < 1000; attempt += 1) {
        const payload = await jsonResponse<JobPayload>(await fetch(statusURL, { headers: { Authorization: `Bearer ${user.api_key}` } }), 'Could not read image status');
        const next = payload.job?.status || '';
        if (next === 'completed') {
          const url = payload.job?.result?.image_url;
          if (!url) throw new Error('Generation completed without an image');
          setOutputURL(url); setCost(payload.job?.result?.charged_usd ?? queued.estimated_cost_usd ?? null);
          setPrivateResult(Boolean(payload.job?.result?.is_nsfw)); setPhase('done'); setStatus(editing ? 'Edit ready' : 'Image ready');
          void refreshUser(user.api_key).then((fresh) => { if (fresh) { setUser(fresh); saveUser(fresh); } });
          return;
        }
        if (next === 'failed' || next === 'payment_required') throw new Error(payload.job?.error || (next === 'payment_required' ? 'Top up to release this image' : 'H3 image generation failed'));
        setPhase(next === 'processing' ? 'processing' : 'queued');
        setStatus(next === 'processing' ? 'Generating…' : 'Job added');
        await new Promise((resolve) => window.setTimeout(resolve, 2500));
      }
      throw new Error('The job remains available in your account');
    } catch (reason) { setPhase('error'); setStatus(reason instanceof Error ? reason.message : 'H3 image generation failed'); }
  }

  const busy = phase === 'uploading' || phase === 'queued' || phase === 'processing';
  const estimate = (steps === 20 ? .40 : .25) + (editing ? .05 : 0);
  const displayedURL = outputURL || (editing ? EDIT_EXAMPLE : CREATE_EXAMPLE);
  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/" className={styles.back}><ArrowLeft size={17} /> ManifoldGen</Link>
      <div className={styles.switcher}><Link className={!editing ? styles.active : ''} href="/tools/h3-image">Create</Link><Link className={editing ? styles.active : ''} href="/tools/h3-image-editor">Edit</Link></div>
      <Link href="/account" className={styles.account}>{user ? `${(user.credits_usd ?? user.credits * (user.credit_price_usd || .01)).toFixed(2)} USD` : 'Sign in'}</Link>
    </header>
    <section className={styles.hero}>
      <div className={styles.eyebrow}><Sparkles size={14} /> MINIMAX H3 · {editing ? 'IMAGE EDITOR' : 'IMAGE GENERATOR'}</div>
      <h1>{editing ? <>Edit with H3.<br /><span>Keep what matters.</span></> : <>H3 image generation.<br /><span>Make a finished frame.</span></>}</h1>
      <p>{editing ? 'Edit a source image with H3. Keep the subject, change the look.' : 'Generate a finished image with H3. For video, use any image as the first frame.'}</p>
    </section>
    <section className={styles.workspace}>
      <div className={styles.controls}>
        {editing && <div className={styles.inputGrid}>
          <ImageDrop title="Source image" hint="The image to edit" asset={source} busy={busy} input={sourceInput} onChoose={(files) => void choose(files, 'source')} onDrop={(event) => drop(event, 'source')} />
          <ImageDrop title="Reference image" hint="Optional style or detail" asset={reference} busy={busy} input={referenceInput} onChoose={(files) => void choose(files, 'reference')} onDrop={(event) => drop(event, 'reference')} />
        </div>}
        <label className={styles.promptLabel}>{editing ? 'Describe the edit' : 'Describe the image'}
          <textarea value={prompt} disabled={busy} maxLength={2400} onChange={(event) => setPrompt(event.target.value)} placeholder={editing ? 'Keep the person and room. Use the silver jacket from the reference.' : 'A cinematic editorial portrait, sharp eyes, Rembrandt light, dark background.'} />
          <small>{editing ? 'The source image is required. Add a reference for style or details.' : 'Describe the final frame. Motion instructions are not needed.'}</small>
        </label>
        <div className={styles.options}>
          <label>Canvas<select value={canvas} disabled={busy} onChange={(event) => setCanvas(event.target.value as Canvas)}>{Object.entries(CANVASES).map(([key, value]) => <option key={key} value={key}>{key} · {value[2]}</option>)}</select></label>
          <label>Recipe<select value={steps} disabled={busy} onChange={(event) => setSteps(Number(event.target.value) as 12 | 20)}><option value={12}>Fast · 12 RES steps</option><option value={20}>Quality · 20 RES steps</option></select></label>
        </div>
        {editing && <label className={styles.fidelity}>Source fidelity <span>{Math.round(fidelity * 100)}%</span><input type="range" min="0" max="1" step=".05" value={fidelity} disabled={busy} onChange={(event) => setFidelity(Number(event.target.value))} /><small>Prompt preservation strength—not a diffusion denoise slider.</small></label>}
        <button data-testid="h3-image-run" className={styles.run} type="button" disabled={busy || !prompt.trim() || (editing && !source)} onClick={() => void generate()}>
          {busy ? <LoaderCircle className={styles.spin} size={19} /> : editing ? <WandSparkles size={18} /> : <Sparkles size={18} />}{busy ? status : editing ? 'Generate edit' : 'Create H3 image'}
        </button>
        <div className={styles.price}><span>GPU-time estimate · ${estimate.toFixed(2)}</span><span>12 steps · ~0.98 MP max</span></div>
        {phase === 'error' && <div className={styles.error}>{status}</div>}
      </div>
      <div className={styles.previewPanel}>
        <div className={styles.previewHeader}><span>{outputURL ? (editing ? 'H3 EDIT OUTPUT' : 'H3 IMAGE OUTPUT') : 'H3 EXAMPLE'}</span>{phase === 'done' && <span className={styles.ready}><Check size={13} /> READY</span>}</div>
        <div className={styles.preview}><img src={displayedURL} alt={outputURL ? 'Generated H3 result' : 'H3 example output'} />{busy && <div className={styles.emptyOutput}><LoaderCircle className={styles.spin} size={35} /><b>{status}</b><span>You can refresh this page while it runs.</span></div>}</div>
        <div className={styles.resultFooter}><div><b>{privateResult ? 'Private adult result' : phase === 'done' ? 'Saved to your gallery' : editing ? 'H3 edit example' : 'H3 image example'}</b><span>{cost === null ? 'Example output' : `$${cost.toFixed(4)} charged`}</span></div>{outputURL && <a href={outputURL} download><Download size={16} /> Download</a>}</div>
      </div>
    </section>
    <section className={styles.notes}><div><ShieldCheck size={17} /><span><strong>Safety checked</strong>Adult work uses a private H3 lane.</span></div><div><Sparkles size={17} /><span><strong>Shared H3 models</strong>Images and video share core model weights.</span></div><div><WandSparkles size={17} /><span><strong>Usage-based</strong>You pay for the GPU time used.</span></div></section>
  </main>;
}

function ImageDrop({ title, hint, asset, busy, input, onChoose, onDrop }: { title: string; hint: string; asset: Asset | null; busy: boolean; input: React.RefObject<HTMLInputElement | null>; onChoose: (files: FileList | null) => void; onDrop: (event: DragEvent<HTMLDivElement>) => void }) {
  return <div className={styles.inputCard} onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
    <input ref={input} type="file" accept="image/*" hidden onChange={(event: ChangeEvent<HTMLInputElement>) => { onChoose(event.target.files); event.target.value = ''; }} />
    {asset ? <img src={asset.preview} alt={title} /> : <div className={styles.emptyInput}><ImageIcon size={28} /><b>{title}</b><span>{hint}</span></div>}
    <button type="button" disabled={busy} onClick={() => input.current?.click()}><Upload size={14} /> {asset ? 'Replace' : 'Choose'}</button>
  </div>;
}
