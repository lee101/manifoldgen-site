'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ChevronDown,
  CircleHelp,
  Clapperboard,
  Copy,
  Crop,
  Download,
  Film,
  Image as ImageIcon,
  Loader2,
  Maximize,
  Menu,
  Minus,
  MousePointer2,
  Pause,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
  UserRound,
  WandSparkles,
  X,
  ZoomIn,
} from 'lucide-react';
import {
  ALL_FORMATS,
  AudioSampleSink,
  AudioSampleSource,
  BlobSource,
  BufferTarget,
  CanvasSink,
  CanvasSource,
  EncodedAudioPacketSource,
  EncodedPacketSink,
  Input,
  Mp4OutputFormat,
  Output,
  Quality,
  WebMOutputFormat,
  canEncodeAudio,
  canEncodeVideo,
} from 'mediabunny';
import { loadStoredUser, refreshUser, saveUser, type StoredUser } from '../../lib/auth';
import { parseJSONResponse } from '../../lib/http';
import {
  DEFAULT_ADJUSTMENTS,
  StudioRenderer,
  type StudioAdjustments,
} from '../../lib/studio-renderer';
import styles from './page.module.css';

type MediaKind = 'video' | 'image';
type Tool = 'media' | 'adjust' | 'crop' | 'effects' | 'ai';
type ExportFormat = 'webm-av1' | 'mp4-h264';

type StudioAsset = {
  id: string;
  name: string;
  kind: MediaKind;
  file: File;
  url: string;
  duration: number;
  width: number;
  height: number;
  trimStart: number;
  trimEnd: number;
  adjustments: StudioAdjustments;
};

const ADJUSTMENTS: { key: keyof StudioAdjustments; label: string; min: number; max: number; step: number }[] = [
  { key: 'exposure', label: 'Exposure', min: -2, max: 2, step: 0.01 },
  { key: 'brightness', label: 'Brightness', min: -0.5, max: 0.5, step: 0.01 },
  { key: 'contrast', label: 'Contrast', min: -0.8, max: 1, step: 0.01 },
  { key: 'highlights', label: 'Highlights', min: -1, max: 1, step: 0.01 },
  { key: 'shadows', label: 'Shadows', min: -1, max: 1, step: 0.01 },
  { key: 'saturation', label: 'Saturation', min: -1, max: 1, step: 0.01 },
  { key: 'temperature', label: 'Temperature', min: -1, max: 1, step: 0.01 },
  { key: 'tint', label: 'Tint', min: -1, max: 1, step: 0.01 },
  { key: 'fade', label: 'Fade', min: 0, max: 1, step: 0.01 },
  { key: 'vignette', label: 'Vignette', min: 0, max: 1, step: 0.01 },
  { key: 'grain', label: 'Grain', min: 0, max: 1, step: 0.01 },
];

const FILTERS: { name: string; values: Partial<StudioAdjustments>; colors: string }[] = [
  { name: 'Clean', values: {}, colors: '#8e98a6,#424854' },
  { name: 'Noir', values: { saturation: -1, contrast: 0.28, grain: 0.22 }, colors: '#d9d9d9,#282828' },
  { name: 'Cinema', values: { contrast: 0.18, saturation: -0.08, temperature: 0.16, vignette: 0.22 }, colors: '#dd9d61,#183c4d' },
  { name: 'Chrome', values: { contrast: 0.3, highlights: 0.14, temperature: -0.18 }, colors: '#bddef2,#5d6b84' },
  { name: 'Ember', values: { temperature: 0.44, tint: 0.08, shadows: -0.12 }, colors: '#ff9c52,#5b2620' },
  { name: 'Mist', values: { fade: 0.58, contrast: -0.18, highlights: 0.22 }, colors: '#d6e2e4,#8590a2' },
];

function formatTime(value: number) {
  if (!Number.isFinite(value)) return '00:00.00';
  const minutes = Math.floor(value / 60);
  const seconds = value - minutes * 60;
  return `${String(minutes).padStart(2, '0')}:${seconds.toFixed(2).padStart(5, '0')}`;
}

function uid() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

function authHeaders(apiKey: string, json = true): HeadersInit {
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${apiKey}`,
  };
}

function resultURL(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const data = payload as Record<string, unknown>;
  if (typeof data.url === 'string') return data.url;
  if (typeof data.data_url === 'string') return data.data_url;
  if (typeof data.video_url === 'string') return data.video_url;
  if (data.video && typeof data.video === 'object' && typeof (data.video as Record<string, unknown>).url === 'string') {
    return (data.video as Record<string, string>).url;
  }
  if (data.result) return resultURL(data.result);
  return '';
}

async function readDimensions(file: File, kind: MediaKind) {
  const url = URL.createObjectURL(file);
  try {
    if (kind === 'image') {
      const image = new Image();
      image.src = url;
      await image.decode();
      return { width: image.naturalWidth, height: image.naturalHeight, duration: 5 };
    }
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('This video could not be read'));
    });
    return { width: video.videoWidth, height: video.videoHeight, duration: video.duration || 5 };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function StudioPage() {
  const [assets, setAssets] = useState<StudioAsset[]>([]);
  const [selectedID, setSelectedID] = useState('');
  const [tool, setTool] = useState<Tool>('media');
  const [user, setUser] = useState<StoredUser | null>(null);
  const [creditPrice, setCreditPrice] = useState(0.01);
  const [extendRates, setExtendRates] = useState({ input: 0.012, output: 0.084 });
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('webm-av1');
  const [exportProgress, setExportProgress] = useState(0);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendPrompt, setExtendPrompt] = useState('The camera continues forward as the scene naturally unfolds.');
  const [extendDuration, setExtendDuration] = useState(6);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<StudioRenderer | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const selected = assets.find((asset) => asset.id === selectedID) || null;
  const timelineDuration = useMemo(() => Math.max(1, assets.reduce((sum, item) => sum + (item.trimEnd - item.trimStart), 0)), [assets]);
  const customerExtendUSD = useMemo(() => Math.ceil(((selected?.duration || 0) * extendRates.input + extendDuration * extendRates.output) * 100 - 1e-8) / 100, [selected?.duration, extendDuration, extendRates]);
  const extendCredits = Math.ceil(customerExtendUSD / creditPrice);
  const creditsLabel = useMemo(() => {
    if (!user) return 'Sign in';
    const usd = user.credits_usd ?? user.credits * creditPrice;
    return `${Math.round(user.credits).toLocaleString()} cr · $${usd.toFixed(2)}`;
  }, [user, creditPrice]);

  const updateAsset = useCallback((id: string, update: Partial<StudioAsset>) => {
    setAssets((current) => current.map((item) => (item.id === id ? { ...item, ...update } : item)));
  }, []);

  useEffect(() => {
    const stored = loadStoredUser();
    if (stored) {
      setUser(stored);
      refreshUser(stored.api_key).then((next) => next && setUser(next));
    }
    fetch('/api/pricing').then((response) => response.json()).then((data) => {
      if (data.credit_price_usd) setCreditPrice(data.credit_price_usd);
      if (data.studio?.extend_input_second_usd && data.studio?.extend_output_second_usd) {
        setExtendRates({ input: data.studio.extend_input_second_usd, output: data.studio.extend_output_second_usd });
      }
    }).catch(() => undefined);
    return () => assets.forEach((asset) => URL.revokeObjectURL(asset.url));
    // Object URLs are revoked as individual assets are deleted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const drawCurrent = useCallback(() => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer || !selected) return;
    renderer.resize(Math.min(selected.width, 1920), Math.min(selected.height, 1080));
    if (selected.kind === 'video') {
      const video = videoRef.current;
      if (video && video.readyState >= 2) renderer.draw(video, selected.adjustments, video.currentTime * 24);
    } else if (imageRef.current) {
      renderer.draw(imageRef.current, selected.adjustments, 0);
    }
  }, [selected]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      rendererRef.current?.destroy();
      rendererRef.current = new StudioRenderer(canvas);
      drawCurrent();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to start the GPU preview');
    }
    return () => {
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, [drawCurrent]);

  useEffect(() => {
    if (!selected) return;
    setPlayhead(selected.trimStart);
    setPlaying(false);
    if (selected.kind === 'image') {
      const image = new Image();
      image.onload = () => {
        imageRef.current = image;
        drawCurrent();
      };
      image.src = selected.url;
    } else {
      imageRef.current = null;
    }
  }, [selected?.id, selected?.url, selected?.kind, selected?.trimStart, drawCurrent]);

  useEffect(() => {
    let frame = 0;
    const render = () => {
      const video = videoRef.current;
      if (video && selected?.kind === 'video') {
        if (video.currentTime >= selected.trimEnd) {
          video.pause();
          video.currentTime = selected.trimStart;
          setPlaying(false);
        }
        setPlayhead(video.currentTime);
      }
      drawCurrent();
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [selected, drawCurrent]);

  async function importFiles(files: FileList | File[]) {
    setError('');
    const incoming = Array.from(files).filter((file) => file.type.startsWith('video/') || file.type.startsWith('image/'));
    if (!incoming.length) {
      setError('Choose an image or video file');
      return;
    }
    const next: StudioAsset[] = [];
    for (const file of incoming) {
      const kind: MediaKind = file.type.startsWith('video/') ? 'video' : 'image';
      try {
        const metadata = await readDimensions(file, kind);
        next.push({
          id: uid(), name: file.name, kind, file, url: URL.createObjectURL(file),
          ...metadata, trimStart: 0, trimEnd: metadata.duration,
          adjustments: { ...DEFAULT_ADJUSTMENTS },
        });
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : `Could not import ${file.name}`);
      }
    }
    setAssets((current) => [...current, ...next]);
    if (next[0]) setSelectedID(next[0].id);
  }

  function removeSelected() {
    if (!selected) return;
    URL.revokeObjectURL(selected.url);
    const remaining = assets.filter((item) => item.id !== selected.id);
    setAssets(remaining);
    setSelectedID(remaining[0]?.id || '');
  }

  function duplicateSelected() {
    if (!selected) return;
    const copy = { ...selected, id: uid(), name: `${selected.name.replace(/(\.[^.]+)?$/, '')} copy$1`, adjustments: { ...selected.adjustments } };
    setAssets((items) => [...items, copy]);
    setSelectedID(copy.id);
  }

  function resetAdjustments() {
    if (selected) updateAsset(selected.id, { adjustments: { ...DEFAULT_ADJUSTMENTS } });
  }

  function togglePlayback() {
    if (!selected || selected.kind !== 'video' || !videoRef.current) return;
    if (videoRef.current.paused) {
      if (videoRef.current.currentTime < selected.trimStart || videoRef.current.currentTime >= selected.trimEnd) videoRef.current.currentTime = selected.trimStart;
      void videoRef.current.play();
      setPlaying(true);
    } else {
      videoRef.current.pause();
      setPlaying(false);
    }
  }

  async function uploadPublic(file: File) {
    if (!user) throw new Error('Sign in to use AI tools');
    const query = new URLSearchParams({ filename: file.name, content_type: file.type || 'application/octet-stream', dataset: 'studio' });
    const presign = await fetch(`/api/uploads/presign?${query}`, { headers: authHeaders(user.api_key, false) });
    const data = await parseJSONResponse<{ upload_url: string; public_url: string }>(presign, 'Could not prepare upload');
    const put = await fetch(data.upload_url, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
    if (!put.ok) throw new Error('Asset upload failed');
    return data.public_url;
  }

  async function removeBackground() {
    if (!selected || selected.kind !== 'image') return;
    setBusy('background'); setError(''); setNotice('Uploading image…');
    try {
      const imageURL = await uploadPublic(selected.file);
      setNotice('Removing background…');
      const response = await fetch('/api/studio/remove-background', {
        method: 'POST', headers: authHeaders(user?.api_key || ''), body: JSON.stringify({ image_url: imageURL }),
      });
      const data = await parseJSONResponse<{ image_url?: string; data_url?: string; credits_remain?: number }>(response, 'Background removal failed');
      const url = data.image_url || data.data_url || resultURL(data);
      if (!url) throw new Error('Background removal returned no image');
      const blob = await fetch(url).then((item) => item.blob());
      const file = new File([blob], `${selected.name.replace(/\.[^.]+$/, '')}-cutout.webp`, { type: blob.type || 'image/webp' });
      const metadata = await readDimensions(file, 'image');
      const cutout: StudioAsset = { ...selected, id: uid(), name: file.name, file, url: URL.createObjectURL(file), ...metadata, trimStart: 0, trimEnd: 5 };
      setAssets((items) => [...items, cutout]);
      setSelectedID(cutout.id);
      if (user && typeof data.credits_remain === 'number') {
        const next = { ...user, credits: data.credits_remain };
        setUser(next); saveUser(next);
      }
      setNotice('Background removed · 1 credit');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Background removal failed');
    } finally {
      setBusy('');
    }
  }

  async function extendVideo() {
    if (!selected || selected.kind !== 'video') return;
    setBusy('extend'); setError(''); setNotice('Uploading source video…');
    try {
      const videoURL = await uploadPublic(selected.file);
      setNotice('Starting extension…');
      const response = await fetch('/api/studio/extend-video', {
        method: 'POST', headers: authHeaders(user?.api_key || ''),
        body: JSON.stringify({ video_url: videoURL, prompt: extendPrompt, duration: extendDuration, source_duration: selected.duration }),
      });
      const data = await parseJSONResponse<{ job_id: string; status_url: string; credits_remain?: number }>(response, 'Could not start extension');
      if (!data.job_id) throw new Error('Extension returned no job');
      if (user && typeof data.credits_remain === 'number') {
        const next = { ...user, credits: data.credits_remain };
        setUser(next); saveUser(next);
      }
      setExtendOpen(false);
      let attempts = 0;
      while (attempts++ < 240) {
        await new Promise((resolve) => window.setTimeout(resolve, 2500));
        const poll = await fetch(data.status_url || `/api/video-jobs/${data.job_id}`, { headers: authHeaders(user?.api_key || '', false) });
        const payload = await parseJSONResponse<{ job?: { status?: string; result?: unknown; error?: string } }>(poll, 'Extension status failed');
        const status = payload.job?.status || '';
        if (status === 'failed') throw new Error(payload.job?.error || 'Extension failed');
        if (status === 'completed') {
          const url = resultURL(payload.job?.result);
          if (!url) throw new Error('Extension completed without a video');
          setNotice('Extension ready');
          window.open(url, '_blank', 'noopener,noreferrer');
          return;
        }
        setNotice(status === 'processing' ? 'Extending video…' : 'Extension queued…');
      }
      throw new Error('Extension is taking longer than expected. It remains available in your account.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Video extension failed');
    } finally {
      setBusy('');
    }
  }

  async function exportImage() {
    if (!selected || selected.kind !== 'image' || !canvasRef.current) return;
    drawCurrent();
    const blob = await new Promise<Blob | null>((resolve) => canvasRef.current?.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Could not export image');
    downloadBlob(blob, `${selected.name.replace(/\.[^.]+$/, '')}-graded.png`);
  }

  function downloadBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = name; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function exportVideo() {
    if (!selected || selected.kind !== 'video') return;
    setBusy('export'); setError(''); setExportProgress(0.01);
    let input: Input | null = null;
    let output: Output | null = null;
    let exportRenderer: StudioRenderer | null = null;
    try {
      const codec = exportFormat === 'webm-av1' ? 'av1' : 'avc';
      if (!(await canEncodeVideo(codec, { width: selected.width, height: selected.height }))) {
        throw new Error(`${exportFormat === 'webm-av1' ? 'AV1' : 'H.264'} encoding is not available in this browser`);
      }
      input = new Input({ source: new BlobSource(selected.file), formats: ALL_FORMATS });
      const videoTrack = await input.getPrimaryVideoTrack();
      if (!videoTrack || !(await videoTrack.canDecode())) throw new Error('This browser cannot decode the source video');

      const width = Math.min(selected.width, 1920);
      const height = Math.round((width / selected.width) * selected.height / 2) * 2;
      const workCanvas = document.createElement('canvas');
      exportRenderer = new StudioRenderer(workCanvas);
      exportRenderer.resize(width, height);
      const target = new BufferTarget();
      output = new Output({
        format: exportFormat === 'webm-av1' ? new WebMOutputFormat() : new Mp4OutputFormat({ fastStart: 'in-memory' }),
        target,
      });
      const videoSource = new CanvasSource(workCanvas, { codec, quality: new Quality('high') });
      output.addVideoTrack(videoSource);

      const audioTrack = await input.getPrimaryAudioTrack();
      let audioSource: AudioSampleSource | null = null;
      let audioSink: AudioSampleSink | null = null;
      let encodedAudioSource: EncodedAudioPacketSource | null = null;
      let encodedAudioSink: EncodedPacketSink | null = null;
      let encodedAudioConfig: AudioDecoderConfig | null = null;
      const audioCodec = exportFormat === 'webm-av1' ? 'opus' : 'aac';
      if (audioTrack) {
        const sourceAudioCodec = await audioTrack.getCodec();
        if (sourceAudioCodec === audioCodec) {
          encodedAudioConfig = await audioTrack.getDecoderConfig();
          encodedAudioSource = new EncodedAudioPacketSource(sourceAudioCodec);
          output.addAudioTrack(encodedAudioSource, encodedAudioConfig ? { decoderConfig: encodedAudioConfig } : undefined);
          encodedAudioSink = new EncodedPacketSink(audioTrack);
        } else if (await audioTrack.canDecode() && await canEncodeAudio(audioCodec)) {
          audioSource = new AudioSampleSource({ codec: audioCodec, quality: new Quality('high') });
          output.addAudioTrack(audioSource);
          audioSink = new AudioSampleSink(audioTrack);
        }
      }

      await output.start();
      const fps = 30;
      const duration = selected.trimEnd - selected.trimStart;
      const frames = Math.max(1, Math.ceil(duration * fps));
      const sink = new CanvasSink(videoTrack, { width, height, fit: 'contain' });
      const timestamps = Array.from({ length: frames }, (_, index) => selected.trimStart + index / fps);
      let index = 0;
      for await (const source of sink.canvasesAtTimestamps(timestamps)) {
        if (source) exportRenderer.draw(source.canvas, selected.adjustments, index);
        await videoSource.add(index / fps, 1 / fps, { keyFrame: index % (fps * 2) === 0 });
        index += 1;
        setExportProgress(Math.min(0.9, index / frames * 0.9));
      }

      if (audioSource && audioSink) {
        for await (const sample of audioSink.samples(selected.trimStart, selected.trimEnd)) {
          sample.setTimestamp(Math.max(0, sample.timestamp - selected.trimStart));
          await audioSource.add(sample);
          sample.close();
        }
      }
      if (encodedAudioSource && encodedAudioSink) {
        let firstPacket = true;
        for await (const packet of encodedAudioSink.packets()) {
          if (packet.timestamp + packet.duration <= selected.trimStart) continue;
          if (packet.timestamp >= selected.trimEnd) break;
          const shifted = packet.clone({ timestamp: Math.max(0, packet.timestamp - selected.trimStart) });
          await encodedAudioSource.add(shifted, firstPacket && encodedAudioConfig ? { decoderConfig: encodedAudioConfig } : undefined);
          firstPacket = false;
        }
      }
      await output.finalize();
      setExportProgress(1);
      const extension = exportFormat === 'webm-av1' ? 'webm' : 'mp4';
      const mime = exportFormat === 'webm-av1' ? 'video/webm' : 'video/mp4';
      downloadBlob(new Blob([target.buffer!], { type: mime }), `${selected.name.replace(/\.[^.]+$/, '')}-studio.${extension}`);
      setNotice(`Exported ${extension.toUpperCase()} locally`);
      setExportOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Local export failed');
      await output?.cancel().catch(() => undefined);
    } finally {
      exportRenderer?.destroy();
      input?.dispose();
      setBusy('');
      window.setTimeout(() => setExportProgress(0), 600);
    }
  }

  const toolItems: { id: Tool; label: string; icon: typeof Film }[] = [
    { id: 'media', label: 'Media', icon: Film },
    { id: 'adjust', label: 'Adjust', icon: SlidersHorizontal },
    { id: 'crop', label: 'Transform', icon: Crop },
    { id: 'effects', label: 'Looks', icon: WandSparkles },
    { id: 'ai', label: 'AI tools', icon: Sparkles },
  ];

  return (
    <main className={styles.studio} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); void importFiles(event.dataTransfer.files); }}>
      <header className={styles.topbar}>
        <div className={styles.brandGroup}>
          <button className={styles.iconButton} aria-label="Menu"><Menu size={17} /></button>
          <Link href="/" className={styles.brand}><span className={styles.brandMark}>M</span><span>MANIFOLD</span></Link>
          <span className={styles.divider} />
          <button className={styles.projectName}>Untitled project <ChevronDown size={13} /></button>
        </div>
        <div className={styles.historyActions}>
          <button className={styles.iconButton} aria-label="Undo" disabled><Undo2 size={16} /></button>
          <button className={styles.iconButton} aria-label="Redo" disabled><Redo2 size={16} /></button>
          <span className={styles.saved}>Saved locally</span>
        </div>
        <div className={styles.accountActions}>
          <Link href="/account" className={styles.creditPill}><span className={styles.creditDot} />{creditsLabel}</Link>
          <Link href="/account?tab=billing" className={styles.topupButton}><Plus size={14} /> Top up</Link>
          <Link href="/account" className={styles.avatar} aria-label="Account"><UserRound size={16} /></Link>
          <button className={styles.exportButton} disabled={!selected || !!busy} onClick={() => selected?.kind === 'image' ? void exportImage() : setExportOpen(true)}><Download size={15} /> Export</button>
        </div>
      </header>

      <div className={styles.workspace}>
        <aside className={styles.rail}>
          {toolItems.map(({ id, label, icon: Icon }) => <button key={id} className={tool === id ? styles.railActive : ''} onClick={() => setTool(id)}><Icon size={19} /><span>{label}</span></button>)}
          <div className={styles.railBottom}><button><CircleHelp size={18} /><span>Help</span></button></div>
        </aside>

        <aside className={styles.panel}>
          {tool === 'media' && <>
            <div className={styles.panelHeader}><div><span className={styles.eyebrow}>PROJECT</span><h2>Media</h2></div><button className={styles.smallIcon} onClick={() => fileInputRef.current?.click()}><Plus size={15} /></button></div>
            <button className={styles.importButton} onClick={() => fileInputRef.current?.click()}><Upload size={16} /> Import media</button>
            <input ref={fileInputRef} type="file" multiple accept="video/*,image/*" hidden onChange={(event) => event.target.files && void importFiles(event.target.files)} />
            <div className={styles.assetGrid}>
              {assets.map((asset) => <button key={asset.id} onClick={() => setSelectedID(asset.id)} className={`${styles.assetCard} ${asset.id === selectedID ? styles.assetSelected : ''}`}>
                {asset.kind === 'image' ? <img src={asset.url} alt="" /> : <video src={asset.url} muted preload="metadata" />}
                <span className={styles.assetType}>{asset.kind === 'video' ? <Film size={11} /> : <ImageIcon size={11} />}</span>
                <span className={styles.assetName}>{asset.name}</span>
              </button>)}
            </div>
            {!assets.length && <div className={styles.emptyLibrary}><Clapperboard size={24} /><p>Your imported files stay in this browser.</p></div>}
          </>}

          {tool === 'adjust' && <>
            <div className={styles.panelHeader}><div><span className={styles.eyebrow}>COLOR</span><h2>Adjustments</h2></div><button className={styles.smallIcon} onClick={resetAdjustments} title="Reset"><RotateCcw size={14} /></button></div>
            {!selected ? <PanelEmpty /> : <div className={styles.controls}>{ADJUSTMENTS.map((item) => <label key={item.key} className={styles.sliderRow}><span><b>{item.label}</b><output>{Math.round(selected.adjustments[item.key] * 100)}</output></span><input type="range" min={item.min} max={item.max} step={item.step} value={selected.adjustments[item.key]} onChange={(event) => updateAsset(selected.id, { adjustments: { ...selected.adjustments, [item.key]: Number(event.target.value) } })} /></label>)}</div>}
          </>}

          {tool === 'effects' && <>
            <div className={styles.panelHeader}><div><span className={styles.eyebrow}>PRESETS</span><h2>Looks</h2></div></div>
            {!selected ? <PanelEmpty /> : <div className={styles.lookGrid}>{FILTERS.map((filter) => <button key={filter.name} onClick={() => updateAsset(selected.id, { adjustments: { ...DEFAULT_ADJUSTMENTS, ...filter.values } })}><span style={{ background: `linear-gradient(135deg, ${filter.colors})` }} /><b>{filter.name}</b></button>)}</div>}
          </>}

          {tool === 'crop' && <>
            <div className={styles.panelHeader}><div><span className={styles.eyebrow}>CANVAS</span><h2>Transform</h2></div></div>
            <div className={styles.transformGrid}><button className={styles.settingCard}><Maximize size={17} /><span><b>Fit frame</b><small>Original ratio</small></span></button><button className={styles.settingCard} disabled><Crop size={17} /><span><b>Free crop</b><small>Coming next</small></span></button></div>
            {selected && <div className={styles.metaList}><span>Dimensions <b>{selected.width} × {selected.height}</b></span><span>Aspect <b>{(selected.width / selected.height).toFixed(2)}:1</b></span></div>}
          </>}

          {tool === 'ai' && <>
            <div className={styles.panelHeader}><div><span className={styles.eyebrow}>ASSIST</span><h2>AI tools</h2></div></div>
            <div className={styles.aiStack}>
              <button className={styles.aiCard} disabled={selected?.kind !== 'image' || !!busy} onClick={() => void removeBackground()}><span className={styles.aiIcon}><ImageIcon size={19} /></span><span><b>Remove background</b><small>Transparent WebP · 1 credit</small></span>{busy === 'background' ? <Loader2 className={styles.spin} size={16} /> : <ArrowLeft className={styles.arrowRight} size={14} />}</button>
              <button className={styles.aiCard} disabled={selected?.kind !== 'video' || !!busy} onClick={() => setExtendOpen(true)}><span className={styles.aiIcon}><Sparkles size={19} /></span><span><b>Extend video</b><small>Continue the current scene</small></span>{busy === 'extend' ? <Loader2 className={styles.spin} size={16} /> : <ArrowLeft className={styles.arrowRight} size={14} />}</button>
            </div>
            <p className={styles.aiNote}>AI tools require a signed-in account. Local editing and export do not use credits.</p>
          </>}
        </aside>

        <section className={styles.stageArea}>
          <div className={styles.stageToolbar}>
            <div className={styles.stageLeft}><button className={styles.toolChip}><MousePointer2 size={14} /> Select</button><button className={styles.toolChip} disabled><Crop size={14} /> Crop</button></div>
            <div className={styles.stageStatus}>{selected ? `${selected.width} × ${selected.height}` : 'Ready'}</div>
            <div className={styles.stageRight}><button className={styles.iconButton} onClick={() => setZoom((value) => Math.max(.5, value - .1))}><Minus size={14} /></button><span>{Math.round(zoom * 100)}%</span><button className={styles.iconButton} onClick={() => setZoom((value) => Math.min(2, value + .1))}><Plus size={14} /></button><button className={styles.iconButton}><Maximize size={14} /></button></div>
          </div>
          <div className={styles.stage}>
            {selected ? <div className={styles.canvasWrap} style={{ transform: `scale(${zoom})`, aspectRatio: `${selected.width}/${selected.height}` }}>
              {selected.kind === 'video' && <video ref={videoRef} className={styles.sourceVideo} src={selected.url} muted={false} playsInline preload="auto" onLoadedData={() => { if (videoRef.current) videoRef.current.currentTime = selected.trimStart; drawCurrent(); }} />}
              <canvas ref={canvasRef} className={styles.previewCanvas} />
            </div> : <button className={styles.dropPrompt} onClick={() => fileInputRef.current?.click()}><span><Upload size={26} /></span><b>Drop media to begin</b><small>Video, image, WebM, MP4, PNG, JPEG</small><em>Browse files</em></button>}
            {dragging && <div className={styles.dropOverlay}><div><Upload size={28} /><b>Drop to import</b></div></div>}
          </div>
          {(notice || error) && <div className={`${styles.toast} ${error ? styles.toastError : ''}`}><span>{error || notice}</span><button onClick={() => { setError(''); setNotice(''); }}><X size={14} /></button></div>}
        </section>
      </div>

      <section className={styles.timeline}>
        <div className={styles.timelineToolbar}>
          <div className={styles.timelineTools}><button onClick={() => fileInputRef.current?.click()}><Plus size={14} /> Add</button><button disabled={!selected}><Scissors size={14} /> Split</button><button onClick={duplicateSelected} disabled={!selected}><Copy size={14} /></button><button onClick={removeSelected} disabled={!selected}><Trash2 size={14} /></button></div>
          <div className={styles.transport}><button onClick={() => selected && setPlayhead(selected.trimStart)}><ArrowLeft size={15} /></button><button className={styles.playButton} onClick={togglePlayback} disabled={selected?.kind !== 'video'}>{playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}</button><span>{formatTime(playhead)} <i>/</i> {formatTime(selected ? selected.trimEnd - selected.trimStart : timelineDuration)}</span></div>
          <div className={styles.timelineZoom}><ZoomIn size={14} /><input type="range" min="0.5" max="2.5" step="0.1" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></div>
        </div>
        <div className={styles.timelineBody}>
          <div className={styles.trackLabels}><span>VIDEO</span><div>V1</div><div className={styles.audioLabel}>A1</div></div>
          <div className={styles.trackContent}>
            <div className={styles.ruler}>{Array.from({ length: 13 }, (_, index) => <span key={index} style={{ left: `${index / 12 * 100}%` }}>{formatTime(timelineDuration * index / 12).slice(3)}</span>)}</div>
            <div className={styles.videoTrack}>{assets.map((asset) => <button key={asset.id} onClick={() => setSelectedID(asset.id)} className={`${styles.timelineClip} ${selectedID === asset.id ? styles.timelineClipSelected : ''}`} style={{ flex: Math.max(.5, asset.trimEnd - asset.trimStart) }}><span className={styles.clipThumb} style={{ backgroundImage: `url(${asset.kind === 'image' ? asset.url : ''})` }}>{asset.kind === 'video' && <Film size={15} />}</span><span><b>{asset.name}</b><small>{formatTime(asset.trimEnd - asset.trimStart)}</small></span></button>)}</div>
            <div className={styles.audioTrack}>{selected?.kind === 'video' && <div className={styles.waveform}>{Array.from({ length: 80 }, (_, index) => <i key={index} style={{ height: `${15 + ((index * 29) % 70)}%` }} />)}</div>}</div>
            {selected && <div className={styles.playhead} style={{ left: `${Math.min(100, Math.max(0, playhead / Math.max(selected.trimEnd, 1) * 100))}%` }} />}
          </div>
        </div>
      </section>

      {exportOpen && <Modal title="Export video" onClose={() => !busy && setExportOpen(false)}>
        <div className={styles.exportOptions}>
          <button className={exportFormat === 'webm-av1' ? styles.optionSelected : ''} onClick={() => setExportFormat('webm-av1')}><span className={styles.optionIcon}>AV1</span><span><b>WebM · AV1</b><small>Smallest file, modern playback</small></span></button>
          <button className={exportFormat === 'mp4-h264' ? styles.optionSelected : ''} onClick={() => setExportFormat('mp4-h264')}><span className={styles.optionIcon}>264</span><span><b>MP4 · H.264</b><small>Maximum compatibility</small></span></button>
        </div>
        <div className={styles.exportSummary}><span>Resolution <b>{selected?.width} × {selected?.height}</b></span><span>Frame rate <b>30 fps</b></span><span>Processing <b>On this device</b></span></div>
        {exportProgress > 0 && <div className={styles.progress}><i style={{ width: `${exportProgress * 100}%` }} /></div>}
        <button className={styles.modalPrimary} disabled={!!busy} onClick={() => void exportVideo()}>{busy === 'export' ? <><Loader2 className={styles.spin} size={16} /> Exporting {Math.round(exportProgress * 100)}%</> : <><Download size={16} /> Export locally</>}</button>
      </Modal>}

      {extendOpen && <Modal title="Extend video" onClose={() => !busy && setExtendOpen(false)}>
        <label className={styles.field}><span>What happens next?</span><textarea value={extendPrompt} onChange={(event) => setExtendPrompt(event.target.value)} rows={4} /></label>
        <div className={styles.durationChoices}>{[2, 4, 6, 8, 10].map((duration) => <button key={duration} className={extendDuration === duration ? styles.durationActive : ''} onClick={() => setExtendDuration(duration)}>{duration}s</button>)}</div>
        <div className={styles.priceLine}><span>Price</span><b>${customerExtendUSD.toFixed(2)} · {extendCredits.toLocaleString()} credits</b></div>
        <button className={styles.modalPrimary} disabled={!extendPrompt.trim() || !!busy} onClick={() => void extendVideo()}><Sparkles size={16} /> Extend video</button>
      </Modal>}
    </main>
  );
}

function PanelEmpty() {
  return <div className={styles.panelEmpty}><MousePointer2 size={22} /><p>Select a clip to edit.</p></div>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className={styles.modalBackdrop} onMouseDown={(event) => event.currentTarget === event.target && onClose()}><div className={styles.modal}><div className={styles.modalHeader}><div><span className={styles.eyebrow}>STUDIO</span><h2>{title}</h2></div><button onClick={onClose}><X size={17} /></button></div><div className={styles.modalBody}>{children}</div></div></div>;
}
