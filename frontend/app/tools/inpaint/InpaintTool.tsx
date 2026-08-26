'use client';

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type PointerEvent as ReactPointerEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, Brush, Check, Download, Eraser, Image as ImageIcon, Loader2, Sparkles, Upload, WandSparkles } from 'lucide-react';
import { loadStoredUser, refreshUser, saveUser, type StoredUser } from '@/lib/auth';
import styles from './page.module.css';

type APIResponse = { result?: unknown; error?: string; credits_remain?: number; usd_equivalent?: number };

const EXAMPLE = 'https://manifoldgenstatic.manifoldgen.com/gallery/originals/ea0d66c5b19b8439_64411e9f.webp';

const EXAMPLE_PROMPTS = [
  'Replace the brushed area with weathered copper plating and green patina seams.',
  'Turn the masked region into glowing stained glass lit from within.',
  'Fill the brushed area with dense ivy and small white blossoms.',
];

function responseImage(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') { const trimmed = value.trim(); return /^https?:\/\//.test(trimmed) || trimmed.startsWith('data:image/') ? trimmed : ''; }
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
  const params = new URLSearchParams({ filename: file.name, content_type: file.type || 'image/webp', dataset: 'inpaint' });
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
function loadImage(url: string, cors = false): Promise<HTMLImageElement> {
  const { promise, resolve, reject } = Promise.withResolvers<HTMLImageElement>();
  const image = new Image();
  if (cors) image.crossOrigin = 'anonymous';
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Could not load the edited image'));
  image.src = url;
  return promise;
}

/** Composite the edited image into the masked region over the original. */
function composite(original: HTMLImageElement, edited: HTMLImageElement, mask: HTMLCanvasElement): string {
  const { naturalWidth: width, naturalHeight: height } = original;
  const layer = document.createElement('canvas');
  layer.width = width;
  layer.height = height;
  const ctx = layer.getContext('2d');
  if (!ctx) throw new Error('Canvas compositing is unavailable in this browser');
  ctx.drawImage(edited, 0, 0, width, height);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.filter = 'blur(6px)';
  ctx.drawImage(mask, 0, 0, width, height);
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-over';
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const outCtx = out.getContext('2d');
  if (!outCtx) throw new Error('Canvas compositing is unavailable in this browser');
  outCtx.drawImage(original, 0, 0);
  outCtx.drawImage(layer, 0, 0);
  return out.toDataURL('image/png');
}

export default function InpaintTool() {
  const fileInput = useRef<HTMLInputElement>(null);
  const maskCanvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sourceURL, setSourceURL] = useState('');
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [resultURL, setResultURL] = useState('');
  const [prompt, setPrompt] = useState('');
  const [brushSize, setBrushSize] = useState(40);
  const [painted, setPainted] = useState(false);
  const [busy, setBusy] = useState<'upload' | 'edit' | ''>('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [creditPrice, setCreditPrice] = useState(0.01);

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
    setResultURL('');
    setPainted(false);
    return () => URL.revokeObjectURL(localURL);
  }, [file]);

  useEffect(() => {
    if (!sourceURL) { setSourceImage(null); return; }
    let alive = true;
    loadImage(sourceURL).then((image) => { if (alive) setSourceImage(image); }).catch(() => setError('Could not read that image.'));
    return () => { alive = false; };
  }, [sourceURL]);

  useEffect(() => {
    const canvas = maskCanvas.current;
    const image = sourceImage;
    if (!canvas || !image) return;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setPainted(false);
  }, [sourceImage]);

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

  function canvasPoint(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = maskCanvas.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function paintTo(point: { x: number; y: number }) {
    const ctx = maskCanvas.current?.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const from = lastPoint.current;
    ctx.beginPath();
    if (from) { ctx.moveTo(from.x, from.y); } else { ctx.moveTo(point.x - 0.01, point.y); }
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPoint.current = point;
    if (!painted) setPainted(true);
  }

  function startPaint(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!sourceImage || busy) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    lastPoint.current = null;
    paintTo(canvasPoint(event));
  }

  function movePaint(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    paintTo(canvasPoint(event));
  }

  function endPaint() {
    drawing.current = false;
    lastPoint.current = null;
  }

  function clearMask() {
    const canvas = maskCanvas.current;
    if (!canvas) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setPainted(false);
  }

  async function run() {
    const currentUser = user || loadStoredUser();
    if (!currentUser?.api_key) { setError('Sign in to use Inpaint.'); return; }
    if (!sourceImage) { setError('Choose an image first.'); return; }
    if (!painted) { setError('Brush the area you want to change.'); return; }
    if (!prompt.trim()) { setError('Describe the change for the brushed area.'); return; }
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
      setStatus('OpenPaths is editing the brushed region…');
      const response = await fetch('/api/service', {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentUser.api_key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: 'image-edit', image_url: imageURL, prompt: prompt.trim(), width: sourceImage.naturalWidth, height: sourceImage.naturalHeight, n: 1 }),
      });
      const data = await jsonResponse(response, 'Inpainting failed');
      const editedURL = responseImage(data.result);
      if (!editedURL) throw new Error('The edit completed without returning an image.');
      const edited = await loadImage(editedURL, !editedURL.startsWith('data:') && !editedURL.startsWith('blob:'));
      const merged = composite(sourceImage, edited, maskCanvas.current!);
      setResultURL(merged);
      setStatus('Your inpainted image is ready');
      const fresh = await refreshUser(currentUser.api_key);
      if (fresh) { setUser(fresh); saveUser(fresh); }
    } catch (reason) {
      setStatus('');
      setError(reason instanceof Error ? reason.message : 'Inpainting failed');
    } finally {
      setBusy('');
    }
  }

  const price = 0.3;
  const credits = Math.ceil(price / creditPrice);

  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/tools" className={styles.back}><ArrowLeft size={16} /> All tools</Link>
      <div className={styles.brand}><Brush size={14} /> INPAINT</div>
      <Link href="/account" className={styles.account}>{user ? `${(user.credits_usd ?? user.credits * (user.credit_price_usd || .01)).toFixed(2)} USD` : 'Sign in'}</Link>
    </header>
    <section className={styles.hero}>
      <h1>Change one region.<br /><span>Keep everything else pixel-exact.</span></h1>
      <p>Brush the area you want changed, describe the replacement, and the edit is composited back only inside your mask. The rest of the image returns untouched.</p>
    </section>
    <section className={styles.workspace}>
      <div className={styles.controls}>
        <div className={styles.drop} onDragOver={(event) => event.preventDefault()} onDrop={drop} onClick={() => fileInput.current?.click()}>
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={(event: ChangeEvent<HTMLInputElement>) => { choose(event.target.files?.[0]); event.target.value = ''; }} />
          {sourceURL ? <img src={sourceURL} alt="Source image" /> : <><Upload size={26} /><b>Drop an image here</b><span>PNG, JPG, WEBP · up to 20 MB</span></>}
          {sourceURL && <button type="button" onClick={(event) => { event.stopPropagation(); fileInput.current?.click(); }}><Upload size={13} /> Replace image</button>}
        </div>
        {sourceURL && <div className={styles.brushRow}>
          <label><span>Brush</span><input type="range" min={10} max={120} value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} aria-label="Brush size" /></label>
          <span className={styles.brushValue}>{brushSize}px</span>
          <button type="button" className={styles.ghostButton} onClick={clearMask}><Eraser size={13} /> Clear mask</button>
        </div>}
        <label className={styles.field}><span>Describe the change inside the brushed area</span>
          <textarea data-testid="inpaint-prompt" value={prompt} maxLength={1200} onChange={(event) => setPrompt(event.target.value)} rows={3} placeholder="Replace the masked region with…" />
          <small>Only the brushed region changes; everything outside the mask is composited back untouched.</small>
        </label>
        <button data-testid="inpaint-run" className={styles.run} type="button" disabled={Boolean(busy) || !prompt.trim()} onClick={() => void run()}>{busy ? <Loader2 className={styles.spin} size={18} /> : <WandSparkles size={18} />}{busy ? status : 'Inpaint brushed area'}</button>
        <div className={styles.price}><span>OpenPaths image-edit route · masked client composite</span><b>~{credits} credits · ${price.toFixed(2)}</b></div>
        {error && <div className={styles.error} role="alert">{error}</div>}
      </div>
      <div className={styles.previewPanel}>
        <div className={styles.previewHeader}><span>{resultURL ? 'INPAINTED RESULT' : sourceURL ? 'BRUSH THE MASK' : 'SOURCE PREVIEW'}</span>{resultURL && <span className={styles.ready}><Check size={13} /> READY</span>}</div>
        <div className={styles.preview}>
          {sourceURL
            ? <div className={styles.canvasStack}>
              <img src={sourceURL} alt="Source being inpainted" />
              {!resultURL && <canvas ref={maskCanvas} data-testid="inpaint-mask" className={styles.maskCanvas} onPointerDown={startPaint} onPointerMove={movePaint} onPointerUp={endPaint} onPointerCancel={endPaint} />}
            </div>
            : <div className={styles.empty}><ImageIcon size={30} /><b>Your result will appear here</b><span>Upload an image, brush a region, and run the edit.</span></div>}
          {resultURL && <img data-testid="inpaint-result" src={resultURL} alt="Inpainted result" />}
          {busy && <div className={styles.loading}><Loader2 className={styles.spin} size={32} /><b>{status}</b></div>}
        </div>
        <div className={styles.footer}><span>{resultURL ? 'The edit was composited back only inside your mask.' : 'White strokes mark the region the model may change.'}</span>{resultURL && <a href={resultURL} download="inpainted.png"><Download size={15} /> Download</a>}</div>
      </div>
    </section>
    <section className={styles.exampleSection}>
      <div className={styles.exampleCard}>
        <img src={EXAMPLE} alt="Example inpaint source: a lighthouse on black basalt" />
        <div className={styles.exampleCopy}>
          <b>Lighthouse on black basalt</b>
          <p>Brush the sky or the headland, then try one of these prompts on the masked region.</p>
          <div className={styles.chips}>
            {EXAMPLE_PROMPTS.map((chip) => (
              <button key={chip} type="button" className={styles.chip} onClick={() => setPrompt(chip)}>{chip}</button>
            ))}
          </div>
        </div>
      </div>
    </section>
    <section className={styles.notes}>
      <div><Brush size={17} /><span><b>Mask stays local</b>Brush strokes never leave the browser; only the source image is uploaded for the edit.</span></div>
      <div><Sparkles size={17} /><span><b>Feathered edges</b>The mask is blurred six pixels before compositing so the patch blends without a hard seam.</span></div>
      <div><Check size={17} /><span><b>Flat pricing</b>Each inpaint run costs the image-edit rate and is refunded if the backend fails.</span></div>
    </section>
  </main>;
}
