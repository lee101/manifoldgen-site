'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Download, Image as ImageIcon, Loader2, Sparkles, WandSparkles } from 'lucide-react';
import { loadStoredUser, refreshUser, saveUser, type StoredUser } from '@/lib/auth';
import styles from './page.module.css';

const EXAMPLE_IMAGE = 'https://manifoldgenstatic.manifoldgen.com/gallery/originals/d9e1b11a3ec6e66f_22e5d455.webp';

const EXAMPLE_PROMPTS = [
  'floating botanical conservatory beneath a star-filled sky, glass panes glowing with warm lanterns, drifting spores catching starlight',
  'cliffside observatory in quiet late-afternoon haze, brass instruments on a stone terrace, long shadows over the sea',
  'lighthouse on black basalt, storm surf exploding against the rocks, single beam cutting through rain',
];

const ASPECTS: { id: 'square' | 'landscape' | 'portrait'; label: string; dims: [number, number] }[] = [
  { id: 'square', label: 'Square · 1024 × 1024', dims: [1024, 1024] },
  { id: 'landscape', label: 'Landscape · 1536 × 1024', dims: [1536, 1024] },
  { id: 'portrait', label: 'Portrait · 1024 × 1536', dims: [1024, 1536] },
];

const MAX_PROMPT = 3200;

function extractImages(payload: unknown): string[] {
  const found: string[] = [];
  const walk = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      (value as unknown[]).forEach(walk);
      return;
    }
    const row = value as Record<string, unknown>;
    const url = [row.saved_image_url, row.image_url, row.url].find((v): v is string => typeof v === 'string' && Boolean(v.trim()));
    if (url) { found.push(url); return; }
    const b64 = [row.b64_json, row.image_base64].find((v): v is string => typeof v === 'string' && Boolean(v.trim()));
    if (b64) { found.push(`data:image/png;base64,${b64}`); return; }
    for (const key of ['data', 'images', 'result', 'output']) {
      if (row[key]) { walk(row[key]); return; }
    }
  };
  walk(payload);
  return found;
}

export default function GptImageTool() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [prompt, setPrompt] = useState('');
  const [aspect, setAspect] = useState<'square' | 'landscape' | 'portrait'>('square');
  const [count, setCount] = useState(1);
  const [seed, setSeed] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [creditPrice, setCreditPrice] = useState(0.01);

  useEffect(() => {
    setUser(loadStoredUser());
    void fetch('/api/pricing').then((response) => response.json()).then((data) => {
      if (typeof data.credit_price_usd === 'number') setCreditPrice(data.credit_price_usd);
    }).catch(() => undefined);
  }, []);

  const price = 0.24 * count;
  const credits = Math.ceil(price / creditPrice);

  async function generate() {
    const currentUser = user || loadStoredUser();
    if (!currentUser?.api_key) { setError('Sign in to use GPT Image 2.'); return; }
    if (!prompt.trim()) { setError('Describe the image you want.'); return; }
    setError('');
    setBusy(true);
    try {
      const dims = ASPECTS.find((item) => item.id === aspect)!.dims;
      const parsedSeed = Number(seed);
      const body: Record<string, unknown> = {
        service: 'openpaths-image',
        model: 'gpt-image-2',
        prompt: prompt.trim(),
        width: dims[0],
        height: dims[1],
        n: count,
      };
      if (seed.trim() && Number.isInteger(parsedSeed)) body.seed = parsedSeed;
      const response = await fetch('/api/service', {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentUser.api_key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Image generation failed');
      const images = extractImages(data);
      if (!images.length) throw new Error('Generation completed without returning an image.');
      setResults(images);
      const fresh = await refreshUser(currentUser.api_key);
      if (fresh) { setUser(fresh); saveUser(fresh); }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Image generation failed');
    } finally {
      setBusy(false);
    }
  }

  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/tools" className={styles.back}><ArrowLeft size={16} /> All tools</Link>
      <div className={styles.brand}><Sparkles size={14} /> GPT IMAGE 2</div>
      <Link href="/account" className={styles.account}>{user ? `${(user.credits_usd ?? user.credits * (user.credit_price_usd || 0.01)).toFixed(2)} USD` : 'Sign in'}</Link>
    </header>

    <section className={styles.hero}>
      <div className={styles.eyebrow}>PREMIUM TEXT TO IMAGE · OPENAI ROUTE · ALWAYS METERED</div>
      <h1>Premium prompts,<br /><span>gallery-grade frames.</span></h1>
      <p>GPT Image 2 renders precise, prompt-faithful images with strong typography and composition. Up to four variants per run, optional seed for reproducibility.</p>
    </section>

    <section className={styles.exampleCard}>
      <div className={styles.examplePreview}><img src={EXAMPLE_IMAGE} alt="Example GPT Image 2 output" loading="lazy" /><span>EXAMPLE</span></div>
      <div className={styles.examplePrompts}>
        <b>Try a real prompt</b>
        {EXAMPLE_PROMPTS.map((example) => (
          <button key={example} type="button" disabled={busy} onClick={() => setPrompt(example)}>{example.length > 92 ? `${example.slice(0, 90).trimEnd()}…` : example}</button>
        ))}
        <small>Real ManifoldGen gallery outputs. Click a prompt to load it.</small>
      </div>
    </section>

    <section className={styles.console}>
      <div className={styles.promptField}>
        <label htmlFor="gpt-image-prompt-input">Prompt</label>
        <textarea
          id="gpt-image-prompt-input"
          data-testid="gpt-image-prompt"
          value={prompt}
          maxLength={MAX_PROMPT}
          rows={6}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="a floating botanical conservatory beneath a star-filled sky…"
        />
        <div className={styles.promptMeta}>
          <small>Name the subject, medium, palette, light, and finish. Up to {MAX_PROMPT.toLocaleString()} characters.</small>
          <span>{prompt.length}/{MAX_PROMPT}</span>
        </div>
      </div>

      <div className={styles.bar}>
        <div className={styles.stackGroup}>
          <label>Aspect</label>
          <select value={aspect} onChange={(event) => setAspect(event.target.value as typeof aspect)}>
            {ASPECTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </div>
        <div className={styles.stackGroup}>
          <label>Variants</label>
          <input type="number" min={1} max={4} value={count} onChange={(event) => setCount(Math.min(4, Math.max(1, Number(event.target.value) || 1)))} />
        </div>
        <div className={styles.stackGroup}>
          <label>Seed · optional</label>
          <input type="number" min={0} value={seed} onChange={(event) => setSeed(event.target.value)} placeholder="reproducible runs" />
        </div>
      </div>

      <button data-testid="gpt-image-run" className={styles.run} type="button" disabled={busy || !prompt.trim()} onClick={() => void generate()}>
        {busy ? <Loader2 className={styles.spin} size={18} /> : <WandSparkles size={18} />}
        {busy ? 'Generating…' : `Generate ${count > 1 ? `${count} images` : 'image'}`}
      </button>
      <div className={styles.estimate}>
        <span>always metered — excluded from unlimited plans</span>
        <b>~{credits.toLocaleString()} credits · ${price.toFixed(2)}</b>
      </div>
      {error && <div className={styles.error} role="alert">{error}</div>}
    </section>

    <section className={styles.gallery}>
      <div className={styles.galleryHead}><b>RESULT</b>{results.length > 0 && <span><Check size={13} /> READY</span>}</div>
      <div data-testid="gpt-image-result" className={styles.variantGrid}>
        {results.length === 0 ? (
          <div className={styles.empty}><ImageIcon size={34} /><b>Your result will appear here</b><span>GPT Image 2 returns crisp, prompt-faithful frames saved to your gallery when the service reports them.</span></div>
        ) : results.map((url, index) => (
          <div key={`${url}::${index}`} className={styles.variant}>
            <img src={url} alt={`Generated image ${index + 1}`} />
            <a href={url} download aria-label="Download image"><Download size={13} /></a>
            <span className={styles.tick}><Check size={13} /></span>
          </div>
        ))}
      </div>
    </section>

    <section className={styles.notes}>
      <div><Sparkles size={17} /><span><b>Precision rendering</b>GPT Image 2 follows detailed prompts closely, including text and layout instructions inside the frame.</span></div>
      <div><WandSparkles size={17} /><span><b>Up to four variants</b>Set variants per run to compare directions from one prompt before committing.</span></div>
      <div><Check size={17} /><span><b>Always metered</b>Every run bills $0.24 per image and is excluded from unlimited plans, matching server metering.</span></div>
    </section>
  </main>;
}
