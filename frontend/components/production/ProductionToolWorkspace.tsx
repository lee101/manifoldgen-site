'use client';

import { downloadVideo, videoExtension } from '../../lib/video-export';
import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, Box, Clapperboard, Download, LoaderCircle, Minus, Music, Plus, Settings2, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { loadStoredUser, refreshUser, saveUser, type StoredUser } from '@/lib/auth';
import { ensurePaidAccess, errorFields, isPaywallError, paywallFromResponse } from '@/lib/paywall';
import {
  MODEL_EXTENSIONS, MOTION_PRICING, PRODKIT_PRICES, formatSpec, SCENE_SCHEMA, SCENE_TEMPLATES, apiBody, controlDefaults, controlParams, isBlenderService, isMotionService, modelContentType,
  productionPriceUSD, productionTool, validateSceneSpec, type ProductionControl, type ProductionParams, type ProductionRequest, type SourceMode,
} from '@/lib/production-tools';
import { ApiPanel, BeforeAfter, DemoGallery, FightStatsCard, ShareRow, SvgCompare } from './ProductionViews';
import styles from './production.module.css';

const GLBViewer = dynamic(() => import('./GLBViewer'), { ssr: false });

type JobResult = {
  job_id?: string; status?: string; error?: string; stage?: string;
  video_url?: string; poster_url?: string; blend_url?: string; glb_url?: string; source_model_url?: string; svg_url?: string;
  palette?: string[]; layers?: number; paths?: number; duration_seconds?: number; render_seconds?: number;
  charged_usd?: number; credits_used?: number; width?: number; height?: number;
  tracks_url?: string; signals_url?: string; preview_url?: string; guide_url?: string; audio_url?: string; cues_url?: string;
  stats?: unknown; bpm?: number; events_count?: number; tracks_count?: number; seconds?: number; music_prompt?: string; preset?: string;
};
type Point = { x: number; y: number; type: 'positive' | 'negative' };
type Uploaded = { url: string; name: string };
const SITE = 'https://manifoldgen.com';
type VideoMeta = { duration: number; width: number; height: number };

const SOURCE_LABEL: Record<SourceMode, string> = { preset: 'Preset', demo: 'Demo model', upload: 'Upload model', photo: 'Photo → 3D' };
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const fmtUSD = (usd: number) => `$${usd.toFixed(2)}`;

function ControlField({ control, value, onChange }: { control: ProductionControl; value: unknown; onChange: (value: unknown) => void }) {
  if (control.type === 'toggle') {
    return <label className={styles.toggle}>{control.label}<input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} /></label>;
  }
  if (control.type === 'select') {
    return <label className={styles.field}>{control.label}
      <select className={styles.select} value={String(value)} onChange={(event) => onChange(event.target.value)}>
        {control.options.map(([option, label]) => <option key={option} value={option}>{label}</option>)}
      </select>
    </label>;
  }
  if (control.type === 'range') {
    return <label className={styles.field}>
      <span className={styles.fieldHead}>{control.label}<output>{String(value)}{control.unit || ''}</output></span>
      <input className={styles.range} type="range" min={control.min} max={control.max} step={control.step} value={Number(value)} onChange={(event) => onChange(Number(event.target.value))} />
      {control.hint && <small>{control.hint}</small>}
    </label>;
  }
  if (control.type === 'color') {
    return <label className={styles.field}>{control.label}
      <span className={styles.color}><input type="color" value={String(value)} onChange={(event) => onChange(event.target.value)} /><input className={styles.input} value={String(value)} maxLength={7} onChange={(event) => onChange(event.target.value)} /></span>
    </label>;
  }
  if (control.type === 'names') {
    return <label className={styles.field} style={{ gridColumn: '1 / -1' }}>{control.label}<input className={styles.input} maxLength={80} placeholder={control.placeholder} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} />{control.hint && <small>{control.hint}</small>}</label>;
  }
  if (control.type === 'tri') {
    return <label className={styles.field}>{control.label}
      <select className={styles.select} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)}>
        <option value="">Preset default</option><option value="true">On</option><option value="false">Off</option>
      </select>
    </label>;
  }
  if (control.type === 'seed') {
    return <label className={styles.field}>{control.label}<input className={styles.input} inputMode="numeric" placeholder={control.hint} value={String(value ?? '')} onChange={(event) => onChange(event.target.value.replace(/[^0-9]/g, '').slice(0, 9))} /></label>;
  }
  const palette = Array.isArray(value) ? value as string[] : [];
  return <div className={styles.field} style={{ gridColumn: '1 / -1' }}>{control.label}
    <div className={styles.chips}>
      {palette.map((color, index) => <span key={index} style={{ position: 'relative', display: 'inline-flex' }}>
        <input type="color" aria-label={`Palette color ${index + 1}`} className={styles.swatch} value={color} onChange={(event) => onChange(palette.map((item, i) => i === index ? event.target.value : item))} />
        <button type="button" aria-label="Remove color" onClick={() => onChange(palette.filter((_, i) => i !== index))} style={{ position: 'absolute', top: -6, right: -6, width: 15, height: 15, borderRadius: 8, border: 0, background: '#302c48', color: '#fff', display: 'grid', placeItems: 'center', padding: 0, cursor: 'pointer' }}><X size={9} /></button>
      </span>)}
      {palette.length < 8 && <button type="button" className={styles.chip} onClick={() => onChange([...palette, ['#ff6b9a', '#ffd166', '#6bd3ff', '#9b7bff', '#3ddc97', '#ffffff', '#222233', '#ff8a3d'][palette.length]])}><Plus size={12} /> Color</button>}
    </div>
    {control.hint && <small>{control.hint}</small>}
  </div>;
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return <div className={styles.section}><div className={styles.sectionLabel}>{label}</div>{children}</div>;
}

export function ProductionToolWorkspace({ slug }: { slug: string }) {
  const tool = productionTool(slug)!;
  const blender = isBlenderService(tool.service);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<'model' | 'image' | 'video' | 'scene' | 'audio'>('model');
  const motion = isMotionService(tool.service);
  const clipCap = motion ? MOTION_PRICING[tool.service as keyof typeof MOTION_PRICING].max : PRODKIT_PRICES.eraserMaxSeconds;
  const alive = useRef(true);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [source, setSource] = useState<SourceMode>(tool.sources?.[0] || 'upload');
  const [subject, setSubject] = useState(tool.presets?.[0]?.[0] || 'tower');
  const [subjectText, setSubjectText] = useState('BOOM');
  const [demoModel, setDemoModel] = useState(tool.demoModels?.[0]?.[0] || '');
  const [model, setModel] = useState<Uploaded | null>(null);
  const [image, setImage] = useState<Uploaded | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [sceneModels, setSceneModels] = useState<Uploaded[]>([]);
  const [specText, setSpecText] = useState(() => formatSpec(SCENE_TEMPLATES[1].spec));
  const [video, setVideo] = useState<Uploaded | null>(null);
  const [videoPreview, setVideoPreview] = useState('');
  const [audio, setAudio] = useState<Uploaded | null>(null);
  const [audioStart, setAudioStart] = useState(0);
  const [trackView, setTrackView] = useState<'preview' | 'guide'>('preview');
  const [meta, setMeta] = useState<VideoMeta | null>(null);
  const [target, setTarget] = useState<'prompt' | 'points'>('prompt');
  const [prompt, setPrompt] = useState('person');
  const [points, setPoints] = useState<Point[]>([]);
  const [pointType, setPointType] = useState<Point['type']>('positive');
  const [clipSeconds, setClipSeconds] = useState(5);
  const [values, setValues] = useState<ProductionParams>(() => controlDefaults(tool.controls));
  const [uploading, setUploading] = useState('');
  const [phase, setPhase] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<JobResult | null>(null);
  const [resultImage, setResultImage] = useState('');
  const [resultVideo, setResultVideo] = useState('');

  useEffect(() => {
    alive.current = true;
    const stored = loadStoredUser();
    setUser(stored);
    if (stored?.api_key) void refreshUser(stored.api_key).then((fresh) => { if (fresh && alive.current) { setUser(fresh); saveUser(fresh); } }).catch(() => {});
    const query = new URLSearchParams(window.location.search);
    const name = (url: string) => decodeURIComponent(url.split('?')[0].split('/').pop() || url);
    const modelURL = query.get('model_url')?.trim();
    const imageURL = query.get('image_url')?.trim();
    const videoURL = query.get('video_url')?.trim();
    const audioURL = query.get('audio_url')?.trim();
    if (audioURL && tool.audio) setAudio({ url: audioURL, name: name(audioURL) });
    if (modelURL && tool.input === 'model') { setModel({ url: modelURL, name: name(modelURL) }); setSource('upload'); }
    else if (modelURL && tool.input === 'scene') {
      setSceneModels([{ url: modelURL, name: name(modelURL) }]);
      setSpecText(formatSpec(SCENE_TEMPLATES[0].spec));
    }
    if (imageURL && (tool.input === 'image' || (tool.input === 'model' && !modelURL))) {
      setImage({ url: imageURL, name: name(imageURL) }); setImagePreview(imageURL);
      if (tool.input === 'model') setSource('photo');
    }
    if (videoURL && tool.input === 'video') { setVideo({ url: videoURL, name: name(videoURL) }); setVideoPreview(videoURL); }
    return () => { alive.current = false; };
  }, [tool.input]);

  useEffect(() => () => { if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview); }, [imagePreview]);
  useEffect(() => () => { if (videoPreview.startsWith('blob:')) URL.revokeObjectURL(videoPreview); }, [videoPreview]);

  const sceneCheck = useMemo(() => tool.input === 'scene' ? validateSceneSpec(specText, sceneModels.length) : {}, [tool.input, specText, sceneModels.length]);
  const effectiveSeconds = meta ? Math.min(meta.duration, clipSeconds) : clipSeconds;
  const pointsAllowed = effectiveSeconds <= PRODKIT_PRICES.eraserChunkSeconds + 1e-6;
  const maxClip = meta ? Math.max(1, Math.min(clipCap, Math.ceil(meta.duration - 0.01))) : clipCap;
  const cleanup = tool.service === 'shot-cleanup';

  const request = useMemo<ProductionRequest>(() => {
    const params = controlParams(tool.controls, values);
    const req: ProductionRequest = { service: tool.service, params };
    if (tool.input === 'model') {
      if (source === 'preset') { params.subject = subject; if (subject === 'text') params.text = subjectText.trim(); }
      else if (source === 'demo') params.demo = demoModel;
      else if (source === 'upload' && model) req.model_url = model.url;
      else if (source === 'photo' && image) req.image_url = image.url;
    } else if (tool.input === 'scene') {
      if (sceneCheck.spec) params.spec = sceneCheck.spec;
      if (sceneModels.length) req.model_urls = sceneModels.map((item) => item.url);
    } else if (tool.input === 'image') {
      if (image) req.image_url = image.url;
    } else if (tool.input === 'video') {
      if (video) req.video_url = video.url;
      req.duration = clipSeconds;
      if (audio) req.audio_url = audio.url;
      if (audio && audioStart > 0 && (tool.service === 'beat-drop' || tool.service === 'motion-fx')) params.audio_start = audioStart;
      if (!cleanup) Object.assign(params, tool.fixedParams || {});
      else if (target === 'prompt') req.prompt = prompt.trim();
      else {
        const scale = meta && meta.width > 1920 ? 1920 / meta.width : 1;
        params.points = points.map((point) => ({ x: Math.round(point.x * scale), y: Math.round(point.y * scale), type: point.type }));
      }
    }
    return req;
  }, [tool, cleanup, values, source, subject, subjectText, demoModel, model, image, sceneCheck.spec, sceneModels, video, audio, audioStart, clipSeconds, target, prompt, points, meta]);

  const priceUSD = productionPriceUSD(source === 'photo' && !request.image_url ? { ...request, image_url: 'pending' } : request);
  const credits = Math.ceil(priceUSD / (user?.credit_price_usd || 0.01) - 1e-9);

  const snippetRequest = useMemo<ProductionRequest>(() => {
    const filled: ProductionRequest = { ...request, params: { ...request.params } };
    if (tool.input === 'model' && source === 'upload' && !filled.model_url) filled.model_url = 'https://…/model.glb';
    if ((tool.input === 'image' || (tool.input === 'model' && source === 'photo')) && !filled.image_url) filled.image_url = 'https://…/photo.png';
    if (tool.input === 'video' && !filled.video_url) filled.video_url = 'https://…/clip.mp4';
    if (tool.audio === 'required' && !filled.audio_url) filled.audio_url = 'https://…/song.mp3';
    if (tool.input === 'scene' && !filled.params.spec) filled.params.spec = { objects: [] };
    return filled;
  }, [request, tool.input, source]);

  const missing = (() => {
    if (uploading) return 'Wait for the upload to finish';
    if (tool.input === 'model') {
      if (source === 'preset' && subject === 'text' && !subjectText.trim()) return 'Type the text to destroy';
      if (source === 'upload' && !model) return 'Upload a 3D model';
      if (source === 'photo' && !image) return 'Add a photo';
    }
    if (tool.input === 'scene' && sceneCheck.error) return sceneCheck.error;
    if (tool.input === 'image' && !image) return 'Add an image';
    if (tool.input === 'video') {
      if (!video) return 'Add a video';
      if (tool.audio === 'required' && !audio) return 'Add a song';
      if (cleanup && target === 'prompt' && !prompt.trim()) return 'Name what to remove';
      if (cleanup && target === 'points' && !points.some((point) => point.type === 'positive')) return 'Click the object on the first frame';
      if (cleanup && target === 'points' && !pointsAllowed) return 'Points need 4.8 s or less: lower the duration or use a name';
    }
    return '';
  })();

  function setValue(key: string, value: unknown) { setValues((current) => ({ ...current, [key]: value })); }

  function requireUser() {
    const current = user || loadStoredUser();
    if (!current?.api_key) { ensurePaidAccess(tool.name); return null; }
    return current;
  }

  async function uploadFile(file: File, contentType: string, apiKey: string) {
    const response = await fetch('/api/studio/assets/presign', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: crypto.randomUUID(), asset_id: crypto.randomUUID(), filename: file.name, content_type: contentType, size: file.size }),
    });
    const data = await response.json().catch(() => ({})) as { upload_url?: string; public_url?: string };
    if (!response.ok) throw paywallFromResponse(response, data, tool.name) || new Error(errorFields(data).message || 'Could not prepare the upload');
    if (!data.upload_url || !data.public_url) throw new Error('Upload service returned no destination');
    const put = await fetch(data.upload_url, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file });
    if (!put.ok) throw new Error(`Upload failed (${put.status})`);
    return data.public_url;
  }

  function pick(kind: 'model' | 'image' | 'video' | 'scene' | 'audio') {
    uploadTarget.current = kind;
    const input = fileInput.current;
    if (!input) return;
    input.accept = kind === 'image' ? 'image/png,image/jpeg,image/webp' : kind === 'audio' ? 'audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac' : kind === 'video' ? 'video/mp4,video/quicktime,video/webm' : MODEL_EXTENSIONS.map((ext) => `.${ext}`).join(',');
    input.multiple = kind === 'scene';
    input.click();
  }

  async function onFiles(files: File[]) {
    const kind = uploadTarget.current;
    if (!files.length) return;
    const current = requireUser();
    if (!current) return;
    setError('');
    try {
      if (kind === 'model' || kind === 'scene') {
        const room = kind === 'scene' ? 16 - sceneModels.length : 1;
        for (const file of files.slice(0, Math.max(room, 0))) {
          const contentType = modelContentType(file.name);
          if (!contentType) throw new Error('Models must be .glb, .obj, .fbx, .stl or .ply');
          if (file.size > 200 * 1024 * 1024) throw new Error('Models must be under 200 MB');
          setUploading(`Uploading ${file.name}…`);
          const url = await uploadFile(file, contentType, current.api_key);
          if (kind === 'model') setModel({ url, name: file.name });
          else setSceneModels((list) => [...list, { url, name: file.name }].slice(0, 16));
        }
      } else if (kind === 'image') {
        const file = files[0];
        if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 25 * 1024 * 1024) throw new Error('Choose a PNG, JPEG or WebP up to 25 MB');
        setImagePreview(URL.createObjectURL(file));
        setUploading('Uploading image…');
        setImage({ url: await uploadFile(file, file.type, current.api_key), name: file.name });
      } else if (kind === 'audio') {
        const file = files[0];
        if (!(file.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(file.name)) || file.size > 60 * 1024 * 1024) throw new Error('Choose an audio file up to 60 MB');
        setUploading('Uploading audio…');
        setAudio({ url: await uploadFile(file, file.type || 'audio/mpeg', current.api_key), name: file.name });
      } else {
        const file = files[0];
        if (!file.type.startsWith('video/') || file.size > 300 * 1024 * 1024) throw new Error('Choose a video up to 300 MB');
        setMeta(null); setPoints([]);
        setVideoPreview(URL.createObjectURL(file));
        setUploading('Uploading video…');
        setVideo({ url: await uploadFile(file, file.type || 'video/mp4', current.api_key), name: file.name });
      }
    } catch (reason) {
      if (!isPaywallError(reason)) setError(reason instanceof Error ? reason.message : 'Upload failed');
    } finally {
      setUploading('');
    }
  }

  function finish(done: JobResult, apiKey: string) {
    setResult(done);
    setResultImage(image?.url || '');
    setResultVideo(video?.url || '');
    setPhase('done'); setStage('');
    void refreshUser(apiKey).then((fresh) => { if (fresh && alive.current) { setUser(fresh); saveUser(fresh); } }).catch(() => {});
  }

  async function run() {
    const current = requireUser();
    if (!current) return;
    if (missing) { setError(missing); return; }
    setPhase('running'); setError(''); setResult(null); setStage('queued');
    const headers = { Authorization: `Bearer ${current.api_key}`, 'Content-Type': 'application/json' };
    try {
      const response = await fetch('/api/service', { method: 'POST', headers, body: JSON.stringify(apiBody(request)) });
      const data = await response.json().catch(() => ({})) as { result?: JobResult };
      if (!response.ok) throw paywallFromResponse(response, data, tool.name) || new Error(errorFields(data).message || `Request failed (${response.status})`);
      const queued = data.result || {};
      if (queued.status === 'completed') { finish(queued, current.api_key); return; }
      if (queued.status === 'failed' || queued.status === 'payment_required') throw new Error(queued.error || 'The job failed; you were not charged');
      if (!queued.job_id) throw new Error('The service returned no job');
      const statusURL = `/api/video-jobs/${encodeURIComponent(queued.job_id)}`;
      for (let attempt = 0; attempt < 1000 && alive.current; attempt += 1) {
        await sleep(attempt < 10 ? 1500 : 3000);
        const poll = await fetch(statusURL, { headers: { Authorization: `Bearer ${current.api_key}` } }).catch(() => null);
        if (!poll) continue;
        const payload = await poll.json().catch(() => ({})) as { job?: { status?: string; error?: string; result?: JobResult } };
        const job = payload.job;
        if (!job) { if (poll.status >= 500) continue; throw new Error(errorFields(payload).message || 'Could not read the job status'); }
        if (job.status === 'completed') { finish({ ...(job.result || {}), job_id: queued.job_id }, current.api_key); return; }
        if (job.status === 'payment_required') throw new Error(job.error || 'Top up to release the result');
        if (job.status === 'failed' || job.status === 'cancelled' || job.status === 'timed_out') throw new Error(job.error || 'The job failed; you were not charged');
        setStage(job.result?.stage || job.status || 'processing');
      }
      if (alive.current) throw new Error('Still running; the job stays in your account');
    } catch (reason) {
      if (!alive.current) return;
      setPhase(isPaywallError(reason) ? 'idle' : 'error'); setStage('');
      if (!isPaywallError(reason)) setError(reason instanceof Error ? reason.message : 'The job failed');
    }
  }

  function addPoint(event: MouseEvent<HTMLDivElement>) {
    if (!meta || points.length >= 12) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(meta.width, (event.clientX - rect.left) / rect.width * meta.width));
    const y = Math.max(0, Math.min(meta.height, (event.clientY - rect.top) / rect.height * meta.height));
    setPoints((list) => [...list, { x, y, type: pointType }]);
  }

  const busy = phase === 'running';
  const basic = tool.controls.filter((control) => !control.advanced);
  const advanced = tool.controls.filter((control) => control.advanced);
  const signedIn = Boolean(user?.api_key);
  const controlGrid = (controls: readonly ProductionControl[]) => {
    const field = (control: ProductionControl) => <ControlField key={control.key} control={control} value={values[control.key]} onChange={(value) => setValue(control.key, value)} />;
    const toggles = controls.filter((control) => control.type === 'toggle');
    const rest = controls.filter((control) => control.type !== 'toggle');
    return <>
      {rest.length > 0 && <div className={styles.grid}>{rest.map(field)}</div>}
      {toggles.length > 0 && <div className={styles.grid} style={{ marginTop: rest.length ? 12 : 0 }}>{toggles.map(field)}</div>}
    </>;
  };

  const sourcePanel = (() => {
    if (tool.input === 'model') {
      return <Section label="01 · Source">
        <div className={styles.tabs} role="group" aria-label="Source">
          {tool.sources!.map((mode) => <button key={mode} type="button" aria-pressed={source === mode} onClick={() => setSource(mode)}>{SOURCE_LABEL[mode]}</button>)}
        </div>
        <div style={{ marginTop: 10 }}>
          {source === 'preset' && <>
            <div className={styles.chips}>{tool.presets!.map(([value, label]) => <button key={value} type="button" className={styles.chip} aria-pressed={subject === value} onClick={() => setSubject(value)}>{label}</button>)}</div>
            {subject === 'text' && <input className={styles.input} style={{ marginTop: 8 }} maxLength={24} value={subjectText} onChange={(event) => setSubjectText(event.target.value)} placeholder="Text to shatter" aria-label="Text to shatter" />}
          </>}
          {source === 'demo' && <div className={styles.chips}>{tool.demoModels!.map(([value, label]) => <button key={value} type="button" className={styles.chip} aria-pressed={demoModel === value} onClick={() => setDemoModel(value)}>{label}</button>)}</div>}
          {source === 'upload' && <button type="button" className={styles.drop} disabled={busy} onClick={() => pick('model')} data-testid="model-drop">
            {model ? <><Box size={22} /><b>{model.name}</b><span>Click to replace</span></> : <><Upload size={22} /><b>Upload a 3D model</b><span>.glb · .obj · .fbx · .stl · .ply · up to 200 MB</span></>}
          </button>}
          {source === 'photo' && <button type="button" className={styles.drop} disabled={busy} onClick={() => pick('image')}>
            {imagePreview ? <img src={imagePreview} alt="Source photo" /> : <><Upload size={22} /><b>Upload a photo</b><span>One clear object · rebuilt as 3D first (+{fmtUSD(PRODKIT_PRICES.photoTo3D)})</span></>}
          </button>}
        </div>
      </Section>;
    }
    if (tool.input === 'scene') {
      return <>
        <Section label="01 · Scene spec">
          <div className={styles.chips} style={{ marginBottom: 8 }}>
            {SCENE_TEMPLATES.map((template) => <button key={template.id} type="button" className={styles.chip} onClick={() => setSpecText(formatSpec(template.spec))}>{template.label}</button>)}
          </div>
          <textarea className={styles.textarea} spellCheck={false} value={specText} onChange={(event) => setSpecText(event.target.value)} aria-label="Scene spec JSON" data-testid="scene-spec" />
          <div className={sceneCheck.error ? styles.error : styles.hint} data-testid="scene-validation">{sceneCheck.error || `Valid · ${(sceneCheck.spec?.objects as unknown[] | undefined)?.length || 0} objects`}</div>
          <details className={styles.advanced}><summary><Settings2 size={13} /> Spec schema</summary><pre className={styles.schema}>{SCENE_SCHEMA}</pre></details>
        </Section>
        <Section label="02 · Models (model_urls)">
          {sceneModels.length > 0 && <div className={styles.list} style={{ marginBottom: 8 }}>
            {sceneModels.map((item, index) => <div key={`${item.url}-${index}`} className={styles.listItem}>
              <code>#{index}</code><span title={item.url}>{item.name}</span>
              <button type="button" aria-label={`Remove model ${index}`} onClick={() => setSceneModels((list) => list.filter((_, i) => i !== index))}><Trash2 size={13} /></button>
            </div>)}
          </div>}
          <button type="button" className={styles.chip} disabled={busy || sceneModels.length >= 16} onClick={() => pick('scene')}><Upload size={12} /> Add models</button>
          <div className={styles.hint}>Reference with <code>model_index</code>. Up to 16.</div>
        </Section>
      </>;
    }
    if (tool.input === 'image') {
      return <Section label="01 · Image">
        <button type="button" className={styles.drop} disabled={busy} onClick={() => pick('image')} data-testid="image-drop">
          {imagePreview ? <img src={imagePreview} alt="Source" /> : <><Upload size={22} /><b>Upload an image</b><span>PNG · JPEG · WebP · up to 25 MB</span></>}
        </button>
      </Section>;
    }
    return <>
      <Section label="01 · Video">
        {videoPreview
          ? target === 'points' && meta
            ? <div className={styles.picker} style={{ aspectRatio: `${meta.width}/${meta.height}` }} onClick={addPoint} data-testid="point-picker">
              <video src={videoPreview.startsWith('blob:') ? videoPreview : `${videoPreview}#t=0.001`} muted playsInline preload="auto" />
              {points.map((point, index) => <span key={index} className={`${styles.dot} ${point.type === 'positive' ? styles.dotPos : styles.dotNeg}`} style={{ left: `${point.x / meta.width * 100}%`, top: `${point.y / meta.height * 100}%` }} />)}
            </div>
            : <video className={styles.sourceVideo} src={videoPreview} controls muted playsInline preload="metadata"
              onLoadedMetadata={(event) => {
                const element = event.currentTarget;
                const next = { duration: element.duration || 0, width: element.videoWidth || 1280, height: element.videoHeight || 720 };
                setMeta(next);
                setClipSeconds(Math.max(1, Math.min(clipCap, Math.ceil(next.duration - 0.01))));
              }} />
          : null}
        <button type="button" className={styles.drop} style={{ marginTop: videoPreview ? 8 : 0, minHeight: videoPreview ? 0 : 120 }} disabled={busy} onClick={() => pick('video')} data-testid="video-drop">
          {videoPreview ? <span>{video?.name || 'Video'}{meta ? ` · ${meta.duration.toFixed(1)} s · ${meta.width}×${meta.height}` : ''} · click to replace</span> : <><Upload size={22} /><b>Upload a video</b><span>MP4 · MOV · WebM · up to {clipCap} s processed</span></>}
        </button>
      </Section>
      {tool.audio && <Section label={`02 · ${tool.audioLabel || 'Audio'}`}>
        <button type="button" className={styles.drop} style={{ minHeight: 0 }} disabled={busy} onClick={() => pick('audio')} data-testid="audio-drop">
          {audio ? <><Music size={18} /><b>{audio.name}</b><span>Click to replace{tool.audio === 'optional' ? '' : ''}</span></> : <><Music size={20} /><b>{tool.audio === 'required' ? 'Add a song' : 'Add a track'}</b><span>{tool.audioHint}</span></>}
        </button>
        {audio && tool.audio === 'optional' && <button type="button" className={styles.chip} style={{ marginTop: 8 }} onClick={() => setAudio(null)}><Trash2 size={12} /> Remove track</button>}
        {audio && (tool.service === 'beat-drop' || tool.service === 'motion-fx') && <label className={styles.field} style={{ marginTop: 10 }}>
          <span className={styles.fieldHead}>Start song at<output>{audioStart}s</output></span>
          <input className={styles.input} type="number" min={0} max={3600} step={1} inputMode="numeric" value={audioStart} aria-label="Start song at (seconds)" onChange={(event) => setAudioStart(Math.max(0, Math.min(3600, Math.floor(Number(event.target.value) || 0))))} />
          <small>Skip the intro: the effects and soundtrack start from this second of the song.</small>
        </label>}
      </Section>}
      {cleanup && <Section label="02 · What to remove">
        <div className={styles.tabs} role="group" aria-label="Selection">
          <button type="button" aria-pressed={target === 'prompt'} onClick={() => setTarget('prompt')}>Name it</button>
          <button type="button" aria-pressed={target === 'points'} onClick={() => setTarget('points')}>Click points</button>
        </div>
        {target === 'prompt'
          ? <>
            <input className={styles.input} style={{ marginTop: 8 }} value={prompt} maxLength={120} onChange={(event) => setPrompt(event.target.value)} placeholder="person, logo, car…" aria-label="Object to remove" />
            <div className={styles.chips} style={{ marginTop: 8 }}>{['person', 'logo', 'car', 'microphone', 'watermark'].map((noun) => <button key={noun} type="button" className={styles.chip} aria-pressed={prompt === noun} onClick={() => setPrompt(noun)}>{noun}</button>)}</div>
          </>
          : <>
            <div className={styles.chips} style={{ marginTop: 8 }}>
              <button type="button" className={styles.chip} aria-pressed={pointType === 'positive'} onClick={() => setPointType('positive')}><Plus size={12} /> Remove</button>
              <button type="button" className={styles.chip} aria-pressed={pointType === 'negative'} onClick={() => setPointType('negative')}><Minus size={12} /> Keep</button>
              <button type="button" className={styles.chip} disabled={!points.length} onClick={() => setPoints([])}><Trash2 size={12} /> Clear {points.length ? `(${points.length})` : ''}</button>
            </div>
            <div className={pointsAllowed ? styles.hint : styles.error}>{!videoPreview ? 'Add a video, then click the object on its first frame.' : pointsAllowed ? 'Click the object on the first frame. Green = remove, red = keep. Max 12.' : `Points work on up to ${PRODKIT_PRICES.eraserChunkSeconds} s. Lower the duration to 4 s or name the object instead.`}</div>
          </>}
      </Section>}
      <Section label={`0${cleanup ? 3 : tool.audio ? 3 : 2} · Duration`}>
        <label className={styles.field}>
          <span className={styles.fieldHead}>Seconds from start<output>{clipSeconds}s</output></span>
          <input className={styles.range} type="range" min={1} max={maxClip} step={1} value={Math.min(clipSeconds, maxClip)} onChange={(event) => setClipSeconds(Number(event.target.value))} />
          <small>{motion ? `${fmtUSD(MOTION_PRICING[tool.service as keyof typeof MOTION_PRICING].rate)} per second · min ${fmtUSD(MOTION_PRICING[tool.service as keyof typeof MOTION_PRICING].min)} · charged on success` : `${fmtUSD(PRODKIT_PRICES.eraserPerSecond)} per second · charged per processed second`}</small>
        </label>
      </Section>
    </>;
  })();

  const resultView = (() => {
    if (!result) return null;
    if (tool.service === 'image-to-3d' && result.glb_url) return <GLBViewer url={result.glb_url} />;
    if (tool.service === 'vectorize' && result.svg_url) return <SvgCompare original={resultImage || result.svg_url} svg={result.svg_url} />;
    if (tool.service === 'shot-cleanup' && result.video_url) return <BeforeAfter before={resultVideo || result.video_url} after={result.video_url} aspect={meta ? meta.width / meta.height : (result.width && result.height ? result.width / result.height : 16 / 9)} />;
    if (tool.service === 'motion-track' && (result.preview_url || result.guide_url)) {
      const src = trackView === 'guide' && result.guide_url ? result.guide_url : result.preview_url || result.guide_url;
      return <div className={styles.resultBody}>
        <video key={src} data-testid="production-result" src={src} poster={trackView === 'preview' ? result.poster_url : undefined} controls loop autoPlay muted playsInline />
        <div className={styles.tabs} role="group" aria-label="Track view" style={{ marginTop: 8 }}>
          <button type="button" aria-pressed={trackView === 'preview'} onClick={() => setTrackView('preview')}>Skeleton preview</button>
          <button type="button" aria-pressed={trackView === 'guide'} disabled={!result.guide_url} onClick={() => setTrackView('guide')}>Motion guide</button>
        </div>
      </div>;
    }
    if (result.video_url) return <video data-testid="production-result" src={result.video_url} poster={result.poster_url} controls loop autoPlay muted playsInline />;
    return null;
  })();

  const downloads: [string, string | undefined, string][] = [
    ['MP4', result?.video_url, 'video'], ['Poster', result?.poster_url, 'poster'], ['.blend', result?.blend_url, 'blend'],
    ['.glb', result?.glb_url, 'glb'], ['Source .glb', result?.source_model_url, 'source-glb'], ['.svg', result?.svg_url, 'svg'],
    ['Skeleton MP4', result?.preview_url, 'skeleton'], ['Guide MP4', result?.guide_url, 'guide'], ['tracks.json', result?.tracks_url, 'tracks'],
    ['signals.json', result?.signals_url, 'signals'], ['Audio', result?.audio_url, 'audio'], ['cues.json', result?.cues_url, 'cues'],
  ];
  const shareURL = result?.video_url || result?.preview_url;
  const chainVideo = tool.service === 'motion-track' ? resultVideo : result?.video_url;
  const chain: [string, string][] = !chainVideo || !motion ? [] : ([
    ['motion-fx', 'Add FX'], ['beat-drop-fx', 'Beat Drop'], ['motion-score', 'Score it'], ['shot-cleanup', 'Clean up'],
  ] as const).filter(([slug]) => (productionTool(slug)?.service || slug) !== tool.service).map(([slug, label]) => [`/tools/${slug}?video_url=${encodeURIComponent(chainVideo)}`, label] as [string, string])
    .concat(tool.service === 'motion-track' ? [] : [[`/tools/crazy-captions?src=${encodeURIComponent(chainVideo)}`, 'Captions']]);
  const sendTargets = [['destruction-studio', 'Destruction'], ['exploded-view', 'Exploded'], ['toon-shader', 'Toon']] as const;
  const reusableModel = result?.glb_url || result?.source_model_url;

  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/tools" className={styles.back}><ArrowLeft size={16} /> Tools</Link>
      <Link href="/tools/production" className={styles.brand} style={{ textDecoration: 'none' }}><Sparkles size={13} /> Production suite</Link>
      <Link href="/account" className={styles.account}>{signedIn ? 'Account' : 'Sign in'}</Link>
    </header>
    <section className={styles.hero}>
      <div className={styles.kicker}>{tool.kicker}</div>
      <h1>{tool.name}: {tool.headline}</h1>
      <p>{tool.blurb}</p>
    </section>
    <section className={styles.workspace}>
      <div className={`${styles.panel} ${styles.controls}`}>
        <input ref={fileInput} type="file" hidden onChange={(event) => { const files = Array.from(event.target.files || []); event.target.value = ''; void onFiles(files); }} />
        <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          {sourcePanel}
          {basic.length > 0 && <Section label={tool.input === 'video' ? `0${cleanup || tool.audio ? 4 : 3} · Options` : tool.input === 'scene' ? '03 · Render' : '02 · Settings'}>
            {controlGrid(basic)}
          </Section>}
          {advanced.length > 0 && <details className={styles.advanced}>
            <summary><Settings2 size={13} /> Advanced</summary>
            {controlGrid(advanced)}
          </details>}
        </fieldset>
        <div className={styles.priceBar} data-testid="production-price">
          <span>ESTIMATE · CHARGED ON SUCCESS</span>
          <span><b>{fmtUSD(priceUSD)}</b> · {credits} credits</span>
        </div>
        {signedIn
          ? <button type="button" className={styles.run} data-testid="production-run" disabled={busy || Boolean(uploading)} onClick={() => void run()}>
            {busy || uploading ? <LoaderCircle size={17} className={styles.spin} /> : <Sparkles size={16} />}{uploading || (busy ? (stage || 'Working…') : tool.runLabel)}
          </button>
          : <button type="button" className={styles.run} data-testid="production-run" onClick={() => ensurePaidAccess(tool.name)}>Sign in to run</button>}
        {missing && !busy && !uploading && !(tool.input === 'scene' && sceneCheck.error) && <div className={styles.hint}>{missing}</div>}
        {error && <div role="alert" className={styles.error}>{error}</div>}
      </div>
      <div className={styles.panel}>
        <div className={styles.previewHead}>
          <span>Result</span>
          {busy ? <span className={`${styles.stageWrap} ${styles.stage}`} data-testid="production-stage"><LoaderCircle size={12} /><span>{stage || 'queued'}</span></span>
            : result ? <span className={styles.ready}>Ready{result.render_seconds ? ` · ${result.render_seconds.toFixed(0)} s render` : ''}</span> : <span>Waiting</span>}
        </div>
        <div className={styles.preview} style={result ? { borderRadius: 0 } : undefined}>
          {resultView || <div className={styles.empty}>
            {busy ? <><LoaderCircle size={26} className={styles.spin} /><b style={{ textTransform: 'capitalize' }}>{stage || 'Queued'}</b><div className={styles.progress}><i /></div><span>{blender ? 'Renders take about 1-4 minutes. You can keep this tab open.' : motion ? 'Pose tracking and rendering take about 1-3 minutes for a 10 s clip.' : 'Usually under a minute.'}</span></>
              : <><Sparkles size={28} /><b>Your result appears here</b><span>{tool.outputs.split(', ').filter((field) => field.endsWith('_url')).map((field) => field.replace('_url', '').toUpperCase()).join(' · ')}</span></>}
          </div>}
        </div>
        {result && <>
          {tool.service === 'vectorize' && Array.isArray(result.palette) && result.palette.length > 0 && <div className={styles.palette} data-testid="svg-palette">
            {result.palette.map((color) => <span key={color} className={styles.paletteChip}><i style={{ background: color }} />{color}</span>)}
          </div>}
          <div className={styles.actions}>
            {downloads.filter(([, url]) => url).map(([label, url, name]) => label.endsWith('MP4') && videoExtension(url!) !== 'mp4'
              ? <button key={label} type="button" className={styles.action} onClick={() => void downloadVideo(url!, `manifoldgen-${tool.slug}-${name}`, 'mp4').catch(() => window.open(url, '_blank', 'noopener'))}><Download size={13} /> {label} (converted on your device)</button>
              : <a key={label} className={styles.action} href={url} download={`manifoldgen-${tool.slug}-${name}`} target="_blank" rel="noreferrer"><Download size={13} /> {label}</a>)}
            {result.video_url && <Link className={`${styles.action} ${styles.actionPrimary}`} href={`/studio?video_url=${encodeURIComponent(result.video_url)}&name=${encodeURIComponent(tool.name)}`}><Clapperboard size={13} /> Open in Studio</Link>}
            {chain.map(([href, label]) => <Link key={label} className={styles.action} href={href}><Sparkles size={13} /> {label}</Link>)}
            {tool.service === 'image-to-3d' && reusableModel && sendTargets.map(([slugTarget, label]) => <Link key={slugTarget} className={styles.action} href={`/tools/${slugTarget}?model_url=${encodeURIComponent(reusableModel)}`}><Box size={13} /> Use in {label}</Link>)}
          </div>
          {shareURL && <ShareRow url={shareURL} title={`Made with ManifoldGen ${tool.name}`} page={`${SITE}/tools/${tool.slug}`} />}
          {(tool.service === 'motion-fx' || tool.service === 'motion-track') && <FightStatsCard stats={result.stats} names={Array.isArray(request.params.names) ? request.params.names as string[] : []} />}
          {tool.service === 'motion-score' && result.music_prompt && <div className={styles.hint}>Music prompt for a matching track: <code>{result.music_prompt}</code></div>}
          <div className={styles.meta}>
            {typeof result.bpm === 'number' && result.bpm > 0 && <span>{Math.round(result.bpm)} BPM</span>}
            {typeof result.tracks_count === 'number' && <span>{result.tracks_count} tracked</span>}
            {typeof result.events_count === 'number' && <span>{result.events_count} hits</span>}
            {typeof result.layers === 'number' && <span>{result.layers} layers</span>}
            {typeof result.paths === 'number' && <span>{result.paths} paths</span>}
            {typeof result.duration_seconds === 'number' && result.duration_seconds > 0 && <span>{result.duration_seconds.toFixed(1)} s</span>}
            {typeof result.charged_usd === 'number' && <span>charged {fmtUSD(result.charged_usd)}</span>}
          </div>
        </>}
        <ApiPanel request={snippetRequest} tool={tool} />
      </div>
    </section>
    <DemoGallery tool={tool} />
    <section className={styles.extra}>
      <div><b>{tool.extraCopy ? 'How it works' : 'Editable outputs'}</b>{tool.extraCopy ? tool.extraCopy : blender ? 'Every render ships with the baked .blend so you can keep editing in Blender.' : tool.service === 'vectorize' ? 'One SVG group per color, ready for Illustrator, Inkscape and Figma.' : tool.service === 'image-to-3d' ? 'Standard GLB with textures; works in Blender, three.js and game engines.' : 'Cleaned MP4 at source resolution (up to 1920 px wide), audio kept on request.'}</div>
      <div><b>Pay on success</b>Price shown before you run. Failed jobs are not charged.</div>
      <div><b>More production tools</b>{motion && <><Link href="/tools/motion-fx">Motion FX</Link><Link href="/tools/beat-drop-fx">Beat Drop FX</Link><Link href="/tools/motion-tracker">Motion Tracker</Link><Link href="/tools/motion-score">Motion Score</Link></>}<Link href="/tools/production">Production suite</Link><Link href="/api#production">API reference</Link></div>
    </section>
  </main>;
}
