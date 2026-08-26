'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Download, Image as ImageIcon, Loader2, Sparkles, WandSparkles } from 'lucide-react';
import { loadStoredUser, refreshUser, saveUser, type StoredUser } from '@/lib/auth';
import styles from './page.module.css';

const EXAMPLE_IMAGE = 'https://manifoldgenstatic.manifoldgen.com/gallery/originals/2cd11733526df0ed_6e875ea4.webp';

const EXAMPLE_PROMPTS = [
  'cliffside observatory in quiet late-afternoon haze',
  'floating botanical conservatory beneath a star-filled sky',
  'lighthouse on black basalt',
];

const ASPECTS = ['16:9', '9:16', '1:1', '4:3', '3:4'] as const;
type Aspect = (typeof ASPECTS)[number];
type Quality = '1k' | '2k';

function extractVariants(payload: unknown): string[] {
  const found: string[] = [];
  const walk = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
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
    const url = [row.saved_image_url, row.image_url, row.url].find((v): v is string => typeof v === 'string' && Boolean(v.trim()));
    const b64 = [row.b64_json, row.image_base64].find((v): v is string => typeof v === 'string' && Boolean(v.trim()));
    if (url) { found.push(url); return; }
    if (b64) found.push(`data:image/png;base64,${b64}`);
  };
  walk(payload);
  return found;
}

export default function GrokImagineTool() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [prompt, setPrompt] = useState('');
  const [aspect, setAspect] = useState<Aspect>('16:9');
  const [quality, setQuality] = useState<Quality>('1k');
  const [count, setCount] = useState(1);
  const [results, setResults] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [creditPrice, setCreditPrice] = useState(0.01);

  useEffect(() => {
    const stored = loadStoredUser();
    setUser(stored);
    if (stored?.api_key) void refreshUser(stored.api_key).then((fresh) => { if (fresh) { setUser(fresh); saveUser(fresh); } });
  }, []);

  useEffect(() => {
    void fetch('/api/pricing').then((response) => response.json()).then((data) => {
      if (typeof data.credit_price_usd === 'number') setCreditPrice(data.credit_price_usd);
    }).catch(() => undefined);
  }, []);

  const perImage = quality === '2k' ? 0.09 : 0.04;
  const totalUSD = perImage * count;
  const totalCredits = Math.ceil(totalUSD / creditPrice);

  async function generate() {
    const currentUser = user || loadStoredUser();
    if (!currentUser?.api_key) { setError('Sign in to use Grok Imagine.'); return; }
    if (!prompt.trim()) { setError('Describe the image you want.'); return; }
    setError('');
    setBusy(true);
    setStatus('Grok Imagine is rendering…');
    try {
      const response = await fetch('/api/service', {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentUser.api_key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: 'openpaths-image', model: 'grok-imagine', prompt: prompt.trim(), aspect_ratio: aspect, resolution: quality, n: count }),
      });
      const data = await response.json().catch(() => ({})) as { result?: unknown; error?: string };
      if (!response.ok) throw new Error(data.error || 'Image generation failed');
      const variants = extractVariants(data.result ?? data);
      if (!variants.length) throw new Error('Image generation returned no images');
      setResults(variants);
      setStatus('Your images are ready');
      const fresh = await refreshUser(currentUser.api_key);
      if (fresh) { setUser(fresh); saveUser(fresh); }
    } catch (reason) {
      setStatus('');
      setError(reason instanceof Error ? reason.message : 'Image generation failed');
    } finally {
      setBusy(false);
    }
  }

  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/tools" className={styles.back}><ArrowLeft size={16} /> All tools</Link>
      <div className={styles.brand}><Sparkles size={14} /> GROK IMAGINE</div>
      <Link href="/account" className={styles.account}>{user ? `${(user.credits_usd ?? user.credits * (user.credit_price_usd || 0.01)).toFixed(2)} USD` : 'Sign in'}</Link>
    </header>
    <section className={styles.hero}>
      <h1>Type a scene.<br /><span>Grok Imagine renders it.</span></h1>
      <p>A quick, inexpensive image lane powered by xAI. Choose your framing, opt into 2K when the detail matters, and pull up to four takes on the same prompt in one run.</p>
    </section>
    <section className={styles.console}>
      <div className={styles.promptField}>
        <label htmlFor="grok-prompt">Prompt</label>
        <textarea
          id="grok-prompt"
          data-testid="grok-imagine-prompt"
          value={prompt}
          maxLength={4000}
          rows={3}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="a lighthouse on black basalt, storm clouds breaking, long-exposure surf"
        />
        <div className={styles.promptMeta}>
          <small>Describe the subject, setting, light, and medium.</small>
          <span>GROK IMAGINE · {quality === '2k' ? '2K' : '1K'}</span>
        </div>
      </div>
      <div className={styles.bar}>
        <div className={styles.stacked}>
          <div className={styles.stackGroup}><label htmlFor="grok-aspect">Aspect ratio</label><select id="grok-aspect" value={aspect} onChange={(event) => setAspect(event.target.value as Aspect)}>{ASPECTS.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
          <div className={styles.stackGroup}><label htmlFor="grok-quality">Quality</label><select id="grok-quality" value={quality} onChange={(event) => setQuality(event.target.value as Quality)}><option value="1k">Standard · 1K</option><option value="2k">High-res · 2K</option></select></div>
          <div className={styles.stackGroup}><label htmlFor="grok-count">Images</label><select id="grok-count" value={count} onChange={(event) => setCount(Number(event.target.value))}>{[1, 2, 3, 4].map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
        </div>
      </div>
      <button className={styles.run} data-testid="grok-imagine-run" type="button" disabled={busy || !prompt.trim()} onClick={() => void generate()}>
        {busy ? <Loader2 className={styles.spin} size={18} /> : <WandSparkles size={18} />}
        {busy ? status || 'Generating…' : `Generate ${count} image${count === 1 ? '' : 's'}`}
      </button>
      <div className={styles.estimate}>
        <span>Grok Imagine · {quality === '2k' ? 'high-res 2K' : 'standard 1K'} · ${perImage.toFixed(2)} per image</span>
        <b data-testid="grok-imagine-price">~{totalCredits.toLocaleString()} credits · ${totalUSD.toFixed(2)}</b>
      </div>
      {error && <div className={styles.error} role="alert">{error}</div>}
    </section>
    <section className={styles.console}>
      <div className={styles.exampleCard}>
        <img src={EXAMPLE_IMAGE} alt="Example Grok Imagine output: cliffside observatory in late-afternoon haze" loading="lazy" />
        <div className={styles.exampleBody}>
          <b>EXAMPLE</b>
          <span>Real gallery output from this lane. Tap a prompt to load it, then make it yours.</span>
          <div className={styles.chips}>{EXAMPLE_PROMPTS.map((item) => (
            <button key={item} type="button" className={styles.chip} onClick={() => setPrompt(item)}>{item}</button>
          ))}</div>
        </div>
      </div>
    </section>
    <section className={styles.gallery}>
      <div className={styles.galleryHead}><b>RESULT · {results.length}</b>{busy && <span><Loader2 className={styles.spin} size={13} /> {status}</span>}</div>
      {results.length === 0 ? (
        <div className={styles.empty} data-testid="grok-imagine-result"><ImageIcon size={34} /><b>Your generated images</b><span>Pick a framing, hit generate, and the results land here.</span></div>
      ) : (
        <div className={styles.variantGrid} data-testid="grok-imagine-result">{results.map((url, index) => (
          <div key={`${url}::${index}`} className={styles.variant}>
            <img src={url} alt={`Grok Imagine result ${index + 1}`} />
            <a href={url} download aria-label="Download image"><Download size={13} /></a>
            <span className={styles.tick}><Check size={13} /></span>
          </div>
        ))}</div>
      )}
    </section>
    <section className={styles.notes}>
      <div><WandSparkles size={17} /><span><b>Fast and inexpensive</b>Grok Imagine is the budget lane: standard runs cost $0.04 per image, high-res 2K runs $0.09.</span></div>
      <div><ImageIcon size={17} /><span><b>Five framings</b>16:9, 9:16, 1:1, 4:3, and 3:4 cover cinematic, vertical, and print-shaped output.</span></div>
      <div><Check size={17} /><span><b>Batch in one run</b>Up to four images per prompt so you can compare takes without resubmitting.</span></div>
    </section>
  </main>;
}
