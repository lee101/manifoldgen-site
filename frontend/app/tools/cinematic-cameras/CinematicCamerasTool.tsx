'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Download, Image as ImageIcon, Loader2, Sparkles, WandSparkles } from 'lucide-react';
import { loadStoredUser, refreshUser, saveUser, type StoredUser } from '@/lib/auth';
import styles from './page.module.css';

type Engine = 'zimage' | 'gpt-image-2';

interface APIResponse { result?: unknown; error?: string; credits_used?: number; credits_remain?: number; usd_equivalent?: number }

const EXAMPLE = 'https://manifoldgenstatic.manifoldgen.com/gallery/originals/d9e1b11a3ec6e66f_22e5d455.webp';

const ENGINES: { id: Engine; name: string; rate: number }[] = [
  { id: 'zimage', name: 'RA2 (fast)', rate: 0.04 },
  { id: 'gpt-image-2', name: 'GPT Image 2', rate: 0.24 },
];

const ASPECTS: { id: 'square' | 'landscape' | 'portrait'; label: string; width: number; height: number }[] = [
  { id: 'square', label: 'Square · 1024×1024', width: 1024, height: 1024 },
  { id: 'landscape', label: 'Landscape · 1536×1024', width: 1536, height: 1024 },
  { id: 'portrait', label: 'Portrait · 1024×1536', width: 1024, height: 1536 },
];

const PRESETS = [
  'low-angle hero shot',
  'dolly-in close-up',
  'wide establishing crane shot',
  'Dutch tilt',
  'macro detail',
  'over-the-shoulder',
  'top-down drone view',
  'anamorphic 35mm lens flare',
  'shallow depth of field portrait',
  'symmetrical Wes Anderson framing',
];

const EXAMPLE_PROMPTS = [
  'floating botanical conservatory beneath a star-filled sky, low-angle hero shot',
  'floating botanical conservatory at dusk, anamorphic 35mm lens flare, wide establishing crane shot',
  'botanist inside a glass conservatory, shallow depth of field portrait, dolly-in close-up',
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

function extractVariants(payload: unknown): string[] {
  if (Array.isArray(payload)) {
    return payload.map((item) => responseImage(item)).filter(Boolean);
  }
  if (payload && typeof payload === 'object') {
    for (const key of ['images', 'data', 'output', 'result']) {
      const value = (payload as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        const found = value.map((item) => responseImage(item)).filter(Boolean);
        if (found.length) return found;
      }
    }
  }
  const single = responseImage(payload);
  return single ? [single] : [];
}

export default function CinematicCamerasTool() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [prompt, setPrompt] = useState('');
  const [engine, setEngine] = useState<Engine>('zimage');
  const [aspect, setAspect] = useState<'square' | 'landscape' | 'portrait'>('square');
  const [count, setCount] = useState(1);
  const [presets, setPresets] = useState<string[]>([]);
  const [results, setResults] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
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

  const rate = ENGINES.find((item) => item.id === engine)!.rate;
  const aspectValue = ASPECTS.find((item) => item.id === aspect)!;
  const fullPrompt = presets.length ? [prompt.trim(), ...presets].filter(Boolean).join(', ') : prompt;
  const usd = rate * count;

  function togglePreset(name: string) {
    setPresets((prev) => {
      if (prev.includes(name)) return prev.filter((item) => item !== name);
      if (prev.length >= 3) return prev;
      return [...prev, name];
    });
  }

  async function run() {
    const currentUser = user || loadStoredUser();
    if (!currentUser?.api_key) { setError('Sign in to use Cinematic Cameras.'); return; }
    if (!prompt.trim()) { setError('Describe the shot first.'); return; }
    setError('');
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        service: engine === 'zimage' ? 'zimage' : 'openpaths-image',
        prompt: fullPrompt,
        width: aspectValue.width,
        height: aspectValue.height,
        n: count,
      };
      if (engine === 'gpt-image-2') body.model = 'gpt-image-2';
      const response = await fetch('/api/service', {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentUser.api_key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({})) as APIResponse;
      if (!response.ok) throw new Error(data.error || 'Generation failed');
      const variants = extractVariants(data.result);
      if (!variants.length) throw new Error('No image returned');
      setResults(variants);
      const fresh = await refreshUser(currentUser.api_key);
      if (fresh) { setUser(fresh); saveUser(fresh); }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Generation failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/tools" className={styles.back}><ArrowLeft size={16} /> All tools</Link>
        <div className={styles.brand}><Sparkles size={14} /> CINEMATIC CAMERAS</div>
        <Link href="/account" className={styles.account}>{user ? `${(user.credits_usd ?? user.credits * (user.credit_price_usd || 0.01)).toFixed(2)} USD` : 'Sign in'}</Link>
      </header>

      <section className={styles.hero}>
        <h1>Direct the camera.<br /><span>The model frames the shot.</span></h1>
        <p>Pick camera moves and lens language as chips, stack up to three per shot, and render through RA2 or GPT Image 2.</p>
      </section>

      <section className={styles.workspace}>
        <div className={styles.controls}>
          <div className={styles.field}>
            <label htmlFor="cinematic-cameras-prompt">Shot description</label>
            <textarea
              id="cinematic-cameras-prompt"
              data-testid="cinematic-cameras-prompt"
              value={prompt}
              maxLength={4000}
              rows={3}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="a lighthouse on black basalt in storm light"
            />
          </div>

          <div className={styles.field}>
            <label>Camera presets — pick up to 3</label>
            <div className={styles.chips}>
              {PRESETS.map((name) => {
                const active = presets.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    className={active ? `${styles.chip} ${styles.chipActive}` : styles.chip}
                    aria-pressed={active}
                    disabled={!active && presets.length >= 3}
                    onClick={() => togglePreset(name)}
                  >{name}</button>
                );
              })}
            </div>
          </div>

          <div className={styles.options}>
            <div className={styles.field}>
              <label htmlFor="cinematic-cameras-engine">Engine</label>
              <select id="cinematic-cameras-engine" value={engine} onChange={(event) => setEngine(event.target.value as Engine)}>
                {ENGINES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="cinematic-cameras-aspect">Aspect</label>
              <select id="cinematic-cameras-aspect" value={aspect} onChange={(event) => setAspect(event.target.value as typeof aspect)}>
                {ASPECTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="cinematic-cameras-count">Images</label>
              <select id="cinematic-cameras-count" value={count} onChange={(event) => setCount(Number(event.target.value) || 1)}>
                {[1, 2, 3, 4].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>
          </div>

          <button className={styles.run} type="button" data-testid="cinematic-cameras-run" disabled={busy} onClick={() => void run()}>
            {busy ? <Loader2 className={styles.spin} size={18} /> : <WandSparkles size={18} />}
            {busy ? 'Filming…' : `Render ${count} frame${count === 1 ? '' : 's'}`}
          </button>
          <div className={styles.price}>
            <span>{ENGINES.find((item) => item.id === engine)!.name}</span>
            <b>≈{Math.ceil(usd / creditPrice).toLocaleString()} credits · ${usd.toFixed(2)}</b>
          </div>
          {error && <div className={styles.error} role="alert">{error}</div>}
        </div>

        <div className={styles.previewPanel}>
          <div className={styles.previewHeader}><b>RESULT</b><span>{aspectValue.width}×{aspectValue.height} · n={count}</span></div>
          {results.length === 0 ? (
            <div className={styles.empty} data-testid="cinematic-cameras-result">
              <ImageIcon size={34} />
              <b>No frames yet</b>
              <span>Describe the scene, tap camera chips, and render.</span>
            </div>
          ) : (
            <div className={styles.frames} data-testid="cinematic-cameras-result">
              {results.map((url, index) => (
                <div key={`${url}::${index}`} className={styles.preview}>
                  <img src={url} alt={`cinematic frame ${index + 1}`} />
                  <a href={url} download aria-label="Download frame"><Download size={13} /></a>
                  <span className={styles.ready}><Check size={13} /> READY</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className={styles.example}>
        <div className={styles.exampleMedia}>
          <div className={styles.previewHeader}><b>EXAMPLE</b><span>conservatory, star-filled sky</span></div>
          <img src={EXAMPLE} alt="Example cinematic output of a floating botanical conservatory" loading="lazy" />
        </div>
        <div className={styles.prompts}>
          Try a directed prompt
          {EXAMPLE_PROMPTS.map((example) => (
            <button key={example} type="button" onClick={() => setPrompt(example)}>{example}</button>
          ))}
        </div>
      </section>

      <section className={styles.notes}>
        <div><WandSparkles size={17} /><span><b>Camera language as chips</b>Stack up to three presets — angle, move, lens — appended to your prompt verbatim.</span></div>
        <div><Sparkles size={17} /><span><b>Two engines</b>RA2 is fast at $0.04 a frame; GPT Image 2 renders richer detail at $0.24.</span></div>
        <div><Check size={17} /><span><b>Framing control</b>Square, landscape, and portrait map to fixed resolutions each engine supports natively.</span></div>
      </section>
    </main>
  );
}
