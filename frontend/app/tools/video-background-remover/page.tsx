'use client';

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Download, Film, LoaderCircle, Scissors, Upload, Volume2 } from 'lucide-react';
import Link from 'next/link';
import { loadStoredUser, refreshUser, saveUser, StoredUser } from '../../../lib/auth';
import styles from './page.module.css';

const SAMPLE = 'https://manifoldgenstatic.manifoldgen.com/gallery/videos/astronaut-flower-field.webm';
const REAL_OUTPUT = 'https://manifoldgenstatic.manifoldgen.com/gallery/service_netw/video-background/6f378c9b-1c0d-4aad-9f1a-e41f9436fca5.webm';
const MAX_SECONDS = 30;

type Phase = 'idle' | 'uploading' | 'queued' | 'processing' | 'done' | 'error';
type PreviewBackground = 'checker' | 'green' | 'studio';
type JobPayload = {
  job?: {
    status?: string;
    error?: string;
    result?: { video_url?: string; duration_seconds?: number; charged_usd?: number };
  };
};

async function jsonResponse<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || fallback);
  return payload as T;
}

function fileDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const objectURL = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const duration = video.duration;
      URL.revokeObjectURL(objectURL);
      if (!Number.isFinite(duration) || duration <= 0) reject(new Error('Could not read video duration'));
      else resolve(duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectURL);
      reject(new Error('This video could not be decoded'));
    };
    video.src = objectURL;
  });
}

export default function VideoBackgroundRemoverPage() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [sourceURL, setSourceURL] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [duration, setDuration] = useState(5);
  const [preserveAudio, setPreserveAudio] = useState(true);
  const [phase, setPhase] = useState<Phase>('idle');
  const [status, setStatus] = useState('Showing a real transparent output');
  const [outputURL, setOutputURL] = useState(REAL_OUTPUT);
  const [cost, setCost] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [previewBackground, setPreviewBackground] = useState<PreviewBackground>('checker');
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = loadStoredUser();
    setUser(stored);
    if (stored?.api_key) {
      void refreshUser(stored.api_key).then((fresh) => {
        if (fresh) {
          setUser(fresh);
          saveUser(fresh);
        }
      });
    }
  }, []);

  async function upload(file: File) {
    if (!file.type.startsWith('video/')) throw new Error('Choose a video file');
    if (!user?.api_key) throw new Error('Sign in before uploading a video');
    setPhase('uploading');
    setStatus('Reading and uploading source video…');
    const seconds = await fileDuration(file);
    if (seconds > MAX_SECONDS + 0.25) throw new Error('Videos must be 30 seconds or shorter');
    const query = new URLSearchParams({
      filename: file.name,
      content_type: file.type || 'application/octet-stream',
      dataset: 'video-background-remover',
    });
    const target = await jsonResponse<{ upload_url: string; public_url: string }>(
      await fetch(`/api/uploads/presign?${query}`, { headers: { Authorization: `Bearer ${user.api_key}` } }),
      'Could not prepare upload',
    );
    const sent = await fetch(target.upload_url, {
      method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file,
    });
    if (!sent.ok) throw new Error('Video upload failed');
    setSourceURL(target.public_url);
    setSourceName(file.name);
    setDuration(Math.max(1, Math.ceil(seconds)));
    setPhase('idle');
    setStatus(`${seconds.toFixed(1)} second clip ready`);
  }

  async function chooseFiles(files: FileList | File[]) {
    const file = Array.from(files)[0];
    if (!file) return;
    setOutputURL('');
    setCost(null);
    try {
      await upload(file);
    } catch (reason) {
      setPhase('error');
      setStatus(reason instanceof Error ? reason.message : 'Video upload failed');
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    void chooseFiles(event.target.files || []);
    event.target.value = '';
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void chooseFiles(event.dataTransfer.files);
  }

  async function removeBackground() {
    if (!user?.api_key) {
      setPhase('error');
      setStatus('Sign in to remove a video background');
      return;
    }
    if (!sourceURL.trim()) {
      setPhase('error');
      setStatus('Upload a video or paste a public video URL');
      return;
    }
    setOutputURL('');
    setCost(null);
    setPhase('queued');
    setStatus('Sending to the GPU queue…');
    try {
      const queued = await jsonResponse<{
        result?: { job_id?: string; status_url?: string };
        estimated_cost_usd?: number;
      }>(
        await fetch('/api/service', {
          method: 'POST',
          headers: { Authorization: `Bearer ${user.api_key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service: 'video_background_removal', video_url: sourceURL.trim(), duration,
            background_color: 'transparent', output_format: 'webm_vp9', preserve_audio: preserveAudio,
          }),
        }),
        'Could not start background removal',
      );
      const jobID = queued.result?.job_id;
      if (!jobID) throw new Error('The video service returned no job');
      const statusURL = queued.result?.status_url || `/api/video-jobs/${encodeURIComponent(jobID)}`;
      for (let attempt = 0; attempt < 1080; attempt += 1) {
        const payload = await jsonResponse<JobPayload>(
          await fetch(statusURL, { headers: { Authorization: `Bearer ${user.api_key}` } }),
          'Could not read video job status',
        );
        const next = payload.job?.status || '';
        if (next === 'completed') {
          const url = payload.job?.result?.video_url;
          if (!url) throw new Error('Background removal completed without a video');
          setOutputURL(url);
          setCost(payload.job?.result?.charged_usd ?? queued.estimated_cost_usd ?? null);
          setPhase('done');
          setStatus('Transparent video is ready');
          void refreshUser(user.api_key).then((fresh) => fresh && setUser(fresh));
          return;
        }
        if (next === 'failed' || next === 'payment_required') {
          throw new Error(payload.job?.error || (next === 'payment_required' ? 'Top up to release this video' : 'Background removal failed'));
        }
        setPhase(next === 'processing' ? 'processing' : 'queued');
        setStatus(next === 'processing' ? 'Separating every frame…' : 'Waiting for a GPU…');
        await new Promise((resolve) => window.setTimeout(resolve, 2500));
      }
      throw new Error('The job is still running and remains available in your account');
    } catch (reason) {
      setPhase('error');
      setStatus(reason instanceof Error ? reason.message : 'Background removal failed');
    }
  }

  const busy = phase === 'uploading' || phase === 'queued' || phase === 'processing';

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}><ArrowLeft size={17} /> ManifoldGen</Link>
        <div className={styles.crumb}>Tools / Video background remover</div>
        <Link href={user ? '/account' : '/account'} className={styles.account}>
          {user ? `${(user.credits_usd ?? user.credits * (user.credit_price_usd || 0.01)).toFixed(2)} USD` : 'Sign in'}
        </Link>
      </header>

      <section className={styles.hero}>
        <div className={styles.eyebrow}><Scissors size={14} /> GPU VIDEO MATTING</div>
        <h1>Remove a video background.<br /><span>Keep every original pixel.</span></h1>
        <p>We infer a temporal alpha matte and attach it to your source frames—no generative redraw, no lost fabric or skin detail.</p>
      </section>

      <section className={styles.workspace}>
        <div className={styles.controls}>
          <div
            className={`${styles.dropzone} ${dragging ? styles.dragging : ''}`}
            onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <input ref={fileInput} type="file" accept="video/*" hidden onChange={onFileChange} />
            <div className={styles.uploadIcon}><Upload size={23} /></div>
            <strong>{sourceName || 'Drop a video here'}</strong>
            <span>MP4, MOV or WebM · up to 30 seconds</span>
            <button type="button" onClick={() => fileInput.current?.click()} disabled={busy}>
              Choose video
            </button>
          </div>

          <div className={styles.or}><span /> or use a public URL <span /></div>
          <label className={styles.urlLabel}>
            Video URL
            <input
              value={sourceURL}
              onChange={(event) => { setSourceURL(event.target.value); setSourceName(''); setOutputURL(''); }}
              placeholder="https://…/source.webm"
              disabled={busy}
            />
          </label>
          <button className={styles.sample} type="button" onClick={() => { setSourceURL(SAMPLE); setDuration(17); setSourceName('Astronaut sample'); }} disabled={busy}>
            Use astronaut sample
          </button>

          <div className={styles.options}>
            <div><Volume2 size={18} /><span><strong>Keep audio</strong><small>Preserve the source soundtrack</small></span></div>
            <button
              type="button" role="switch" aria-checked={preserveAudio}
              className={`${styles.switch} ${preserveAudio ? styles.switchOn : ''}`}
              onClick={() => setPreserveAudio((value) => !value)}
            ><span /></button>
          </div>

          <button className={styles.run} type="button" onClick={() => void removeBackground()} disabled={busy || !sourceURL.trim()}>
            {busy ? <LoaderCircle className={styles.spin} size={19} /> : <Scissors size={19} />}
            {busy ? status : 'Remove background'}
          </button>
          <div className={styles.price}><span>Transparent VP9 WebM</span><span>From $0.00504 / second</span></div>
          {phase === 'error' && <div className={styles.error}>{status}</div>}
        </div>

        <div className={styles.previewPanel}>
          <div className={styles.previewHeader}>
            <span>OUTPUT PREVIEW</span>
            {phase === 'done' ? <span className={styles.ready}><Check size={13} /> READY</span> : outputURL === REAL_OUTPUT && <span className={styles.ready}><Check size={13} /> REAL OUTPUT</span>}
          </div>
          <div className={styles.backgroundPicker} aria-label="Preview background">
            {(['checker', 'green', 'studio'] as const).map((background) => (
              <button
                key={background}
                type="button"
                aria-pressed={previewBackground === background}
                className={previewBackground === background ? styles.backgroundActive : ''}
                onClick={() => setPreviewBackground(background)}
              >
                <i className={styles[`${background}Swatch`]} />
                {background === 'green' ? 'Chroma green' : background === 'studio' ? 'New scene' : 'Transparency'}
              </button>
            ))}
          </div>
          <div className={`${styles.checker} ${previewBackground === 'green' ? styles.greenBackground : previewBackground === 'studio' ? styles.studioBackground : ''}`}>
            {outputURL ? (
              <video src={outputURL} controls autoPlay loop playsInline aria-label="Transparent output video" />
            ) : busy ? (
              <div className={styles.empty}><LoaderCircle className={styles.spin} size={34} /><strong>{status}</strong><span>The job is durable; closing this tab will not duplicate it.</span></div>
            ) : (
              <div className={styles.empty}><Film size={39} /><strong>Your transparent video appears here</strong><span>The checkerboard shows removed pixels.</span></div>
            )}
          </div>
          <div className={styles.resultFooter}>
            <div><strong>{phase === 'done' ? 'Foreground isolated' : outputURL === REAL_OUTPUT ? 'Completed example' : 'Original resolution'}</strong><span>{cost !== null ? `$${cost.toFixed(4)} charged` : outputURL === REAL_OUTPUT ? 'RVM · transparent VP9 WebM' : 'Source RGB detail retained'}</span></div>
            {outputURL && <a href={outputURL} download><Download size={17} /> Download WebM</a>}
          </div>
        </div>
      </section>

      <section className={styles.notes}>
        <div><b>01</b><span><strong>Temporal matte</strong>Recurrent inference keeps edges stable between frames.</span></div>
		<div><b>02</b><span><strong>Local GPU first</strong>Our native worker handles the job; RunPod absorbs local queue pressure and general matting uses standby capacity.</span></div>
        <div><b>03</b><span><strong>No duplicate work</strong>Repeated submissions reuse the same account job and content cache.</span></div>
      </section>
    </main>
  );
}
