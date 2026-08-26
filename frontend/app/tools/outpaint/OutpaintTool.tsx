'use client';

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Download, Image as ImageIcon, Loader2, Maximize2, Sparkles, Upload, WandSparkles } from 'lucide-react';
import { loadStoredUser, refreshUser, saveUser, type StoredUser } from '@/lib/auth';
import styles from './page.module.css';

type APIResponse = { result?: unknown; error?: string; credits_remain?: number; usd_equivalent?: number };

const EXAMPLE = 'https://manifoldgenstatic.manifoldgen.com/gallery/originals/64171ef03cb954ad_378dad88.webp';

function responseImage(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value.startsWith('data:image') || value.startsWith('http') || value.startsWith('/') ? value : '';
  if (typeof value !== 'object') return '';
  const row = value as Record<string, unknown>;
  for (const key of ['saved_image_url', 'image_url', 'url', 'path']) {
    if (typeof row[key] === 'string' && row[key]) return row[key] as string;
  }
  for (const key of ['b64_json', 'image_base64']) {
    if (typeof row[key] === 'string' && row[key]) return `data:image/png;base64,${row[key]}`;
  }
  for (const key of ['data', 'result', 'output', 'images']) {
    const nested = responseImage(row[key]);
    if (nested) return nested;
  }
  return '';
}

async function jsonResponse(response: Response, fallback: string): Promise<APIResponse> {
  const data = await response.json().catch(() => ({})) as APIResponse;
  if (!response.ok) throw new Error(data.error || fallback);
  return data;
}

async function uploadToR2(file: File, apiKey: string): Promise<string> {
  const params = new URLSearchParams({ filename: file.name, content_type: file.type || 'image/webp', dataset: 'outpaint' });
  const prepared = await jsonResponse(await fetch(`/api/uploads/presign?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  }), 'Could not prepare the image upload');
  const destinations = prepared as APIResponse & { upload_url?: string; public_url?: string };
  if (!destinations.upload_url || !destinations.public_url) throw new Error('Upload service returned no destination');
  const uploaded = await fetch(destinations.upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'image/webp' } });
  if (!uploaded.ok) throw new Error(`Image upload failed (${uploaded.status})`);
  return destinations.public_url;
}

type Expand = { top: number; bottom: number; left: number; right: number };

export default function OutpaintTool() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [creditPrice, setCreditPrice] = useState(0.01);
  const [file, setFile] = useState<File | null>(null);
  const [sourceURL, setSourceURL] = useState('');
  const [outputURL, setOutputURL] = useState('');
  const [expand, setExpand] = useState<Expand>({ top: 0, bottom: 0, left: 0, right: 0 });
  const [zoomMode, setZoomMode] = useState(false);
  const [zoomOut, setZoomOut] = useState(10);
  const [busy, setBusy] = useState<'upload' | 'extend' | ''>('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setUser(loadStoredUser());
    fetch('/api/pricing').then((response) => response.json()).then((data) => {
      if (typeof data.credit_price_usd === 'number' && data.credit_price_usd > 0) setCreditPrice(data.credit_price_usd);
    }).catch(() => {});
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

  async function extend() {
    const currentUser = user || loadStoredUser();
    if (!currentUser?.api_key) { setError('Sign in to use Extend Image.'); return; }
    if (!file && !sourceURL) { setError('Choose an image first.'); return; }
    const anyExpand = Object.values(expand).some((value) => value > 0);
    if (zoomMode ? zoomOut <= 0 : !anyExpand) { setError('Choose at least one side to expand or set zoom-out.'); return; }
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
      setBusy('extend');
      setStatus('OpenPaths is extending your canvas…');
      const body = zoomMode
        ? { service: 'extend-image', image_url: imageURL, zoom_out_percentage: zoomOut }
        : {
            service: 'extend-image',
            image_url: imageURL,
            expand_top: expand.top / 100,
            expand_bottom: expand.bottom / 100,
            expand_left: expand.left / 100,
            expand_right: expand.right / 100,
          };
      const response = await fetch('/api/service', {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentUser.api_key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await jsonResponse(response, 'Canvas extension failed');
      const result = responseImage(data.result);
      if (!result) throw new Error('The extension completed without returning an image.');
      setOutputURL(result);
      setStatus('Your extended canvas is ready');
      const fresh = await refreshUser(currentUser.api_key);
      if (fresh) { setUser(fresh); saveUser(fresh); }
    } catch (reason) {
      setStatus('');
      setError(reason instanceof Error ? reason.message : 'Canvas extension failed');
    } finally {
      setBusy('');
    }
  }

  const previewSource = sourceURL || EXAMPLE;
  const price = 0.10;
  const credits = Math.ceil(price / creditPrice);
  const hintPadding = zoomMode ? `${zoomOut / 2}%` : `${expand.top}% ${expand.right}% ${expand.bottom}% ${expand.left}%`;
  const presets: Array<{ label: string; apply: () => void }> = [
    { label: 'Wide panorama · +40% sides', apply: () => { setZoomMode(false); setExpand({ top: 0, bottom: 0, left: 40, right: 40 }); } },
    { label: 'Tall poster · +25% top and bottom', apply: () => { setZoomMode(false); setExpand({ top: 25, bottom: 25, left: 0, right: 0 }); } },
    { label: 'Zoom out 25%', apply: () => { setZoomMode(true); setZoomOut(25); } },
  ];

  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/tools" className={styles.back}><ArrowLeft size={16} /> All tools</Link>
      <div className={styles.brand}><Maximize2 size={14} /> EXTEND IMAGE</div>
      <Link href="/account" className={styles.account}>{user ? `${(user.credits_usd ?? user.credits * creditPrice).toFixed(2)} USD` : 'Sign in'}</Link>
    </header>
    <section className={styles.hero}>
      <h1>Keep the subject.<br /><span>Grow the world around it.</span></h1>
      <p>Upload a frame, push any edge outward or zoom the whole scene out, and outpainting fills the new border in visual continuity with the original.</p>
    </section>
    <section className={styles.workspace}>
      <div className={styles.controls}>
        <div className={styles.drop} onDragOver={(event) => event.preventDefault()} onDrop={drop} onClick={() => fileInput.current?.click()}>
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={(event: ChangeEvent<HTMLInputElement>) => { choose(event.target.files?.[0]); event.target.value = ''; }} />
          {sourceURL ? <img src={sourceURL} alt="Source image" /> : <><Upload size={26} /><b>Drop an image here</b><span>PNG, JPG, WEBP · up to 20 MB</span></>}
          {sourceURL && <button type="button" onClick={(event) => { event.stopPropagation(); fileInput.current?.click(); }}><Upload size={13} /> Replace image</button>}
        </div>
        <div className={styles.modeRow}>
          <span>Expansion mode</span>
          <div className={styles.modeToggle}>
            <button type="button" className={zoomMode ? '' : styles.active} onClick={() => setZoomMode(false)}>Per side</button>
            <button type="button" className={zoomMode ? styles.active : ''} onClick={() => setZoomMode(true)}>Zoom out</button>
          </div>
        </div>
        {zoomMode
          ? <label className={styles.slider}><span>Zoom-out percentage <b className={styles.val}>{zoomOut}%</b></span><input type="range" min={5} max={50} step={5} value={zoomOut} onChange={(event) => setZoomOut(Number(event.target.value))} /></label>
          : <div className={styles.sliders}>
              <label className={styles.slider}><span>Expand top <b className={styles.val}>{expand.top}%</b></span><input type="range" min={0} max={100} value={expand.top} onChange={(event) => setExpand((current) => ({ ...current, top: Number(event.target.value) }))} /></label>
              <label className={styles.slider}><span>Expand bottom <b className={styles.val}>{expand.bottom}%</b></span><input type="range" min={0} max={100} value={expand.bottom} onChange={(event) => setExpand((current) => ({ ...current, bottom: Number(event.target.value) }))} /></label>
              <label className={styles.slider}><span>Expand left <b className={styles.val}>{expand.left}%</b></span><input type="range" min={0} max={100} value={expand.left} onChange={(event) => setExpand((current) => ({ ...current, left: Number(event.target.value) }))} /></label>
              <label className={styles.slider}><span>Expand right <b className={styles.val}>{expand.right}%</b></span><input type="range" min={0} max={100} value={expand.right} onChange={(event) => setExpand((current) => ({ ...current, right: Number(event.target.value) }))} /></label>
            </div>}
        <button className={styles.run} data-testid="outpaint-run" type="button" disabled={Boolean(busy)} onClick={() => void extend()}>{busy ? <Loader2 className={styles.spin} size={18} /> : <WandSparkles size={18} />}{busy ? status : 'Extend canvas'}</button>
        <div className={styles.price}><span>OpenPaths extend route · flat rate per run</span><b>~{credits} credits · ${price.toFixed(2)}</b></div>
        {error && <div className={styles.error} role="alert">{error}</div>}
      </div>
      <div className={styles.previewPanel}>
        <div className={styles.previewHeader}><span>{outputURL ? 'SOURCE / EXTENDED' : 'CANVAS PREVIEW'}</span>{outputURL && <span className={styles.ready}><Check size={13} /> READY</span>}</div>
        <div className={styles.preview}>
          {outputURL
            ? <div data-testid="outpaint-result"><span>Extended result</span><img src={outputURL} alt="Extended result" /></div>
            : <div><span>New canvas outline</span><div className={styles.frame} style={{ padding: hintPadding }}><img src={previewSource} alt="Source preview" /></div></div>}
          {busy && <div className={styles.loading}><Loader2 className={styles.spin} size={32} /><b>{status}</b></div>}
        </div>
        <div className={styles.footer}><span>{outputURL ? 'Saved to your ManifoldGen gallery when returned by the service.' : 'The dashed border marks the canvas the model will fill.'}</span>{outputURL && <a href={outputURL} download><Download size={15} /> Download</a>}</div>
      </div>
    </section>
    <section className={styles.example}>
      <span className={styles.exampleTag}>EXAMPLE</span>
      <div className={styles.exampleCard}>
        <img src={EXAMPLE} alt="Desert research station at blue hour" />
        <div className={styles.exampleBody}>
          <b>Desert research station at blue hour</b>
          <span>A real ManifoldGen output. Upload a similar wide-scene frame, then push the edges outward — dunes, sky, and haze continue past the original border.</span>
          <div className={styles.chips}>
            {presets.map((preset) => <button key={preset.label} type="button" onClick={preset.apply}>{preset.label}</button>)}
          </div>
        </div>
      </div>
    </section>
    <section className={styles.notes}>
      <div><Sparkles size={17} /><span><b>Per-side control</b>Each edge expands independently from 0 to 100 percent of the original dimension.</span></div>
      <div><Maximize2 size={17} /><span><b>Zoom-out mode</b>Shrink the original inside a larger canvas by a single percentage and let the model fill the ring.</span></div>
      <div><ImageIcon size={17} /><span><b>Simple metering</b>Every extension is one flat charge and is refunded if the backend fails.</span></div>
    </section>
  </main>;
}
