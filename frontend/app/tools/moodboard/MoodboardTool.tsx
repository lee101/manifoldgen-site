'use client';

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Download, Image as ImageIcon, Layers, Loader2, Plus, Sparkles, Upload, WandSparkles, X } from 'lucide-react';
import { loadStoredUser, refreshUser, saveUser, type StoredUser } from '@/lib/auth';
import styles from './page.module.css';

type APIResponse = { result?: unknown; error?: string; credits_remain?: number; usd_equivalent?: number };
type Model = 'nano-banana-2' | 'gpt-image-2';
type RefItem = { file: File | null; url: string };

const MAX_REFS = 6;
const EXAMPLES = [
  'https://manifoldgenstatic.manifoldgen.com/gallery/originals/2cd11733526df0ed_6e875ea4.webp',
  'https://manifoldgenstatic.manifoldgen.com/gallery/originals/d9e1b11a3ec6e66f_22e5d455.webp',
  'https://manifoldgenstatic.manifoldgen.com/gallery/originals/e681e42f9ad635c1_45a810ec.webp',
];
const EXAMPLE_PROMPTS = [
  'Fuse these references into one cohesive moodboard design: shared palette, unified lighting, and a single hero composition that carries the atmosphere of every source.',
  'Fuse these references into a single art-directed poster. Borrow the materials and color temperature of each image and settle them into one balanced layout.',
  'Fuse these references into one concept sheet: same world, same light, one continuous visual language across a triptych of panels.',
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

async function jsonResponse(response: Response, fallback: string): Promise<APIResponse> {
  const data = await response.json().catch(() => ({})) as APIResponse;
  if (!response.ok) throw new Error(data.error || fallback);
  return data;
}

async function uploadToR2(file: File, apiKey: string): Promise<string> {
  const params = new URLSearchParams({ filename: file.name, content_type: file.type || 'image/webp', dataset: 'moodboard' });
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

export default function MoodboardTool() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [refs, setRefs] = useState<RefItem[]>([]);
  const [prompt, setPrompt] = useState('Fuse these references into one cohesive design: unify the palette, lighting, and materials into a single hero composition.');
  const [model, setModel] = useState<Model>('nano-banana-2');
  const [outputURL, setOutputURL] = useState('');
  const [busy, setBusy] = useState<'upload' | 'fuse' | ''>('');
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

  function addFiles(list: FileList | null) {
    const incoming = Array.from(list || []).filter((file) => file.type.startsWith('image/'));
    if (!incoming.length) return;
    setError('');
    setRefs((prev) => {
      const room = MAX_REFS - prev.length;
      if (room <= 0) { setError(`A moodboard takes at most ${MAX_REFS} reference images.`); return prev; }
      const added = incoming.slice(0, room).map((file) => ({ file, url: URL.createObjectURL(file) }));
      if (incoming.length > room) setError(`Only the first ${room} image${room === 1 ? '' : 's'} fit — the moodboard caps at ${MAX_REFS}.`);
      return [...prev, ...added];
    });
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    addFiles(event.dataTransfer.files);
  }

  function removeRef(index: number) {
    setRefs((prev) => {
      const item = prev[index];
      if (item && !item.url.startsWith('http')) URL.revokeObjectURL(item.url);
      return prev.filter((_, i) => i !== index);
    });
    setOutputURL('');
  }

  async function fuse() {
    const currentUser = user || loadStoredUser();
    if (!currentUser?.api_key) { setError('Sign in to use Soul Moodboard.'); return; }
    if (refs.length < 2) { setError('Add at least 2 reference images to fuse.'); return; }
    if (!prompt.trim()) { setError('Describe how the references should fuse.'); return; }
    setError('');
    try {
      setBusy('upload');
      setStatus('Uploading references to secure storage…');
      const urls: string[] = [];
      for (const item of refs) {
        urls.push(item.file ? await uploadToR2(item.file, currentUser.api_key) : item.url);
      }
      setRefs((prev) => prev.map((item, i) => ({ file: null, url: urls[i] })));
      setBusy('fuse');
      setStatus('OpenPaths is fusing your references…');
      const response = await fetch('/api/service', {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentUser.api_key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: 'openpaths-image', model, prompt: prompt.trim(), image_url: urls[0], reference_image_urls: urls, n: 1 }),
      });
      const data = await jsonResponse(response, 'Moodboard fusion failed');
      const result = responseImage(data.result);
      if (!result) throw new Error('The fusion completed without returning an image.');
      setOutputURL(result);
      setStatus('Your fused moodboard is ready');
      const fresh = await refreshUser(currentUser.api_key);
      if (fresh) { setUser(fresh); saveUser(fresh); }
    } catch (reason) {
      setStatus('');
      setError(reason instanceof Error ? reason.message : 'Moodboard fusion failed');
    } finally {
      setBusy('');
    }
  }

  const price = model === 'gpt-image-2' ? 0.24 : 0.16;
  const credits = Math.ceil(price / creditPrice);
  const ready = refs.length >= 2 && Boolean(prompt.trim()) && !busy;

  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/tools" className={styles.back}><ArrowLeft size={16} /> All tools</Link>
      <div className={styles.brand}><Layers size={14} /> SOUL MOODBOARD</div>
      <Link href="/account" className={styles.account}>{user ? `${(user.credits_usd ?? user.credits * (user.credit_price_usd || .01)).toFixed(2)} USD` : 'Sign in'}</Link>
    </header>
    <section className={styles.hero}>
      <h1>Many references.<br /><span>One fused design.</span></h1>
      <p>Collect two to six images that share a mood, then let a reference-aware model fuse them into a single cohesive composition with one unified visual language.</p>
    </section>
    <section className={styles.workspace}>
      <div className={styles.controls}>
        <div className={styles.drop} onDragOver={(event) => event.preventDefault()} onDrop={drop} onClick={() => refs.length < MAX_REFS && fileInput.current?.click()}>
          <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(event: ChangeEvent<HTMLInputElement>) => { addFiles(event.target.files); event.target.value = ''; }} />
          {refs.length
            ? <><Upload size={22} /><b>{refs.length} of {MAX_REFS} references · drop more here</b><span>The first image leads the composition.</span></>
            : <><Upload size={26} /><b>Drop 2–6 reference images</b><span>PNG, JPG, WEBP · up to 20 MB each</span></>}
        </div>
        {refs.length > 0 && <div className={styles.thumbs}>
          {refs.map((item, index) => <div key={`${item.url}-${index}`} className={styles.thumb}>
            <img src={item.url} alt={`Reference ${index + 1}`} />
            <button type="button" aria-label={`Remove reference ${index + 1}`} onClick={(event) => { event.stopPropagation(); removeRef(index); }}><X size={12} /></button>
            {index === 0 && <span className={styles.lead}>LEAD</span>}
          </div>)}
          {refs.length < MAX_REFS && <button type="button" className={styles.addTile} onClick={() => fileInput.current?.click()}><Plus size={20} /></button>}
        </div>}
        <label className={styles.field}><span>Fusion direction</span><textarea data-testid="moodboard-prompt" value={prompt} maxLength={1200} onChange={(event) => setPrompt(event.target.value)} rows={3} placeholder="Fuse these references into…" /><small>Say what unites the references: palette, medium, era, light, or the single scene they should become.</small></label>
        <div className={styles.options}><label><span>Model</span><select value={model} onChange={(event) => setModel(event.target.value as Model)}>
          <option value="nano-banana-2">Nano Banana 2 · $0.16</option>
          <option value="gpt-image-2">GPT Image 2 · $0.24</option>
        </select></label></div>
        <button data-testid="moodboard-run" className={styles.run} type="button" disabled={!ready} onClick={() => void fuse()}>{busy ? <Loader2 className={styles.spin} size={18} /> : <WandSparkles size={18} />}{busy ? status : refs.length < 2 ? `Add ${2 - refs.length} more reference${refs.length === 1 ? '' : 's'}` : 'Fuse moodboard'}</button>
        <div className={styles.price}><span>Reference fusion · first image leads the edit</span><b>≈{credits} credits · ${price.toFixed(2)}</b></div>
        {error && <div className={styles.error} role="alert">{error}</div>}
      </div>
      <div className={styles.previewPanel}>
        <div className={styles.previewHeader}><span>{outputURL ? 'FUSED RESULT' : 'MOODBOARD PREVIEW'}</span>{outputURL && <span className={styles.ready}><Check size={13} /> READY</span>}</div>
        <div className={styles.preview}>
          {outputURL
            ? <div data-testid="moodboard-result"><img src={outputURL} alt="Fused moodboard result" /></div>
            : <div className={styles.empty}><ImageIcon size={30} /><b>Your fused board will appear here</b><span>Pick references that argue for one world.</span></div>}
          {busy && <div className={styles.loading}><Loader2 className={styles.spin} size={32} /><b>{status}</b></div>}
        </div>
        <div className={styles.footer}><span>{outputURL ? 'Saved to your ManifoldGen gallery when returned by the service.' : `${refs.length} of ${MAX_REFS} references loaded.`}</span>{outputURL && <a href={outputURL} download><Download size={15} /> Download</a>}</div>
      </div>
    </section>
    <section className={styles.examples}>
      <div className={styles.examplesHead}><Sparkles size={15} /><span>EXAMPLE MOODBOARD</span></div>
      <div className={styles.exampleBoard}>
        {EXAMPLES.map((src, index) => <img key={src} src={src} alt={`Example reference ${index + 1}`} />)}
      </div>
      <div className={styles.chips}>
        {EXAMPLE_PROMPTS.map((chip) => <button key={chip} type="button" className={styles.chip} onClick={() => setPrompt(chip)}>{chip.slice(0, 58)}…</button>)}
      </div>
    </section>
    <section className={styles.notes}><div><Layers size={17} /><span><b>References stay ordered</b>The first upload becomes the lead image the edit anchors on; the rest arrive as ranked style references.</span></div><div><Sparkles size={17} /><span><b>Two to six images</b>Enough spread to define a language, few enough that no reference is ignored.</span></div><div><Check size={17} /><span><b>Honest metering</b>Nano Banana 2 runs $0.16 and GPT Image 2 $0.24 per fused board, refunded if the backend fails.</span></div></section>
  </main>;
}
