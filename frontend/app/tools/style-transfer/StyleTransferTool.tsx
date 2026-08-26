'use client';

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Download, Image as ImageIcon, Loader2, Sparkles, Upload, WandSparkles } from 'lucide-react';
import { loadStoredUser, refreshUser, saveUser, type StoredUser } from '@/lib/auth';
import styles from './page.module.css';

type APIResponse = { result?: unknown; error?: string; credits_remain?: number; usd_equivalent?: number };

const EXAMPLE = 'https://manifoldgenstatic.manifoldgen.com/gallery/originals/h3_dev_glass_hummingbird_20260816.png';

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
  if (!response.ok) throw new Error(data.error || fallback);
  return data;
}

async function uploadToR2(file: File, apiKey: string): Promise<string> {
  const params = new URLSearchParams({ filename: file.name, content_type: file.type || 'image/webp', dataset: 'style-transfer' });
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

export default function StyleTransferTool() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sourceURL, setSourceURL] = useState('');
  const [outputURL, setOutputURL] = useState('');
  const [prompt, setPrompt] = useState('Turn this into a softly lit editorial photograph with warm paper texture, restrained colors, and a premium art-book finish. Keep the subject, pose, and composition recognizable.');
  const [aspect, setAspect] = useState<'square' | 'landscape' | 'portrait'>('square');
  const [busy, setBusy] = useState<'upload' | 'edit' | ''>('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setUser(loadStoredUser());
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

  async function edit() {
    const currentUser = user || loadStoredUser();
    if (!currentUser?.api_key) { setError('Sign in to use Style Transfer.'); return; }
    if (!file && !sourceURL) { setError('Choose an image first.'); return; }
    if (!prompt.trim()) { setError('Describe the style or change you want.'); return; }
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
      setBusy('edit');
      setStatus('OpenPaths is editing your image…');
      const dimensions = aspect === 'landscape' ? [1536, 1024] : aspect === 'portrait' ? [1024, 1536] : [1024, 1024];
      const response = await fetch('/api/service', {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentUser.api_key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: 'image-edit', image_url: imageURL, prompt: prompt.trim(), width: dimensions[0], height: dimensions[1], n: 1 }),
      });
      const data = await jsonResponse(response, 'Style transfer failed');
      const result = responseImage(data.result);
      if (!result) throw new Error('The edit completed without returning an image.');
      setOutputURL(result);
      setStatus('Your edited image is ready');
      const fresh = await refreshUser(currentUser.api_key);
      if (fresh) { setUser(fresh); saveUser(fresh); }
    } catch (reason) {
      setStatus('');
      setError(reason instanceof Error ? reason.message : 'Style transfer failed');
    } finally {
      setBusy('');
    }
  }

  const previewSource = sourceURL || EXAMPLE;
  const price = 0.30;
  const credits = Math.ceil(price / (user?.credit_price_usd || 0.01));

  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/tools" className={styles.back}><ArrowLeft size={16} /> All tools</Link>
      <div className={styles.brand}><Sparkles size={14} /> STYLE TRANSFER</div>
      <Link href="/account" className={styles.account}>{user ? `${(user.credits_usd ?? user.credits * (user.credit_price_usd || .01)).toFixed(2)} USD` : 'Sign in'}</Link>
    </header>
    <section className={styles.hero}>
      <h1>Keep the image.<br /><span>Change its world.</span></h1>
      <p>Upload a source, describe a style, and an edit model restyles it while preserving subject and composition.</p>
    </section>
    <section className={styles.workspace}>
      <div className={styles.controls}>
        <div className={styles.drop} onDragOver={(event) => event.preventDefault()} onDrop={drop} onClick={() => fileInput.current?.click()}>
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={(event: ChangeEvent<HTMLInputElement>) => { choose(event.target.files?.[0]); event.target.value = ''; }} />
          {sourceURL ? <img src={sourceURL} alt="Source image" /> : <><Upload size={26} /><b>Drop an image here</b><span>PNG, JPG, WEBP · up to 20 MB</span></>}
          {sourceURL && <button type="button" onClick={(event) => { event.stopPropagation(); fileInput.current?.click(); }}><Upload size={13} /> Replace image</button>}
        </div>
        <label className={styles.field}><span>Describe the new style</span><textarea value={prompt} maxLength={1200} onChange={(event) => setPrompt(event.target.value)} rows={3} placeholder="Preserve the subject, but…" /><small>Say what should stay, what should change, the medium, palette, light, and finish.</small></label>
        <div className={styles.options}><label><span>Canvas</span><select value={aspect} onChange={(event) => setAspect(event.target.value as typeof aspect)}><option value="square">Square · 1024 × 1024</option><option value="landscape">Landscape · 1536 × 1024</option><option value="portrait">Portrait · 1024 × 1536</option></select></label></div>
        <button className={styles.run} type="button" disabled={Boolean(busy) || !prompt.trim()} onClick={() => void edit()}>{busy ? <Loader2 className={styles.spin} size={18} /> : <WandSparkles size={18} />}{busy ? status : 'Transfer style'}</button>
        <div className={styles.price}><b>~{credits} credits · ${price.toFixed(2)}</b></div>
        {error && <div className={styles.error} role="alert">{error}</div>}
      </div>
      <div className={styles.previewPanel}>
        <div className={styles.previewHeader}><span>{outputURL ? 'BEFORE / AFTER' : 'SOURCE PREVIEW'}</span>{outputURL && <span className={styles.ready}><Check size={13} /> READY</span>}</div>
        <div className={`${styles.preview} ${outputURL ? styles.split : ''}`}>
          <div><span>Source</span><img src={previewSource} alt="Source preview" /></div>
          {outputURL ? <div><span>Edited result</span><img src={outputURL} alt="Edited result" /></div> : <div className={styles.empty}><ImageIcon size={30} /><b>Your result will appear here</b><span>The source stays visible while the edit runs.</span></div>}
          {busy && <div className={styles.loading}><Loader2 className={styles.spin} size={32} /><b>{status}</b></div>}
        </div>
        <div className={styles.footer}><span>{outputURL ? 'Saved to your ManifoldGen gallery when returned by the service.' : 'One prompt-driven edit per run.'}</span>{outputURL && <a href={outputURL} download><Download size={15} /> Download</a>}</div>
      </div>
    </section>
    <section className={styles.notes}><div><Sparkles size={17} /><span><b>Prompt the transformation</b>Describe a medium, palette, lighting direction, or complete visual language.</span></div><div><ImageIcon size={17} /><span><b>Source stays first</b>The uploaded image is sent as an edit input, not copied into a text-only generation.</span></div><div><Check size={17} /><span><b>Simple metering</b>Each edit is priced at the current maximum image-edit rate and refunded if the backend fails.</span></div></section>
  </main>;
}
