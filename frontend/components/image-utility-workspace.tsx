'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, Loader2, Sparkles, Upload } from 'lucide-react';
import { loadStoredUser, refreshUser, saveUser, type StoredUser } from '@/lib/auth';
import { ensurePaidAccess, errorFields, isPaywallError, paywallFromResponse } from '@/lib/paywall';
import { RESIZE_PRESETS, resizePrice, utilityImageURLs, validResizeSize } from '@/lib/image-utilities';
import styles from '@/app/tools/relight/page.module.css';
import utilityStyles from './image-utility-workspace.module.css';

export function ImageUtilityWorkspace({ resize }: { resize: boolean }) {
  const name = resize ? 'Smart Resize' : 'Image Background Remover';
  const input = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [sizes, setSizes] = useState<string[]>(['1024x1024']);
  const [custom, setCustom] = useState('');
  const [prompt, setPrompt] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [resultSizes, setResultSizes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const price = resize ? resizePrice(sizes.length) : 0.03;

  useEffect(() => { setUser(loadStoredUser()); }, []);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function choose(next?: File) {
    if (!next) return;
    if (!/^image\/(png|jpeg|webp)$/.test(next.type) || next.size > 20 * 1024 * 1024) {
      setError('Choose a PNG, JPG or WebP image up to 20 MB.'); return;
    }
    setFile(next); setResults([]); setError('');
  }

  function toggle(size: string) {
    setSizes((current) => current.includes(size) ? current.filter((item) => item !== size) : current.length < 6 ? [...current, size] : current);
  }

  async function read(response: Response) {
    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw paywallFromResponse(response, data, name) || new Error(errorFields(data).message || `Request failed (${response.status})`);
    return data;
  }

  async function run() {
    const current = user || loadStoredUser();
    if (!current?.api_key) { ensurePaidAccess(name); return; }
    if (!file || (resize && !sizes.length)) { setError('Choose an image and at least one target size.'); return; }
    const selected = [...sizes];
    setBusy(true); setError(''); setResults([]);
    try {
      setStatus('Uploading image...');
      const params = new URLSearchParams({ filename: file.name, content_type: file.type, dataset: resize ? 'smart-resize' : 'background-removal' });
      const destination = await read(await fetch(`/api/uploads/presign?${params}`, { headers: { Authorization: `Bearer ${current.api_key}` } }));
      if (typeof destination.upload_url !== 'string' || typeof destination.public_url !== 'string') throw new Error('Upload destination missing');
      const upload = await fetch(destination.upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      if (!upload.ok) throw new Error('Image upload failed');
      setStatus(resize ? 'Recomposing your target sizes...' : 'Removing the background...');
      const data = await read(await fetch('/api/service', {
        method: 'POST', headers: { Authorization: `Bearer ${current.api_key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: resize ? 'smart-resize' : 'remove-background', image_url: destination.public_url, ...(resize ? { target_sizes: selected, prompt: prompt.trim() } : {}) }),
      }));
      const urls = utilityImageURLs(data);
      if (!urls.length) throw new Error('No image returned');
      setResults(urls); setResultSizes(selected); setStatus('Ready');
      try {
        const fresh = await refreshUser(current.api_key);
        if (fresh) { setUser(fresh); saveUser(fresh); }
      } catch { /* The completed result remains available if account refresh fails. */ }
    } catch (reason) {
      setStatus('');
      if (!isPaywallError(reason)) setError(reason instanceof Error ? reason.message : 'Image processing failed');
    } finally { setBusy(false); }
  }

  return <main className={styles.page}>
    <header className={styles.header}><Link href="/tools" className={styles.back}><ArrowLeft size={16} /> All tools</Link><div className={styles.brand}><Sparkles size={14} /> {name}</div><Link href="/account" className={styles.account}>{user ? 'Account' : 'Sign in'}</Link></header>
    <section className={styles.hero}><h1>{name}</h1><p>{resize ? 'Recompose one image for social posts, stories and banners. AI adapts the composition to each exact size instead of stretching the source.' : 'Cut out people, products and characters with BiRefNet. Download a transparent PNG without redrawing your subject.'}</p></section>
    <section className={styles.workspace}>
      <div className={styles.controls}>
        <button type="button" className={styles.drop} style={{ width: '100%' }} disabled={busy} onClick={() => input.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (!busy) choose(event.dataTransfer.files[0]); }}>
          {preview ? <img src={preview} alt="Source image" /> : <><Upload size={26} /><b>Upload or drop an image</b><span>PNG, JPG, WebP - up to 20 MB</span></>}
        </button>
        <input ref={input} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { choose(event.target.files?.[0]); event.target.value = ''; }} />
        {resize && <fieldset disabled={busy} style={{ border: 0, padding: 0, marginTop: 18 }}><legend>Target sizes (choose up to 6)</legend>
          <div className={styles.chips}>{RESIZE_PRESETS.map(({ size, label }) => <button type="button" className={styles.chip} key={size} aria-pressed={sizes.includes(size)} onClick={() => toggle(size)} style={{ borderColor: sizes.includes(size) ? '#c5a7ff' : undefined }}>{label} {size}</button>)}</div>
          <label className={styles.field}>Custom dimensions<input className={utilityStyles.customInput} aria-label="Custom dimensions" placeholder="1600x900" value={custom} onChange={(event) => setCustom(event.target.value)} /><small>64-2048 px per side. Exact WIDTHxHEIGHT.</small></label>
          <button type="button" className={styles.chip} disabled={!validResizeSize(custom) || sizes.length >= 6 || sizes.includes(custom)} onClick={() => { setSizes([...sizes, custom]); setCustom(''); }}>Add size</button>
          <div className={styles.chips}>{sizes.filter((size) => !RESIZE_PRESETS.some((preset) => preset.size === size)).map((size) => <button type="button" className={styles.chip} key={size} onClick={() => toggle(size)}>{size} - remove</button>)}</div>
          <label className={styles.field}>Extra direction (optional)<textarea value={prompt} maxLength={1200} onChange={(event) => setPrompt(event.target.value)} placeholder="Keep the product label legible, leave space above for a headline" /></label>
        </fieldset>}
        <button className={`${styles.run} ${utilityStyles.run}`} type="button" data-testid="utility-run" disabled={busy || !file || (resize && !sizes.length)} onClick={() => void run()}>{busy && <Loader2 size={18} className={styles.spin} />}{busy ? status : resize ? 'Resize image' : 'Remove background'}</button>
        <div className={styles.price}><span>Refunded on backend failure</span><b>${price.toFixed(2)} - {Math.ceil(price / (user?.credit_price_usd || 0.01))} credits</b></div>
        {error && <div role="alert" className={styles.error}>{error}</div>}
        <div role="status" aria-live="polite" className={utilityStyles.status}>{status}</div>
      </div>
      <div className={styles.previewPanel}><div className={styles.previewHeader}>RESULTS</div><div className={styles.preview} style={{ background: resize ? undefined : 'repeating-conic-gradient(#242431 0% 25%, #15151f 0% 50%) 0 / 24px 24px' }}>
        {results.length ? results.map((url, index) => <div key={`${url}-${index}`} data-testid="utility-result" style={{ background: 'transparent' }}><span>{resize ? resultSizes[index] : 'Transparent PNG'}</span><img src={url} alt={resize ? `Resized image ${resultSizes[index]}` : 'Subject with background removed'} /><a className={styles.chip} href={url} download target="_blank" rel="noreferrer"><Download size={14} /> Download PNG</a></div>) : <div className={styles.empty}><Sparkles size={30} /><b>Your results appear here</b><span>{resize ? 'One PNG for each selected size.' : 'Transparency is shown over a checkerboard.'}</span></div>}
      </div></div>
    </section>
    <section className={styles.notes}><div><span><b>{resize ? 'Composition-aware' : 'Clean cutouts'}</b>{resize ? 'AI may regenerate details and text. Inspect each output before publishing.' : 'Fine edges and hair are segmented, not generated.'}</span></div><div><span><b>Keep creating</b><Link href="/tools/relight">Relight your photo</Link><Link href="/tools/outpaint">Extend its canvas</Link></span></div><div><span><b>Simple pricing</b>{resize ? '$0.06 per run + $0.18 per size. Up to six outputs.' : '$0.03 per image. Original resolution, transparent PNG.'}</span></div></section>
  </main>;
}
