'use client';

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Download, Image as ImageIcon, LoaderCircle, Play, Sparkles, Upload, Video } from 'lucide-react';
import Link from 'next/link';
import { loadStoredUser, refreshUser, saveUser, StoredUser } from '../../../lib/auth';
import styles from './page.module.css';

const DANCE_SAMPLE = 'https://manifoldgenstatic.manifoldgen.com/gallery/videos/temple-chiffon-spin.webm';
const REAL_OUTPUT = 'https://manifoldgenstatic.manifoldgen.com/gallery/videos/wan_animate_cartographer_standard_5s_20260816.mp4';

type Phase = 'idle' | 'uploading' | 'queued' | 'processing' | 'done' | 'error';
type ServiceTier = 'standard' | 'fast' | 'xfast';
type Asset = { url: string; preview: string; name: string };
type JobPayload = { job?: { status?: string; error?: string; result?: { video_url?: string; charged_usd?: number } } };

async function jsonResponse<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || fallback);
  return payload as T;
}

function videoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => { const value = video.duration; URL.revokeObjectURL(url); Number.isFinite(value) && value > 0 ? resolve(value) : reject(new Error('Could not read video duration')); };
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This video could not be decoded')); };
    video.src = url;
  });
}

export default function CharacterAnimatorPage() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [character, setCharacter] = useState<Asset | null>(null);
  const [driving, setDriving] = useState<Asset | null>(null);
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState(5);
  const [format, setFormat] = useState<'portrait' | 'landscape' | 'square'>('portrait');
  const [serviceTier, setServiceTier] = useState<ServiceTier>('standard');
  const [phase, setPhase] = useState<Phase>('idle');
  const [status, setStatus] = useState('Showing a real Wan Animate output');
  const [outputURL, setOutputURL] = useState(REAL_OUTPUT);
  const [cost, setCost] = useState<number | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = loadStoredUser();
    setUser(stored);
    if (stored?.api_key) void refreshUser(stored.api_key).then((fresh) => { if (fresh) { setUser(fresh); saveUser(fresh); } });
  }, []);

  async function upload(file: File, kind: 'image' | 'video') {
    if (!user?.api_key) throw new Error('Sign in before uploading media');
    if (!file.type.startsWith(`${kind}/`)) throw new Error(`Choose a${kind === 'image' ? 'n' : ''} ${kind} file`);
    setPhase('uploading');
    setStatus(`Uploading ${kind}…`);
    let seconds = 5;
    if (kind === 'video') {
      seconds = await videoDuration(file);
      if (seconds > 30.25) throw new Error('Driving videos must be 30 seconds or shorter');
    }
    const query = new URLSearchParams({ filename: file.name, content_type: file.type, dataset: 'character-animator' });
    const target = await jsonResponse<{ upload_url: string; public_url: string }>(
      await fetch(`/api/uploads/presign?${query}`, { headers: { Authorization: `Bearer ${user.api_key}` } }),
      'Could not prepare upload',
    );
    const sent = await fetch(target.upload_url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
    if (!sent.ok) throw new Error(`${kind === 'image' ? 'Image' : 'Video'} upload failed`);
    const asset = { url: target.public_url, preview: URL.createObjectURL(file), name: file.name };
    if (kind === 'image') setCharacter((current) => { if (current?.preview.startsWith('blob:')) URL.revokeObjectURL(current.preview); return asset; });
    else {
      setDriving((current) => { if (current?.preview.startsWith('blob:')) URL.revokeObjectURL(current.preview); return asset; });
      setDuration(Math.max(1, Math.min(8, Math.floor(seconds))));
    }
    setPhase('idle');
    setStatus('Inputs ready');
  }

  async function choose(files: FileList | null, kind: 'image' | 'video') {
    const file = files?.[0];
    if (!file) return;
    setOutputURL(''); setCost(null);
    try { await upload(file, kind); }
    catch (reason) { setPhase('error'); setStatus(reason instanceof Error ? reason.message : 'Upload failed'); }
  }

  function drop(event: DragEvent<HTMLDivElement>, kind: 'image' | 'video') {
    event.preventDefault();
    void choose(event.dataTransfer.files, kind);
  }

  async function animate() {
    if (!user?.api_key) { setPhase('error'); setStatus('Sign in to animate a character'); return; }
    if (!character || !driving) { setPhase('error'); setStatus('Add both a character image and a driving video'); return; }
    if (!prompt.trim()) { setPhase('error'); setStatus('Describe the character appearance and background'); return; }
    const dimensions = format === 'portrait' ? [640, 800] : format === 'landscape' ? [960, 544] : [768, 768];
    const laneName = serviceTier === 'xfast' ? 'B200 priority' : serviceTier === 'fast' ? '96 GB/B200 priority' : 'cost-efficient GPU';
    setOutputURL(''); setCost(null); setPhase('queued'); setStatus(`Finding a ${laneName} lane…`);
    try {
      const queued = await jsonResponse<{ result?: { job_id?: string; status_url?: string }; estimated_cost_usd?: number }>(
        await fetch('/api/service', {
          method: 'POST', headers: { Authorization: `Bearer ${user.api_key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service: 'character_animation', image_url: character.url, video_url: driving.url,
            prompt: prompt.trim(), duration, width: dimensions[0], height: dimensions[1],
            execution_profile: 'auto', service_tier: serviceTier, num_steps: 10, guidance: 1,
          }),
        }),
        'Could not start character animation',
      );
      const jobID = queued.result?.job_id;
      if (!jobID) throw new Error('The animation service returned no job');
      const statusURL = queued.result?.status_url || `/api/video-jobs/${encodeURIComponent(jobID)}`;
      for (let attempt = 0; attempt < 2400; attempt += 1) {
        const payload = await jsonResponse<JobPayload>(await fetch(statusURL, { headers: { Authorization: `Bearer ${user.api_key}` } }), 'Could not read animation status');
        const next = payload.job?.status || '';
        if (next === 'completed') {
          const url = payload.job?.result?.video_url;
          if (!url) throw new Error('Animation completed without a playable video');
          setOutputURL(url); setCost(payload.job?.result?.charged_usd ?? queued.estimated_cost_usd ?? null);
          setPhase('done'); setStatus('Character animation is ready');
          void refreshUser(user.api_key).then((fresh) => fresh && setUser(fresh));
          return;
        }
        if (next === 'failed' || next === 'payment_required') throw new Error(payload.job?.error || (next === 'payment_required' ? 'Top up to release this animation' : 'Animation failed'));
        setPhase(next === 'processing' ? 'processing' : 'queued');
        setStatus(next === 'processing' ? 'Transferring motion and expression…' : 'Waiting for a GPU…');
        await new Promise((resolve) => window.setTimeout(resolve, 3000));
      }
      throw new Error('The job is still running and remains available in your account');
    } catch (reason) { setPhase('error'); setStatus(reason instanceof Error ? reason.message : 'Animation failed'); }
  }

  const busy = phase === 'uploading' || phase === 'queued' || phase === 'processing';
  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/" className={styles.back}><ArrowLeft size={17} /> ManifoldGen</Link>
      <div className={styles.crumb}>Tools / Character animator</div>
      <Link href="/account" className={styles.account}>{user ? `${(user.credits_usd ?? user.credits * (user.credit_price_usd || .01)).toFixed(2)} USD` : 'Sign in'}</Link>
    </header>
    <section className={styles.hero}>
      <div className={styles.eyebrow}><Sparkles size={14} /> WAN-ANIMATE-2</div>
      <h1>Give any character<br /><span>someone else&apos;s motion.</span></h1>
      <p>One character image. One driving video. Body movement, expression, and timing transfer directly—without a pose-extraction stage.</p>
    </section>
    <section className={styles.workspace}>
      <div className={styles.controls}>
        <div className={styles.inputGrid}>
          <div className={styles.inputCard} onDragOver={(event) => event.preventDefault()} onDrop={(event) => drop(event, 'image')}>
            <input ref={imageInput} type="file" accept="image/*" hidden onChange={(event: ChangeEvent<HTMLInputElement>) => { void choose(event.target.files, 'image'); event.target.value = ''; }} />
            {character ? <img src={character.preview} alt="Character reference" /> : <div className={styles.emptyInput}><ImageIcon size={29} /><b>Character image</b><span>Full body works best</span></div>}
            <button type="button" disabled={busy} onClick={() => imageInput.current?.click()}><Upload size={14} /> {character ? 'Replace' : 'Choose image'}</button>
          </div>
          <div className={styles.inputCard} onDragOver={(event) => event.preventDefault()} onDrop={(event) => drop(event, 'video')}>
            <input ref={videoInput} type="file" accept="video/*" hidden onChange={(event: ChangeEvent<HTMLInputElement>) => { void choose(event.target.files, 'video'); event.target.value = ''; }} />
            {driving ? <video src={driving.preview} muted loop autoPlay playsInline /> : <div className={styles.emptyInput}><Video size={29} /><b>Driving video</b><span>One visible performer</span></div>}
            <button type="button" disabled={busy} onClick={() => videoInput.current?.click()}><Upload size={14} /> {driving ? 'Replace' : 'Choose video'}</button>
          </div>
        </div>
        <button className={styles.sample} type="button" disabled={busy} onClick={() => { setDriving({ url: DANCE_SAMPLE, preview: DANCE_SAMPLE, name: 'Temple dancer sample' }); setDuration(5); }}>Use a gallery dance sample</button>
        <label className={styles.promptLabel}>Character and background description
          <textarea value={prompt} disabled={busy} maxLength={1600} onChange={(event) => setPrompt(event.target.value)} placeholder="Person appearance: a silver humanoid robot with a polished face and blue jacket. Background: a clean white photography studio with soft even light." />
          <small>Describe appearance, clothing, and background—not the action in the driving video.</small>
        </label>
        <div className={styles.options}>
          <label>Length<select value={duration} disabled={busy} onChange={(event) => setDuration(Number(event.target.value))}>{[1,2,3,4,5,6,7,8].map((value) => <option key={value} value={value}>{value}s</option>)}</select></label>
          <label>Canvas<select value={format} disabled={busy} onChange={(event) => setFormat(event.target.value as typeof format)}><option value="portrait">Portrait</option><option value="landscape">Landscape</option><option value="square">Square</option></select></label>
        </div>
        <fieldset className={styles.tiers} disabled={busy}>
          <legend>Speed</legend>
          {([
            ['standard', 'Standard', '1×', 'Cost smart'],
            ['fast', 'Fast', '2×', '96 GB/B200 priority'],
            ['xfast', 'XFast', '4×', 'B200 priority'],
          ] as const).map(([value, label, multiplier, detail]) => <button key={value} type="button" aria-pressed={serviceTier === value} className={serviceTier === value ? styles.tierActive : ''} onClick={() => setServiceTier(value)}>
            <span><b>{label}</b><em>{multiplier}</em></span><small>{detail}</small>
          </button>)}
        </fieldset>
        <button data-testid="character-animate-run" className={styles.run} type="button" disabled={busy || !character || !driving || !prompt.trim()} onClick={() => void animate()}>
          {busy ? <LoaderCircle className={styles.spin} size={19} /> : <Play size={18} fill="currentColor" />}{busy ? status : 'Animate character'}
        </button>
        <div className={styles.price}><span>10-step distilled · {serviceTier} lane</span><span>${(Math.max(duration, 5) * .15 * (serviceTier === 'fast' ? 2 : serviceTier === 'xfast' ? 4 : 1)).toFixed(2)} fixed price · 5s minimum</span></div>
        {phase === 'error' && <div className={styles.error}>{status}</div>}
      </div>
      <div className={styles.previewPanel}>
        <div className={styles.previewHeader}><span>ANIMATION OUTPUT</span>{phase === 'done' ? <span className={styles.ready}><Check size={13} /> READY</span> : outputURL === REAL_OUTPUT && <span className={styles.ready}><Check size={13} /> REAL OUTPUT</span>}</div>
        <div className={styles.preview}>
          {outputURL ? <video src={outputURL} controls autoPlay loop playsInline /> : busy ? <div className={styles.emptyOutput}><LoaderCircle className={styles.spin} size={35} /><b>{status}</b><span>Your durable job keeps its selected service class while the GPU lane starts.</span></div> : <div className={styles.emptyOutput}><Sparkles size={38} /><b>Your animated character appears here</b><span>The original clip supplies motion; the character image supplies identity.</span></div>}
        </div>
        <div className={styles.resultFooter}><div><b>{phase === 'done' ? 'Motion transferred' : outputURL === REAL_OUTPUT ? 'Completed example' : 'Direct video conditioning'}</b><span>{cost === null ? outputURL === REAL_OUTPUT ? 'Real 5s Standard output · seed 18467291' : 'Apache-2.0 model · durable job' : `$${cost.toFixed(4)} charged`}</span></div>{outputURL && <a href={outputURL} download><Download size={16} /> Download MP4</a>}</div>
      </div>
    </section>
    <section className={styles.notes}><div><b>01</b><span><strong>No pose preprocessing</strong>The model consumes the driving frames directly.</span></div><div><b>02</b><span><strong>Cached FP8 model</strong>Pre-serialized weights cut model setup without lowering the distilled step count.</span></div><div><b>03</b><span><strong>Global GPU drain</strong>Warm priority capacity can serve cheaper jobs, then scales fully to zero after the burst.</span></div></section>
  </main>;
}
