'use client';

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import Link from 'next/link';
import { Check, Clapperboard, Download, Image as ImageIcon, LoaderCircle, Music4, Sparkles } from 'lucide-react';
import { loadStoredUser, refreshUser, saveUser, type StoredUser } from '../../../lib/auth';
import { parseJSONResponse } from '../../../lib/http';
import styles from '../audio-spaces.module.css';

type Phase = 'idle' | 'queued' | 'processing' | 'done' | 'error';
type Resolution = '768P' | '2K' | '720p' | '580p';
type SwapEstimate = {
  estimated_cost_usd?: number;
  estimated_credits?: number;
  source_seconds?: number;
  chunks?: number;
  rate_usd_per_second?: number;
  rate_usd_per_second_per_character?: number;
  people?: number;
  image_included?: boolean;
  estimated_generation_seconds?: number;
  shots?: number;
  shot_fee_usd?: number;
  per_shot_frames?: boolean;
};
type ServiceResponse = {
  result?: { job_id?: string; status?: string; status_url?: string; stage?: string };
  estimated_cost_usd?: number;
  estimated_credits?: number;
  source_seconds?: number;
  chunks?: number;
};
type JobResult = {
  stage?: string;
  chunks_total?: number;
  chunks_completed?: number;
  swapped_image_url?: string;
  video_url?: string;
  duration_seconds?: number;
  pose_error?: number;
  people?: number;
  charged_usd?: number;
  credits_used?: number;
};
type JobPayload = { job?: { status?: string; error?: string; result?: JobResult } };

const SAMPLE_VIDEO = 'https://manifoldgenstatic.manifoldgen.com/static/tools/character-swap/rapvid-source.mp4';
const SAMPLE_FRAME = 'https://manifoldgenstatic.manifoldgen.com/static/tools/character-swap/rapvid-frame.png';
const SAMPLE_SWAPPED = 'https://manifoldgenstatic.manifoldgen.com/static/tools/character-swap/rapvid-swapped.png';
const SAMPLE_OUTPUT = 'https://manifoldgenstatic.manifoldgen.com/static/tools/character-swap/rapvid-elon-optimus.mp4';
const SAMPLE_OUTPUT_EXACT = 'https://manifoldgenstatic.manifoldgen.com/static/tools/character-swap/rapvid-elon-optimus-exact.mp4';
const DEFAULT_CHARACTER_PROMPT = 'Recreate this exact frame with the characters swapped: the person on the left becomes Elon Musk singing into the same microphone, standing in the exact same pose and position, and the figure on the right becomes a Tesla Optimus humanoid robot standing in the exact same place and pose as the original character. Keep the vivid orange background, the microphone, the framing, camera angle, lighting and composition identical. Photorealistic, music video still.';
const DEFAULT_VIDEO_PROMPT = 'Image 1 is the exact target look: Elon Musk in a black blazer on the left singing into the hanging silver studio microphone, and a white-and-black Tesla Optimus humanoid robot with a glossy dark faceplate on the right, in front of a vivid bright orange studio wall. Video 1 is only the motion and camera reference. From the very first frame, show only Elon Musk and the Optimus robot, never the original two men. Elon Musk performs every move, gesture, lip movement and timing of the man on the left in Video 1; the Optimus robot performs every move of the man on the right. Same camera angles, same framing, same cuts, same microphone, and the bright orange background of Image 1 throughout. Photorealistic music video.';
const FRAME_PRICE_USD = 0.24;

function sleep(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  window.setTimeout(resolve, ms);
  return promise;
}

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

async function uploadToR2(blob: Blob, filename: string, contentType: string, apiKey: string): Promise<string> {
  const params = new URLSearchParams({ filename, content_type: contentType, dataset: 'character-swap' });
  const prepared = await parseJSONResponse<{ upload_url?: string; public_url?: string }>(
    await fetch(`/api/uploads/presign?${params}`, { headers: { Authorization: `Bearer ${apiKey}` } }),
    'Could not prepare the upload',
  );
  if (!prepared.upload_url || !prepared.public_url) throw new Error('Upload service returned no destination');
  const response = await fetch(prepared.upload_url, { method: 'PUT', headers: { 'Content-Type': contentType }, body: blob });
  if (!response.ok) throw new Error(`Upload failed (${response.status})`);
  return prepared.public_url;
}

async function extractFirstFrame(file: File): Promise<{ blob: Blob; duration: number }> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'auto';
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Could not read that video file'));
    });
    if (!Number.isFinite(video.duration) || video.duration < 5 || video.duration > 60) {
      throw new Error('Videos must be 5–60 seconds long');
    }
    video.currentTime = Math.min(2, video.duration / 4);
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error('Could not read that video file'));
    });
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Could not capture the first frame');
    return { blob, duration: video.duration };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function stageLabel(result?: JobResult, exact?: boolean): string {
  if (exact) {
    switch (result?.stage) {
      case 'frame': return 'Extracting the reference frame';
      case 'image': return 'Drawing the new characters';
      case 'track': return 'Tracking the performers';
      case 'mux': return 'Compositing and laying the soundtrack back on';
      case 'video': {
        const total = result?.chunks_total ?? 0;
        const done = result?.chunks_completed ?? 0;
        return total > 0 ? `Replacing performer passes ${done}/${total}` : 'Replacing performer passes';
      }
      default: return 'Working…';
    }
  }
  switch (result?.stage) {
    case 'frame': return 'Extracting the reference frame';
    case 'image': return 'Drawing the new characters';
    case 'shots': return 'Redrawing one frame per shot';
    case 'mux': return 'Laying the original soundtrack back on';
    case 'video': {
      const total = result?.chunks_total ?? 0;
      const done = result?.chunks_completed ?? 0;
      return total > 0 ? `Re-performing clip ${done}/${total} with H3` : 'Re-performing clips with H3';
    }
    default: return 'Working…';
  }
}

export default function CharacterSwapTool({ lane }: { lane: 'reference' | 'exact' }) {
  const exact = lane === 'exact';
  const inputRef = useRef<HTMLInputElement>(null);
  const estimateSequence = useRef(0);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [creditPrice, setCreditPrice] = useState(0.01);
  const [videoURL, setVideoURL] = useState(SAMPLE_VIDEO);
  const [videoLink, setVideoLink] = useState('');
  const [frameURL, setFrameURL] = useState(SAMPLE_FRAME);
  const [frameLink, setFrameLink] = useState('');
  const [duration, setDuration] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [sourceError, setSourceError] = useState('');
  const [characterPrompt, setCharacterPrompt] = useState(DEFAULT_CHARACTER_PROMPT);
  const [swappedImageURL, setSwappedImageURL] = useState(SAMPLE_SWAPPED);
  const [swappedLink, setSwappedLink] = useState('');
  const [frameGenerated, setFrameGenerated] = useState(false);
  const [frameBusy, setFrameBusy] = useState(false);
  const [frameError, setFrameError] = useState('');
  const [videoPrompt, setVideoPrompt] = useState(DEFAULT_VIDEO_PROMPT);
  const [resolution, setResolution] = useState<Resolution>(exact ? '720p' : '768P');
  const [characters, setCharacters] = useState(2);
  const [audioReference, setAudioReference] = useState(false);
  const [perShotFrames, setPerShotFrames] = useState(false);
  const [estimate, setEstimate] = useState<SwapEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [status, setStatus] = useState('Describe the swap');
  const [videoError, setVideoError] = useState('');
  const [outputURL, setOutputURL] = useState('');
  const [outputFrame, setOutputFrame] = useState('');
  const [poseError, setPoseError] = useState<number | null>(null);
  const [chargedUSD, setChargedUSD] = useState<number | null>(null);
  const [creditsUsed, setCreditsUsed] = useState<number | null>(null);

  useEffect(() => {
    const stored = loadStoredUser();
    setUser(stored);
    if (stored?.api_key) void refreshUser(stored.api_key).then((fresh) => { if (fresh) { setUser(fresh); saveUser(fresh); } });
    fetch('/api/pricing').then((response) => response.json()).then((data: { credit_price_usd?: number }) => {
      if (typeof data.credit_price_usd === 'number' && data.credit_price_usd > 0) setCreditPrice(data.credit_price_usd);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const currentUser = user || loadStoredUser();
    if (!videoURL || !swappedImageURL || !currentUser?.api_key) { setEstimate(null); return; }
    const sequence = ++estimateSequence.current;
    const timer = window.setTimeout(async () => {
      setEstimating(true);
      try {
        const payload = await parseJSONResponse<SwapEstimate>(
          await fetch('/api/character-swap/estimate', {
            method: 'POST',
            headers: { Authorization: `Bearer ${currentUser.api_key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(exact
              ? { video_url: videoURL, image_url: swappedImageURL, kind: 'exact', resolution, characters }
              : { video_url: videoURL, image_url: swappedImageURL, resolution, prompt: videoPrompt.trim(), include_audio: audioReference, max_quality: perShotFrames }),
          }),
          'Could not estimate the swap',
        );
        if (sequence === estimateSequence.current) setEstimate(payload);
      } catch {
        if (sequence === estimateSequence.current) setEstimate(null);
      } finally {
        if (sequence === estimateSequence.current) setEstimating(false);
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [videoURL, swappedImageURL, resolution, videoPrompt, audioReference, perShotFrames, characters, exact, user]);

  function resetSample() {
    estimateSequence.current += 1;
    setVideoURL(SAMPLE_VIDEO); setVideoLink('');
    setFrameURL(SAMPLE_FRAME); setFrameLink('');
    setSwappedImageURL(SAMPLE_SWAPPED); setSwappedLink('');
    setFrameGenerated(false); setDuration(0);
    setEstimate(null); setOutputURL(''); setOutputFrame(''); setPoseError(null);
    setChargedUSD(null); setCreditsUsed(null);
    setSourceError(''); setFrameError(''); setVideoError('');
    setPhase('idle'); setStatus('Describe the swap');
  }

  async function choose(next?: File) {
    if (!next) return;
    const accepted = ['video/mp4', 'video/webm', 'video/quicktime'].includes(next.type) || /\.(mp4|webm|mov)$/i.test(next.name);
    if (!accepted) { setSourceError('Choose an MP4, WebM, or MOV file.'); return; }
    const currentUser = user || loadStoredUser();
    if (!currentUser?.api_key) { setSourceError('Sign in to upload your own video.'); return; }
    setSourceError(''); setUploading(true);
    try {
      const { blob, duration: seconds } = await extractFirstFrame(next);
      const uploadedVideo = await uploadToR2(next, next.name, next.type || 'video/mp4', currentUser.api_key);
      const uploadedFrame = await uploadToR2(blob, 'frame.png', 'image/png', currentUser.api_key);
      setVideoURL(uploadedVideo); setVideoLink('');
      setFrameURL(uploadedFrame); setFrameLink('');
      setDuration(seconds);
      setSwappedImageURL(''); setSwappedLink(''); setFrameGenerated(false);
      setOutputURL(''); setOutputFrame(''); setPoseError(null);
    } catch (reason) {
      setSourceError(reason instanceof Error ? reason.message : 'Could not upload the video');
    } finally {
      setUploading(false);
    }
  }

  function useVideoLink() {
    const url = videoLink.trim();
    if (!url) return;
    estimateSequence.current += 1;
    setVideoURL(url);
    setFrameURL(''); setFrameLink('');
    setSwappedImageURL(''); setSwappedLink(''); setFrameGenerated(false);
    setDuration(0); setEstimate(null); setOutputURL(''); setOutputFrame(''); setPoseError(null);
    setSourceError('');
  }

  async function generateFrame() {
    const currentUser = user || loadStoredUser();
    if (!currentUser?.api_key) { setFrameError('Sign in to generate the character frame.'); return; }
    if (!frameURL) { setFrameError('Add a source frame first.'); return; }
    if (characterPrompt.trim().length < 10) { setFrameError('Describe the character swap in at least 10 characters.'); return; }
    setFrameError(''); setFrameBusy(true);
    try {
      const data = await parseJSONResponse<{ result?: unknown }>(
        await fetch('/api/service', {
          method: 'POST',
          headers: { Authorization: `Bearer ${currentUser.api_key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ service: 'image-edit', image_url: frameURL, prompt: characterPrompt.trim(), width: 1536, height: 1024, n: 1 }),
        }),
        'Could not redraw the frame',
      );
      const url = responseImage(data.result) || responseImage(data);
      if (!url) throw new Error('The edit completed without returning an image.');
      setSwappedImageURL(url); setSwappedLink(''); setFrameGenerated(true);
      const fresh = await refreshUser(currentUser.api_key);
      if (fresh) { setUser(fresh); saveUser(fresh); }
    } catch (reason) {
      setFrameError(reason instanceof Error ? reason.message : 'Could not redraw the frame');
    } finally {
      setFrameBusy(false);
    }
  }

  async function generateVideo() {
    const currentUser = user || loadStoredUser();
    if (!currentUser?.api_key) { setPhase('error'); setVideoError('Sign in to generate.'); return; }
    if (!videoURL) { setPhase('error'); setVideoError('Choose a source video first.'); return; }
    if (!swappedImageURL) { setPhase('error'); setVideoError('Generate the character frame first.'); return; }
    if (!exact && videoPrompt.trim().length < 10) { setPhase('error'); setVideoError('Describe the re-performance in at least 10 characters.'); return; }
    setVideoError(''); setOutputURL(''); setOutputFrame(''); setPoseError(null); setChargedUSD(null); setCreditsUsed(null);
    setPhase('queued'); setStatus('Job added');
    try {
      const queued = await parseJSONResponse<ServiceResponse>(
        await fetch('/api/service', {
          method: 'POST',
          headers: { Authorization: `Bearer ${currentUser.api_key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(exact
            ? {
              service: 'character_swap_video',
              video_url: videoURL,
              image_url: swappedImageURL,
              kind: 'exact',
              resolution,
              characters,
              character_prompt: characterPrompt.trim(),
            }
            : {
              service: 'character_swap_video',
              video_url: videoURL,
              image_url: swappedImageURL,
              prompt: videoPrompt.trim(),
              resolution,
              prompt_expansion_mode: 'disabled',
              include_audio: audioReference,
              max_quality: perShotFrames,
              character_prompt: characterPrompt.trim(),
            }),
        }),
        'Could not start the character swap',
      );
      const jobID = queued.result?.job_id;
      if (!jobID) throw new Error('The swap service returned no job');
      const statusURL = queued.result?.status_url || `/api/video-jobs/${encodeURIComponent(jobID)}`;
      for (let attempt = 0; attempt < 1200; attempt += 1) {
        const payload = await parseJSONResponse<JobPayload>(
          await fetch(statusURL, { headers: { Authorization: `Bearer ${currentUser.api_key}` } }),
          'Could not read the swap status',
        );
        const next = payload.job?.status || '';
        const result = payload.job?.result;
        if (next === 'completed') {
          const url = result?.video_url;
          if (!url) throw new Error('Generation completed without a video');
          setOutputURL(url);
          setOutputFrame(result?.swapped_image_url || swappedImageURL);
          setPoseError(typeof result?.pose_error === 'number' ? result.pose_error : null);
          setChargedUSD(result?.charged_usd ?? null);
          setCreditsUsed(result?.credits_used ?? null);
          setPhase('done'); setStatus('Music video ready');
          void refreshUser(currentUser.api_key).then((fresh) => { if (fresh) { setUser(fresh); saveUser(fresh); } });
          return;
        }
        if (next === 'failed' || next === 'payment_required') {
          throw new Error(payload.job?.error || (next === 'payment_required' ? 'Top up to render this video' : 'Character swap generation failed'));
        }
        setPhase(next === 'processing' ? 'processing' : 'queued');
        setStatus(next === 'processing' ? stageLabel(result, exact) : 'Job added');
        await sleep(3000);
      }
      throw new Error('The job remains available in your account');
    } catch (reason) {
      setPhase('error');
      setVideoError(reason instanceof Error ? reason.message : 'Character swap generation failed');
    }
  }

  const signedIn = Boolean(user?.api_key);
  const busy = phase === 'queued' || phase === 'processing';
  const frameCredits = Math.ceil(FRAME_PRICE_USD / (creditPrice || 0.01));
  const resolutionOptions = exact ? ['720p', '580p'] as const : ['768P', '2K'] as const;
  const estimateLine = estimating
    ? 'Pricing the swap…'
    : estimate && typeof estimate.estimated_credits === 'number' && typeof estimate.estimated_cost_usd === 'number'
      ? exact
        ? `≈ ${estimate.estimated_credits} credits ($${estimate.estimated_cost_usd.toFixed(2)}) · ${estimate.people ?? characters} performers · ${Math.round(estimate.source_seconds ?? 0)} s · about ${Math.max(1, Math.round((estimate.estimated_generation_seconds ?? 0) / 60))} min`
        : `≈ ${estimate.estimated_credits} credits ($${estimate.estimated_cost_usd.toFixed(2)}) · ${estimate.shots ?? 1} shots · ${estimate.chunks ?? '?'} clips · ${Math.round(estimate.source_seconds ?? 0)} s · about ${Math.max(1, Math.round((estimate.estimated_generation_seconds ?? 0) / 60))} min`
      : 'Estimate appears when signed in';

  return <>
    <section className={styles.hero}>
      <div className={styles.eyebrow}><Music4 size={13} /> {exact ? 'GPT IMAGE 2 FRAME · WAN 2.2 ANIMATE · EXACT MOTION · ORIGINAL AUDIO' : 'GPT IMAGE 2 FRAME · MINIMAX H3 RE-PERFORMANCE · ORIGINAL AUDIO'}</div>
      <h1>{exact ? 'Swap the performers. Keep every frame.' : 'Swap the performers, keep the performance.'}</h1>
      <p>{exact
        ? 'Each performer is replaced in the original footage with pose-exact motion transfer, one performer at a time, then composited back: identical choreography, cuts, camera moves and background, with the untouched soundtrack.'
        : 'Redraw the first frame with your new characters, then H3 re-performs the footage clip by clip: every clip gets the exact source motion, continues from the previous frame, is checked by a vision model, and the untouched original soundtrack goes back on top.'}</p>
      {exact
        ? <Link href="/tools/character-swap" className="mt-4 inline-block text-sm font-medium text-white/70 underline decoration-white/30 underline-offset-4 hover:text-white">Cheaper stylised re-performance: Character Swap (H3)</Link>
        : <Link href="/tools/character-swap-exact" className="mt-4 inline-block text-sm font-medium text-white/70 underline decoration-white/30 underline-offset-4 hover:text-white">Need frame-exact motion? Try the Exact Motion lane</Link>}
      <Link href="/tools/reference-video" className="mt-2 block text-sm font-medium text-white/70 underline decoration-white/30 underline-offset-4 hover:text-white">Want the most faithful performance with face-free characters? Try Reference Video Studio</Link>
    </section>
    <div className="mx-auto grid max-w-[1320px] gap-3.5 px-6 pb-16">
      <div className={styles.panel}>
        <div className={styles.panelHead}><div><span>EXAMPLE OUTPUT</span><h2>Source rappers → Elon Musk + Optimus</h2></div><Clapperboard size={17} /></div>
        <div className={styles.output}>
          <div className={styles.outputHead}><span>SAMPLE SWAP</span><span className={styles.ready}>READY</span></div>
          <video data-testid="swap-example" src={exact ? SAMPLE_OUTPUT_EXACT : SAMPLE_OUTPUT} muted autoPlay loop playsInline controls />
          <div className={styles.price} style={{ padding: '0 12px 12px' }}><span>{exact ? 'Frame-exact: same dance, same cuts, same room' : 'Same moves, same track'}</span><span>1280×720 · 24 fps</span></div>
        </div>
      </div>
      <div className={styles.panel}>
        <div className={styles.panelHead}><div><span>01 / SOURCE</span><h2>Source video</h2></div><Clapperboard size={17} /></div>
        <div className={styles.output}>
          <div className={styles.outputHead}><span>SOURCE PREVIEW</span><span className={videoURL ? styles.ready : ''}>{videoURL ? 'LOADED' : 'WAITING'}</span></div>
          {videoURL
            ? <video data-testid="swap-video" key={videoURL} src={videoURL} controls muted playsInline onLoadedMetadata={(event) => { if (!duration) setDuration(event.currentTarget.duration); }} />
            : <div className={`${styles.empty} p-8`}><p>No source yet.</p></div>}
        </div>
        {duration > 0 && <div className={styles.price}><span>Source length</span><span>{duration.toFixed(1)} s</span></div>}
        {frameURL && <div className={styles.output}>
          <div className={styles.outputHead}><span>REFERENCE FRAME</span><span className={styles.ready}>EXTRACTED</span></div>
          <img data-testid="swap-frame" src={frameURL} alt="Reference frame of the source video" />
        </div>}
        <input ref={inputRef} type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov" hidden
          onChange={(event: ChangeEvent<HTMLInputElement>) => { void choose(event.target.files?.[0]); event.target.value = ''; }} />
        <button type="button" className={styles.run} disabled={uploading}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event: DragEvent<HTMLButtonElement>) => { event.preventDefault(); void choose(event.dataTransfer.files[0]); }}>
          {uploading ? <LoaderCircle className={styles.spin} size={17} /> : <Download size={16} />}{uploading ? 'Uploading and extracting the frame…' : 'Use your own video'}
        </button>
        <div className={styles.price}><span>MP4 · WebM · MOV · 5–60 s</span><span>Frame extracted automatically</span></div>
        <label className={styles.field}>Or paste a public video URL
          <input data-testid="swap-video-url" type="url" value={videoLink} disabled={uploading}
            onChange={(event) => setVideoLink(event.target.value)} placeholder="https://example.com/performance.mp4" />
        </label>
        {videoLink.trim() && <div className={styles.chips}><button type="button" disabled={uploading} onClick={useVideoLink}>Use this URL</button></div>}
        <label className={styles.field}>Frame image URL
          <input data-testid="swap-frame-url" type="url" value={frameLink} disabled={uploading}
            onChange={(event) => { setFrameLink(event.target.value); if (event.target.value.trim()) setFrameURL(event.target.value.trim()); }}
            placeholder="https://example.com/frame.png" />
        </label>
        <div className={styles.chips}><button type="button" disabled={uploading} onClick={resetSample}>Restore sample video</button></div>
        {sourceError && <div data-testid="swap-source-error" className={styles.error}>{sourceError}</div>}
      </div>
      <div className={styles.panel}>
        <div className={styles.panelHead}><div><span>02 / FRAME</span><h2>Redraw the first frame with GPT Image 2</h2></div><ImageIcon size={17} /></div>
        <label className={styles.field}>Character swap prompt
          <textarea data-testid="swap-character-prompt" rows={6} maxLength={2000} disabled={frameBusy}
            value={characterPrompt} onChange={(event) => setCharacterPrompt(event.target.value)} placeholder={DEFAULT_CHARACTER_PROMPT} />
        </label>
        {!frameURL && <div className={styles.error}>Upload a file to extract the frame automatically, or paste a frame image URL.</div>}
        {signedIn
          ? <button data-testid="swap-frame-run" className={styles.run} type="button" disabled={frameBusy || !frameURL || characterPrompt.trim().length < 10} onClick={() => void generateFrame()}>
            {frameBusy ? <LoaderCircle className={styles.spin} size={17} /> : <Sparkles size={16} />}{frameBusy ? 'Redrawing the frame…' : `${frameGenerated ? 'Regenerate' : 'Generate'} character frame · ${frameCredits} credits ($${FRAME_PRICE_USD.toFixed(2)})`}
          </button>
          : <Link data-testid="swap-frame-run" href="/account" className={styles.run}>Sign in to generate</Link>}
        <label className={styles.field}>Or paste an image URL
          <input data-testid="swap-image-url" type="url" value={swappedLink} disabled={frameBusy}
            onChange={(event) => { setSwappedLink(event.target.value); if (event.target.value.trim()) { setSwappedImageURL(event.target.value.trim()); setFrameGenerated(false); } }}
            placeholder="https://example.com/swapped-characters.png" />
        </label>
        {frameError && <div data-testid="swap-frame-error" className={styles.error}>{frameError}</div>}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className={styles.output}>
            <div className={styles.outputHead}><span>BEFORE</span><span>SOURCE FRAME</span></div>
            {frameURL ? <img src={frameURL} alt="Source frame" /> : <div className={`${styles.empty} p-8`}><p>No frame yet.</p></div>}
          </div>
          <div className={styles.output}>
            <div className={styles.outputHead}><span>AFTER</span><span className={swappedImageURL ? styles.ready : ''}>{swappedImageURL ? 'READY' : frameBusy ? 'GENERATING' : 'WAITING'}</span></div>
            {swappedImageURL
              ? <img data-testid="swap-swapped" src={swappedImageURL} alt="Frame with swapped characters" />
              : <div className={`${styles.empty} p-8`}>{frameBusy ? <><LoaderCircle className={styles.spin} size={22} /><p>Redrawing…</p></> : <p>The swapped frame will appear here.</p>}</div>}
          </div>
        </div>
      </div>
      <div className={styles.panel}>
        <div className={styles.panelHead}><div><span>03 / VIDEO</span><h2>{exact ? 'Replace the performers with Wan 2.2 Animate' : 'Re-perform the video with MiniMax H3'}</h2></div><Sparkles size={17} /></div>
        {!exact && <label className={styles.field}>Re-performance prompt
          <textarea data-testid="swap-video-prompt" rows={6} maxLength={2000} disabled={busy}
            value={videoPrompt} onChange={(event) => setVideoPrompt(event.target.value)} placeholder={DEFAULT_VIDEO_PROMPT} />
        </label>}
        <div className={styles.segment}>
          {resolutionOptions.map((value) => <button key={value} type="button" disabled={busy}
            className={resolution === value ? styles.active : ''} onClick={() => setResolution(value)}>{exact ? value.toUpperCase() : value}</button>)}
        </div>
        {exact && <label className={styles.field}>Performers to replace
          <input data-testid="swap-characters" type="number" min={1} max={3} step={1} value={characters} disabled={busy} style={{ maxWidth: 120 }}
            onChange={(event) => setCharacters(Math.min(3, Math.max(1, Math.floor(Number(event.target.value) || 1))))} />
        </label>}
        {!exact && <label className={styles.field} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <input data-testid="swap-per-shot" type="checkbox" checked={perShotFrames} disabled={busy} onChange={(event) => setPerShotFrames(event.target.checked)} />
          Experimental: redraw one frame per detected shot so close-ups and angles follow each cut (+$0.30 per extra shot; the set can drift between shots)
        </label>}
        {!exact && <label className={styles.field} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <input data-testid="swap-audio" type="checkbox" checked={audioReference} disabled={busy} onChange={(event) => setAudioReference(event.target.checked)} />
          Also give H3 the song as an audio reference (experimental lip-sync guidance)
        </label>}
        <div className={styles.price}><span>{estimateLine}</span><span>{exact ? '$0.24 per second per performer at 720P, $0.18 at 580P' : `${resolution} · $0.20/s${resolution === '2K' ? ' → $0.36/s' : ''}`}</span></div>
        {signedIn
          ? <button data-testid="swap-run" className={styles.run} type="button" disabled={busy || !videoURL || !swappedImageURL || (!exact && videoPrompt.trim().length < 10)} onClick={() => void generateVideo()}>
            {busy ? <LoaderCircle className={styles.spin} size={17} /> : <Sparkles size={16} />}{busy ? status : 'Generate music video'}
          </button>
          : <Link data-testid="swap-run" href="/account" className={styles.run}>Sign in to generate</Link>}
        {videoError && <div data-testid="swap-error" className={styles.error}>{videoError}</div>}
        <div className={styles.output}>
          <div className={styles.outputHead}><span>SWAPPED VIDEO</span><span className={outputURL ? styles.ready : ''}>{outputURL ? 'READY' : busy ? 'GENERATING' : 'WAITING'}</span></div>
          {outputURL
            ? <>
              <video data-testid="swap-output" src={outputURL} controls playsInline />
              <a className={styles.download} href={outputURL} download><Download size={14} /> Download MP4</a>
            </>
            : <div className={`${styles.empty} p-8`}>{busy ? <><LoaderCircle className={styles.spin} size={22} /><p>{status}</p></> : <p>No video yet. Finish steps 1–2, then render.</p>}</div>}
        </div>
        {exact && poseError !== null && <div className={styles.price}><span>Motion match: {((1 - Math.min(poseError, 1)) * 100 | 0)}% (joint error {poseError.toFixed(3)})</span></div>}
        {outputURL && <div className={styles.price}>
          <span>1280×720 · 24 fps · H.264 + AAC · original audio · ready for X/Twitter</span>
          <span>{creditsUsed === null ? '' : `${Math.ceil(creditsUsed)} credits used`}{chargedUSD === null ? '' : ` · $${chargedUSD.toFixed(2)}`}</span>
        </div>}
        {outputFrame && <div className={styles.output}>
          <div className={styles.outputHead}><span>SWAPPED FRAME</span><span className={styles.ready}><Check size={11} /></span></div>
          <img src={outputFrame} alt="Swapped character frame" />
        </div>}
        {phase === 'done' && <div className={styles.price}><span><Check size={11} /> Swap complete</span><span>{resolution}</span></div>}
      </div>
    </div>
  </>;
}
