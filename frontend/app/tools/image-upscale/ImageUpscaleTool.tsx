'use client';

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Download, Image as ImageIcon, Loader2, Maximize2, Sparkles, Upload } from 'lucide-react';
import { loadStoredUser, refreshUser, saveUser, type StoredUser } from '@/lib/auth';
import { ensurePaidAccess, errorFields, isPaywallError, paywallFromResponse } from '@/lib/paywall';
import styles from './page.module.css';

const FEATURE = 'Image Upscale';

type APIResponse = { result?: unknown; error?: unknown; credits_remain?: number; usd_equivalent?: number };

const EXAMPLE = 'https://manifoldgenstatic.manifoldgen.com/gallery/originals/ea0d66c5b19b8439_64411e9f.webp';
type Mode = '2x' | '4x' | 'creative';
const MODES: { id: Mode; label: string; detail: string; usd: number }[] = [
  { id: '2x', label: '2×', detail: 'Faithful detail', usd: 0.02 },
  { id: '4x', label: '4×', detail: 'Print size', usd: 0.03 },
  { id: 'creative', label: 'Creative 2×', detail: 'Redraws micro-detail', usd: 0.15 },
];

function responseImage(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') {
    if (value.startsWith('data:image/')) return value;
    try { return responseImage(JSON.parse(value)); } catch { return ''; }
  }
  if (typeof value !== 'object') return '';
  const row = value as Record<string, unknown>;
  for (const key of ['saved_image_url', 'image_url', 'url', 'path']) {
    if (typeof row[key] === 'string' && row[key]) return row[key] as string;
  }
  for (const key of ['b64_json', 'image_base64']) {
    if (typeof row[key] === 'string' && row[key]) return `data:image/png;base64,${row[key]}`;
  }
  for (const key of ['data', 'result', 'output', 'images']) {
    const found = responseImage(row[key]);
    if (found) return found;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = responseImage(item);
      if (found) return found;
    }
  }
  return '';
}

async function jsonResponse(response: Response, fallback: string): Promise<APIResponse> {
  const data = await response.json().catch(() => ({})) as APIResponse;
  if (!response.ok) throw paywallFromResponse(response, data, FEATURE) || new Error(errorFields(data).message || fallback);
  return data;
}

async function uploadToR2(file: File, apiKey: string): Promise<string> {
  const params = new URLSearchParams({ filename: file.name, content_type: file.type || 'image/webp', dataset: 'image-upscale' });
  const prepared = await jsonResponse(await fetch(`/api/uploads/presign?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  }), 'Could not prepare the image upload');
  const destinations = prepared as APIResponse & { upload_url?: string; public_url?: string };
  if (!destinations.upload_url || !destinations.public_url) throw new Error('Upload service returned no destination');
  const uploaded = await fetch(destinations.upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'image/webp' } });
  if (!uploaded.ok) throw new Error(`Image upload failed (${uploaded.status})`);
  return destinations.public_url;
}

export default function ImageUpscaleTool() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sourceURL, setSourceURL] = useState('');
  const [outputURL, setOutputURL] = useState('');
  const [busy, setBusy] = useState<'upload' | 'upscale' | ''>('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [creditPrice, setCreditPrice] = useState(0.01);
  const [mode, setMode] = useState<Mode>('2x');
  const selectedMode = MODES.find((item) => item.id === mode) || MODES[0];

  useEffect(() => {
    setUser(loadStoredUser());
    void fetch('/api/pricing').then((response) => response.json()).then((data) => {
      if (typeof data.credit_price_usd === 'number') setCreditPrice(data.credit_price_usd);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!file) return;
    const localURL = URL.createObjectURL(file);
    setSourceURL(localURL);
    setOutputURL('');
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

  async function upscale() {
    const currentUser = user || loadStoredUser();
    if (!currentUser?.api_key) { setError(''); ensurePaidAccess(FEATURE); return; }
    setError('');
    try {
      let imageURL = sourceURL || EXAMPLE;
      if (file) {
        setBusy('upload');
        setStatus('Uploading the source to secure storage…');
        imageURL = await uploadToR2(file, currentUser.api_key);
        setSourceURL(imageURL);
        setFile(null);
      }
      setBusy('upscale');
      setStatus(`Upscaling your image ${selectedMode.label}…`);
      const response = await fetch('/api/service', {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentUser.api_key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: 'upscale-image', image_url: imageURL, scale: mode === '4x' ? 4 : 2, ...(mode === 'creative' ? { model: 'creative' } : {}) }),
      });
      const data = await jsonResponse(response, 'Upscale failed');
      const result = responseImage(data.result);
      if (!result) throw new Error('The upscale completed without returning an image.');
      setOutputURL(result);
      setStatus('Your upscaled image is ready');
      const fresh = await refreshUser(currentUser.api_key);
      if (fresh) { setUser(fresh); saveUser(fresh); }
    } catch (reason) {
      setStatus('');
      if (isPaywallError(reason)) { setError(''); return; }
      setError(reason instanceof Error ? reason.message : 'Upscale failed');
    } finally {
      setBusy('');
    }
  }

  const previewSource = sourceURL || EXAMPLE;
  const credits = Math.max(1, Math.ceil(selectedMode.usd / creditPrice - 1e-9));

  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/tools" className={styles.back}><ArrowLeft size={16} /> All tools</Link>
      <div className={styles.brand}><Maximize2 size={14} /> IMAGE UPSCALE</div>
      <Link href="/account" className={styles.account}>{user ? `${(user.credits_usd ?? user.credits * creditPrice).toFixed(2)} USD` : 'Sign in'}</Link>
    </header>
    <section className={styles.hero}>
      <h1>Same picture.<br /><span>Up to 4× the resolution.</span></h1>
      <p>Drop in any image for a faithful 2× or 4× upscale from 2 cents, or pick Creative to redraw texture and edge detail. No prompt needed.</p>
    </section>
    <section className={styles.workspace}>
      <div className={styles.controls}>
        <div className={styles.drop} onDragOver={(event) => event.preventDefault()} onDrop={drop} onClick={() => fileInput.current?.click()}>
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={(event: ChangeEvent<HTMLInputElement>) => { choose(event.target.files?.[0]); event.target.value = ''; }} />
          {sourceURL ? <img src={sourceURL} alt="Source image" /> : <><Upload size={26} /><b>Drop an image here</b><span>PNG, JPG, WEBP · up to 20 MB</span></>}
          {sourceURL && <button type="button" onClick={(event) => { event.stopPropagation(); fileInput.current?.click(); }}><Upload size={13} /> Replace image</button>}
        </div>
        <button data-testid="image-upscale-run" className={styles.run} type="button" disabled={Boolean(busy)} onClick={() => void upscale()}>{busy ? <Loader2 className={styles.spin} size={18} /> : <Sparkles size={18} />}{busy ? status : `Upscale ${selectedMode.label}`}</button>
        <div className={styles.modes} role="radiogroup" aria-label="Upscale mode">{MODES.map((item) => <button key={item.id} type="button" role="radio" aria-checked={mode === item.id} data-testid={`image-upscale-mode-${item.id}`} className={mode === item.id ? styles.modeOn : ''} disabled={Boolean(busy)} onClick={() => setMode(item.id)}><b>{item.label}</b><span>{item.detail}</span></button>)}</div>
        <div className={styles.price}><span>{selectedMode.detail} · no prompt needed</span><b>~{credits} credits · ${selectedMode.usd.toFixed(2)}</b></div>
        {error && <div className={styles.error} role="alert">{error}</div>}
      </div>
      <div className={styles.previewPanel}>
        <div className={styles.previewHeader}><span>{outputURL ? 'BEFORE / AFTER' : 'SOURCE PREVIEW'}</span>{outputURL && <span className={styles.ready}><Check size={13} /> READY</span>}</div>
        <div data-testid="image-upscale-result" className={`${styles.preview} ${outputURL ? styles.split : ''}`}>
          <div><span>Before</span><img src={previewSource} alt="Source preview" /></div>
          {outputURL ? <div><span>After · {selectedMode.label}</span><img src={outputURL} alt="Upscaled result" /></div> : <div className={styles.empty}><ImageIcon size={30} /><b>Your result will appear here</b><span>The source stays visible while the upscale runs.</span></div>}
          {busy && <div className={styles.loading}><Loader2 className={styles.spin} size={32} /><b>{status}</b></div>}
        </div>
        <div className={styles.footer}><span>{outputURL ? 'Saved to your ManifoldGen gallery when returned by the service.' : 'Flat price per run · refunded if the backend fails.'}</span>{outputURL && <a href={outputURL} download><Download size={15} /> Download</a>}</div>
      </div>
    </section>
    <section className={styles.example}>
      <div className={styles.exampleCard}>
        <span className={styles.exampleTag}>EXAMPLE</span>
        <div className={styles.exampleSplit}>
          <figure><img src={EXAMPLE} alt="Lighthouse source example" /><figcaption>Before</figcaption></figure>
          <figure><img src={EXAMPLE} alt="Lighthouse upscaled example" /><figcaption>After · 2× upscale</figcaption></figure>
        </div>
        <p>A lighthouse on black basalt, upscaled from its original render — texture on the rock and lamp room comes back at double resolution.</p>
      </div>
    </section>
    <section className={styles.notes}><div><Sparkles size={17} /><span><b>Faithful or creative</b>The faithful upscaler sharpens what is there without inventing content; Creative mode adds plausible micro-detail at creativity 0.35.</span></div><div><ImageIcon size={17} /><span><b>No prompt required</b>The model works from the image alone, so there is nothing to write before running.</span></div><div><Check size={17} /><span><b>Flat metering</b>$0.02 for 2×, $0.03 for 4×, $0.15 for Creative, regardless of source size. Refunded if the backend fails.</span></div></section>
  </main>;
}
