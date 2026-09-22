'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Download, Image as ImageIcon, Loader2, Plus, Sparkles, WandSparkles } from 'lucide-react';
import { loadStoredUser, refreshUser, saveUser, type StoredUser } from '@/lib/auth';
import styles from './page.module.css';

type Engine = 'omniserve' | 'images3' | 'r1';

interface Variant {
  url: string;
}

interface PromptBatch {
  prompt: string;
  variants: Variant[];
}

const ENGINES: { id: Engine; name: string; detail: string }[] = [
  { id: 'omniserve', name: 'RA2', detail: 'RA2 · OmniServe Native' },
  { id: 'images3', name: 'RA1', detail: 'RA1 · images3.netwrck.com' },
  { id: 'r1', name: 'R1', detail: 'R1 · ra.netwrck.com' },
];

const ASPECTS: { id: 'portrait' | 'square' | 'landscape'; label: string; dims: [number, number] }[] = [
  { id: 'square', label: 'Square · 1024 × 1024', dims: [1024, 1024] },
  { id: 'landscape', label: 'Landscape · 1536 × 1024', dims: [1536, 1024] },
  { id: 'portrait', label: 'Portrait · 1024 × 1536', dims: [1024, 1536] },
];

type EngineName = (typeof ENGINES)[number]['name'];

/** Extract any image URL or base64 payload from the normalized zimage response. */
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
    const url = [row.image_url, row.url, row.path, row.saved_image_url].find((v): v is string => typeof v === 'string' && Boolean(v.trim()));
    const b64 = [row.image_base64, row.b64_json].find((v): v is string => typeof v === 'string' && Boolean(v.trim()));
    if (url) { found.push(url); return; }
    if (b64) found.push(`data:image/png;base64,${b64}`);
  };
  walk(payload);
  return found;
}

function linesFor(text: string): string[] {
  return text.split('\n').map((line) => line.trim()).filter(Boolean);
}

function friendlyPrompt(prompt: string): string {
  return prompt.length > 88 ? `${prompt.slice(0, 86).trimEnd()}…` : prompt;
}

async function generateBatch(
  apiKey: string,
  prompt: string,
  engine: Engine,
  aspect: (typeof ASPECTS)[number],
  count: number,
): Promise<Variant[]> {
  const response = await fetch('/api/service', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service: 'zimage',
      prompt,
      width: aspect.dims[0],
      height: aspect.dims[1],
      n: count,
      num_images: count,
      image_backend: engine,
    }),
  });
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error((data.error as string) || 'Image generation failed');
  const variants = extractVariants(data).map((url) => ({ url }));
  if (!variants.length) throw new Error('Image generation returned no images');
  return variants;
}

function renderEngineName(engine: Engine): string {
  const found = ENGINES.find((item) => item.id === engine);
  return found ? `${found.name} (${found.detail})` : engine;
}

export default function BulkImageTool() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [prompt, setPrompt] = useState('');
  const [engine, setEngine] = useState<Engine>('omniserve');
  const [aspect, setAspect] = useState<'square' | 'landscape' | 'portrait'>('square');
  const [count, setCount] = useState(4);
  const [batches, setBatches] = useState<PromptBatch[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
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

  const prompts = linesFor(prompt);
  const total = prompts.length * count;
  const aspectValue = ASPECTS.find((a) => a.id === aspect)!;

  async function generate() {
    const currentUser = user || loadStoredUser();
    if (!currentUser?.api_key) { setError('Sign in to generate images.'); return; }
    if (!prompts.length) { setError('Paste at least one prompt.'); return; }
    setError('');
    setBusy(true);
    try {
      let done = 0;
      for (const line of prompts) {
        setProgress(`Generating ${line.slice(0, 40)}…`);
        const variants = await generateBatch(currentUser.api_key, line, engine, aspectValue, count);
        setBatches((prev) => [...prev, { prompt: line, variants }]);
        done += 1;
        setProgress(done === prompts.length ? '' : `${done}/${prompts.length}`);
      }
      const fresh = await refreshUser(currentUser.api_key);
      if (fresh) { setUser(fresh); saveUser(fresh); }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Image generation failed');
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  async function makeMore(batch: PromptBatch) {
    const currentUser = user || loadStoredUser();
    if (!currentUser?.api_key) { setError('Sign in to generate images.'); return; }
    setError('');
    setBusy(true);
    try {
      setProgress(`More variants for ${batch.prompt.slice(0, 40)}…`);
      const variants = await generateBatch(currentUser.api_key, batch.prompt, engine, aspectValue, count);
      setBatches((prev) => prev.map((item) => item === batch ? { ...item, variants: [...item.variants, ...variants] } : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Image generation failed');
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  const variantTotal = batches.reduce((sum, batch) => sum + batch.variants.length, 0);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/tools" className={styles.back}><ArrowLeft size={16} /> All tools</Link>
        <div className={styles.brand}><Sparkles size={14} /> MAKE IMAGE</div>
        <Link href="/account" className={styles.account}>{user ? `${(user.credits_usd ?? user.credits * (user.credit_price_usd || 0.01)).toFixed(2)} USD` : 'Sign in'}</Link>
      </header>

      <section className={styles.hero}>
        <h1>Drop a prompt.<br /><span>Get a full test of ideas.</span></h1>
        <p>One prompt per line becomes its own variant batch across the RA2, RA1, and R1 lanes. Compare directions, and refill any batch that looks worth chasing.</p>
      </section>

      <section className={styles.console}>
        <div className={styles.promptField}>
          <label htmlFor="bulk-prompt">Prompts — one per line</label>
          <textarea
            id="bulk-prompt"
            value={prompt}
            maxLength={12000}
            rows={3}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="a glass hummingbird in a greenhouse&#10;a neon city street at dusk, rain-slicked&#10;acrylic-painted cartoon fox in a spacesuit"
          />
          <div className={styles.promptMeta}>
            <small>Paste several lines to explore many directions at once.</small>
            <span>{prompts.length} prompt{prompts.length === 1 ? '' : 's'} · {total} image{total === 1 ? '' : 's'}</span>
          </div>
        </div>

        <div className={styles.bar}>
          <div className={styles.stacked}>
            <div className={styles.stackGroup}><label>Engine</label><div className={styles.engineButtons}>{ENGINES.map((item) => (
              <button key={item.id} type="button" className={engine === item.id ? styles.engineActive : ''} onClick={() => setEngine(item.id)}><b>{item.name}</b><span><small>{item.detail}</small></span></button>
            ))}</div></div>
          </div>
          <div className={styles.stacked}>
            <div className={styles.stackGroup}><label>Aspect</label><select value={aspect} onChange={(event) => setAspect(event.target.value as typeof aspect)}>{ASPECTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
            <div className={styles.stackGroup}><label>Variants per prompt</label><input type="number" min={1} max={12} value={count} onChange={(event) => setCount(Math.min(12, Math.max(1, Number(event.target.value) || 1)))} /></div>
          </div>
        </div>

        <button className={styles.run} type="button" disabled={Boolean(busy) || !prompts.length} onClick={() => void generate()}>
          {busy ? <Loader2 className={styles.spin} size={18} /> : <WandSparkles size={18} />}
          {busy ? progress || 'Generating…' : `Generate ${total} image${total === 1 ? '' : 's'}`}
        </button>
        <div className={styles.estimate}>
          <span>RA2 lane · {renderEngineName(engine)}</span>
          <b>~{Math.ceil(total * 0.04 / creditPrice).toLocaleString()} credits · ${(total * 0.04).toFixed(2)}</b>
        </div>
        {error && <div className={styles.error} role="alert">{error}</div>}
      </section>

      <section className={styles.gallery}>
        <div className={styles.galleryHead}>
          <b>VARIANTS · {variantTotal}</b>
          {busy && <span><Loader2 className={styles.spin} size={13} /> {progress}</span>}
        </div>
        {batches.length === 0 ? (
          <div className={styles.empty}><ImageIcon size={34} /><b>Your exploration grid</b><span>Variants will land here by prompt. Refill or download any of them.</span></div>
        ) : batches.map((batch) => (
          <div key={batch.prompt} className={styles.promptCard}>
            <div className={styles.promptTitle}><span>{friendlyPrompt(batch.prompt)}</span><small>{batch.variants.length} variant{batch.variants.length === 1 ? '' : 's'}</small></div>
            <div className={styles.variantGrid}>{batch.variants.map((variant, index) => (
              <div key={`${batch.prompt}::${index}`} className={styles.variant}>
                <img src={variant.url} alt={`${batch.prompt} variant ${index + 1}`} loading="lazy" />
                <a href={variant.url} download aria-label="Download image"><Download size={13} /></a>
                <span className={styles.tick}><Check size={13} /></span>
              </div>
            ))}</div>
            <button className={styles.promptMore} type="button" disabled={Boolean(busy)} onClick={() => void makeMore(batch)}><Plus size={14} /> Make more variants</button>
          </div>
        ))}
      </section>

      <section className={styles.notes}>
        <div><Sparkles size={17} /><span><b>Bulk explore each prompt</b>Several prompts, several variants each, all compared on one grid.</span></div>
        <div><WandSparkles size={17} /><span><b>Three image lanes</b>RA2 on OmniServe Native, RA1 on images3.netwrck.com, and R1 on ra.netwrck.com.</span></div>
        <div><Check size={17} /><span><b>Keep refilling</b>“Make more variants” tops up any prompt with the same visual direction.</span></div>
      </section>
    </main>
  );
}