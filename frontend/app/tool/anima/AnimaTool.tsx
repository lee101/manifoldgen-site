'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Download, LoaderCircle, ShieldCheck, Sparkles, WandSparkles } from 'lucide-react';
import { loadStoredUser, refreshUser, saveUser, type StoredUser } from '../../../lib/auth';
import styles from './page.module.css';

const EXAMPLE_URL = '/examples/anima/celestial-cartographer.png';
const EXAMPLE_PROMPT = 'Masterpiece anime character concept art, a young adult celestial cartographer, short midnight-blue hair, amber eyes, tailored ivory expedition coat with cobalt trim, holding a brass astrolabe, elegant full-body composition, intricate fabric and metal details, cinematic rim light, clean background, no text, no watermark';

type Canvas = 'portrait' | 'square' | 'landscape';
type Phase = 'idle' | 'queued' | 'processing' | 'done' | 'error';
type AnimaStatus = { available: boolean; reason?: string; model?: string; price_usd?: number };
type JobPayload = { job?: { status?: string; error?: string; result?: { image_url?: string; charged_usd?: number; is_nsfw?: boolean } } };

const CANVASES: Record<Canvas, [number, number, string]> = {
  portrait: [768, 1024, '3:4'], square: [1024, 1024, '1:1'], landscape: [1024, 768, '4:3'],
};

async function jsonResponse<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || fallback);
  return payload as T;
}

export default function AnimaTool() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [availability, setAvailability] = useState<AnimaStatus>({ available: false, reason: 'checking' });
  const [prompt, setPrompt] = useState(EXAMPLE_PROMPT);
  const [negativePrompt, setNegativePrompt] = useState('text, watermark, logo, blurry face, malformed hands, extra fingers');
  const [canvas, setCanvas] = useState<Canvas>('portrait');
  const [steps, setSteps] = useState<28 | 40>(28);
  const [seed, setSeed] = useState('18467291');
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState('Ready to create character art');
  const [outputURL, setOutputURL] = useState('');
  const [charged, setCharged] = useState<number | null>(null);
  const [privateResult, setPrivateResult] = useState(false);

  useEffect(() => {
    const stored = loadStoredUser();
    setUser(stored);
    if (stored?.api_key) void refreshUser(stored.api_key).then((fresh) => { if (fresh) { setUser(fresh); saveUser(fresh); } });
    void fetch('/api/anima/status').then((response) => jsonResponse<AnimaStatus>(response, 'Anima status unavailable')).then(setAvailability).catch(() => setAvailability({ available: false, reason: 'status_unavailable' }));
  }, []);

  const launchCopy = useMemo(() => {
    if (availability.reason === 'checking') return 'Checking Anima capacity…';
    if (availability.available) return user ? 'Generate Anima character' : 'Sign in to generate';
    return 'Capacity is being prepared';
  }, [availability, user]);

  async function generate() {
    if (!availability.available) { setPhase('error'); setMessage('Anima native capacity is temporarily unavailable'); return; }
    if (!user?.api_key) { setPhase('error'); setMessage('Sign in before generating'); return; }
    if (!prompt.trim()) { setPhase('error'); setMessage('Describe the character or illustration'); return; }
    const parsedSeed = Number(seed);
    if (!Number.isInteger(parsedSeed) || parsedSeed < 0 || parsedSeed > 2147483647) { setPhase('error'); setMessage('Seed must be an integer from 0 to 2147483647'); return; }
    const [width, height] = CANVASES[canvas];
    setOutputURL(''); setCharged(null); setPrivateResult(false); setPhase('queued'); setMessage('Starting OmniServe native image capacity…');
    try {
      const queued = await jsonResponse<{ result?: { job_id?: string; status_url?: string }; estimated_cost_usd?: number }>(
        await fetch('/api/service', {
          method: 'POST', headers: { Authorization: `Bearer ${user.api_key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ service: 'anima', prompt: prompt.trim(), negative_prompt: negativePrompt.trim(), width, height, num_steps: steps, guidance: 4, seed: parsedSeed }),
        }),
        'Could not start Anima generation',
      );
      const jobID = queued.result?.job_id;
      if (!jobID) throw new Error('The Anima service returned no job');
      const statusURL = queued.result?.status_url || `/api/video-jobs/${encodeURIComponent(jobID)}`;
      for (let attempt = 0; attempt < 1000; attempt += 1) {
        const payload = await jsonResponse<JobPayload>(await fetch(statusURL, { headers: { Authorization: `Bearer ${user.api_key}` } }), 'Could not read Anima status');
        const status = payload.job?.status || '';
        if (status === 'completed') {
          const imageURL = payload.job?.result?.image_url;
          if (!imageURL) throw new Error('Anima completed without an image');
          setOutputURL(imageURL); setCharged(payload.job?.result?.charged_usd ?? queued.estimated_cost_usd ?? .04);
          setPrivateResult(Boolean(payload.job?.result?.is_nsfw)); setPhase('done'); setMessage('Your Anima illustration is ready');
          void refreshUser(user.api_key).then((fresh) => { if (fresh) { setUser(fresh); saveUser(fresh); } });
          return;
        }
        if (status === 'failed' || status === 'payment_required') throw new Error(payload.job?.error || (status === 'payment_required' ? 'Top up to release this image' : 'Anima generation failed'));
        setPhase(status === 'processing' ? 'processing' : 'queued');
        setMessage(status === 'processing' ? 'Painting the final Anima frame…' : 'Waiting for OmniServe native capacity…');
        await new Promise((resolve) => window.setTimeout(resolve, 2500));
      }
      throw new Error('The job remains available in your account');
    } catch (reason) {
      setPhase('error'); setMessage(reason instanceof Error ? reason.message : 'Anima generation failed');
    }
  }

  const busy = phase === 'queued' || phase === 'processing';
  const displayedURL = outputURL || EXAMPLE_URL;
  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/tools" className={styles.back}><ArrowLeft size={17} /> All tools</Link>
      <div className={styles.brand}><i /> ANIMA ART STUDIO</div>
      <Link href="/account" className={styles.account}>{user ? `${(user.credits_usd ?? user.credits * (user.credit_price_usd || .01)).toFixed(2)} USD` : 'Sign in'}</Link>
    </header>

    <section className={styles.hero}>
      <div className={styles.heroCopy}>
        <div className={styles.eyebrow}><Sparkles size={14} /> ANIMA 2.9B · CHARACTER ILLUSTRATION</div>
        <h1>Design a character.<br /><span>Give them a world.</span></h1>
        <p>An art-first generator for expressive anime characters, costume design, key art, and polished illustration. Seeded controls make a look repeatable.</p>
        <div className={styles.chips}><span>Anime-native</span><span>Up to 1 MP</span><span>28-step default</span><span>$0.04 / image</span></div>
      </div>
      <figure className={styles.heroExample}>
        <img src={EXAMPLE_URL} alt="Anima-generated celestial cartographer anime character" />
        <figcaption><span><Check size={13} /> REAL ANIMA OUTPUT</span><b>Celestial Cartographer</b><small>Seed 18467291 · 768 × 1024 · 28 steps</small></figcaption>
      </figure>
    </section>

    <section className={styles.workspace}>
      <div className={styles.controls}>
        <label className={styles.prompt}>Character or scene prompt
          <textarea value={prompt} disabled={busy} maxLength={2400} onChange={(event) => setPrompt(event.target.value)} />
          <small>Include silhouette, clothing, expression, palette, setting, light, and finish.</small>
        </label>
        <label className={styles.prompt}>Avoid
          <textarea className={styles.negative} value={negativePrompt} disabled={busy} maxLength={1200} onChange={(event) => setNegativePrompt(event.target.value)} />
        </label>
        <div className={styles.options}>
          <label>Canvas<select value={canvas} disabled={busy} onChange={(event) => setCanvas(event.target.value as Canvas)}>{Object.entries(CANVASES).map(([key, value]) => <option key={key} value={key}>{key} · {value[2]}</option>)}</select></label>
          <label>Finish<select value={steps} disabled={busy} onChange={(event) => setSteps(Number(event.target.value) as 28 | 40)}><option value={28}>Studio · 28 steps</option><option value={40}>Detailed · 40 steps</option></select></label>
          <label>Seed<input value={seed} disabled={busy} inputMode="numeric" onChange={(event) => setSeed(event.target.value.replace(/\D/g, '').slice(0, 10))} /></label>
        </div>
        <button data-testid="anima-run" className={styles.run} type="button" disabled={busy || !availability.available || !prompt.trim()} onClick={() => void generate()}>
          {busy ? <LoaderCircle className={styles.spin} size={19} /> : <WandSparkles size={18} />}{busy ? message : launchCopy}
        </button>
        <div className={styles.price}><span>Fixed $0.04 per successful image</span><span>Output classified before gallery indexing</span></div>
        {!availability.available && availability.reason !== 'checking' && <div className={styles.license}><span><b>Native capacity unavailable.</b> OmniServe’s licensed image lane is not currently ready to accept jobs.</span></div>}
        {phase === 'error' && <div className={styles.error}>{message}</div>}
      </div>

      <div className={styles.outputPanel}>
        <div className={styles.outputHeader}><span>{outputURL ? 'YOUR OUTPUT' : 'REAL MODEL EXAMPLE'}</span>{phase === 'done' && <span className={styles.ready}><Check size={13} /> READY</span>}</div>
        <div className={styles.output}>
          <img src={displayedURL} alt={outputURL ? 'Your generated Anima illustration' : 'Anima example output'} />
          {busy && <div className={styles.busy}><LoaderCircle className={styles.spin} size={30} /><b>{message}</b></div>}
        </div>
        <div className={styles.resultFooter}><div><b>{privateResult ? 'Private adult result' : outputURL ? 'Saved to your gallery' : 'Generated with Anima-2.9B'}</b><span>{charged === null ? 'Example seed 18467291' : `$${charged.toFixed(4)} charged`}</span></div>{outputURL && <a href={outputURL} download><Download size={16} /> Download</a>}</div>
      </div>
    </section>

    <section className={styles.api}>
      <div><span>API</span><h2>The same art pipeline,<br />from one durable request.</h2><p>Jobs survive browser refreshes, scale cached GPU capacity from zero, and publish only after classification.</p></div>
      <pre><code>{`POST /api/service
Authorization: Bearer $MANIFOLDGEN_API_KEY

{
  "service": "anima",
  "prompt": "celestial cartographer...",
  "width": 768,
  "height": 1024,
  "num_steps": 28,
  "guidance": 4,
  "seed": 18467291
}`}</code></pre>
    </section>
    <section className={styles.notes}><div><ShieldCheck size={18} /><span><b>Classifier-routed</b>Every generated image passes the production NSFW classifier. Adult results remain private and out of public search.</span></div><div><Sparkles size={18} /><span><b>Native GPU lane</b>Requests run through the licensed OmniServe native image gateway with durable job status.</span></div><div><Sparkles size={18} /><span><b>Gallery-safe</b>Only classified, successfully stored outputs are settled and indexed.</span></div></section>
  </main>;
}
