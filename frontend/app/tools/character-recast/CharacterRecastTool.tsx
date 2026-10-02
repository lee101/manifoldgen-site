'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { Check, Clapperboard, Download, Image as ImageIcon, LoaderCircle, Music4, Sparkles } from 'lucide-react';
import { loadStoredUser, refreshUser, saveUser, type StoredUser } from '../../../lib/auth';
import { parseJSONResponse } from '../../../lib/http';
import styles from '../audio-spaces.module.css';
import { sleep, uploadToR2 } from '../character-swap/CharacterSwapTool';

type Phase = 'idle' | 'queued' | 'processing' | 'done' | 'error';
type Resolution = '768P' | '1080P';
type Estimate = { estimated_cost_usd?: number; estimated_credits?: number; source_seconds?: number; people?: number; estimated_generation_seconds?: number };
type ServiceResponse = { result?: { job_id?: string; status_url?: string } };
type JobResult = { stage?: string; chunks_total?: number; chunks_completed?: number; video_url?: string; charged_usd?: number; credits_used?: number };
type JobPayload = { job?: { status?: string; error?: string; result?: JobResult } };

const SAMPLE_BASE = 'https://manifoldgenstatic.manifoldgen.com/static/tools/character-recast';
const SAMPLE_VIDEO = `${SAMPLE_BASE}/dance-source.webm`;
const SAMPLE_PHOTO = `${SAMPLE_BASE}/cat-reference.webp`;
const SAMPLE_OUTPUT = `${SAMPLE_BASE}/cat-recast.webm`;
const RATES: Record<Resolution, number> = { '768P': 0.62, '1080P': 0.70 };
const MAX_PEOPLE = 4;

function stageLabel(result?: JobResult): string {
  switch (result?.stage) {
    case 'frame': return 'Extracting the reference frame';
    case 'image': return 'Backup engine: drawing the new characters';
    case 'mux': return 'Publishing the recast video';
    case 'video': {
      const total = result?.chunks_total ?? 0;
      return total > 1 ? `Backup engine: swapping clip ${result?.chunks_completed ?? 0}/${total}` : 'Recasting with H3 Max';
    }
    default: return 'Working…';
  }
}

export default function CharacterRecastTool() {
  const videoInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const photoSlot = useRef(0);
  const estimateSequence = useRef(0);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [videoURL, setVideoURL] = useState(SAMPLE_VIDEO);
  const [videoLink, setVideoLink] = useState('');
  const [duration, setDuration] = useState(0);
  const [photos, setPhotos] = useState<string[]>([SAMPLE_PHOTO]);
  const [uploading, setUploading] = useState(false);
  const [sourceError, setSourceError] = useState('');
  const [prompt, setPrompt] = useState('');
  const [resolution, setResolution] = useState<Resolution>('1080P');
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [status, setStatus] = useState('Add your people');
  const [error, setError] = useState('');
  const [outputURL, setOutputURL] = useState('');
  const [chargedUSD, setChargedUSD] = useState<number | null>(null);
  const [creditsUsed, setCreditsUsed] = useState<number | null>(null);

  const cleanPhotos = photos.map((photo) => photo.trim()).filter(Boolean);
  const signedIn = Boolean(user?.api_key);
  const busy = phase === 'queued' || phase === 'processing';

  useEffect(() => {
    const stored = loadStoredUser();
    setUser(stored);
    if (stored?.api_key) void refreshUser(stored.api_key).then((fresh) => { if (fresh) { setUser(fresh); saveUser(fresh); } });
  }, []);

  useEffect(() => {
    const currentUser = user || loadStoredUser();
    if (!videoURL || cleanPhotos.length === 0 || !currentUser?.api_key) { setEstimate(null); return; }
    const sequence = ++estimateSequence.current;
    const timer = window.setTimeout(async () => {
      setEstimating(true);
      try {
        const payload = await parseJSONResponse<Estimate>(
          await fetch('/api/character-swap/estimate', {
            method: 'POST',
            headers: { Authorization: `Bearer ${currentUser.api_key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ video_url: videoURL, kind: 'recast', reference_image_urls: cleanPhotos, resolution }),
          }),
          'Could not estimate the recast',
        );
        if (sequence === estimateSequence.current) setEstimate(payload);
      } catch {
        if (sequence === estimateSequence.current) setEstimate(null);
      } finally {
        if (sequence === estimateSequence.current) setEstimating(false);
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [videoURL, photos, resolution, user]);

  function setPhoto(index: number, value: string) {
    setPhotos((current) => current.map((photo, i) => (i === index ? value : photo)));
  }

  async function uploadVideo(file?: File) {
    if (!file) return;
    const currentUser = user || loadStoredUser();
    if (!currentUser?.api_key) { setSourceError('Sign in to upload your own video.'); return; }
    if (!/\.(mp4|webm|mov)$/i.test(file.name) && !file.type.startsWith('video/')) { setSourceError('Choose an MP4, WebM, or MOV file.'); return; }
    setSourceError(''); setUploading(true);
    try {
      setVideoURL(await uploadToR2(file, file.name, file.type || 'video/mp4', currentUser.api_key));
      setDuration(0); setOutputURL('');
    } catch (reason) {
      setSourceError(reason instanceof Error ? reason.message : 'Could not upload the video');
    } finally {
      setUploading(false);
    }
  }

  async function uploadPhoto(file?: File) {
    if (!file) return;
    const currentUser = user || loadStoredUser();
    if (!currentUser?.api_key) { setSourceError('Sign in to upload photos.'); return; }
    if (!file.type.startsWith('image/')) { setSourceError('Choose a PNG, JPEG, or WebP photo.'); return; }
    setSourceError(''); setUploading(true);
    try {
      setPhoto(photoSlot.current, await uploadToR2(file, file.name, file.type, currentUser.api_key));
    } catch (reason) {
      setSourceError(reason instanceof Error ? reason.message : 'Could not upload the photo');
    } finally {
      setUploading(false);
    }
  }

  async function generate() {
    const currentUser = user || loadStoredUser();
    if (!currentUser?.api_key) { setPhase('error'); setError('Sign in to generate.'); return; }
    if (!videoURL) { setPhase('error'); setError('Choose a source video first.'); return; }
    if (cleanPhotos.length === 0) { setPhase('error'); setError('Add one photo per new person.'); return; }
    setError(''); setOutputURL(''); setChargedUSD(null); setCreditsUsed(null);
    setPhase('queued'); setStatus('Job added');
    try {
      const queued = await parseJSONResponse<ServiceResponse>(
        await fetch('/api/service', {
          method: 'POST',
          headers: { Authorization: `Bearer ${currentUser.api_key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service: 'character_swap_video', kind: 'recast', video_url: videoURL, reference_image_urls: cleanPhotos, resolution,
            ...(prompt.trim() ? { prompt: prompt.trim() } : {}),
          }),
        }),
        'Could not start the recast',
      );
      const jobID = queued.result?.job_id;
      if (!jobID) throw new Error('The recast service returned no job');
      const statusURL = queued.result?.status_url || `/api/video-jobs/${encodeURIComponent(jobID)}`;
      for (let attempt = 0; attempt < 1200; attempt += 1) {
        const payload = await parseJSONResponse<JobPayload>(
          await fetch(statusURL, { headers: { Authorization: `Bearer ${currentUser.api_key}` } }),
          'Could not read the recast status',
        );
        const next = payload.job?.status || '';
        const result = payload.job?.result;
        if (next === 'completed') {
          if (!result?.video_url) throw new Error('Generation completed without a video');
          setOutputURL(result.video_url);
          setChargedUSD(result.charged_usd ?? null);
          setCreditsUsed(result.credits_used ?? null);
          setPhase('done'); setStatus('Recast ready');
          void refreshUser(currentUser.api_key).then((fresh) => { if (fresh) { setUser(fresh); saveUser(fresh); } });
          return;
        }
        if (next === 'failed' || next === 'payment_required') {
          throw new Error(payload.job?.error || (next === 'payment_required' ? 'Top up to render this video' : 'Recast failed'));
        }
        setPhase(next === 'processing' ? 'processing' : 'queued');
        setStatus(next === 'processing' ? stageLabel(result) : 'Job added');
        await sleep(3000);
      }
      throw new Error('The job remains available in your account');
    } catch (reason) {
      setPhase('error');
      setError(reason instanceof Error ? reason.message : 'Recast failed');
    }
  }

  const estimateLine = estimating
    ? 'Pricing the recast…'
    : estimate && typeof estimate.estimated_credits === 'number' && typeof estimate.estimated_cost_usd === 'number'
      ? `≈ ${estimate.estimated_credits} credits ($${estimate.estimated_cost_usd.toFixed(2)}) · ${estimate.people ?? cleanPhotos.length} people · ${Math.round(estimate.source_seconds ?? 0)} s · about ${Math.max(1, Math.round((estimate.estimated_generation_seconds ?? 0) / 60))} min`
      : 'Estimate appears when signed in with a photo added';

  return <>
    <section className={styles.hero}>
      <div className={styles.eyebrow}><Music4 size={13} /> MINIMAX H3 MAX RECAST · SHOTS TRACKED · ORIGINAL AUDIO</div>
      <h1>Recast the people. Keep the shot.</h1>
      <p>Give H3 Max a video and one photo per new person. Each person is replaced in every shot they appear in, with the original motion, camera, cut timing and soundtrack kept. Up to four people, 5–30 seconds, priced per source second before you start.</p>
      <Link href="/tools/character-swap" className="mt-4 inline-block text-sm font-medium text-white/70 underline decoration-white/30 underline-offset-4 hover:text-white">Redraw a scene frame instead: Character Swap (H3)</Link>
      <Link href="/tools/character-swap-lora" className="mt-2 block text-sm font-medium text-white/70 underline decoration-white/30 underline-offset-4 hover:text-white">Longer than 30 s, or one composite character frame: Character Swap LoRA</Link>
    </section>
    <div className="mx-auto grid max-w-[1320px] gap-3.5 px-6 pb-16">
      <div className={styles.panel}>
        <div className={styles.panelHead}><div><span>EXAMPLE</span><h2>Dancer → cat, one photo</h2></div><Clapperboard size={17} /></div>
        <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr]">
          <div className={styles.output}>
            <div className={styles.outputHead}><span>INPUT VIDEO</span><span>10 s · 1080P source</span></div>
            <video data-testid="recast-example-source" src={SAMPLE_VIDEO} muted autoPlay loop playsInline controls />
          </div>
          <div className={styles.output} style={{ maxWidth: 180 }}>
            <div className={styles.outputHead}><span>PHOTO</span></div>
            <img src={SAMPLE_PHOTO} alt="Reference photo of a cat standing upright in a white t-shirt and beanie" />
          </div>
          <div className={styles.output}>
            <div className={styles.outputHead}><span>RECAST OUTPUT</span><span className={styles.ready}>H3 MAX · 1080P</span></div>
            <video data-testid="recast-example-output" src={SAMPLE_OUTPUT} muted autoPlay loop playsInline controls />
          </div>
        </div>
        <div className={styles.price}><span>Same room, same camera, same dance: only the person changes</span><span>Source video by PNW Production on Pexels</span></div>
      </div>
      <div className={styles.panel}>
        <div className={styles.panelHead}><div><span>01 / SOURCE</span><h2>Source video</h2></div><Clapperboard size={17} /></div>
        <div className={styles.output}>
          <div className={styles.outputHead}><span>SOURCE PREVIEW</span><span className={videoURL ? styles.ready : ''}>{videoURL ? 'LOADED' : 'WAITING'}</span></div>
          {videoURL
            ? <video data-testid="recast-video" key={videoURL} src={videoURL} controls muted playsInline onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} />
            : <div className={`${styles.empty} p-8`}><p>No source yet.</p></div>}
        </div>
        {duration > 0 && <div className={styles.price}><span>Source length</span><span>{duration.toFixed(1)} s{duration < 5 || duration > 30 ? ' · must be 5–30 s' : ''}</span></div>}
        <input ref={videoInput} type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov" hidden
          onChange={(event: ChangeEvent<HTMLInputElement>) => { void uploadVideo(event.target.files?.[0]); event.target.value = ''; }} />
        <button type="button" className={styles.run} disabled={uploading} onClick={() => videoInput.current?.click()}>
          {uploading ? <LoaderCircle className={styles.spin} size={17} /> : <Download size={16} />}{uploading ? 'Uploading…' : 'Use your own video'}
        </button>
        <div className={styles.price}><span>MP4 · WebM · MOV · 5–30 s · shots up to 15 s</span><span>Original soundtrack kept</span></div>
        <label className={styles.field}>Or paste a public video URL
          <input data-testid="recast-video-url" type="url" value={videoLink} disabled={uploading}
            onChange={(event) => setVideoLink(event.target.value)} placeholder="https://example.com/performance.mp4" />
        </label>
        {videoLink.trim() && <div className={styles.chips}><button type="button" disabled={uploading} onClick={() => { setVideoURL(videoLink.trim()); setDuration(0); setEstimate(null); setOutputURL(''); }}>Use this URL</button></div>}
        {sourceError && <div data-testid="recast-source-error" className={styles.error}>{sourceError}</div>}
      </div>
      <div className={styles.panel}>
        <div className={styles.panelHead}><div><span>02 / PEOPLE</span><h2>One photo per new person</h2></div><ImageIcon size={17} /></div>
        <p className="text-sm leading-6 text-white/60">People are replaced from left to right. Name who becomes whom in the prompt below if the order is not obvious.</p>
        <input ref={photoInput} type="file" accept="image/png,image/jpeg,image/webp" hidden
          onChange={(event: ChangeEvent<HTMLInputElement>) => { void uploadPhoto(event.target.files?.[0]); event.target.value = ''; }} />
        {photos.map((photo, index) => <div key={index} className="grid gap-2 md:grid-cols-[96px_1fr_auto]">
          <div className={styles.output}>{photo.trim() ? <img data-testid="recast-photo-preview" src={photo.trim()} alt={`New person ${index + 1}`} /> : <div className={`${styles.empty} p-4`}><p>Person {index + 1}</p></div>}</div>
          <label className={styles.field}>Photo {index + 1} URL
            <input data-testid="recast-photo-url" type="url" value={photo} disabled={uploading || busy}
              onChange={(event) => setPhoto(index, event.target.value)} placeholder="https://example.com/person.png" />
          </label>
          <div className={styles.chips}>
            <button type="button" disabled={uploading || busy} onClick={() => { photoSlot.current = index; photoInput.current?.click(); }}>Upload</button>
            {photos.length > 1 && <button type="button" disabled={busy} onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))}>Remove</button>}
          </div>
        </div>)}
        {photos.length < MAX_PEOPLE && <div className={styles.chips}><button data-testid="recast-add-person" type="button" disabled={busy} onClick={() => setPhotos((current) => [...current, ''])}>Add another person</button></div>}
      </div>
      <div className={styles.panel}>
        <div className={styles.panelHead}><div><span>03 / RECAST</span><h2>Recast with MiniMax H3 Max</h2></div><Sparkles size={17} /></div>
        <label className={styles.field}>Prompt (optional): who becomes whom, or what to keep or change
          <textarea data-testid="recast-prompt" rows={4} maxLength={2000} disabled={busy} value={prompt}
            onChange={(event) => setPrompt(event.target.value)} placeholder="The man on the left becomes the person in photo 1; keep the red jacket." />
        </label>
        <div className={styles.segment}>
          {(['768P', '1080P'] as const).map((value) => <button key={value} type="button" disabled={busy}
            className={resolution === value ? styles.active : ''} onClick={() => setResolution(value)}>{value}</button>)}
        </div>
        <div className={styles.price}><span>{estimateLine}</span><span>${RATES[resolution].toFixed(2)} per source second at {resolution}</span></div>
        {signedIn
          ? <button data-testid="recast-run" className={styles.run} type="button" disabled={busy || uploading || !videoURL || cleanPhotos.length === 0} onClick={() => void generate()}>
            {busy ? <LoaderCircle className={styles.spin} size={17} /> : <Sparkles size={16} />}{busy ? status : 'Recast the people'}
          </button>
          : <Link data-testid="recast-run" href="/account" className={styles.run}>Sign in to generate</Link>}
        {error && <div data-testid="recast-error" className={styles.error}>{error}</div>}
        <div className={styles.output}>
          <div className={styles.outputHead}><span>RECAST VIDEO</span><span className={outputURL ? styles.ready : ''}>{outputURL ? 'READY' : busy ? 'GENERATING' : 'WAITING'}</span></div>
          {outputURL
            ? <>
              <video data-testid="recast-output" src={outputURL} controls playsInline />
              <a className={styles.download} href={outputURL} download><Download size={14} /> Download MP4</a>
            </>
            : <div className={`${styles.empty} p-8`}>{busy ? <><LoaderCircle className={styles.spin} size={22} /><p>{status}</p></> : <p>No video yet. Add the people, then recast.</p>}</div>}
        </div>
        {outputURL && <div className={styles.price}>
          <span>H.264 + AAC · original audio</span>
          <span>{creditsUsed === null ? '' : `${Math.ceil(creditsUsed)} credits used`}{chargedUSD === null ? '' : ` · $${chargedUSD.toFixed(2)}`}</span>
        </div>}
        {phase === 'done' && <div className={styles.price}><span><Check size={11} /> Recast complete</span><span>{resolution}</span></div>}
        <div className={styles.price}><span>Powered by MiniMax H3 Max</span><span>Self-hosted H3 backup if the primary engine is unavailable</span></div>
      </div>
    </div>
  </>;
}
