'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  AudioLines,
  ChevronDown,
  CircleHelp,
  Clapperboard,
  Copy,
  Crop,
  Download,
  Film,
  Image as ImageIcon,
  Library,
  Loader2,
  Maximize,
  Menu,
  Mic2,
  Minus,
  MousePointer2,
  Music2,
  Pause,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Search,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
  UserRound,
  Volume2,
  WandSparkles,
  X,
  ZoomIn,
} from 'lucide-react';
import {
  ALL_FORMATS,
  AudioSample,
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

type MediaKind = 'video' | 'image' | 'audio';
type Tool = 'media' | 'adjust' | 'crop' | 'effects' | 'audio' | 'ai';
type ExportFormat = 'webm-av1' | 'mp4-h264';

type AudioCatalogAsset = {
  id: number;
  title: string;
  url: string;
  preview_url?: string;
  duration: number;
  provider: string;
  kind: 'music' | 'sfx' | 'voice';
  description?: string;
  license: string;
  license_url?: string;
  attribution?: string;
  source_url?: string;
};

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
  timelineStart: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  attribution?: string;
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

function compactCredits(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10_000 ? 1 : 2).replace(/\.0$/, '')}k cr`;
  return `${Math.round(value)} cr`;
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
  if (typeof data.audio_url === 'string') return data.audio_url;
  if (data.video && typeof data.video === 'object' && typeof (data.video as Record<string, unknown>).url === 'string') {
    return (data.video as Record<string, string>).url;
  }
  if (data.result) return resultURL(data.result);
  return '';
}

function resultJobID(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const data = payload as Record<string, unknown>;
  if (typeof data.job_id === 'string') return data.job_id;
  if (data.job) {
    const found = resultJobID(data.job);
    if (found) return found;
  }
  if (data.result) return resultJobID(data.result);
  return '';
}

function base64File(value: string, contentType: string, name: string) {
  const bytes = Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  return new File([bytes], name, { type: contentType || 'audio/wav' });
}

function wavBlob(buffer: AudioBuffer) {
  const channels = Math.min(2, buffer.numberOfChannels);
  const samples = buffer.length;
  const bytes = new ArrayBuffer(44 + samples * channels * 2);
  const view = new DataView(bytes);
  const write = (offset: number, value: string) => Array.from(value).forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  write(0, 'RIFF'); view.setUint32(4, bytes.byteLength - 8, true); write(8, 'WAVE'); write(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); write(36, 'data');
  view.setUint32(40, samples * channels * 2, true);
  let offset = 44;
  for (let sample = 0; sample < samples; sample += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const value = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[sample] || 0));
      view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([bytes], { type: 'audio/wav' });
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
    const media = document.createElement(kind === 'audio' ? 'audio' : 'video');
    media.preload = 'metadata';
    media.src = url;
    await new Promise<void>((resolve, reject) => {
      media.onloadedmetadata = () => resolve();
      media.onerror = () => reject(new Error(`This ${kind} file could not be read`));
    });
    if (kind === 'audio') return { width: 1, height: 1, duration: media.duration || 5 };
    const video = media as HTMLVideoElement;
    return { width: video.videoWidth, height: video.videoHeight, duration: video.duration || 5 };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function renderTimelineAudio(video: StudioAsset, audioClips: StudioAsset[], duration: number) {
  const decoder = new AudioContext();
  const offline = new OfflineAudioContext(2, Math.max(1, Math.ceil(duration * 48_000)), 48_000);
  let scheduled = 0;
  const schedule = async (asset: StudioAsset, start: number, offset: number, clipDuration: number) => {
    try {
      const decoded = await decoder.decodeAudioData(await asset.file.arrayBuffer());
      const available = Math.min(clipDuration, decoded.duration - offset, duration - start);
      if (available <= 0) return;
      const source = offline.createBufferSource(); source.buffer = decoded;
      const gain = offline.createGain();
      const fadeIn = Math.min(asset.fadeIn, available / 2);
      const fadeOut = Math.min(asset.fadeOut, available / 2);
      gain.gain.setValueAtTime(fadeIn > 0 ? 0 : asset.volume, start);
      if (fadeIn > 0) gain.gain.linearRampToValueAtTime(asset.volume, start + fadeIn);
      if (fadeOut > 0) {
        gain.gain.setValueAtTime(asset.volume, start + available - fadeOut);
        gain.gain.linearRampToValueAtTime(0, start + available);
      }
      source.connect(gain).connect(offline.destination);
      source.start(start, offset, available);
      scheduled += 1;
    } catch {
      // Silent videos and unsupported source audio are valid; additional clips still render.
    }
  };
  await schedule(video, 0, video.trimStart, duration);
  for (const clip of audioClips) {
    await schedule(clip, Math.max(0, clip.timelineStart), clip.trimStart, clip.trimEnd - clip.trimStart);
  }
  await decoder.close();
  if (!scheduled) return null;
  return offline.startRendering();
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
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [audioMode, setAudioMode] = useState<'music' | 'sfx' | 'speech'>('music');
  const [audioPrompt, setAudioPrompt] = useState('Dreamlike ambient score with glass harmonics, soft pulse, and a seamless ending');
  const [audioDuration, setAudioDuration] = useState(10);
  const [speechText, setSpeechText] = useState('Welcome to Manifold Studio. Shape the picture, sound, and story in one place.');
  const [speechVoice, setSpeechVoice] = useState('M1');
  const [speechSpeed, setSpeechSpeed] = useState(1);
  const [audioGenerateOpen, setAudioGenerateOpen] = useState(false);
  const [audioSearch, setAudioSearch] = useState('cinematic ambient');
  const [audioKind, setAudioKind] = useState<'music' | 'sfx' | 'voice'>('music');
  const [audioResults, setAudioResults] = useState<AudioCatalogAsset[]>([]);
  const [audioSearching, setAudioSearching] = useState(false);
  const [h3AudioEstimateUSD, setH3AudioEstimateUSD] = useState(1.01);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<StudioRenderer | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const selected = assets.find((asset) => asset.id === selectedID) || null;
  const timelineDuration = useMemo(() => {
    const pictureDuration = assets.filter((item) => item.kind !== 'audio').reduce((sum, item) => sum + (item.trimEnd - item.trimStart), 0);
    const audioDuration = assets.filter((item) => item.kind === 'audio').reduce((end, item) => Math.max(end, item.timelineStart + item.trimEnd - item.trimStart), 0);
    return Math.max(1, pictureDuration, audioDuration);
  }, [assets]);
  const customerExtendUSD = useMemo(() => Math.ceil(((selected?.duration || 0) * extendRates.input + extendDuration * extendRates.output) * 100 - 1e-8) / 100, [selected?.duration, extendDuration, extendRates]);
  const extendCredits = Math.ceil(customerExtendUSD / creditPrice);
  const audioEstimateUSD = Math.max(0.1, Math.ceil(h3AudioEstimateUSD * audioDuration / 5 * 100) / 100);
  const audioEstimateCredits = Math.ceil(audioEstimateUSD / creditPrice);
  const speechUSD = Math.max(0.0005, Math.ceil(Math.max(1, speechText.trim().length) / 100 * 0.005 * 10000) / 10000);
  const speechCredits = speechUSD / creditPrice;
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
      if (data.h3_video_estimate?.estimated_cost_usd) setH3AudioEstimateUSD(data.h3_video_estimate.estimated_cost_usd);
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
    const incoming = Array.from(files).filter((file) => file.type.startsWith('video/') || file.type.startsWith('image/') || file.type.startsWith('audio/'));
    if (!incoming.length) {
      setError('Choose an image, video, or audio file');
      return;
    }
    const next: StudioAsset[] = [];
    for (const file of incoming) {
      const kind: MediaKind = file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'image';
      try {
        const metadata = await readDimensions(file, kind);
        next.push({
          id: uid(), name: file.name, kind, file, url: URL.createObjectURL(file),
          ...metadata, trimStart: 0, trimEnd: metadata.duration,
          timelineStart: 0, volume: 1, fadeIn: 0, fadeOut: 0,
          adjustments: { ...DEFAULT_ADJUSTMENTS },
        });
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : `Could not import ${file.name}`);
      }
    }
    setAssets((current) => [...current, ...next]);
    if (next[0]) setSelectedID(next[0].id);
  }

  async function addGeneratedFile(file: File, kind: MediaKind, attribution?: string) {
    const metadata = await readDimensions(file, kind);
    const asset: StudioAsset = {
      id: uid(), name: file.name, kind, file, url: URL.createObjectURL(file), ...metadata,
      trimStart: 0, trimEnd: metadata.duration, timelineStart: 0, volume: 1, fadeIn: 0, fadeOut: 0,
      attribution, adjustments: { ...DEFAULT_ADJUSTMENTS },
    };
    setAssets((current) => [...current, asset]);
    setSelectedID(asset.id);
    return asset;
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
    if (!selected) return;
    if (selected.kind === 'audio' && audioRef.current) {
      if (audioRef.current.paused) {
        if (audioRef.current.currentTime < selected.trimStart || audioRef.current.currentTime >= selected.trimEnd) audioRef.current.currentTime = selected.trimStart;
        void audioRef.current.play(); setPlaying(true);
      } else {
        audioRef.current.pause(); setPlaying(false);
      }
      return;
    }
    if (selected.kind !== 'video' || !videoRef.current) return;
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

  async function searchAudioCatalog() {
    setAudioSearching(true); setError('');
    try {
      const query = new URLSearchParams({ q: audioSearch.trim(), kind: audioKind, limit: '12' });
      const response = await fetch(`/api/studio/audio-search?${query}`);
      const data = await parseJSONResponse<{ results?: AudioCatalogAsset[] }>(response, 'Could not search the audio catalog');
      setAudioResults(data.results || []);
      if (!(data.results || []).length) setNotice('No licensed audio matched that search');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Audio catalog search failed');
    } finally {
      setAudioSearching(false);
    }
  }

  async function importCatalogAudio(asset: AudioCatalogAsset) {
    setBusy(`catalog-${asset.id}`); setError(''); setNotice(`Importing ${asset.title}…`);
    try {
      const response = await fetch(asset.url);
      if (!response.ok) throw new Error('Could not download this catalog track');
      const blob = await response.blob();
      const extension = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('wav') ? 'wav' : blob.type.includes('mpeg') ? 'mp3' : 'opus';
      await addGeneratedFile(new File([blob], `${asset.title}.${extension}`, { type: blob.type || 'audio/ogg' }), 'audio', asset.attribution || asset.provider);
      setNotice(`${asset.title} added · ${asset.license.toUpperCase()}`);
      setMobilePanelOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not import audio');
    } finally {
      setBusy('');
    }
  }

  async function pollGeneratedAudio(jobID: string) {
    for (let attempt = 0; attempt < 240; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 2500));
      const response = await fetch(`/api/video-jobs/${jobID}`, { headers: authHeaders(user?.api_key || '', false) });
      const data = await parseJSONResponse<{ job?: { status?: string; result?: unknown; error?: string } }>(response, 'Audio status failed');
      const status = data.job?.status || '';
      if (status === 'failed' || status === 'payment_required') throw new Error(data.job?.error || 'Audio generation failed');
      if (status === 'completed') {
        const url = resultURL(data.job?.result);
        if (!url) throw new Error('Audio generation returned no media');
        return url;
      }
      setNotice(status === 'processing' ? 'Composing audio…' : 'Audio generation queued…');
    }
    throw new Error('Audio generation is still running and remains available in your account');
  }

  async function generateAudio() {
    if (!user) { setError('Sign in to generate audio'); return; }
    setBusy(`generate-${audioMode}`); setError('');
    try {
      if (audioMode === 'speech') {
        setNotice('Generating speech…');
        const response = await fetch('/api/service', {
          method: 'POST', headers: authHeaders(user.api_key),
          body: JSON.stringify({ service: 'tts', text: speechText.trim(), voice: speechVoice, language: 'en', speed: speechSpeed, steps: 4 }),
        });
        const data = await parseJSONResponse<{ result?: { audio_base64?: string; content_type?: string; format?: string }; credits_remain?: number }>(response, 'Speech generation failed');
        if (!data.result?.audio_base64) throw new Error('Speech generation returned no audio');
        const format = data.result.format || 'wav';
        await addGeneratedFile(base64File(data.result.audio_base64, data.result.content_type || 'audio/wav', `speech-${Date.now()}.${format}`), 'audio');
        if (typeof data.credits_remain === 'number') {
          const next = { ...user, credits: data.credits_remain }; setUser(next); saveUser(next);
        }
        setNotice(`Speech added · ${speechCredits.toFixed(2)} credits`);
      } else {
        setNotice(audioMode === 'music' ? 'Starting music generation…' : 'Starting sound generation…');
        const prompt = `${audioMode === 'music' ? 'Music track' : 'Sound effect'}: ${audioPrompt.trim()}`;
        const response = await fetch('/api/service', {
          method: 'POST', headers: authHeaders(user.api_key),
          body: JSON.stringify({ service: 'h3_video', prompt, size: 'audio', duration: audioDuration, output_format: 'mp4-h264', structured_prompt: true, include_audio: true }),
        });
        const data = await parseJSONResponse<unknown>(response, 'Could not start audio generation');
        const jobID = resultJobID(data);
        if (!jobID) throw new Error('Audio generation returned no job');
        const url = await pollGeneratedAudio(jobID);
        const media = await fetch(url);
        if (!media.ok) throw new Error('Could not download generated audio');
        const blob = await media.blob();
        await addGeneratedFile(new File([blob], `${audioMode}-${Date.now()}.mp4`, { type: blob.type || 'video/mp4' }), 'audio');
        setNotice(`${audioMode === 'music' ? 'Music' : 'Sound'} added · metered H3 generation`);
      }
      setAudioGenerateOpen(false); setMobilePanelOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Audio generation failed');
    } finally {
      setBusy('');
    }
  }

  async function exportAudio() {
    if (!selected || selected.kind !== 'audio') return;
    setBusy('export-audio'); setError('');
    let context: AudioContext | null = null;
    try {
      context = new AudioContext();
      const decoded = await context.decodeAudioData(await selected.file.arrayBuffer());
      const duration = Math.max(0.05, selected.trimEnd - selected.trimStart);
      const offline = new OfflineAudioContext(Math.min(2, decoded.numberOfChannels), Math.ceil(duration * 48_000), 48_000);
      const source = offline.createBufferSource(); source.buffer = decoded;
      const gain = offline.createGain();
      const fadeIn = Math.min(selected.fadeIn, duration / 2);
      const fadeOut = Math.min(selected.fadeOut, duration / 2);
      gain.gain.setValueAtTime(fadeIn > 0 ? 0 : selected.volume, 0);
      if (fadeIn > 0) gain.gain.linearRampToValueAtTime(selected.volume, fadeIn);
      if (fadeOut > 0) {
        gain.gain.setValueAtTime(selected.volume, duration - fadeOut);
        gain.gain.linearRampToValueAtTime(0, duration);
      }
      source.connect(gain).connect(offline.destination);
      source.start(0, selected.trimStart, duration);
      const rendered = await offline.startRendering();
      downloadBlob(wavBlob(rendered), `${selected.name.replace(/\.[^.]+$/, '')}-studio.wav`);
      setNotice('Exported WAV mix locally');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Audio export failed');
    } finally {
      await context?.close().catch(() => undefined); setBusy('');
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
      const duration = selected.trimEnd - selected.trimStart;
      const timelineAudio = assets.filter((asset) => asset.kind === 'audio');

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
      let mixedAudio: AudioBuffer | null = null;
      const audioCodec = exportFormat === 'webm-av1' ? 'opus' : 'aac';
      if (timelineAudio.length) {
        if (!(await canEncodeAudio(audioCodec))) throw new Error(`${audioCodec.toUpperCase()} audio encoding is not available in this browser`);
        mixedAudio = await renderTimelineAudio(selected, timelineAudio, duration);
        if (!mixedAudio) throw new Error('The timeline audio could not be decoded');
        audioSource = new AudioSampleSource({ codec: audioCodec, quality: new Quality('high') });
        output.addAudioTrack(audioSource);
      } else if (audioTrack) {
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

      if (audioSource && mixedAudio) {
        for (const sample of AudioSample.fromAudioBuffer(mixedAudio, 0)) {
          await audioSource.add(sample);
          sample.close();
        }
      } else if (audioSource && audioSink) {
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
    { id: 'audio', label: 'Audio', icon: AudioLines },
    { id: 'ai', label: 'AI tools', icon: Sparkles },
  ];

  return (
    <main className={styles.studio} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); void importFiles(event.dataTransfer.files); }}>
      <header className={styles.topbar}>
        <div className={styles.brandGroup}>
          <button className={styles.iconButton} aria-label="Menu"><Menu size={17} /></button>
          <Link href="/" className={styles.brand} aria-label="Manifold home"><img className={styles.brandMark} src="/brand/logo-mark.webp" alt="" /><span>MANIFOLD</span></Link>
          <span className={styles.divider} />
          <button className={styles.projectName}>Untitled project <ChevronDown size={13} /></button>
        </div>
        <div className={styles.historyActions}>
          <button className={styles.iconButton} aria-label="Undo" disabled><Undo2 size={16} /></button>
          <button className={styles.iconButton} aria-label="Redo" disabled><Redo2 size={16} /></button>
          <span className={styles.saved}>Saved locally</span>
        </div>
        <div className={styles.accountActions}>
          <Link href="/account" className={styles.creditPill}><span className={styles.creditDot} /><span className={styles.creditFull}>{creditsLabel}</span><span className={styles.creditCompact}>{user ? compactCredits(user.credits) : 'Sign in'}</span></Link>
          <Link href="/account?tab=billing" className={styles.topupButton}><Plus size={14} /> Top up</Link>
          <Link href="/account" className={styles.avatar} aria-label="Account"><UserRound size={16} /></Link>
          <button data-testid="studio-export" className={styles.exportButton} disabled={!selected || !!busy} onClick={() => selected?.kind === 'image' ? void exportImage() : selected?.kind === 'audio' ? void exportAudio() : setExportOpen(true)}><Download size={15} /> Export</button>
        </div>
      </header>

      <div className={styles.workspace}>
        <aside className={styles.rail}>
          {toolItems.map(({ id, label, icon: Icon }) => <button data-testid={`studio-tool-${id}`} key={id} className={tool === id ? styles.railActive : ''} onClick={() => { setTool(id); setMobilePanelOpen(tool !== id || !mobilePanelOpen); }}><Icon size={19} /><span>{label}</span></button>)}
          <div className={styles.railBottom}><button><CircleHelp size={18} /><span>Help</span></button></div>
        </aside>

        <aside data-testid="studio-panel" className={`${styles.panel} ${mobilePanelOpen ? styles.panelOpen : ''}`}>
          <button className={styles.panelClose} aria-label="Close tools" onClick={() => setMobilePanelOpen(false)}><X size={16} /></button>
          {tool === 'media' && <>
            <div className={styles.panelHeader}><div><span className={styles.eyebrow}>PROJECT</span><h2>Media</h2></div><button className={styles.smallIcon} onClick={() => fileInputRef.current?.click()}><Plus size={15} /></button></div>
            <button className={styles.importButton} onClick={() => fileInputRef.current?.click()}><Upload size={16} /> Import media</button>
            <input ref={fileInputRef} type="file" multiple accept="video/*,image/*,audio/*" hidden onChange={(event) => event.target.files && void importFiles(event.target.files)} />
            <div className={styles.assetGrid}>
              {assets.map((asset) => <button key={asset.id} onClick={() => setSelectedID(asset.id)} className={`${styles.assetCard} ${asset.id === selectedID ? styles.assetSelected : ''}`}>
                {asset.kind === 'image' ? <img src={asset.url} alt="" /> : asset.kind === 'video' ? <video src={asset.url} muted preload="metadata" /> : <span className={styles.audioThumb}><AudioLines size={24} /></span>}
                <span className={styles.assetType}>{asset.kind === 'video' ? <Film size={11} /> : asset.kind === 'audio' ? <Volume2 size={11} /> : <ImageIcon size={11} />}</span>
                <span className={styles.assetName}>{asset.name}</span>
              </button>)}
            </div>
            {!assets.length && <div className={styles.emptyLibrary}><Clapperboard size={24} /><p>Your imported files stay in this browser.</p></div>}
          </>}

          {tool === 'adjust' && <>
            <div className={styles.panelHeader}><div><span className={styles.eyebrow}>COLOR</span><h2>Adjustments</h2></div><button className={styles.smallIcon} onClick={resetAdjustments} title="Reset"><RotateCcw size={14} /></button></div>
            {!selected || selected.kind === 'audio' ? <PanelEmpty /> : <div className={styles.controls}>{ADJUSTMENTS.map((item) => <label key={item.key} className={styles.sliderRow}><span><b>{item.label}</b><output>{Math.round(selected.adjustments[item.key] * 100)}</output></span><input type="range" min={item.min} max={item.max} step={item.step} value={selected.adjustments[item.key]} onChange={(event) => updateAsset(selected.id, { adjustments: { ...selected.adjustments, [item.key]: Number(event.target.value) } })} /></label>)}</div>}
          </>}

          {tool === 'effects' && <>
            <div className={styles.panelHeader}><div><span className={styles.eyebrow}>PRESETS</span><h2>Looks</h2></div></div>
            {!selected || selected.kind === 'audio' ? <PanelEmpty /> : <div className={styles.lookGrid}>{FILTERS.map((filter) => <button key={filter.name} onClick={() => updateAsset(selected.id, { adjustments: { ...DEFAULT_ADJUSTMENTS, ...filter.values } })}><span style={{ background: `linear-gradient(135deg, ${filter.colors})` }} /><b>{filter.name}</b></button>)}</div>}
          </>}

          {tool === 'crop' && <>
            <div className={styles.panelHeader}><div><span className={styles.eyebrow}>CANVAS</span><h2>Transform</h2></div></div>
            <div className={styles.transformGrid}><button className={styles.settingCard}><Maximize size={17} /><span><b>Fit frame</b><small>Original ratio</small></span></button><button className={styles.settingCard} disabled><Crop size={17} /><span><b>Free crop</b><small>Coming next</small></span></button></div>
            {selected && selected.kind !== 'audio' && <div className={styles.metaList}><span>Dimensions <b>{selected.width} × {selected.height}</b></span><span>Aspect <b>{(selected.width / selected.height).toFixed(2)}:1</b></span></div>}
          </>}

          {tool === 'audio' && <>
            <div className={styles.panelHeader}><div><span className={styles.eyebrow}>SOUND</span><h2>Audio</h2></div></div>
            <div className={styles.quickGenerate}>
              <button onClick={() => { setAudioMode('music'); setAudioGenerateOpen(true); }}><Music2 size={17} /><span><b>Music</b><small>AI · metered</small></span></button>
              <button onClick={() => { setAudioMode('sfx'); setAudioGenerateOpen(true); }}><AudioLines size={17} /><span><b>Sound</b><small>AI · metered</small></span></button>
              <button onClick={() => { setAudioMode('speech'); setAudioGenerateOpen(true); }}><Mic2 size={17} /><span><b>Speech</b><small>from {speechCredits.toFixed(2)} cr</small></span></button>
            </div>
            {selected?.kind === 'audio' && <div className={styles.audioControls}>
              <span className={styles.sectionLabel}>SELECTED CLIP</span>
              <label className={styles.sliderRow}><span><b>Volume</b><output>{Math.round(selected.volume * 100)}%</output></span><input type="range" min="0" max="2" step="0.01" value={selected.volume} onChange={(event) => updateAsset(selected.id, { volume: Number(event.target.value) })} /></label>
              <label className={styles.sliderRow}><span><b>Fade in</b><output>{selected.fadeIn.toFixed(1)}s</output></span><input type="range" min="0" max={Math.min(5, (selected.trimEnd - selected.trimStart) / 2)} step="0.1" value={selected.fadeIn} onChange={(event) => updateAsset(selected.id, { fadeIn: Number(event.target.value) })} /></label>
              <label className={styles.sliderRow}><span><b>Fade out</b><output>{selected.fadeOut.toFixed(1)}s</output></span><input type="range" min="0" max={Math.min(5, (selected.trimEnd - selected.trimStart) / 2)} step="0.1" value={selected.fadeOut} onChange={(event) => updateAsset(selected.id, { fadeOut: Number(event.target.value) })} /></label>
            </div>}
            <div className={styles.catalogHeader}><span className={styles.sectionLabel}>LICENSED CATALOG</span><Library size={14} /></div>
            <div className={styles.searchRow}><Search size={14} /><input data-testid="studio-audio-search" value={audioSearch} onChange={(event) => setAudioSearch(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void searchAudioCatalog()} placeholder="Search music and sounds" /><button disabled={audioSearching} onClick={() => void searchAudioCatalog()}>{audioSearching ? <Loader2 className={styles.spin} size={14} /> : 'Find'}</button></div>
            <div className={styles.kindChips}>{(['music', 'sfx', 'voice'] as const).map((kind) => <button key={kind} className={audioKind === kind ? styles.kindActive : ''} onClick={() => setAudioKind(kind)}>{kind === 'sfx' ? 'SFX' : kind}</button>)}</div>
            <div className={styles.catalogList}>{audioResults.map((asset) => <article key={asset.id} className={styles.catalogCard}><button className={styles.catalogPlay} onClick={() => { const audio = new Audio(asset.preview_url || asset.url); void audio.play(); }} aria-label={`Preview ${asset.title}`}><Play size={12} fill="currentColor" /></button><span><b>{asset.title}</b><small>{formatTime(asset.duration).slice(3)} · {asset.license.toUpperCase()} · {asset.provider}</small></span><button disabled={!!busy} onClick={() => void importCatalogAudio(asset)}>{busy === `catalog-${asset.id}` ? <Loader2 className={styles.spin} size={13} /> : <Plus size={13} />}</button></article>)}</div>
            {!audioResults.length && <p className={styles.aiNote}>Search Netwrck&apos;s licensed music, sound-effects, and voice index. Catalog imports and local edits are free.</p>}
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
            <div className={styles.stageStatus}>{selected ? selected.kind === 'audio' ? `${formatTime(selected.duration).slice(3)} audio` : `${selected.width} × ${selected.height}` : 'Ready'}</div>
            <div className={styles.stageRight}><button className={styles.iconButton} onClick={() => setZoom((value) => Math.max(.5, value - .1))}><Minus size={14} /></button><span>{Math.round(zoom * 100)}%</span><button className={styles.iconButton} onClick={() => setZoom((value) => Math.min(2, value + .1))}><Plus size={14} /></button><button className={styles.iconButton}><Maximize size={14} /></button></div>
          </div>
          <div className={styles.stage}>
            {selected?.kind === 'audio' ? <div className={styles.audioPreview}>
              <span><AudioLines size={36} /></span><small>AUDIO CLIP</small><h2>{selected.name}</h2>
              <div className={styles.heroWaveform}>{Array.from({ length: 52 }, (_, index) => <i key={index} style={{ height: `${18 + ((index * 31) % 75)}%` }} />)}</div>
              <audio ref={audioRef} src={selected.url} controls preload="metadata" onTimeUpdate={(event) => setPlayhead(event.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
              {selected.attribution && <p>Credit: {selected.attribution}</p>}
            </div> : selected ? <div className={styles.canvasWrap} style={{ transform: `scale(${zoom})`, aspectRatio: `${selected.width}/${selected.height}` }}>
              {selected.kind === 'video' && <video ref={videoRef} className={styles.sourceVideo} src={selected.url} muted={false} playsInline preload="auto" onLoadedData={() => { if (videoRef.current) videoRef.current.currentTime = selected.trimStart; drawCurrent(); }} />}
              <canvas ref={canvasRef} className={styles.previewCanvas} />
            </div> : <button data-testid="studio-empty" className={styles.dropPrompt} onClick={() => fileInputRef.current?.click()}><span><Upload size={26} /></span><b>Drop media to begin</b><small>Video, image, audio, WebM, MP4, WAV, PNG</small><em>Browse files</em></button>}
            {dragging && <div className={styles.dropOverlay}><div><Upload size={28} /><b>Drop to import</b></div></div>}
          </div>
          {(notice || error) && <div className={`${styles.toast} ${error ? styles.toastError : ''}`}><span>{error || notice}</span><button onClick={() => { setError(''); setNotice(''); }}><X size={14} /></button></div>}
        </section>
      </div>

      <section className={styles.timeline}>
        <div className={styles.timelineToolbar}>
          <div className={styles.timelineTools}><button onClick={() => fileInputRef.current?.click()}><Plus size={14} /> Add</button><button disabled={!selected}><Scissors size={14} /> Split</button><button onClick={duplicateSelected} disabled={!selected}><Copy size={14} /></button><button onClick={removeSelected} disabled={!selected}><Trash2 size={14} /></button></div>
          <div className={styles.transport}><button onClick={() => selected && setPlayhead(selected.trimStart)}><ArrowLeft size={15} /></button><button className={styles.playButton} onClick={togglePlayback} disabled={!selected || selected.kind === 'image'}>{playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}</button><span>{formatTime(playhead)} <i>/</i> {formatTime(selected ? selected.trimEnd - selected.trimStart : timelineDuration)}</span></div>
          <div className={styles.timelineZoom}><ZoomIn size={14} /><input type="range" min="0.5" max="2.5" step="0.1" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></div>
        </div>
        <div className={styles.timelineBody}>
          <div className={styles.trackLabels}><span>VIDEO</span><div>V1</div><div className={styles.audioLabel}>A1</div></div>
          <div className={styles.trackContent}>
            <div className={styles.ruler}>{Array.from({ length: 13 }, (_, index) => <span key={index} style={{ left: `${index / 12 * 100}%` }}>{formatTime(timelineDuration * index / 12).slice(3)}</span>)}</div>
            <div className={styles.videoTrack}>{assets.filter((asset) => asset.kind !== 'audio').map((asset) => <button key={asset.id} onClick={() => setSelectedID(asset.id)} className={`${styles.timelineClip} ${selectedID === asset.id ? styles.timelineClipSelected : ''}`} style={{ flex: Math.max(.5, asset.trimEnd - asset.trimStart) }}><span className={styles.clipThumb} style={{ backgroundImage: `url(${asset.kind === 'image' ? asset.url : ''})` }}>{asset.kind === 'video' && <Film size={15} />}</span><span><b>{asset.name}</b><small>{formatTime(asset.trimEnd - asset.trimStart)}</small></span></button>)}</div>
            <div className={styles.audioTrack}>{assets.filter((asset) => asset.kind === 'audio').map((asset) => <button key={asset.id} className={`${styles.waveformClip} ${selectedID === asset.id ? styles.timelineClipSelected : ''}`} style={{ width: `${Math.max(18, (asset.trimEnd - asset.trimStart) / timelineDuration * 100)}%`, marginLeft: `${asset.timelineStart / timelineDuration * 100}%` }} onClick={() => setSelectedID(asset.id)}><span>{Array.from({ length: 54 }, (_, index) => <i key={index} style={{ height: `${15 + ((index * 29) % 70)}%` }} />)}</span><b>{asset.name}</b></button>)}</div>
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

      {audioGenerateOpen && <Modal title={audioMode === 'music' ? 'Generate music' : audioMode === 'sfx' ? 'Generate sound' : 'Text to speech'} onClose={() => !busy && setAudioGenerateOpen(false)}>
        {audioMode === 'speech' ? <>
          <label className={styles.field}><span>Script</span><textarea data-testid="studio-speech-text" value={speechText} onChange={(event) => setSpeechText(event.target.value)} rows={5} maxLength={4000} /></label>
          <div className={styles.modalGrid}>
            <label className={styles.field}><span>Voice</span><select value={speechVoice} onChange={(event) => setSpeechVoice(event.target.value)}><option value="M1">M1 · balanced</option><option value="F1">F1 · clear</option><option value="M2">M2 · warm</option><option value="F2">F2 · bright</option></select></label>
            <label className={styles.field}><span>Speed · {speechSpeed.toFixed(1)}×</span><input type="range" min="0.7" max="1.4" step="0.1" value={speechSpeed} onChange={(event) => setSpeechSpeed(Number(event.target.value))} /></label>
          </div>
          <div className={styles.priceLine}><span>Exact text charge</span><b>${speechUSD.toFixed(4)} · {speechCredits.toFixed(2)} credits</b></div>
        </> : <>
          <label className={styles.field}><span>{audioMode === 'music' ? 'Describe the track' : 'Describe the sound'}</span><textarea data-testid="studio-audio-prompt" value={audioPrompt} onChange={(event) => setAudioPrompt(event.target.value)} rows={4} maxLength={2000} /></label>
          <div className={styles.durationChoices}>{[5, 10, 20, 30, 45].map((duration) => <button key={duration} className={audioDuration === duration ? styles.durationActive : ''} onClick={() => setAudioDuration(duration)}>{duration}s</button>)}</div>
          <div className={styles.priceLine}><span>Estimated H3 charge</span><b>~${audioEstimateUSD.toFixed(2)} · ~{audioEstimateCredits.toLocaleString()} credits</b></div>
        </>}
        <p className={styles.billingNote}>Catalog search and editing are free. Generation is charged only through your Manifold credits.</p>
        <button data-testid="studio-audio-generate" className={styles.modalPrimary} disabled={!!busy || (audioMode === 'speech' ? !speechText.trim() : !audioPrompt.trim())} onClick={() => void generateAudio()}>{busy.startsWith('generate-') ? <><Loader2 className={styles.spin} size={16} /> Generating…</> : <><Sparkles size={16} /> Generate and add to timeline</>}</button>
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
