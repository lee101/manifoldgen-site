'use client';

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Download, Image as ImageIcon, Loader2, Sparkles, Upload, WandSparkles } from 'lucide-react';
import { loadStoredUser, refreshUser, saveUser, type StoredUser } from '@/lib/auth';
import styles from './page.module.css';

type APIResponse = { result?: unknown; error?: string; credits_remain?: number; usd_equivalent?: number };
type Kind = '' | 'left' | 'right' | 'top' | 'bottom';

const EXAMPLE = 'https://manifoldgenstatic.manifoldgen.com/gallery/originals/h3_dev_glass_hummingbird_greenhouse_20260816.png';

const KINDS: { id: Kind; label: string }[] = [
  { id: '', label: 'None · relight by prompt only' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
  { id: 'top', label: 'Top' },
  { id: 'bottom', label: 'Bottom' },
];

const EXAMPLE_PROMPTS = [
  'warm golden-hour sunlight, soft shadows',
  'cool moonlight streaming through glass, gentle blue falloff',
  'bright studio key light from the left, clean neutral background',
];

function extractVariants(payload: unknown): string[] {
  const found: string[] = [];
  const walk = (value: unknown): void => {
    if (!value) return;
    if (typeof value === 'string') {
      if (value.startsWith('data:image/')) { found.push(value); return; }
      try { walk(JSON.parse(value)); } catch { /* plain string */ }
      return;
    }
    if (typeof value !== 'object') return;
    if (Array.isArray(value)) {
      (value as unknown[]).forEach(walk);
      return;
    }
    const row = value as Record<string, unknown>;
    for (const key of ['images', 'data']) {
      if (Array.isArray(row[key])) {
        (row[key] as unknown[]).forEach(walk);
        return;
      }
    }
    for (const key of ['result', 'output']) {
      if (row[key] != null && typeof row[key] === 'object') { walk(row[key]); return; }
    }
    const url = [row.saved_image_url, row.image_url, row.url, row.path].find((v): v is string => typeof v === 'string' && Boolean(v.trim()));
    const b64 = [row.image_base64, row.b64_json].find((v): v is string => typeof v === 'string' && Boolean(v.trim()));
    if (url) { found.push(url); return; }
    if (b64) found.push(`data:image/png;base64,${b64}`);
  };
  walk(payload);
  return found;
}

async function jsonResponse(response: Response, fallback: string): Promise<APIResponse> {
  const data = await response.json().catch(() => ({})) as APIResponse;
  if (!response.ok) throw new Error(data.error || fallback);
  return data;
}

async function uploadToR2(file: File, apiKey: string): Promise<string> {
  const params = new URLSearchParams({ filename: file.name, content_type: file.type || 'image/webp', dataset: 'relight' });
  const prepared = await jsonResponse(await fetch(`/api/uploads/presign?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  }), 'Could not prepare the image upload');
  const destinations = prepared as APIResponse & { upload_url?: string; public_url?: string };
  if (!destinations.upload_url || !destinations.public_url) throw new Error('Upload service returned no destination');
  const uploaded = await fetch(destinations.upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'image/webp' },
    body: file,
  });
  if (!uploaded.ok) throw new Error(`Image upload failed (${uploaded.status})`);
  return destinations.public_url;
}

export default function RelightTool() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sourceURL, setSourceURL] = useState('');
  const [outputURLs, setOutputURLs] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('warm golden-hour sunlight, soft shadows');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [kind, setKind] = useState<Kind>('');
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState<'upload' | 'run' | ''>('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setUser(loadStoredUser());
  }, []);

  useEffect(() => {
    if (!file) return;
    const localURL = URL.createObjectURL(file);
    setSourceURL(localURL);
    setOutputURLs([]);
    return () => URL.revokeObjectURL(localURL);
  }, [file]);

  function choose(next: File | undefined) {
    if (!next) return;
    if (!next.type.startsWith('image/')) { setError('Choose an image file.'); return; }
    if (next.size > 20 * 1024 * 1024) { setError('Images must be 20 MB or smaller.'); return; }
    setError('');
    setFile(next);
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    choose(event.dataTransfer.files[0]);
  }

  async function run() {
    const currentUser = user || loadStoredUser();
    if (!currentUser?.api_key) { setError('Sign in to use Relight.'); return; }
    if (!file && !sourceURL) { setError('Choose an image first.'); return; }
    if (!prompt.trim()) { setError('Describe the lighting you want.'); return; }
    setError('');
    try {
      let imageURL = sourceURL;
      if (file) {
        setBusy('upload');
        setStatus('Uploading the source to secure storage…');
        imageURL = await uploadToR2(file, currentUser.api_key);
        setSourceURL(imageURL);
        setFile(null);
      }
      setBusy('run');
      setStatus('IC-Light is relighting your image…');
      const response = await fetch('/api/service', {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentUser.api_key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: 'relight',
          image_url: imageURL,
          prompt: prompt.trim(),
          negative_prompt: negativePrompt.trim(),
          kind,
          aspect_ratio: 'square',
          n: count,
        }),
      });
      const data = await jsonResponse(response, 'Relight failed');
      const results = extractVariants(data.result).slice(0, count);
      if (!results.length) throw new Error('The relight completed without returning an image.');
      setOutputURLs(results);
      setStatus('Your relit image is ready');
      const fresh = await refreshUser(currentUser.api_key);
      if (fresh) { setUser(fresh); saveUser(fresh); }
    } catch (reason) {
      setStatus('');
      setError(reason instanceof Error ? reason.message : 'Relight failed');
    } finally {
      setBusy('');
    }
  }

  const previewSource = sourceURL || EXAMPLE;
  const outputURL = outputURLs[0] || '';
  const price = 0.12 * count;
  const credits = Math.ceil(price / (user?.credit_price_usd || 0.01));

  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/tools" className={styles.back}><ArrowLeft size={16} /> All tools</Link>
      <div className={styles.brand}><Sparkles size={14} /> RELIGHT</div>
      <Link href="/account" className={styles.account}>{user ? `${(user.credits_usd ?? user.credits * (user.credit_price_usd || .01)).toFixed(2)} USD` : 'Sign in'}</Link>
    </header>
    <section className={styles.hero}>
      <h1>Same image.<br /><span>A completely different light.</span></h1>
      <p>Upload a photo and redirect its lighting. Pick a direction or describe the mood, and IC-Light v2 rebuilds the illumination while keeping the subject and composition intact.</p>
    </section>
    <section className={styles.workspace}>
      <div className={styles.controls}>
        <div className={styles.drop} onDragOver={(event) => event.preventDefault()} onDrop={drop} onClick={() => fileInput.current?.click()}>
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={(event: ChangeEvent<HTMLInputElement>) => { choose(event.target.files?.[0]); event.target.value = ''; }} />
          {sourceURL ? <img src={sourceURL} alt="Source image" /> : <><Upload size={26} /><b>Drop an image here</b><span>PNG, JPG, WEBP · up to 20 MB</span></>}
          {sourceURL && <button type="button" onClick={(event) => { event.stopPropagation(); fileInput.current?.click(); }}><Upload size={13} /> Replace image</button>}
        </div>
        <label className={styles.field}><span>Lighting prompt</span><textarea data-testid="relight-prompt" value={prompt} maxLength={1200} onChange={(event) => setPrompt(event.target.value)} rows={4} placeholder="warm golden-hour sunlight, soft shadows" /><small>Describe the light: direction, color temperature, softness, and mood.</small></label>
        <label className={styles.field}><span>Negative prompt (optional)</span><textarea value={negativePrompt} maxLength={1200} onChange={(event) => setNegativePrompt(event.target.value)} rows={2} placeholder="harsh flash, blown highlights" /></label>
        <div className={styles.options}>
          <label><span>Lighting direction</span><select aria-label="Lighting direction" value={kind} onChange={(event) => setKind(event.target.value as Kind)}>{KINDS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
          <label><span>Images</span><select aria-label="Image count" value={count} onChange={(event) => setCount(Number(event.target.value))}><option value={1}>1</option><option value={2}>2</option></select></label>
        </div>
        <button className={styles.run} type="button" disabled={Boolean(busy) || !prompt.trim()} data-testid="relight-run" onClick={() => void run()}>{busy ? <Loader2 className={styles.spin} size={18} /> : <WandSparkles size={18} />}{busy ? status : `Relight ${count > 1 ? `${count} images` : 'image'}`}</button>
        <div className={styles.price}><span>fal IC-Light v2 · refunded on backend failure</span><b>~{credits} credits · ${price.toFixed(2)}</b></div>
        {error && <div className={styles.error} role="alert">{error}</div>}
      </div>
      <div className={styles.previewPanel}>
        <div className={styles.previewHeader}><span>{outputURL ? 'BEFORE / AFTER' : 'SOURCE PREVIEW'}</span>{outputURL && <span className={styles.ready}><Check size={13} /> READY</span>}</div>
        <div className={`${styles.preview} ${outputURL ? styles.split : ''}`}>
          <div><span>Source</span><img src={previewSource} alt="Source preview" /></div>
          {outputURL ? <div data-testid="relight-result"><span>Relit result</span><img src={outputURL} alt="Relit result" />{outputURLs[1] && <img src={outputURLs[1]} alt="Relit result 2" />}</div> : <div className={styles.empty}><ImageIcon size={30} /><b>Your result will appear here</b><span>The source stays visible while the relight runs.</span></div>}
          {busy && <div className={styles.loading}><Loader2 className={styles.spin} size={32} /><b>{status}</b></div>}
        </div>
        <div className={styles.footer}><span>{outputURL ? 'Saved to your ManifoldGen gallery when returned by the service.' : 'One lighting pass per run.'}</span>{outputURL && <a href={outputURL} download><Download size={15} /> Download</a>}</div>
      </div>
    </section>
    <section className={styles.notes}>
      <div><Sparkles size={17} /><span><b>Direct the light</b>Choose a direction (left, right, top, bottom) or describe the mood with a style prompt — both can combine.</span></div>
      <div><ImageIcon size={17} /><span><b>Subject stays put</b>IC-Light v2 re-renders illumination only; geometry, pose, and composition are preserved.</span></div>
      <div><Check size={17} /><span><b>Simple metering</b>Each relit image is $0.12 on the fal IC-Light v2 backend and refunded if the backend fails.</span></div>
    </section>
    <section className={styles.examples}>
      <h2>Example</h2>
      <div className={styles.exampleCard}>
        <img src={EXAMPLE} alt="Example relit output: glass hummingbird greenhouse" />
        <div className={styles.exampleBody}>
          <p>The glass hummingbird greenhouse above was relit with a single direction plus a short style prompt. Try one of these starting points:</p>
          <div className={styles.chips}>{EXAMPLE_PROMPTS.map((example) => <button key={example} type="button" className={styles.chip} onClick={() => setPrompt(example)}>{example}</button>)}</div>
      </div>
      </div>
    </section>
  </main>;
}
