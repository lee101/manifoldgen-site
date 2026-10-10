'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { Check, Clapperboard, Download, Image as ImageIcon, LoaderCircle, Orbit, RotateCcw } from 'lucide-react';
import { loadStoredUser, refreshUser, saveUser, type StoredUser } from '../../../lib/auth';
import { parseJSONResponse } from '../../../lib/http';
import styles from '../audio-spaces.module.css';
import { sleep, uploadToR2 } from '../character-swap/CharacterSwapTool';
import VideoDownload from '../../../components/video-download';

type Phase = 'idle' | 'queued' | 'processing' | 'done' | 'error';
type ServiceResponse = { result?: { job_id?: string; status_url?: string }; estimated_cost_usd?: number; estimated_credits?: number };
type JobPayload = { job?: { status?: string; error?: string; result?: { video_url?: string; charged_usd?: number; credits_used?: number } } };

const SAMPLE_BASE = 'https://manifoldgenstatic.manifoldgen.com/static/tools/orbit-video';
export const SAMPLE_IMAGE = `${SAMPLE_BASE}/witch-input.png`;
export const SAMPLE_OUTPUT = `${SAMPLE_BASE}/witch-orbit.mp4`;
export const PRICE_USD = 0.50;
export const ORBIT_PROMPT = 'One frozen instant. Only the camera moves. In a continuous 360 orbit. Preserve every person and object in exactly the same world position, orientation, shape and pose throughout the shot. Airborne objects remain suspended at the captured height and angle: no wobbling, shaking, spinning, drifting, falling or continued action. Keep faces, hands, clothing, liquids and the background motionless while retaining their natural appearance. Camera parallax is the only source of apparent movement. No cuts, zoom, morphing or added objects.';

export default function OrbitVideoTool() {
  const imageInput = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [imageURL, setImageURL] = useState(SAMPLE_IMAGE);
  const [imageLink, setImageLink] = useState('');
  const [prompt, setPrompt] = useState(ORBIT_PROMPT);
  const [uploading, setUploading] = useState(false);
  const [sourceError, setSourceError] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [status, setStatus] = useState('Add a photo');
  const [error, setError] = useState('');
  const [outputURL, setOutputURL] = useState('');
  const [chargedUSD, setChargedUSD] = useState<number | null>(null);
  const [creditsUsed, setCreditsUsed] = useState<number | null>(null);

  const signedIn = Boolean(user?.api_key);
  const busy = phase === 'queued' || phase === 'processing';

  useEffect(() => {
    const stored = loadStoredUser();
    setUser(stored);
    if (stored?.api_key) void refreshUser(stored.api_key).then((fresh) => { if (fresh) { setUser(fresh); saveUser(fresh); } });
  }, []);

  async function uploadImage(file?: File) {
    if (!file) return;
    const currentUser = user || loadStoredUser();
    if (!currentUser?.api_key) { setSourceError('Sign in to upload your own photo.'); return; }
    if (!file.type.startsWith('image/')) { setSourceError('Choose a PNG, JPEG, or WebP photo.'); return; }
    setSourceError(''); setUploading(true);
    try {
      setImageURL(await uploadToR2(file, file.name, file.type, currentUser.api_key));
      setOutputURL('');
    } catch (reason) {
      setSourceError(reason instanceof Error ? reason.message : 'Could not upload the photo');
    } finally {
      setUploading(false);
    }
  }

  async function generate() {
    const currentUser = user || loadStoredUser();
    if (!currentUser?.api_key) { setPhase('error'); setError('Sign in to generate.'); return; }
    if (!imageURL) { setPhase('error'); setError('Choose a photo first.'); return; }
    setError(''); setOutputURL(''); setChargedUSD(null); setCreditsUsed(null);
    setPhase('queued'); setStatus('Job added');
    try {
      const queued = await parseJSONResponse<ServiceResponse>(
        await fetch('/api/service', {
          method: 'POST',
          headers: { Authorization: `Bearer ${currentUser.api_key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ service: 'orbit_video', image_url: imageURL, prompt: prompt.trim() || ORBIT_PROMPT }),
        }),
        'Could not start the orbit',
      );
      const jobID = queued.result?.job_id;
      if (!jobID) throw new Error('The orbit service returned no job');
      const statusURL = queued.result?.status_url || `/api/video-jobs/${encodeURIComponent(jobID)}`;
      for (let attempt = 0; attempt < 1200; attempt += 1) {
        const payload = await parseJSONResponse<JobPayload>(
          await fetch(statusURL, { headers: { Authorization: `Bearer ${currentUser.api_key}` } }),
          'Could not read the orbit status',
        );
        const next = payload.job?.status || '';
        const result = payload.job?.result;
        if (next === 'completed') {
          if (!result?.video_url) throw new Error('Generation completed without a video');
          setOutputURL(result.video_url);
          setChargedUSD(result.charged_usd ?? null);
          setCreditsUsed(result.credits_used ?? null);
          setPhase('done'); setStatus('Orbit ready');
          void refreshUser(currentUser.api_key).then((fresh) => { if (fresh) { setUser(fresh); saveUser(fresh); } });
          return;
        }
        if (next === 'failed' || next === 'payment_required') {
          throw new Error(payload.job?.error || (next === 'payment_required' ? 'Top up to render this video' : 'Orbit failed'));
        }
        setPhase(next === 'processing' ? 'processing' : 'queued');
        setStatus(next === 'processing' ? 'Orbiting the camera with H3 + orbit LoRA' : 'Job added');
        await sleep(3000);
      }
      throw new Error('The job remains available in your account');
    } catch (reason) {
      setPhase('error');
      setError(reason instanceof Error ? reason.message : 'Orbit failed');
    }
  }

  return <>
    <section className={styles.hero}>
      <div className={styles.eyebrow}><Orbit size={13} /> MINIMAX H3 + 360 ORBIT LORA · FIRST = LAST FRAME</div>
      <h1>One photo, a full 360° orbit.</h1>
      <p>The camera travels all the way around your subject while the scene stays frozen, then lands back on the exact frame it started from. Use it as a product spin, a character turnaround, or a seamless loop. 768 × 768, 3 seconds, a fixed price before it starts.</p>
    </section>
    <div className="mx-auto grid max-w-[1320px] gap-3.5 px-6 pb-16">
      <div className={styles.panel}>
        <div className={styles.panelHead}><div><span>EXAMPLE</span><h2>Witch portrait → frozen 360° orbit</h2></div><Clapperboard size={17} /></div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className={styles.output}>
            <div className={styles.outputHead}><span>INPUT PHOTO</span><span>RA2 · 768 × 768</span></div>
            <img data-testid="orbit-example-input" src={SAMPLE_IMAGE} alt="Realistic witch in a black corset dress and pointed hat standing in a candlelit forest" />
          </div>
          <div className={styles.output}>
            <div className={styles.outputHead}><span>ORBIT OUTPUT</span><span className={styles.ready}>H3 + ORBIT LORA · 3 S</span></div>
            <video data-testid="orbit-example-output" src={SAMPLE_OUTPUT} muted autoPlay loop playsInline controls />
          </div>
        </div>
        <div className={styles.price}><span>Same photo as first and last frame: the clip closes on its own first frame, so it loops</span><span>LoRA by pablodawson</span></div>
      </div>
      <div className={styles.panel}>
        <div className={styles.panelHead}><div><span>01 / PHOTO</span><h2>Your photo</h2></div><ImageIcon size={17} /></div>
        <div className={styles.output} style={{ maxWidth: 420 }}>
          <div className={styles.outputHead}><span>SOURCE</span><span className={imageURL ? styles.ready : ''}>{imageURL ? 'LOADED' : 'WAITING'}</span></div>
          {imageURL ? <img data-testid="orbit-image" key={imageURL} src={imageURL} alt="Photo to orbit" /> : <div className={`${styles.empty} p-8`}><p>No photo yet.</p></div>}
        </div>
        <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp" hidden
          onChange={(event: ChangeEvent<HTMLInputElement>) => { void uploadImage(event.target.files?.[0]); event.target.value = ''; }} />
        <button type="button" className={styles.run} disabled={uploading || busy} onClick={() => imageInput.current?.click()}>
          {uploading ? <LoaderCircle className={styles.spin} size={17} /> : <Download size={16} />}{uploading ? 'Uploading…' : 'Use your own photo'}
        </button>
        <div className={styles.price}><span>PNG · JPEG · WebP · fitted to 768 px, aspect kept</span><span>Best with one clear subject and a static pose</span></div>
        <label className={styles.field}>Or paste a public image URL
          <input data-testid="orbit-image-url" type="url" value={imageLink} disabled={uploading || busy}
            onChange={(event) => setImageLink(event.target.value)} placeholder="https://example.com/subject.png" />
        </label>
        {imageLink.trim() && <div className={styles.chips}><button type="button" disabled={uploading || busy} onClick={() => { setImageURL(imageLink.trim()); setOutputURL(''); }}>Use this URL</button></div>}
        {sourceError && <div data-testid="orbit-source-error" className={styles.error}>{sourceError}</div>}
      </div>
      <div className={styles.panel}>
        <div className={styles.panelHead}><div><span>02 / ORBIT</span><h2>Generate the orbit</h2></div><Orbit size={17} /></div>
        <label className={styles.field}>Prompt (the LoRA was trained on this wording; edit with care)
          <textarea data-testid="orbit-prompt" rows={7} maxLength={2000} disabled={busy} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
        </label>
        {prompt !== ORBIT_PROMPT && <div className={styles.chips}><button type="button" disabled={busy} onClick={() => setPrompt(ORBIT_PROMPT)}><RotateCcw size={12} /> Reset to the recommended prompt</button></div>}
        <div className={styles.price}><span>Fixed ${PRICE_USD.toFixed(2)} per clip, confirmed before it starts</span><span>73 frames · 24 fps · 28 steps · LoRA strength 1.0</span></div>
        {signedIn
          ? <button data-testid="orbit-run" className={styles.run} type="button" disabled={busy || uploading || !imageURL} onClick={() => void generate()}>
            {busy ? <LoaderCircle className={styles.spin} size={17} /> : <Orbit size={16} />}{busy ? status : 'Generate the 360° orbit'}
          </button>
          : <Link data-testid="orbit-run" href="/account" className={styles.run}>Sign in to generate</Link>}
        {error && <div data-testid="orbit-error" className={styles.error}>{error}</div>}
        <div className={styles.output}>
          <div className={styles.outputHead}><span>ORBIT VIDEO</span><span className={outputURL ? styles.ready : ''}>{outputURL ? 'READY' : busy ? 'GENERATING' : 'WAITING'}</span></div>
          {outputURL
            ? <>
              <video data-testid="orbit-output" src={outputURL} controls loop playsInline />
              <VideoDownload url={outputURL} name="manifoldgen-orbit" className={styles.download} testId="orbit-download" />
            </>
            : <div className={`${styles.empty} p-8`}>{busy ? <><LoaderCircle className={styles.spin} size={22} /><p>{status}</p></> : <p>No video yet. Add a photo, then generate.</p>}</div>}
        </div>
        {outputURL && <div className={styles.price}>
          <span>Silent clip · first and last frames match, so it loops</span>
          <span>{creditsUsed === null ? '' : `${Math.ceil(creditsUsed)} credits used`}{chargedUSD === null ? '' : ` · $${chargedUSD.toFixed(2)}`}</span>
        </div>}
        {phase === 'done' && <div className={styles.price}><span><Check size={11} /> Orbit complete</span><span>768 × 768</span></div>}
        <div className={styles.price}><span>MiniMax H3 FL2VA + MiniMax-H3-360-Orbit-LoRA</span><span>Cold start can add a few minutes</span></div>
      </div>
    </div>
  </>;
}
