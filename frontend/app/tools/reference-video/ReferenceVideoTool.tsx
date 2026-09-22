'use client';

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import Link from 'next/link';
import { Clapperboard, Download, Image as ImageIcon, LoaderCircle, Music4, Sparkles, Video, X } from 'lucide-react';
import { loadStoredUser, refreshUser, saveUser, type StoredUser } from '../../../lib/auth';
import { parseJSONResponse } from '../../../lib/http';
import styles from '../audio-spaces.module.css';

export type ReferenceVideoModel = 'mini' | 'pro';
export type ReferenceVideoResolution = '480p' | '720p' | '1080p';
export type ReferenceVideoAspect = 'auto' | '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9';

export const REFERENCE_VIDEO_MAX_IMAGES = 9;
export const REFERENCE_VIDEO_MAX_VIDEOS = 3;
export const REFERENCE_VIDEO_MAX_AUDIOS = 3;

export const REFERENCE_VIDEO_RESOLUTIONS: Record<ReferenceVideoModel, ReferenceVideoResolution[]> = {
  mini: ['480p', '720p'],
  pro: ['480p', '720p', '1080p'],
};

export function resolutionsForModel(model: ReferenceVideoModel): ReferenceVideoResolution[] {
  return [...(REFERENCE_VIDEO_RESOLUTIONS[model] ?? REFERENCE_VIDEO_RESOLUTIONS.mini)];
}

export function clampResolutionForModel(model: ReferenceVideoModel, resolution: string): ReferenceVideoResolution {
  const allowed = resolutionsForModel(model);
  return (allowed as string[]).includes(resolution) ? (resolution as ReferenceVideoResolution) : '720p';
}

export type ReferenceVideoRequestBody = {
  service: 'reference-video';
  prompt: string;
  reference_image_urls: string[];
  reference_video_urls: string[];
  reference_audio_urls: string[];
  model: ReferenceVideoModel;
  resolution: ReferenceVideoResolution;
  duration: number;
  aspect_ratio: ReferenceVideoAspect;
  include_audio: boolean;
  preserve_audio: boolean;
};

export function buildReferenceVideoBody(input: {
  prompt: string;
  imageUrls: string[];
  videoUrls: string[];
  audioUrls: string[];
  model: ReferenceVideoModel;
  resolution: string;
  duration: number;
  aspectRatio: ReferenceVideoAspect;
  includeAudio: boolean;
  preserveAudio: boolean;
}): ReferenceVideoRequestBody {
  const take = (list: string[], max: number): string[] =>
    list.map((item) => item.trim()).filter(Boolean).slice(0, max);
  const duration = Math.floor(input.duration);
  return {
    service: 'reference-video',
    prompt: input.prompt.trim(),
    reference_image_urls: take(input.imageUrls, REFERENCE_VIDEO_MAX_IMAGES),
    reference_video_urls: take(input.videoUrls, REFERENCE_VIDEO_MAX_VIDEOS),
    reference_audio_urls: take(input.audioUrls, REFERENCE_VIDEO_MAX_AUDIOS),
    model: input.model,
    resolution: clampResolutionForModel(input.model, input.resolution),
    duration: duration <= 0 ? 0 : Math.min(15, Math.max(4, duration)),
    aspect_ratio: input.aspectRatio,
    include_audio: input.includeAudio,
    preserve_audio: input.preserveAudio,
  };
}

type Phase = 'idle' | 'queued' | 'processing' | 'done' | 'error';

type ReferenceVideoEstimate = {
  estimated_cost_usd?: number;
  estimated_credits?: number;
  segments?: number;
  long?: boolean;
  output_seconds?: number;
  reference_video_seconds?: number;
  usd_per_output_second?: number;
  usd_per_reference_video_second?: number;
  keeps_soundtrack?: boolean;
  estimated_generation_seconds?: number;
};

type ServiceResponse = {
  result?: { job_id?: string; status?: string; status_url?: string; stage?: string };
};

type JobResult = {
  stage?: string;
  segments_total?: number;
  segments_completed?: number;
  segments?: number;
  video_url?: string;
  duration_seconds?: number;
  charged_usd?: number;
  credits_used?: number;
};

type JobPayload = { job?: { status?: string; error?: string; result?: JobResult } };

type VideoRef = { url: string; duration: number };
type AudioRef = { url: string; fromVideo: boolean };

const SAMPLE_OUTPUT = 'https://manifoldgenstatic.manifoldgen.com/static/tools/reference-video/rapvid-optimus-seedance.mp4';
const EXAMPLE_IMAGE = 'https://manifoldgenstatic.manifoldgen.com/static/tools/reference-video/optimus-reference.jpg';
const EXAMPLE_VIDEO = 'https://manifoldgenstatic.manifoldgen.com/static/tools/character-swap/rapvid-source.mp4';
const EXAMPLE_PROMPT = 'Recreate @Video1 shot for shot. The shirtless man on the left becomes a tech entrepreneur in his fifties: short dark swept-back hair, clean-shaven, black blazer over a black t-shirt. The man on the right becomes the white-and-black humanoid robot from @Image1: glossy black faceless visor, white and black body panels, mechanical hands, no human face. Keep every dance move, gesture, mouth movement, camera cut, framing and timing of @Video1 exactly, the vivid orange studio wall and the hanging silver microphone. The man sings @Audio1 with accurate lip sync. Photorealistic music video, sharp.';
const PROMPT_PLACEHOLDER = 'Recreate @Video1 shot for shot with the robot from @Image1 ...';
const REAL_PEOPLE_HINT = 'Seedance rejects photos of real people and prompts that name them. Use face-free references (robots, characters, products, scenes) and describe people in words.';

function sleep(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  window.setTimeout(resolve, ms);
  return promise;
}

function stageLabel(result?: JobResult): string {
  switch (result?.stage) {
    case 'prepare': return 'Preparing references';
    case 'mux': return 'Joining segments and laying the soundtrack back on';
    case 'video': {
      const total = result?.segments_total ?? result?.segments ?? 0;
      const done = result?.segments_completed ?? 0;
      return total > 0 ? `Rendering segment ${done}/${total}` : 'Rendering video';
    }
    default: return 'Working…';
  }
}

function looksLikeVideoURL(url: string): boolean {
  return /\.(mp4|mov|webm|m4v)(\?|#|$)/i.test(url);
}

export default function ReferenceVideoTool() {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const estimateSequence = useRef(0);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [imageLink, setImageLink] = useState('');
  const [videos, setVideos] = useState<VideoRef[]>([]);
  const [videoLink, setVideoLink] = useState('');
  const [audios, setAudios] = useState<AudioRef[]>([]);
  const [audioLink, setAudioLink] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [slotError, setSlotError] = useState('');
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<ReferenceVideoModel>('mini');
  const [resolution, setResolution] = useState<ReferenceVideoResolution>('720p');
  const [duration, setDuration] = useState(0);
  const [aspectRatio, setAspectRatio] = useState<ReferenceVideoAspect>('auto');
  const [preserveAudio, setPreserveAudio] = useState(true);
  const [includeAudio, setIncludeAudio] = useState(false);
  const [estimate, setEstimate] = useState<ReferenceVideoEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [status, setStatus] = useState('Direct the video');
  const [jobError, setJobError] = useState('');
  const [outputURL, setOutputURL] = useState('');
  const [outputSeconds, setOutputSeconds] = useState<number | null>(null);
  const [chargedUSD, setChargedUSD] = useState<number | null>(null);
  const [creditsUsed, setCreditsUsed] = useState<number | null>(null);
  const [segmentsTotal, setSegmentsTotal] = useState<number | null>(null);

  useEffect(() => {
    const stored = loadStoredUser();
    setUser(stored);
    if (stored?.api_key) void refreshUser(stored.api_key).then((fresh) => { if (fresh) { setUser(fresh); saveUser(fresh); } });
  }, []);

  const imageUrls = images.join('\n');
  const videoUrls = videos.map((video) => video.url).join('\n');
  const audioUrls = audios.map((audio) => audio.url).join('\n');

  useEffect(() => {
    const currentUser = user || loadStoredUser();
    const imageList = imageUrls ? imageUrls.split('\n') : [];
    const videoList = videoUrls ? videoUrls.split('\n') : [];
    const audioList = audioUrls ? audioUrls.split('\n') : [];
    if ((!imageList.length && !videoList.length) || !prompt.trim() || !currentUser?.api_key) { setEstimate(null); return; }
    const sequence = ++estimateSequence.current;
    const timer = window.setTimeout(async () => {
      setEstimating(true);
      try {
        const payload = await parseJSONResponse<ReferenceVideoEstimate>(
          await fetch('/api/reference-video/estimate', {
            method: 'POST',
            headers: { Authorization: `Bearer ${currentUser.api_key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(buildReferenceVideoBody({
              prompt, imageUrls: imageList, videoUrls: videoList, audioUrls: audioList,
              model, resolution, duration, aspectRatio, includeAudio, preserveAudio,
            })),
          }),
          'Could not estimate the video',
        );
        if (sequence === estimateSequence.current) setEstimate(payload);
      } catch {
        if (sequence === estimateSequence.current) setEstimate(null);
      } finally {
        if (sequence === estimateSequence.current) setEstimating(false);
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [imageUrls, videoUrls, audioUrls, prompt, model, resolution, duration, aspectRatio, includeAudio, preserveAudio, user]);

  async function uploadFile(file: File): Promise<string> {
    const currentUser = user || loadStoredUser();
    if (!currentUser?.api_key) throw new Error('Sign in to upload reference files.');
    const params = new URLSearchParams({ filename: file.name, content_type: file.type || 'application/octet-stream', dataset: 'reference-video' });
    const prepared = await parseJSONResponse<{ upload_url?: string; public_url?: string }>(
      await fetch(`/api/uploads/presign?${params}`, { headers: { Authorization: `Bearer ${currentUser.api_key}` } }),
      'Could not prepare the upload',
    );
    if (!prepared.upload_url || !prepared.public_url) throw new Error('Upload service returned no destination');
    const response = await fetch(prepared.upload_url, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
    if (!response.ok) throw new Error(`Upload failed (${response.status})`);
    return prepared.public_url;
  }

  async function addImageFiles(files: FileList | File[]) {
    const list = [...files];
    if (!list.length) return;
    if (images.length + list.length > REFERENCE_VIDEO_MAX_IMAGES) { setSlotError(`At most ${REFERENCE_VIDEO_MAX_IMAGES} reference images.`); return; }
    if (!list.every((file) => file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|avif)$/i.test(file.name))) {
      setSlotError('Images must be image files (PNG, JPG, WebP).'); return;
    }
    setSlotError(''); setUploadingImage(true);
    try {
      const urls: string[] = [];
      for (const file of list) urls.push(await uploadFile(file));
      setImages((prev) => [...prev, ...urls].slice(0, REFERENCE_VIDEO_MAX_IMAGES));
    } catch (reason) {
      setSlotError(reason instanceof Error ? reason.message : 'Could not upload the images');
    } finally {
      setUploadingImage(false);
    }
  }

  async function addVideoFiles(files: FileList | File[]) {
    const list = [...files];
    if (!list.length) return;
    if (videos.length + list.length > REFERENCE_VIDEO_MAX_VIDEOS) { setSlotError(`At most ${REFERENCE_VIDEO_MAX_VIDEOS} reference videos.`); return; }
    if (!list.every((file) => file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/i.test(file.name))) {
      setSlotError('Videos must be video files (MP4, MOV, WebM).'); return;
    }
    setSlotError(''); setUploadingVideo(true);
    try {
      const refs: VideoRef[] = [];
      for (const file of list) refs.push({ url: await uploadFile(file), duration: 0 });
      setVideos((prev) => [...prev, ...refs].slice(0, REFERENCE_VIDEO_MAX_VIDEOS));
    } catch (reason) {
      setSlotError(reason instanceof Error ? reason.message : 'Could not upload the videos');
    } finally {
      setUploadingVideo(false);
    }
  }

  async function addAudioFiles(files: FileList | File[]) {
    const list = [...files];
    if (!list.length) return;
    if (audios.length + list.length > REFERENCE_VIDEO_MAX_AUDIOS) { setSlotError(`At most ${REFERENCE_VIDEO_MAX_AUDIOS} audio references.`); return; }
    if (!list.every((file) => file.type.startsWith('audio/') || file.type.startsWith('video/') || /\.(mp3|wav|ogg|m4a|flac|mp4|mov|webm|m4v)$/i.test(file.name))) {
      setSlotError('Audio references must be audio or video files.'); return;
    }
    setSlotError(''); setUploadingAudio(true);
    try {
      const refs: AudioRef[] = [];
      for (const file of list) refs.push({ url: await uploadFile(file), fromVideo: file.type.startsWith('video/') });
      setAudios((prev) => [...prev, ...refs].slice(0, REFERENCE_VIDEO_MAX_AUDIOS));
    } catch (reason) {
      setSlotError(reason instanceof Error ? reason.message : 'Could not upload the audio');
    } finally {
      setUploadingAudio(false);
    }
  }

  function addImageLink() {
    const url = imageLink.trim();
    if (!url) return;
    if (images.length >= REFERENCE_VIDEO_MAX_IMAGES) { setSlotError(`At most ${REFERENCE_VIDEO_MAX_IMAGES} reference images.`); return; }
    setImages((prev) => [...prev, url]); setImageLink(''); setSlotError('');
  }

  function addVideoLink() {
    const url = videoLink.trim();
    if (!url) return;
    if (videos.length >= REFERENCE_VIDEO_MAX_VIDEOS) { setSlotError(`At most ${REFERENCE_VIDEO_MAX_VIDEOS} reference videos.`); return; }
    setVideos((prev) => [...prev, { url, duration: 0 }]); setVideoLink(''); setSlotError('');
  }

  function addAudioLink() {
    const url = audioLink.trim();
    if (!url) return;
    if (audios.length >= REFERENCE_VIDEO_MAX_AUDIOS) { setSlotError(`At most ${REFERENCE_VIDEO_MAX_AUDIOS} audio references.`); return; }
    setAudios((prev) => [...prev, { url, fromVideo: looksLikeVideoURL(url) }]); setAudioLink(''); setSlotError('');
  }

  function useVideo1Soundtrack() {
    const first = videos[0]?.url;
    if (!first) return;
    if (audios.some((audio) => audio.url === first)) return;
    if (audios.length >= REFERENCE_VIDEO_MAX_AUDIOS) { setSlotError(`At most ${REFERENCE_VIDEO_MAX_AUDIOS} audio references.`); return; }
    setAudios((prev) => [...prev, { url: first, fromVideo: true }]); setSlotError('');
  }

  function insertTag(tag: string) {
    const area = promptRef.current;
    if (!area) { setPrompt((prev) => (prev ? `${prev} ${tag}` : tag)); return; }
    const start = area.selectionStart ?? prompt.length;
    const end = area.selectionEnd ?? prompt.length;
    const next = `${prompt.slice(0, start)}${tag}${prompt.slice(end)}`;
    setPrompt(next);
    requestAnimationFrame(() => { area.focus(); area.setSelectionRange(start + tag.length, start + tag.length); });
  }

  function loadExample() {
    estimateSequence.current += 1;
    setImages([EXAMPLE_IMAGE]); setImageLink('');
    setVideos([{ url: EXAMPLE_VIDEO, duration: 0 }]); setVideoLink('');
    setAudios([{ url: EXAMPLE_VIDEO, fromVideo: true }]); setAudioLink('');
    setPrompt(EXAMPLE_PROMPT);
    setModel('mini'); setResolution('720p'); setDuration(0); setAspectRatio('auto');
    setPreserveAudio(true); setIncludeAudio(false);
    setEstimate(null); setOutputURL(''); setOutputSeconds(null);
    setChargedUSD(null); setCreditsUsed(null); setSegmentsTotal(null);
    setSlotError(''); setJobError(''); setPhase('idle'); setStatus('Direct the video');
  }

  async function generate() {
    const currentUser = user || loadStoredUser();
    if (!currentUser?.api_key) { setPhase('error'); setJobError('Sign in to generate.'); return; }
    if (!images.length && !videos.length) { setPhase('error'); setJobError('Add at least one reference image or video.'); return; }
    if (!prompt.trim()) { setPhase('error'); setJobError('Describe the video first.'); return; }
    setJobError(''); setOutputURL(''); setOutputSeconds(null); setChargedUSD(null); setCreditsUsed(null); setSegmentsTotal(null);
    setPhase('queued'); setStatus('Job added');
    try {
      const queued = await parseJSONResponse<ServiceResponse>(
        await fetch('/api/service', {
          method: 'POST',
          headers: { Authorization: `Bearer ${currentUser.api_key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(buildReferenceVideoBody({
            prompt,
            imageUrls: images,
            videoUrls: videos.map((video) => video.url),
            audioUrls: audios.map((audio) => audio.url),
            model, resolution, duration, aspectRatio, includeAudio, preserveAudio,
          })),
        }),
        'Could not start the reference video',
      );
      const jobID = queued.result?.job_id;
      if (!jobID) throw new Error('The reference video service returned no job');
      const statusURL = queued.result?.status_url || `/api/video-jobs/${encodeURIComponent(jobID)}`;
      for (let attempt = 0; attempt < 1200; attempt += 1) {
        const payload = await parseJSONResponse<JobPayload>(
          await fetch(statusURL, { headers: { Authorization: `Bearer ${currentUser.api_key}` } }),
          'Could not read the video status',
        );
        const next = payload.job?.status || '';
        const result = payload.job?.result;
        if (next === 'completed') {
          const url = result?.video_url;
          if (!url) throw new Error('Generation completed without a video');
          setOutputURL(url);
          setOutputSeconds(typeof result?.duration_seconds === 'number' ? result.duration_seconds : null);
          setChargedUSD(typeof result?.charged_usd === 'number' ? result.charged_usd : null);
          setCreditsUsed(typeof result?.credits_used === 'number' ? result.credits_used : null);
          setSegmentsTotal(typeof result?.segments_total === 'number' ? result.segments_total : (typeof result?.segments === 'number' ? result.segments : null));
          setPhase('done'); setStatus('Video ready');
          void refreshUser(currentUser.api_key).then((fresh) => { if (fresh) { setUser(fresh); saveUser(fresh); } });
          return;
        }
        if (next === 'failed' || next === 'payment_required') {
          throw new Error(payload.job?.error || (next === 'payment_required' ? 'Top up to render this video' : 'Reference video generation failed'));
        }
        setPhase(next === 'processing' ? 'processing' : 'queued');
        setStatus(next === 'processing' ? stageLabel(result) : 'Job added');
        await sleep(3000);
      }
      throw new Error('The job remains available in your account');
    } catch (reason) {
      setPhase('error');
      setJobError(reason instanceof Error ? reason.message : 'Reference video generation failed');
    }
  }

  const signedIn = Boolean(user?.api_key);
  const busy = phase === 'queued' || phase === 'processing';
  const uploadingAny = uploadingImage || uploadingVideo || uploadingAudio;
  const resolutionOptions = resolutionsForModel(model);
  const canGenerate = !busy && !uploadingAny && (images.length > 0 || videos.length > 0) && prompt.trim().length > 0;
  const totalVideoSeconds = videos.reduce((sum, video) => sum + (Number.isFinite(video.duration) ? video.duration : 0), 0);
  const estimateLine = estimating
    ? 'Pricing the video…'
    : estimate && typeof estimate.estimated_credits === 'number' && typeof estimate.estimated_cost_usd === 'number'
      ? `≈ ${estimate.estimated_credits} credits ($${estimate.estimated_cost_usd.toFixed(2)}) · ${Math.round(estimate.output_seconds ?? 0)} s output · ${estimate.segments ?? 1} segment${(estimate.segments ?? 1) === 1 ? '' : 's'} · about ${Math.max(1, Math.round((estimate.estimated_generation_seconds ?? 0) / 60))} min`
      : signedIn ? 'Add a reference and a prompt for a price' : 'Estimate appears when signed in';
  const rateLine = estimate && typeof estimate.usd_per_output_second === 'number' && typeof estimate.usd_per_reference_video_second === 'number'
    ? `$${estimate.usd_per_output_second.toFixed(3)}/s output · $${estimate.usd_per_reference_video_second.toFixed(3)}/s reference video${estimate.long ? ' · long reference, split at cuts' : ''}`
    : `${model} · ${resolution}${duration === 0 ? ' · match reference' : ` · ${duration}s`}`;

  return <>
    <section className={styles.hero}>
      <div className={styles.eyebrow}><Clapperboard size={13} /> SEEDANCE 2.0 · IMAGE + VIDEO + AUDIO REFERENCES</div>
      <h1>Direct a video from references.</h1>
      <p>Cast up to 9 reference images, point Seedance 2.0 at a motion reference video, and lay a soundtrack underneath: the model follows the choreography, cuts and camera of your video while your images set the cast and look. A single reference video up to 60 seconds is split at its cuts into short segments and joined back together.</p>
    </section>
    <div className="mx-auto grid max-w-[1320px] gap-3.5 px-6 pb-16">
      <div className={styles.panel}>
        <div className={styles.panelHead}><div><span>EXAMPLE OUTPUT</span><h2>Robot steps into the performance</h2></div><Clapperboard size={17} /></div>
        <div className={styles.output}>
          <div className={styles.outputHead}><span>SAMPLE VIDEO</span><span className={styles.ready}>READY</span></div>
          <video data-testid="rv-example" src={SAMPLE_OUTPUT} muted autoPlay loop playsInline controls />
          <div className={styles.price} style={{ padding: '0 12px 12px' }}><span>Robot reference image + source performance video + its own soundtrack</span><span>Seedance 2.0</span></div>
        </div>
      </div>
      <div className={styles.panel}>
        <div className={styles.panelHead}><div><span>01 / IMAGES</span><h2>Reference images · @Image1–@Image9</h2></div><ImageIcon size={17} /></div>
        {images.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {images.map((url, index) => (
            <div key={`${url}-${index}`} style={{ position: 'relative' }}>
              <img src={url} alt={`Reference image ${index + 1}`} style={{ display: 'block', width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8 }} />
              <span style={{ position: 'absolute', left: 6, bottom: 6, padding: '2px 7px', borderRadius: 999, background: 'rgba(0,0,0,.7)', fontSize: 10, fontWeight: 700 }}>@Image{index + 1}</span>
              <button type="button" aria-label={`Remove image ${index + 1}`} disabled={busy}
                onClick={() => setImages((prev) => prev.filter((_, i) => i !== index))}
                style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, display: 'grid', placeItems: 'center', borderRadius: '50%', border: 0, background: 'rgba(0,0,0,.7)', color: '#fff', cursor: 'pointer' }}><X size={12} /></button>
            </div>
          ))}
        </div>}
        <input ref={imageInputRef} type="file" accept="image/*" multiple hidden
          onChange={(event: ChangeEvent<HTMLInputElement>) => { void addImageFiles(event.target.files ?? []); event.target.value = ''; }} />
        <button type="button" className={styles.run} disabled={uploadingImage || busy}
          onClick={() => imageInputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event: DragEvent<HTMLButtonElement>) => { event.preventDefault(); void addImageFiles(event.dataTransfer.files); }}>
          {uploadingImage ? <LoaderCircle className={styles.spin} size={17} /> : <ImageIcon size={16} />}{uploadingImage ? 'Uploading images…' : 'Add files'}
        </button>
        <div className={styles.price}><span>PNG · JPG · WebP · up to 9</span><span>{images.length}/9</span></div>
        <label className={styles.field}>Or paste an image URL
          <input data-testid="rv-image-url" type="url" value={imageLink} disabled={uploadingImage || busy}
            onChange={(event) => setImageLink(event.target.value)} placeholder="https://example.com/robot.png" />
        </label>
        {imageLink.trim() && <div className={styles.chips}><button type="button" disabled={uploadingImage || busy} onClick={addImageLink}>Use this URL</button></div>}
        <div className={styles.price}><span>{REAL_PEOPLE_HINT}</span></div>
      </div>
      <div className={styles.panel}>
        <div className={styles.panelHead}><div><span>02 / VIDEO</span><h2>Motion reference · @Video1–@Video3</h2></div><Video size={17} /></div>
        {videos.map((video, index) => (
          <div key={`${video.url}-${index}`} className={styles.output}>
            <div className={styles.outputHead}><span>@Video{index + 1}{video.duration > 0 ? ` · ${video.duration.toFixed(1)} s` : ''}</span>
              <button type="button" aria-label={`Remove video ${index + 1}`} disabled={busy}
                onClick={() => setVideos((prev) => prev.filter((_, i) => i !== index))}
                style={{ display: 'grid', placeItems: 'center', width: 22, height: 22, borderRadius: '50%', border: 0, background: 'rgba(255,255,255,.08)', color: '#fff', cursor: 'pointer' }}><X size={12} /></button>
            </div>
            <video src={video.url} muted controls playsInline preload="metadata"
              onLoadedMetadata={(event) => {
                const seconds = event.currentTarget.duration;
                if (Number.isFinite(seconds)) setVideos((prev) => prev.map((item, i) => (i === index ? { ...item, duration: seconds } : item)));
              }} />
          </div>
        ))}
        {videos.length === 0 && <div className={`${styles.empty} p-8`}><p>No motion reference yet.</p></div>}
        <input ref={videoInputRef} type="file" accept="video/*" multiple hidden
          onChange={(event: ChangeEvent<HTMLInputElement>) => { void addVideoFiles(event.target.files ?? []); event.target.value = ''; }} />
        <button type="button" className={styles.run} disabled={uploadingVideo || busy}
          onClick={() => videoInputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event: DragEvent<HTMLButtonElement>) => { event.preventDefault(); void addVideoFiles(event.dataTransfer.files); }}>
          {uploadingVideo ? <LoaderCircle className={styles.spin} size={17} /> : <Video size={16} />}{uploadingVideo ? 'Uploading videos…' : 'Add files'}
        </button>
        <div className={styles.price}><span>2–15 s total, or one video up to 60 s</span><span>{totalVideoSeconds > 0 ? `${totalVideoSeconds.toFixed(1)} s` : `${videos.length}/3`}</span></div>
        <label className={styles.field}>Or paste a video URL
          <input data-testid="rv-video-url" type="url" value={videoLink} disabled={uploadingVideo || busy}
            onChange={(event) => setVideoLink(event.target.value)} placeholder="https://example.com/performance.mp4" />
        </label>
        {videoLink.trim() && <div className={styles.chips}><button type="button" disabled={uploadingVideo || busy} onClick={addVideoLink}>Use this URL</button></div>}
      </div>
      <div className={styles.panel}>
        <div className={styles.panelHead}><div><span>03 / AUDIO</span><h2>Soundtrack · @Audio1–@Audio3</h2></div><Music4 size={17} /></div>
        {audios.map((audio, index) => (
          <div key={`${audio.url}-${index}`} className={styles.output}>
            <div className={styles.outputHead}><span>@Audio{index + 1}{audio.fromVideo ? ' · AUDIO EXTRACTED FROM VIDEO' : ''}</span>
              <button type="button" aria-label={`Remove audio ${index + 1}`} disabled={busy}
                onClick={() => setAudios((prev) => prev.filter((_, i) => i !== index))}
                style={{ display: 'grid', placeItems: 'center', width: 22, height: 22, borderRadius: '50%', border: 0, background: 'rgba(255,255,255,.08)', color: '#fff', cursor: 'pointer' }}><X size={12} /></button>
            </div>
            {audio.fromVideo && <div className={styles.price} style={{ padding: '8px 12px 0' }}><span>Audio will be extracted from this video</span></div>}
            <audio data-testid={`rv-audio-${index + 1}`} src={audio.url} controls preload="metadata" style={{ marginTop: 12 }} />
          </div>
        ))}
        {audios.length === 0 && <div className={`${styles.empty} p-8`}><p>No soundtrack yet.</p></div>}
        <input ref={audioInputRef} type="file" accept="audio/*,video/*" multiple hidden
          onChange={(event: ChangeEvent<HTMLInputElement>) => { void addAudioFiles(event.target.files ?? []); event.target.value = ''; }} />
        <button type="button" className={styles.run} disabled={uploadingAudio || busy}
          onClick={() => audioInputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event: DragEvent<HTMLButtonElement>) => { event.preventDefault(); void addAudioFiles(event.dataTransfer.files); }}>
          {uploadingAudio ? <LoaderCircle className={styles.spin} size={17} /> : <Music4 size={16} />}{uploadingAudio ? 'Uploading audio…' : 'Add files'}
        </button>
        <div className={styles.price}><span>Audio or video files · audio is extracted</span><span>{audios.length}/3</span></div>
        <label className={styles.field}>Or paste an audio URL
          <input data-testid="rv-audio-url" type="url" value={audioLink} disabled={uploadingAudio || busy}
            onChange={(event) => setAudioLink(event.target.value)} placeholder="https://example.com/song.mp3" />
        </label>
        {audioLink.trim() && <div className={styles.chips}><button type="button" disabled={uploadingAudio || busy} onClick={addAudioLink}>Use this URL</button></div>}
        {videos.length > 0 && <div className={styles.chips}><button type="button" disabled={busy || audios.some((audio) => audio.url === videos[0].url) || audios.length >= REFERENCE_VIDEO_MAX_AUDIOS} onClick={useVideo1Soundtrack}>Use the soundtrack of @Video1</button></div>}
      </div>
      <div className={styles.panel}>
        <div className={styles.panelHead}><div><span>04 / PROMPT</span><h2>Direct the scene</h2></div><Sparkles size={17} /></div>
        <label className={styles.field}>Prompt
          <textarea ref={promptRef} data-testid="rv-prompt" rows={8} maxLength={4000} disabled={busy}
            value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={PROMPT_PLACEHOLDER} />
        </label>
        <div className={styles.chips}>
          <button type="button" disabled={busy} onClick={() => insertTag('@Image1')}>@Image1</button>
          <button type="button" disabled={busy} onClick={() => insertTag('@Video1')}>@Video1</button>
          <button type="button" disabled={busy} onClick={() => insertTag('@Audio1')}>@Audio1</button>
          <button type="button" disabled={busy} onClick={loadExample}>Load the character-swap example</button>
        </div>
      </div>
      <div className={styles.panel}>
        <div className={styles.panelHead}><div><span>05 / RUN</span><h2>Settings and render</h2></div><Clapperboard size={17} /></div>
        <div className={styles.segment}>
          {(['mini', 'pro'] as const).map((value) => (
            <button key={value} type="button" disabled={busy} data-testid={`rv-model-${value}`}
              className={model === value ? styles.active : ''}
              onClick={() => { setModel(value); setResolution((prev) => clampResolutionForModel(value, prev)); }}>
              {value === 'mini' ? 'Mini' : 'Pro'}
            </button>
          ))}
        </div>
        <div className={`${styles.segment} ${resolutionOptions.length === 3 ? styles.three : ''}`}>
          {resolutionOptions.map((value) => (
            <button key={value} type="button" disabled={busy} data-testid={`rv-resolution-${value}`}
              className={resolution === value ? styles.active : ''} onClick={() => setResolution(value)}>{value}</button>
          ))}
        </div>
        <label className={styles.field}>Duration
          <select data-testid="rv-duration" value={duration} disabled={busy} onChange={(event) => setDuration(Number(event.target.value))}>
            <option value={0}>Match reference video</option>
            {[4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((seconds) => (
              <option key={seconds} value={seconds}>{seconds} s</option>
            ))}
          </select>
        </label>
        <label className={styles.field}>Aspect ratio
          <select data-testid="rv-aspect" value={aspectRatio} disabled={busy} onChange={(event) => setAspectRatio(event.target.value as ReferenceVideoAspect)}>
            {(['auto', '16:9', '9:16', '1:1', '4:3', '3:4', '21:9'] as const).map((value) => (
              <option key={value} value={value}>{value === 'auto' ? 'Auto' : value}</option>
            ))}
          </select>
        </label>
        <label className={styles.field} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <input data-testid="rv-preserve-audio" type="checkbox" checked={preserveAudio} disabled={busy} onChange={(event) => setPreserveAudio(event.target.checked)} />
          Keep the reference soundtrack on the result
        </label>
        <label className={styles.field} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <input data-testid="rv-include-audio" type="checkbox" checked={includeAudio} disabled={busy} onChange={(event) => setIncludeAudio(event.target.checked)} />
          Let the model generate audio
        </label>
        <div className={styles.price}><span data-testid="rv-estimate">{estimateLine}</span></div>
        <div className={styles.price}><span>{rateLine}</span><span>{estimate?.keeps_soundtrack ? 'soundtrack kept' : ''}</span></div>
        {slotError && <div data-testid="rv-slot-error" className={styles.error}>{slotError}</div>}
        {signedIn
          ? <button data-testid="rv-run" className={styles.run} type="button" disabled={!canGenerate} onClick={() => void generate()}>
            {busy ? <LoaderCircle className={styles.spin} size={17} /> : <Sparkles size={16} />}{busy ? status : 'Generate video'}
          </button>
          : <Link data-testid="rv-run" href="/account" className={styles.run}>Sign in to generate</Link>}
        {jobError && <div data-testid="rv-error" className={styles.error}>{jobError}</div>}
        <div className={styles.output}>
          <div className={styles.outputHead}><span>REFERENCE VIDEO</span><span className={outputURL ? styles.ready : ''}>{outputURL ? 'READY' : busy ? 'GENERATING' : 'WAITING'}</span></div>
          {outputURL
            ? <>
              <video data-testid="rv-output" src={outputURL} controls playsInline />
              <a className={styles.download} href={outputURL} download><Download size={14} /> Download MP4</a>
            </>
            : <div className={`${styles.empty} p-8`}>{busy ? <><LoaderCircle className={styles.spin} size={22} /><p>{status}</p></> : <p>No video yet. Add references, direct the scene, then render.</p>}</div>}
        </div>
        {outputURL && <div className={styles.price}>
          <span>{outputSeconds === null ? '' : `${outputSeconds.toFixed(1)} s`}{segmentsTotal === null ? '' : ` · ${segmentsTotal} segment${segmentsTotal === 1 ? '' : 's'}`}</span>
          <span>{creditsUsed === null ? '' : `${Math.ceil(creditsUsed)} credits used`}{chargedUSD === null ? '' : ` · $${chargedUSD.toFixed(2)}`}</span>
        </div>}
        {phase === 'done' && <div className={styles.price}><span>Reference video complete</span><span>{model} · {resolution}</span></div>}
      </div>
    </div>
  </>;
}
