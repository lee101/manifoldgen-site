'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Download, Image as ImageIcon, Loader2, Sparkles, WandSparkles } from 'lucide-react';
import { loadStoredUser, refreshUser, saveUser, type StoredUser } from '@/lib/auth';
import styles from './page.module.css';

type APIResponse = { result?: unknown; error?: string; credits_remain?: number; usd_equivalent?: number };

type Model = 'flux-2-klein' | 'flux-2-dev' | 'flux-pro';
type Size = 'square' | 'landscape' | 'portrait';

const MODELS: { id: Model; name: string; price: number; detail: string }[] = [
  { id: 'flux-2-klein', name: 'Klein', price: 0.03, detail: 'Fastest' },
  { id: 'flux-2-dev', name: 'Dev', price: 0.04, detail: 'Balanced quality' },
  { id: 'flux-pro', name: 'Pro', price: 0.06, detail: 'Maximum fidelity' },
];

const SIZES: Record<Size, { label: string; width: number; height: number }> = {
  square: { label: 'Square · 1024 × 1024', width: 1024, height: 1024 },
  landscape: { label: 'Landscape · 1536 × 1024', width: 1536, height: 1024 },
  portrait: { label: 'Portrait · 1024 × 1536', width: 1024, height: 1536 },
};

const EXAMPLE = 'https://manifoldgenstatic.manifoldgen.com/gallery/originals/ea0d66c5b19b8439_64411e9f.webp';

const EXAMPLE_PROMPTS = [
  'Paper-cut lighthouse on black basalt, layered card-stock waves and sky, soft studio light',
  'Cliffside observatory in quiet late-afternoon haze',
  'Floating botanical conservatory beneath a star-filled sky',
];

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
    const nested = row[key];
    if (Array.isArray(nested)) {
      for (const item of nested) {
        const found = responseImage(item);
        if (found) return found;
      }
    } else if (nested) {
      const found = responseImage(nested);
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

export default function Flux2Tool() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [creditPrice, setCreditPrice] = useState(0.01);
  const [model, setModel] = useState<Model>('flux-2-klein');
  const [size, setSize] = useState<Size>('square');
  const [count, setCount] = useState(1);
  const [seed, setSeed] = useState('');
  const [prompt, setPrompt] = useState('Paper-cut lighthouse on black basalt, layered card-stock waves and sky, soft studio light');
  const [outputURL, setOutputURL] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setUser(loadStoredUser());
  }, []);

  useEffect(() => {
    fetch('/api/pricing').then((response) => response.json()).then((data: { credit_price_usd?: number }) => {
      if (typeof data.credit_price_usd === 'number' && data.credit_price_usd > 0) setCreditPrice(data.credit_price_usd);
    }).catch(() => {});
  }, []);

  async function generate() {
    const currentUser = user || loadStoredUser();
    if (!currentUser?.api_key) { setError('Sign in to use FLUX.2.'); return; }
    if (!prompt.trim()) { setError('Describe the image you want.'); return; }
    let seedValue: number | undefined;
    if (seed.trim()) {
      seedValue = Number(seed);
      if (!Number.isInteger(seedValue) || seedValue < 0) { setError('Seed must be a non-negative integer.'); return; }
    }
    setError('');
    setBusy(true);
    setStatus(`FLUX ${MODELS.find((m) => m.id === model)?.name} is painting…`);
    try {
      const dimensions = SIZES[size];
      const response = await fetch('/api/service', {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentUser.api_key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: 'openpaths-image',
          model,
          prompt: prompt.trim(),
          width: dimensions.width,
          height: dimensions.height,
          n: count,
          ...(seedValue !== undefined ? { seed: seedValue } : {}),
        }),
      });
      const data = await jsonResponse(response, 'FLUX generation failed');
      const result = responseImage(data.result);
      if (!result) throw new Error('The run completed without returning an image.');
      setOutputURL(result);
      setStatus('Your image is ready');
      const fresh = await refreshUser(currentUser.api_key);
      if (fresh) { setUser(fresh); saveUser(fresh); }
    } catch (reason) {
      setStatus('');
      setError(reason instanceof Error ? reason.message : 'FLUX generation failed');
    } finally {
      setBusy(false);
    }
  }

  const price = (MODELS.find((m) => m.id === model)?.price ?? 0.03) * count;
  const credits = Math.ceil(price / creditPrice);

  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/tools" className={styles.back}><ArrowLeft size={16} /> All tools</Link>
      <div className={styles.brand}><Sparkles size={14} /> FLUX.2</div>
      <Link href="/account" className={styles.account}>{user ? `${(user.credits_usd ?? user.credits * creditPrice).toFixed(2)} USD` : 'Sign in'}</Link>
    </header>
    <section className={styles.hero}>
      <div className={styles.eyebrow}>FLUX FAMILY · KLEIN · DEV · PRO · OPENPATHS ROUTING</div>
      <h1>Pick your point<br /><span>on the speed-fidelity curve.</span></h1>
      <p>Klein answers almost instantly, Dev balances cost and craft, and Pro pushes the family&rsquo;s maximum fidelity — all from one prompt.</p>
    </section>
    <section className={styles.workspace}>
      <div className={styles.controls}>
        <label className={styles.field}><span>Describe the image</span><textarea data-testid="flux-2-prompt" value={prompt} maxLength={1200} rows={6} onChange={(event) => setPrompt(event.target.value)} placeholder="A paper-cut lighthouse over layered card-stock waves…" /><small>Name the subject, medium, palette, light, and finish.</small></label>
        <div className={styles.options}>
          <label><span>Model</span><select value={model} onChange={(event) => setModel(event.target.value as Model)}>{MODELS.map((m) => <option key={m.id} value={m.id}>{`${m.name} · $${m.price.toFixed(2)}`}</option>)}</select></label>
          <label><span>Size</span><select value={size} onChange={(event) => setSize(event.target.value as Size)}>{Object.entries(SIZES).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}</select></label>
          <label><span>Images</span><select value={count} onChange={(event) => setCount(Number(event.target.value))}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
          <label><span>Seed · optional</span><input type="text" inputMode="numeric" value={seed} onChange={(event) => setSeed(event.target.value)} placeholder="random" /></label>
        </div>
        <button data-testid="flux-2-run" className={styles.run} type="button" disabled={busy || !prompt.trim()} onClick={() => void generate()}>{busy ? <Loader2 className={styles.spin} size={18} /> : <WandSparkles size={18} />}{busy ? status : `Generate ${count > 1 ? `${count} images` : 'image'}`}</button>
        <div className={styles.price}><span>{`OpenPaths ${model} route`}</span><b>~{credits} credits · ${price.toFixed(2)}</b></div>
        {error && <div className={styles.error} role="alert">{error}</div>}
      </div>
      <div className={styles.previewPanel}>
        <div className={styles.previewHeader}><span>{outputURL ? 'IMAGE OUTPUT' : 'EXAMPLE OUTPUT'}</span>{outputURL && <span className={styles.ready}><Check size={13} /> READY</span>}</div>
        <div data-testid="flux-2-result" className={styles.preview}>
          <img src={outputURL || EXAMPLE} alt={outputURL ? 'Generated result' : 'Example FLUX output'} />
          {busy && <div className={styles.loading}><Loader2 className={styles.spin} size={32} /><b>{status}</b></div>}
        </div>
        <div className={styles.footer}><span>{outputURL ? 'Saved to your ManifoldGen gallery when returned by the service.' : 'Text-to-image only — pair with Style Transfer to edit.'}</span>{outputURL && <a href={outputURL} download><Download size={15} /> Download</a>}</div>
      </div>
    </section>
    <section className={styles.exampleSection}>
      <div className={styles.exampleCard}><span>EXAMPLE</span><img src={EXAMPLE} alt="Paper-cut lighthouse example" /></div>
      <div className={styles.exampleCopy}>
        <h2>Start from a real output</h2>
        <p>This paper-cut lighthouse is a genuine FLUX render from the ManifoldGen gallery. Tap a prompt below to load it into the workspace, then make it yours.</p>
        <div className={styles.chips}>{EXAMPLE_PROMPTS.map((chip) => <button key={chip} type="button" className={styles.chip} onClick={() => setPrompt(chip)}><Sparkles size={13} />{chip.length > 72 ? `${chip.slice(0, 70).trimEnd()}…` : chip}</button>)}</div>
      </div>
    </section>
    <section className={styles.notes}><div><WandSparkles size={17} /><span><b>Three tiers, one prompt format</b>Klein favors quick iteration, Dev the everyday default, and Pro the final hero frame — switch without rewording anything.</span></div><div><ImageIcon size={17} /><span><b>Square, landscape, or portrait</b>Sizes map to fixed pixel canvases so every model receives exact width and height.</span></div><div><Check size={17} /><span><b>Honest metering</b>Klein is $0.03, Dev $0.04, and Pro $0.06 per image, multiplied by the batch count and refunded if the backend fails.</span></div></section>
  </main>;
}
