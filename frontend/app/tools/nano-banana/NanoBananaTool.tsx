'use client';

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Download, Image as ImageIcon, Loader2, Sparkles, Upload, WandSparkles } from 'lucide-react';
import { loadStoredUser, refreshUser, saveUser, type StoredUser } from '@/lib/auth';
import styles from './page.module.css';

type APIResponse = { result?: unknown; error?: string };

type Mode = 'gen' | 'edit';

const EXAMPLE_IMAGE = 'https://manifoldgenstatic.manifoldgen.com/gallery/originals/e681e42f9ad635c1_45a810ec.webp';

const EXAMPLE_PROMPTS = [
  'glass monorail in crisp winter sunlight, wide shot',
  'cliffside observatory in quiet late-afternoon haze',
  'lighthouse on black basalt, storm clouds breaking',
];

function extractVariants(payload: unknown): string[] {
  const found: string[] = [];
  const walk = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      (value as unknown[]).forEach(walk);
      return;
    }
    const row = value as Record<string, unknown>;
    for (const key of ['images', 'data', 'saved_image_urls']) {
      if (Array.isArray(row[key])) {
        (row[key] as unknown[]).forEach(walk);
        return;
      }
    }
    const url = [row.saved_image_url, row.image_url, row.url, row.path].find((v): v is string => typeof v === 'string' && Boolean(v.trim()));
    const b64 = [row.b64_json, row.image_base64].find((v): v is string => typeof v === 'string' && Boolean(v.trim()));
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
  const params = new URLSearchParams({ filename: file.name, content_type: file.type || 'image/webp', dataset: 'nano-banana' });
  const prepared = await jsonResponse(await fetch(`/api/uploads/presign?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  }), 'Could not prepare the image upload');
  const destinations = prepared as APIResponse & { upload_url?: string; public_url?: string };
  if (!destinations.upload_url || !destinations.public_url) throw new Error('Upload service returned no destination');
  const uploaded = await fetch(destinations.upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'image/webp' } });
  if (!uploaded.ok) throw new Error(`Image upload failed (${uploaded.status})`);
  return destinations.public_url;
}

export default function NanoBananaTool() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [mode, setMode] = useState<Mode>('gen');
  const [prompt, setPrompt] = useState('');
  const [aspect, setAspect] = useState<'square' | 'portrait' | 'landscape'>('square');
  const [resolution, setResolution] = useState<'1k' | '2k'>('1k');
  const [count, setCount] = useState(1);
  const [seed, setSeed] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sourceURL, setSourceURL] = useState('');
  const [variants, setVariants] = useState<string[]>([]);
  const [busy, setBusy] = useState<'upload' | 'run' | ''>('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [creditPrice, setCreditPrice] = useState(0.01);

  useEffect(() => {
    setUser(loadStoredUser());
  }, []);

  useEffect(() => {
    void fetch('/api/pricing').then((response) => response.json()).then((data) => {
      if (typeof data.credit_price_usd === 'number') setCreditPrice(data.credit_price_usd);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!file) return;
    const localURL = URL.createObjectURL(file);
    setSourceURL(localURL);
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
    if (!currentUser?.api_key) { setError('Sign in to use Nano Banana 2.'); return; }
    const text = prompt.trim();
    if (!text) { setError('Describe the image you want.'); return; }
    setError('');
    try {
      let imageURL = '';
      if (mode === 'edit') {
        if (!file && !sourceURL) { setError('Upload a reference image first.'); return; }
        if (file) {
          setBusy('upload');
          setStatus('Uploading the reference to secure storage…');
          imageURL = await uploadToR2(file, currentUser.api_key);
          setSourceURL(imageURL);
          setFile(null);
        } else {
          imageURL = sourceURL;
        }
      }
      setBusy('run');
      setStatus('Nano Banana 2 is rendering…');
      const body: Record<string, unknown> = {
        service: 'openpaths-image',
        model: 'nano-banana-2',
        prompt: text,
        aspect_ratio: aspect,
        resolution,
        n: count,
      };
      const seedValue = Number(seed);
      if (seed.trim() !== '' && Number.isFinite(seedValue)) body.seed = Math.trunc(seedValue);
      if (mode === 'edit') body.image_url = imageURL;
      const response = await fetch('/api/service', {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentUser.api_key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await jsonResponse(response, 'Image generation failed');
      const found = extractVariants(data.result ?? data);
      if (!found.length) throw new Error('The model returned no images.');
      setVariants(found);
      setStatus('Your image is ready');
      const fresh = await refreshUser(currentUser.api_key);
      if (fresh) { setUser(fresh); saveUser(fresh); }
    } catch (reason) {
      setStatus('');
      setError(reason instanceof Error ? reason.message : 'Image generation failed');
    } finally {
      setBusy('');
    }
  }

  const price = 0.16 * count;
  const credits = Math.ceil(price / creditPrice);

  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/tools" className={styles.back}><ArrowLeft size={16} /> All tools</Link>
      <div className={styles.brand}><Sparkles size={14} /> NANO BANANA 2</div>
      <Link href="/account" className={styles.account}>{user ? `${(user.credits_usd ?? user.credits * (user.credit_price_usd || .01)).toFixed(2)} USD` : 'Sign in'}</Link>
    </header>
    <section className={styles.hero}>
      <h1>Nano Banana 2.<br /><span>Prompt it. Or re-prompt an image.</span></h1>
      <p>Google&rsquo;s Gemini-flash image model, routed through OpenPaths. Generate from text or drop in a reference and describe the change &mdash; square, portrait, or landscape at 1K or 2K.</p>
    </section>
    <section className={styles.workspace}>
      <div className={styles.controls}>
        <div className={styles.modeButtons}>
          <button type="button" className={mode === 'gen' ? styles.modeActive : ''} onClick={() => setMode('gen')}>Text → Image</button>
          <button type="button" className={mode === 'edit' ? styles.modeActive : ''} onClick={() => setMode('edit')}>Reference Edit</button>
        </div>
        {mode === 'edit' && <div className={styles.drop} onDragOver={(event) => event.preventDefault()} onDrop={drop} onClick={() => fileInput.current?.click()}>
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={(event: ChangeEvent<HTMLInputElement>) => { choose(event.target.files?.[0]); event.target.value = ''; }} />
          {sourceURL ? <img src={sourceURL} alt="Reference image" /> : <><Upload size={24} /><b>Drop a reference here</b><span>PNG, JPG, WEBP · up to 20 MB</span></>}
          {sourceURL && <button type="button" onClick={(event) => { event.stopPropagation(); fileInput.current?.click(); }}><Upload size={13} /> Replace image</button>}
        </div>}
        <label className={styles.field}><span>{mode === 'edit' ? 'Describe the change' : 'Describe the image'}</span>
          <textarea data-testid="nano-banana-prompt" value={prompt} maxLength={1200} rows={3} onChange={(event) => setPrompt(event.target.value)} placeholder="glass monorail in crisp winter sunlight…" />
          <small>Name the subject, setting, medium, palette, and light.</small>
        </label>
        <div className={styles.options}>
          <label><span>Aspect ratio</span><select value={aspect} onChange={(event) => setAspect(event.target.value as typeof aspect)}><option value="square">Square</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
          <label><span>Resolution</span><select data-testid="nano-banana-resolution" value={resolution} onChange={(event) => setResolution(event.target.value as typeof resolution)}><option value="1k">1K</option><option value="2k">2K</option></select></label>
          <label><span>Images</span><input data-testid="nano-banana-count" type="number" min={1} max={4} value={count} onChange={(event) => setCount(Math.min(4, Math.max(1, Number(event.target.value) || 1)))} /></label>
          <label><span>Seed <em>optional</em></span><input type="number" value={seed} onChange={(event) => setSeed(event.target.value)} placeholder="random" /></label>
        </div>
        <button data-testid="nano-banana-run" className={styles.run} type="button" disabled={Boolean(busy) || !prompt.trim()} onClick={() => void run()}>
          {busy ? <Loader2 className={styles.spin} size={18} /> : <WandSparkles size={18} />}
          {busy ? status : mode === 'edit' ? `Edit with Nano Banana 2` : `Generate ${count > 1 ? `${count} images` : 'image'}`}
        </button>
        <div className={styles.price}><span>$0.16 per image · 2K renders at the same price as 1K</span><b>~{credits} credits · ${price.toFixed(2)}</b></div>
        {error && <div className={styles.error} role="alert">{error}</div>}
      </div>
      <div className={styles.previewPanel}>
        <div className={styles.previewHeader}><span>{variants.length ? 'RESULT' : 'NANO BANANA 2'}</span>{variants.length > 0 && <span className={styles.ready}><Check size={13} /> READY</span>}</div>
        <div className={styles.preview}>
          {variants.length ? (
            <div data-testid="nano-banana-result" className={styles.variantGrid}>{variants.map((url, index) => (
              <div key={`${url}::${index}`} className={styles.variant}>
                <img src={url} alt={`Result ${index + 1}`} />
                <a href={url} download aria-label="Download image"><Download size={13} /></a>
                <span className={styles.tick}><Check size={13} /></span>
              </div>
            ))}</div>
          ) : (
            <div className={styles.empty}><ImageIcon size={30} /><b>Your result will appear here</b><span>{mode === 'edit' ? 'The reference guides the edit; the prompt sets the change.' : 'One clear prompt beats five vague ones.'}</span></div>
          )}
          {busy && <div className={styles.loading}><Loader2 className={styles.spin} size={32} /><b>{status}</b></div>}
        </div>
        <div className={styles.footer}><span>Variants land in your ManifoldGen gallery when the service saves them.</span>{variants.length > 0 && <a href={variants[0]} download><Download size={15} /> Download</a>}</div>
      </div>
    </section>
    <section className={styles.exampleCard}>
      <img src={EXAMPLE_IMAGE} alt="Example Nano Banana 2 output: glass monorail in crisp winter sunlight" />
      <div className={styles.exampleBody}>
        <span className={styles.exampleLabel}>EXAMPLE · REAL MODEL OUTPUT</span>
        <p>Glass monorail in crisp winter sunlight &mdash; generated by Nano Banana 2. Try one of these starting points:</p>
        <div className={styles.chips}>{EXAMPLE_PROMPTS.map((item) => (
          <button key={item} type="button" className={styles.chip} onClick={() => { setPrompt(item); setError(''); }}>{item}</button>
        ))}</div>
      </div>
    </section>
    <section className={styles.notes}>
      <div><Sparkles size={17} /><span><b>Gemini-flash image model</b>Nano Banana 2 is Google&rsquo;s fast image lane &mdash; quick drafts that still hold composition.</span></div>
      <div><ImageIcon size={17} /><span><b>Reference edit</b>Switch to Reference Edit, drop one image, and describe what should change while the rest holds.</span></div>
      <div><Check size={17} /><span><b>Flat metering</b>$0.16 per image whether you render 1K or 2K, refunded if the backend fails.</span></div>
    </section>
  </main>;
}
