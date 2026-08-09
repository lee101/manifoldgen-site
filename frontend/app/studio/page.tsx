'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  AudioLines,
  ChevronDown,
  ChevronUp,
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
  CanvasSource,
  EncodedAudioPacketSource,
  EncodedPacketSink,
  Input,
  Mp4OutputFormat,
  Output,
  Quality,
  VideoSampleSink,
  WebMOutputFormat,
  canEncodeAudio,
  canEncodeVideo,
} from 'mediabunny';
import { loadStoredUser, refreshUser, saveUser, type StoredUser } from '../../lib/auth';
import { HTTPResponseError, parseJSONResponse } from '../../lib/http';
import { CREDITS_UPDATED_EVENT, openPaymentDialog } from '../../lib/payments';
import {
  DEFAULT_ADJUSTMENTS,
  StudioRenderer,
  type StudioAdjustments,
} from '../../lib/studio-renderer';
import {
  STUDIO_PROJECT_VERSION,
  loadLocalStudioProject,
  saveLocalStudioProject,
  type LocalStudioProject,
  type PortableStudioAsset,
  type PortableStudioDocument,
} from '../../lib/studio-projects';
import styles from './page.module.css';

type MediaKind = 'video' | 'image' | 'audio';
type Tool = 'media' | 'adjust' | 'crop' | 'effects' | 'audio' | 'ai';
type ExportFormat = 'mp4-h264' | 'webm-vp9' | 'webm-av1';
type ExportResolution = 'source' | '2160p' | '1440p' | '1080p' | '720p';
type ExportFrameRate = 'source' | 24 | 30 | 60;
type ExportQuality = 'draft' | 'balanced' | 'high';
type ExportSettings = {
  format: ExportFormat;
  resolution: ExportResolution;
  frameRate: ExportFrameRate;
  quality: ExportQuality;
};
type SpeechVoice = 'M1' | 'F1' | 'M2' | 'F2';
type TimelineDrag = {
  mode: 'move' | 'trim-left' | 'trim-right' | 'scrub';
  pointerID: number;
  startX: number;
  startY: number;
  pixelsPerSecond: number;
  trackHeight: number;
  targetID?: string;
  didMove: boolean;
  toggleOnClick?: boolean;
  trackDelta: number;
  originals: Map<string, Pick<StudioAsset, 'timelineStart' | 'trimStart' | 'trimEnd' | 'duration' | 'visualTrack' | 'kind'>>;
};
type StageDrag = {
  assetID: string;
  pointerID: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
  stageWidth: number;
  stageHeight: number;
};

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

type RestyleReference = {
  id: string;
  name: string;
  kind: MediaKind;
  file: File;
  url: string;
  cloudURL?: string;
};

const SPEECH_VOICES: { id: SpeechVoice; name: string; character: string }[] = [
  { id: 'M1', name: 'Balanced', character: 'Natural and versatile' },
  { id: 'F1', name: 'Clear', character: 'Crisp and articulate' },
  { id: 'M2', name: 'Warm', character: 'Relaxed and inviting' },
  { id: 'F2', name: 'Bright', character: 'Lively and expressive' },
];

const voiceSampleBaseURL = (process.env.NEXT_PUBLIC_STATIC_BASE_URL || '/static').replace(/\/$/, '');

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
  visualTrack: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  stageX: number;
  stageY: number;
  attribution?: string;
  adjustments: StudioAdjustments;
  cloudURL?: string;
  objectKey?: string;
};

type CloudProject = {
  id: string;
  name: string;
  document?: PortableStudioDocument;
  revision: number;
  created_at: string;
  updated_at: string;
};

type StudioPerfDiagnostics = {
  renderer?: ReturnType<StudioRenderer['diagnostics']>;
  previewFrames: number;
  previewStartedAt: number;
  previewLastAt: number;
  export?: {
    sourceWidth: number;
    sourceHeight: number;
    width: number;
    height: number;
    hardwareAcceleration: 'prefer-hardware' | 'no-preference';
    hardwareRequested: 'prefer-hardware';
    startedAt: number;
    completedAt?: number;
    frames?: number;
    format?: ExportFormat;
    frameRate?: ExportFrameRate;
    quality?: ExportQuality;
  };
};

const EXPORT_SETTINGS_KEY = 'mg_studio_export_settings_v1';
const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  format: 'mp4-h264',
  resolution: 'source',
  frameRate: 'source',
  quality: 'balanced',
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

function hueToHex(hue: number) {
  const normalized = ((hue % 360) + 360) % 360;
  const chroma = 1;
  const segment = normalized / 60;
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
  const [red, green, blue] = segment < 1 ? [chroma, secondary, 0] : segment < 2 ? [secondary, chroma, 0] : segment < 3 ? [0, chroma, secondary] : segment < 4 ? [0, secondary, chroma] : segment < 5 ? [secondary, 0, chroma] : [chroma, 0, secondary];
  return `#${[red, green, blue].map((channel) => Math.round(channel * 255).toString(16).padStart(2, '0')).join('')}`;
}

function hexToHue(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  const red = (value >> 16) / 255;
  const green = ((value >> 8) & 255) / 255;
  const blue = (value & 255) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  if (!delta) return 0;
  const hue = max === red ? 60 * (((green - blue) / delta) % 6) : max === green ? 60 * ((blue - red) / delta + 2) : 60 * ((red - green) / delta + 4);
  return hue > 180 ? hue - 360 : hue;
}

function uid() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

function fitWithin(width: number, height: number, maxWidth: number, maxHeight: number) {
  const scale = Math.min(1, maxWidth / Math.max(1, width), maxHeight / Math.max(1, height));
  return {
    width: Math.max(2, Math.round(width * scale / 2) * 2),
    height: Math.max(2, Math.round(height * scale / 2) * 2),
  };
}

function exportSize(width: number, height: number, resolution: ExportResolution) {
  if (resolution === 'source') return fitWithin(width, height, 4096, 4096);
  const shortEdge = Number.parseInt(resolution, 10);
  const longEdge = Math.round(shortEdge * 16 / 9);
  return width >= height
    ? fitWithin(width, height, longEdge, shortEdge)
    : fitWithin(width, height, shortEdge, longEdge);
}

function loadExportSettings(): ExportSettings {
  if (typeof window === 'undefined') return DEFAULT_EXPORT_SETTINGS;
  try {
    const stored = JSON.parse(window.localStorage.getItem(EXPORT_SETTINGS_KEY) || '{}') as Partial<ExportSettings>;
    const formats: ExportFormat[] = ['mp4-h264', 'webm-vp9', 'webm-av1'];
    const resolutions: ExportResolution[] = ['source', '2160p', '1440p', '1080p', '720p'];
    const frameRates: ExportFrameRate[] = ['source', 24, 30, 60];
    const qualities: ExportQuality[] = ['draft', 'balanced', 'high'];
    return {
      format: formats.includes(stored.format as ExportFormat) ? stored.format as ExportFormat : DEFAULT_EXPORT_SETTINGS.format,
      resolution: resolutions.includes(stored.resolution as ExportResolution) ? stored.resolution as ExportResolution : DEFAULT_EXPORT_SETTINGS.resolution,
      frameRate: frameRates.includes(stored.frameRate as ExportFrameRate) ? stored.frameRate as ExportFrameRate : DEFAULT_EXPORT_SETTINGS.frameRate,
      quality: qualities.includes(stored.quality as ExportQuality) ? stored.quality as ExportQuality : DEFAULT_EXPORT_SETTINGS.quality,
    };
  } catch {
    return DEFAULT_EXPORT_SETTINGS;
  }
}

function exportFormatDetails(format: ExportFormat) {
  if (format === 'mp4-h264') return { codec: 'avc' as const, extension: 'mp4', mime: 'video/mp4', label: 'H.264' };
  if (format === 'webm-vp9') return { codec: 'vp9' as const, extension: 'webm', mime: 'video/webm', label: 'VP9' };
  return { codec: 'av1' as const, extension: 'webm', mime: 'video/webm', label: 'AV1' };
}

function perfDiagnostics(): StudioPerfDiagnostics {
  const target = window as typeof window & { __MANIFOLD_STUDIO_PERF__?: StudioPerfDiagnostics };
  target.__MANIFOLD_STUDIO_PERF__ ||= { previewFrames: 0, previewStartedAt: 0, previewLastAt: 0 };
  return target.__MANIFOLD_STUDIO_PERF__;
}

function portableAsset(asset: StudioAsset): PortableStudioAsset {
  return {
    id: asset.id, name: asset.name, kind: asset.kind,
    duration: asset.duration, width: asset.width, height: asset.height,
    trimStart: asset.trimStart, trimEnd: asset.trimEnd, timelineStart: asset.timelineStart,
    visualTrack: asset.visualTrack,
    volume: asset.volume, fadeIn: asset.fadeIn, fadeOut: asset.fadeOut,
    stageX: asset.stageX, stageY: asset.stageY, attribution: asset.attribution,
    adjustments: asset.adjustments, cloudURL: asset.cloudURL, objectKey: asset.objectKey,
    contentType: asset.file.type || 'application/octet-stream', size: asset.file.size,
    lastModified: asset.file.lastModified,
  };
}

function projectDocument(assets: StudioAsset[], selectedID: string): PortableStudioDocument {
  return { version: STUDIO_PROJECT_VERSION, selectedID, assets: assets.map(portableAsset) };
}

async function materializeProject(document: PortableStudioDocument, localFiles = new Map<string, File>()) {
  const assets: StudioAsset[] = [];
  for (const stored of document.assets || []) {
    let file = localFiles.get(stored.id);
    if (!file && stored.cloudURL) {
      const response = await fetch(stored.cloudURL);
      if (!response.ok) throw new Error(`Could not download ${stored.name}`);
      const blob = await response.blob();
      file = new File([blob], stored.name, { type: stored.contentType || blob.type, lastModified: stored.lastModified });
    }
    if (!file) continue;
    assets.push({
      ...stored,
      visualTrack: stored.kind === 'audio' ? 0 : Math.max(0, Math.floor(stored.visualTrack || 0)),
      file,
      url: URL.createObjectURL(file),
      adjustments: { ...DEFAULT_ADJUSTMENTS, ...stored.adjustments },
    });
  }
  return assets;
}

const MIN_CLIP_DURATION = 0.1;
const MAX_VISUAL_TRACKS = 12;

function clipDuration(asset: Pick<StudioAsset, 'trimStart' | 'trimEnd'>) {
  return Math.max(0, asset.trimEnd - asset.trimStart);
}

function clipEnd(asset: Pick<StudioAsset, 'timelineStart' | 'trimStart' | 'trimEnd'>) {
  return asset.timelineStart + clipDuration(asset);
}

function PassiveStageMedia({ asset, playhead, playing }: { asset: StudioAsset; playhead: number; playing: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const sourceTime = asset.trimStart + Math.max(0, Math.min(clipDuration(asset), playhead - asset.timelineStart));

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (!playing || Math.abs(element.currentTime - sourceTime) > 0.25) element.currentTime = sourceTime;
    if (playing) void element.play().catch(() => undefined);
    else element.pause();
  }, [playing, sourceTime]);

  if (asset.kind === 'image') return <img className={styles.stageLayerMedia} src={asset.url} alt="" draggable={false} />;
  return <video ref={video} className={styles.stageLayerMedia} src={asset.url} muted playsInline preload="auto" />;
}

function mediaKindForFile(file: File): MediaKind | null {
  if (file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|mkv)$/i.test(file.name)) return 'video';
  if (file.type.startsWith('audio/') || /\.(wav|mp3|ogg|oga|m4a|aac|flac)$/i.test(file.name)) return 'audio';
  if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|avif|bmp)$/i.test(file.name)) return 'image';
  return null;
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

async function renderTimelineAudio(video: StudioAsset, audioClips: StudioAsset[], duration: number, timelineOffset: number) {
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
    const overlapStart = Math.max(timelineOffset, clip.timelineStart);
    const overlapEnd = Math.min(timelineOffset + duration, clipEnd(clip));
    if (overlapEnd <= overlapStart) continue;
    await schedule(clip, overlapStart - timelineOffset, clip.trimStart + overlapStart - clip.timelineStart, overlapEnd - overlapStart);
  }
  await decoder.close();
  if (!scheduled) return null;
  return offline.startRendering();
}

export default function StudioPage() {
  const [assets, setAssets] = useState<StudioAsset[]>([]);
  const [projectID, setProjectID] = useState('');
  const [projectName, setProjectName] = useState('Untitled project');
  const [projectReady, setProjectReady] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [cloudProjects, setCloudProjects] = useState<CloudProject[]>([]);
  const [saveStatus, setSaveStatus] = useState('Loading project…');
  const [syncRetry, setSyncRetry] = useState(0);
  const [selectedID, setSelectedID] = useState('');
  const [selectedIDs, setSelectedIDs] = useState<string[]>([]);
  const [tool, setTool] = useState<Tool>('media');
  const [user, setUser] = useState<StoredUser | null>(null);
  const [creditPrice, setCreditPrice] = useState(0.01);
  const [extendRates, setExtendRates] = useState({ input: 0.012, output: 0.084 });
  const [upscaleRates, setUpscaleRates] = useState({ base: 0.10, outputMPSecond: 0.012 });
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [stageZoom, setStageZoom] = useState(1);
  const [stageDragPosition, setStageDragPosition] = useState<{ assetID: string; x: number; y: number } | null>(null);
  const [stageGuides, setStageGuides] = useState({ horizontal: false, vertical: false });
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [timelineDropTime, setTimelineDropTime] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportSettings, setExportSettings] = useState<ExportSettings>(loadExportSettings);
  const [exportProgress, setExportProgress] = useState(0);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendPrompt, setExtendPrompt] = useState('The camera continues forward as the scene naturally unfolds.');
  const [extendDuration, setExtendDuration] = useState(6);
  const [upscaleOpen, setUpscaleOpen] = useState(false);
  const [upscaleScale, setUpscaleScale] = useState<2 | 4>(2);
  const [restyleOpen, setRestyleOpen] = useState(false);
  const [restyleSourceID, setRestyleSourceID] = useState('');
  const [restyleModel, setRestyleModel] = useState<'wan-2.2' | 'h3-reference'>('wan-2.2');
  const [restylePrompt, setRestylePrompt] = useState('Transform this clip into a cinematic hand-painted animation while preserving the original motion and composition.');
  const [restyleNegativePrompt, setRestyleNegativePrompt] = useState('flicker, warped anatomy, inconsistent subject, text, watermark');
  const [restyleStrength, setRestyleStrength] = useState(0.85);
  const [restyleFrames, setRestyleFrames] = useState(81);
  const [restyleFPS, setRestyleFPS] = useState(16);
  const [restyleResolution, setRestyleResolution] = useState('720p');
  const [restyleAspect, setRestyleAspect] = useState('auto');
  const [restyleDuration, setRestyleDuration] = useState(10);
  const [restyleSeed, setRestyleSeed] = useState(0);
  const [restyleReferences, setRestyleReferences] = useState<RestyleReference[]>([]);
  const [contextMenu, setContextMenu] = useState<{ assetID: string; x: number; y: number } | null>(null);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [audioMode, setAudioMode] = useState<'music' | 'sfx' | 'speech'>('music');
  const [audioPrompt, setAudioPrompt] = useState('Dreamlike ambient score with glass harmonics, soft pulse, and a seamless ending');
  const [audioDuration, setAudioDuration] = useState(10);
  const [speechText, setSpeechText] = useState('Welcome to Manifold Studio. Shape the picture, sound, and story in one place.');
  const [speechVoice, setSpeechVoice] = useState<SpeechVoice>('M1');
  const [speechSpeed, setSpeechSpeed] = useState(1);
  const [previewingVoice, setPreviewingVoice] = useState<SpeechVoice | null>(null);
  const [voicePreviewError, setVoicePreviewError] = useState('');
  const [audioGenerateOpen, setAudioGenerateOpen] = useState(false);
  const [audioSearch, setAudioSearch] = useState('cinematic ambient');
  const [audioKind, setAudioKind] = useState<'music' | 'sfx' | 'voice'>('music');
  const [audioResults, setAudioResults] = useState<AudioCatalogAsset[]>([]);
  const [audioSearching, setAudioSearching] = useState(false);
  const [h3AudioEstimateUSD, setH3AudioEstimateUSD] = useState(1.01);
  const [ttsPer100USD, setTTSPer100USD] = useState(0.005);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const restyleReferenceInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<StudioRenderer | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const galleryImportStartedRef = useRef(false);
  const timelineCanvasRef = useRef<HTMLDivElement>(null);
  const timelineContentRef = useRef<HTMLDivElement>(null);
  const timelineLabelsRef = useRef<HTMLDivElement>(null);
  const timelineDragRef = useRef<TimelineDrag | null>(null);
  const timelineClipboardRef = useRef<StudioAsset[]>([]);
  const stageRef = useRef<HTMLDivElement>(null);
  const stageDragRef = useRef<StageDrag | null>(null);
  const uploadInFlightRef = useRef(new Set<string>());
  const projectSaveSequenceRef = useRef(0);
  const voicePreviewRef = useRef<HTMLAudioElement | null>(null);

  const selected = assets.find((asset) => asset.id === selectedID) || null;
  const selectedAssets = useMemo(() => assets.filter((asset) => selectedIDs.includes(asset.id)), [assets, selectedIDs]);
  const stageVisualAssets = useMemo(() => assets
    .filter((asset) => asset.kind !== 'audio' && (asset.id === selectedID || (playhead >= asset.timelineStart && playhead < clipEnd(asset))))
    .sort((left, right) => left.visualTrack - right.visualTrack), [assets, playhead, selectedID]);
  const selectedExportSize = selected ? exportSize(selected.width, selected.height, exportSettings.resolution) : null;
  const selectedClipDuration = selected ? clipDuration(selected) : 0;
  const canExtendSelected = selected?.kind === 'video' && selectedClipDuration >= 2 && selectedClipDuration <= 15.1;
  const canOpenUpscale = selected?.kind === 'video' && selected.duration <= 60 && selected.width * 2 <= 8192 && selected.height * 2 <= 8192;
  const canUpscaleSelected = selected?.kind === 'video' && selected.duration <= 60 && selected.width * upscaleScale <= 8192 && selected.height * upscaleScale <= 8192;
  const timelineDuration = useMemo(() => {
    return Math.max(1, ...assets.map(clipEnd));
  }, [assets]);
  const visualTrackCount = useMemo(() => Math.max(2, 1 + Math.max(0, ...assets.filter((asset) => asset.kind !== 'audio').map((asset) => asset.visualTrack))), [assets]);
  const visibleVisualTrackCount = Math.min(3, visualTrackCount);
  const pixelsPerSecond = 64 * timelineZoom;
  const rulerStep = pixelsPerSecond < 42 ? 5 : pixelsPerSecond < 82 ? 2 : 1;
  const rulerDuration = Math.max(rulerStep, Math.ceil(timelineDuration / rulerStep) * rulerStep);
  const timelineWidth = Math.max(320, rulerDuration * pixelsPerSecond + 48);
  const customerExtendUSD = useMemo(() => Math.ceil(((selected?.duration || 0) * extendRates.input + extendDuration * extendRates.output) * 100 - 1e-8) / 100, [selected?.duration, extendDuration, extendRates]);
  const extendCredits = Math.ceil(customerExtendUSD / creditPrice);
  const customerUpscaleUSD = useMemo(() => {
    if (!selected || selected.kind !== 'video') return upscaleRates.base;
    const outputMP = selected.width * selected.height * upscaleScale * upscaleScale / 1_000_000;
    return Math.ceil((upscaleRates.base + outputMP * selected.duration * upscaleRates.outputMPSecond) * 100 - 1e-8) / 100;
  }, [selected, upscaleRates, upscaleScale]);
  const upscaleCredits = Math.ceil(customerUpscaleUSD / creditPrice);
  const audioEstimateUSD = Math.max(0.1, Math.ceil(h3AudioEstimateUSD * audioDuration / 5 * 100) / 100);
  const audioEstimateCredits = Math.ceil(audioEstimateUSD / creditPrice);
  const speechUSD = Math.max(ttsPer100USD * 0.1, Math.ceil(Math.max(1, speechText.trim().length) / 100 * ttsPer100USD * 10000) / 10000);
  const speechCredits = speechUSD / creditPrice;
  const restyleEstimateUSD = useMemo(() => {
    if (restyleModel === 'h3-reference') {
      const rate = restyleResolution === '4K' ? 0.16 : restyleResolution === '2K' ? 0.13 : 0.08;
      const images = restyleReferences.filter((item) => item.kind === 'image').length;
      return Math.ceil((rate * restyleDuration + Math.max(0, images - 5) * 0.08) * 1.2 * 100) / 100;
    }
    const rate = restyleResolution === '480p' ? 0.04 : restyleResolution === '580p' ? 0.06 : 0.08;
    return Math.ceil(rate * restyleFrames / 16 * 1.2 * 100) / 100;
  }, [restyleDuration, restyleFrames, restyleModel, restyleReferences, restyleResolution]);
  const restyleEstimateCredits = Math.ceil(restyleEstimateUSD / creditPrice);
  const creditsLabel = useMemo(() => {
    if (!user) return 'Sign in';
    const usd = user.credits_usd ?? user.credits * creditPrice;
    return `${Math.round(user.credits).toLocaleString()} cr · $${usd.toFixed(2)}`;
  }, [user, creditPrice]);

  const updateAsset = useCallback((id: string, update: Partial<StudioAsset>) => {
    setAssets((current) => current.map((item) => (item.id === id ? { ...item, ...update } : item)));
  }, []);

  const selectOnly = useCallback((id: string) => {
    setSelectedID(id);
    setSelectedIDs(id ? [id] : []);
  }, []);

  const selectClip = useCallback((id: string, additive = false) => {
    if (!additive) {
      selectOnly(id);
      return;
    }
    setSelectedIDs((current) => {
      if (current.includes(id)) {
        const next = current.filter((item) => item !== id);
        setSelectedID(next.at(-1) || '');
        return next;
      }
      setSelectedID(id);
      return [...current, id];
    });
  }, [selectOnly]);

  const seekTimeline = useCallback((time: number, preferredID?: string) => {
    const nextTime = Math.max(0, Math.min(timelineDuration, time));
    setPlayhead(nextTime);
    const active = preferredID
      ? assets.find((asset) => asset.id === preferredID)
      : assets.find((asset) => asset.id === selectedID && nextTime >= asset.timelineStart && nextTime <= clipEnd(asset));
    if (active?.id === selectedID) {
      const sourceTime = active.trimStart + Math.max(0, Math.min(clipDuration(active), nextTime - active.timelineStart));
      if (active.kind === 'video' && videoRef.current) videoRef.current.currentTime = sourceTime;
      if (active.kind === 'audio' && audioRef.current) audioRef.current.currentTime = sourceTime;
    }
  }, [assets, selectedID, timelineDuration]);

  const applyProject = useCallback(async (id: string, name: string, document: PortableStudioDocument, files?: Map<string, File>) => {
    const restored = await materializeProject(document, files);
    setAssets((current) => {
      current.forEach((asset) => URL.revokeObjectURL(asset.url));
      return restored;
    });
    setProjectID(id);
    setProjectName(name || 'Untitled project');
    const restoredSelected = restored.some((asset) => asset.id === document.selectedID) ? document.selectedID : restored[0]?.id || '';
    setSelectedID(restoredSelected);
    setSelectedIDs(restoredSelected ? [restoredSelected] : []);
    setPlayhead(restored.find((asset) => asset.id === restoredSelected)?.timelineStart || 0);
    window.history.replaceState({}, '', `/studio?project=${encodeURIComponent(id)}`);
  }, []);

  const fetchCloudProject = useCallback(async (id: string, apiKey: string) => {
    const response = await fetch(`/api/studio/projects/${encodeURIComponent(id)}`, { headers: authHeaders(apiKey, false) });
    const data = await parseJSONResponse<{ project: CloudProject }>(response, 'Could not load cloud project');
    if (!data.project.document) throw new Error('Cloud project has no document');
    return data.project;
  }, []);

  const refreshCloudProjects = useCallback(async (apiKey: string) => {
    const response = await fetch('/api/studio/projects', { headers: authHeaders(apiKey, false) });
    const data = await parseJSONResponse<{ projects: CloudProject[] }>(response, 'Could not list cloud projects');
    setCloudProjects(data.projects || []);
    return data.projects || [];
  }, []);

  async function openProject(id: string) {
    setProjectMenuOpen(false);
    setSaveStatus('Loading project…');
    try {
      const local = await loadLocalStudioProject(id);
      if (local) {
        await applyProject(local.id, local.name, local.document, local.files);
      } else if (user) {
        const cloud = await fetchCloudProject(id, user.api_key);
        await applyProject(cloud.id, cloud.name, cloud.document!);
      } else {
        throw new Error('Sign in to open this cloud project');
      }
      setSaveStatus(user ? 'Saved to cloud' : 'Saved locally');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not open project');
      setSaveStatus('Project load failed');
    }
  }

  function newProject() {
    assets.forEach((asset) => URL.revokeObjectURL(asset.url));
    const id = uid();
    setAssets([]); setSelectedID(''); setSelectedIDs([]); setPlayhead(0);
    setProjectID(id); setProjectName('Untitled project'); setProjectMenuOpen(false);
    window.history.replaceState({}, '', `/studio?project=${encodeURIComponent(id)}`);
    setSaveStatus(user ? 'Saving to cloud…' : 'Saving locally…');
  }

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
      if (data.studio?.upscale_base_usd && data.studio?.upscale_output_mp_second_usd) {
        setUpscaleRates({ base: data.studio.upscale_base_usd, outputMPSecond: data.studio.upscale_output_mp_second_usd });
      }
      if (data.h3_video_estimate?.estimated_cost_usd) setH3AudioEstimateUSD(data.h3_video_estimate.estimated_cost_usd);
      const ttsPrice = Array.isArray(data.pricing) ? data.pricing.find((item: { service?: string }) => item.service === 'tts')?.price_usd : 0;
      if (ttsPrice) setTTSPer100USD(ttsPrice);
    }).catch(() => undefined);
    return () => assets.forEach((asset) => URL.revokeObjectURL(asset.url));
    // Object URLs are revoked as individual assets are deleted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const updateCredits = () => {
      const stored = loadStoredUser();
      if (stored) setUser(stored);
    };
    window.addEventListener(CREDITS_UPDATED_EVENT, updateCredits);
    return () => window.removeEventListener(CREDITS_UPDATED_EVENT, updateCredits);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(EXPORT_SETTINGS_KEY, JSON.stringify(exportSettings));
  }, [exportSettings]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const storedUser = loadStoredUser();
      const requestedID = new URLSearchParams(window.location.search).get('project');
      try {
        const local = await loadLocalStudioProject(requestedID);
        if (cancelled) return;
        if (local) {
          await applyProject(local.id, local.name, local.document, local.files);
        } else if (storedUser && requestedID) {
          const cloud = await fetchCloudProject(requestedID, storedUser.api_key);
          if (cancelled) return;
          await applyProject(cloud.id, cloud.name, cloud.document!);
        } else if (storedUser) {
          const projects = await refreshCloudProjects(storedUser.api_key).catch(() => []);
          if (cancelled) return;
          if (projects[0]) {
            const cloud = await fetchCloudProject(projects[0].id, storedUser.api_key);
            if (cancelled) return;
            await applyProject(cloud.id, cloud.name, cloud.document!);
          } else {
            setProjectID(uid());
          }
        } else {
          setProjectID(uid());
        }
      } catch (reason) {
        if (!cancelled) {
          setProjectID(requestedID || uid());
          setError(reason instanceof Error ? reason.message : 'Could not restore the project');
        }
      } finally {
        if (!cancelled) {
          setProjectReady(true);
          setSaveStatus('Ready');
          if (storedUser) void refreshCloudProjects(storedUser.api_key).catch(() => undefined);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [applyProject, fetchCloudProject, refreshCloudProjects]);

  useEffect(() => {
    if (!projectReady || !projectID || !user) return;
    const pending = assets.filter((asset) => !asset.cloudURL && !uploadInFlightRef.current.has(asset.id));
    if (!pending.length) return;
    let started = false;
    const start = () => {
      started = true;
      const batch = pending.slice(0, 2);
      batch.forEach((asset) => uploadInFlightRef.current.add(asset.id));
      setSaveStatus(`Uploading ${assets.filter((asset) => !asset.cloudURL).length} asset${assets.filter((asset) => !asset.cloudURL).length === 1 ? '' : 's'}…`);
      void Promise.all(batch.map(async (asset) => {
        const fallbackType = asset.kind === 'video' ? 'video/mp4' : asset.kind === 'audio' ? 'audio/wav' : 'image/png';
        const contentType = asset.file.type || fallbackType;
        try {
          const response = await fetch('/api/studio/assets/presign', {
            method: 'POST', headers: authHeaders(user.api_key),
            body: JSON.stringify({ project_id: projectID, asset_id: asset.id, filename: asset.name, content_type: contentType, size: asset.file.size }),
          });
          const prepared = await parseJSONResponse<{ upload_url: string; public_url: string; object_key: string }>(response, `Could not upload ${asset.name}`);
          const uploaded = await fetch(prepared.upload_url, { method: 'PUT', headers: { 'Content-Type': contentType }, body: asset.file });
          if (!uploaded.ok) throw new Error(`Asset upload failed (${uploaded.status})`);
          setAssets((current) => current.map((item) => item.id === asset.id ? { ...item, cloudURL: prepared.public_url, objectKey: prepared.object_key } : item));
        } catch (reason) {
          setSaveStatus('Cloud upload will retry');
          setError(reason instanceof Error ? reason.message : `Could not upload ${asset.name}`);
          window.setTimeout(() => setSyncRetry((value) => value + 1), 5000);
        } finally {
          uploadInFlightRef.current.delete(asset.id);
        }
      }));
    };
    const idleWindow = window as typeof window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    const idleID = idleWindow.requestIdleCallback?.(start, { timeout: 1000 });
    const timerID = idleID === undefined ? window.setTimeout(start, 40) : undefined;
    return () => {
      if (!started && idleID !== undefined) idleWindow.cancelIdleCallback?.(idleID);
      if (!started && timerID !== undefined) window.clearTimeout(timerID);
    };
  }, [assets, projectID, projectReady, syncRetry, user]);

  useEffect(() => {
    if (!projectReady || !projectID) return;
    const sequence = ++projectSaveSequenceRef.current;
    setSaveStatus(user ? (assets.some((asset) => !asset.cloudURL) ? 'Uploading assets…' : 'Saving to cloud…') : 'Saving locally…');
    const timer = window.setTimeout(() => {
      const document = projectDocument(assets, selectedID);
      const files = new Map(assets.map((asset) => [asset.id, asset.file]));
      const local: LocalStudioProject = { id: projectID, name: projectName, document, files, updatedAt: Date.now() };
      void saveLocalStudioProject(local).then(async () => {
        if (sequence !== projectSaveSequenceRef.current) return;
        if (!user) {
          setSaveStatus('Saved locally');
          return;
        }
        const response = await fetch(`/api/studio/projects/${encodeURIComponent(projectID)}`, {
          method: 'PUT', headers: authHeaders(user.api_key), body: JSON.stringify({ name: projectName, document }),
        });
        const data = await parseJSONResponse<{ project: CloudProject }>(response, 'Could not save project to the cloud');
        if (sequence !== projectSaveSequenceRef.current) return;
        setCloudProjects((current) => [data.project, ...current.filter((project) => project.id !== data.project.id)]);
        setSaveStatus(assets.some((asset) => !asset.cloudURL) ? 'Uploading assets…' : 'Saved to cloud');
      }).catch((reason) => {
        if (sequence === projectSaveSequenceRef.current) {
          setSaveStatus(user ? 'Cloud save will retry' : 'Local save failed');
          setError(reason instanceof Error ? reason.message : 'Could not save project');
          window.setTimeout(() => setSyncRetry((value) => value + 1), 5000);
        }
      });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [assets, projectID, projectName, projectReady, selectedID, syncRetry, user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mediaURL = (params.get('video_url') || params.get('image_url'))?.trim();
    if (!mediaURL || galleryImportStartedRef.current) return;
    let parsed: URL;
    try {
      parsed = new URL(mediaURL);
    } catch {
      return;
    }
    if (parsed.protocol !== 'https:') return;

    galleryImportStartedRef.current = true;
    const isVideo = !!params.get('video_url');
    const name = params.get('name')?.trim() || (isVideo ? 'Gallery video' : 'Gallery image');
    setNotice(`Loading gallery ${isVideo ? 'video' : 'image'}…`);
    fetch(mediaURL)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Could not load the gallery ${isVideo ? 'video' : 'image'}`);
        const blob = await response.blob();
        const extension = blob.type.split('/')[1]?.replace('jpeg', 'jpg') || (isVideo ? 'mp4' : 'webp');
        return importFiles([new File([blob], `${name.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80)}.${extension}`, { type: blob.type || (isVideo ? 'video/mp4' : 'image/webp') })]);
      })
      .then((imported) => {
        const first = imported?.[0];
        setNotice(`Gallery ${isVideo ? 'video' : 'image'} added to the studio`);
        window.history.replaceState({}, '', '/studio');
        if (isVideo && params.get('restyle') === '1' && first?.kind === 'video') openRestyle(first);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : `Could not load the gallery ${isVideo ? 'video' : 'image'}`));
  // importFiles is intentionally declared below this effect; it is stable enough
  // for one-time URL handoff and the guard prevents duplicate imports in Strict Mode.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const drawCurrent = useCallback(() => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer || !selected) return;
    const previewSize = fitWithin(selected.width, selected.height, 1920, 1080);
    renderer.resize(previewSize.width, previewSize.height);
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
      perfDiagnostics().renderer = rendererRef.current.diagnostics();
      drawCurrent();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to start the GPU preview');
    }
    return () => {
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  // The WebGL context belongs to this canvas/selection, not to every slider
  // value. Recreating it during playback or grading causes visible frame drops.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, selected?.kind]);

  useEffect(() => {
    drawCurrent();
  }, [drawCurrent]);

  useEffect(() => {
    if (!selected) return;
    setPlaying(false);
    const sourceTime = selected.trimStart + Math.max(0, Math.min(clipDuration(selected), playhead - selected.timelineStart));
    if (selected.kind === 'video' && videoRef.current) videoRef.current.currentTime = sourceTime;
    if (selected.kind === 'audio' && audioRef.current) audioRef.current.currentTime = sourceTime;
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
  }, [selected?.id, selected?.url, selected?.kind, selected?.trimStart, selected?.trimEnd, selected?.timelineStart, drawCurrent]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || selected?.kind !== 'video') return;
    let videoFrame = 0;
    let animationFrame = 0;
    let lastUIUpdate = 0;
    const processDecodedFrame = (now: number) => {
      if (video.currentTime >= selected.trimEnd) {
        video.pause();
        video.currentTime = selected.trimEnd;
        setPlayhead(clipEnd(selected));
        setPlaying(false);
      } else if (now - lastUIUpdate >= 66) {
        // Keep React/timeline work near 15 Hz while WebGL follows every decoded
        // frame. This is the main-path optimization for 2K/4K source playback.
        setPlayhead(selected.timelineStart + video.currentTime - selected.trimStart);
        lastUIUpdate = now;
      }
      drawCurrent();
      const perf = perfDiagnostics();
      if (!perf.previewStartedAt) perf.previewStartedAt = now;
      perf.previewFrames += 1;
      perf.previewLastAt = now;
    };
    const renderDecodedFrame = (now: number) => {
      processDecodedFrame(now);
      videoFrame = video.requestVideoFrameCallback(renderDecodedFrame);
    };
    if (typeof video.requestVideoFrameCallback === 'function') {
      videoFrame = video.requestVideoFrameCallback(renderDecodedFrame);
      return () => video.cancelVideoFrameCallback(videoFrame);
    }
    const fallback = (now: number) => {
      if (!video.paused) processDecodedFrame(now);
      animationFrame = requestAnimationFrame(fallback);
    };
    animationFrame = requestAnimationFrame(fallback);
    return () => cancelAnimationFrame(animationFrame);
  }, [selected, drawCurrent]);

  async function importFiles(files: FileList | File[], timelinePlacement?: number, visualTrackPlacement = 0) {
    setError('');
    const incoming = Array.from(files).map((file) => ({ file, kind: mediaKindForFile(file) })).filter((item): item is { file: File; kind: MediaKind } => !!item.kind);
    if (!incoming.length) {
      setError('Choose an image, video, or audio file');
      return [] as StudioAsset[];
    }
    const next: StudioAsset[] = [];
    const visualEnd = assets.filter((asset) => asset.kind !== 'audio').reduce((end, asset) => Math.max(end, clipEnd(asset)), 0);
    let visualCursor = timelinePlacement ?? visualEnd;
    let audioCursor = timelinePlacement ?? playhead;
    for (const { file, kind } of incoming) {
      try {
        const metadata = await readDimensions(file, kind);
        const timelineStart = kind === 'audio' ? audioCursor : visualCursor;
        next.push({
          id: uid(), name: file.name, kind, file, url: URL.createObjectURL(file),
          ...metadata, trimStart: 0, trimEnd: metadata.duration,
          timelineStart, visualTrack: kind === 'audio' ? 0 : visualTrackPlacement, volume: 1, fadeIn: 0, fadeOut: 0,
          stageX: 0, stageY: 0,
          adjustments: { ...DEFAULT_ADJUSTMENTS },
        });
        if (kind === 'audio') {
          if (timelinePlacement !== undefined) audioCursor += metadata.duration;
        } else {
          visualCursor += metadata.duration;
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : `Could not import ${file.name}`);
      }
    }
    setAssets((current) => [...current, ...next]);
    if (next[0]) {
      if (timelinePlacement === undefined) {
        selectOnly(next[0].id);
      } else {
        setSelectedIDs(next.map((asset) => asset.id));
        setSelectedID(next.at(-1)?.id || '');
        setNotice(`${next.length === 1 ? next[0].name : `${next.length} media files`} added at ${formatTime(timelinePlacement)}`);
      }
      setPlayhead(timelinePlacement ?? next[0].timelineStart);
    }
    return next;
  }

  async function addGeneratedFile(file: File, kind: MediaKind, attribution?: string) {
    const metadata = await readDimensions(file, kind);
    const visualEnd = assets.filter((item) => item.kind !== 'audio').reduce((end, item) => Math.max(end, clipEnd(item)), 0);
    const asset: StudioAsset = {
      id: uid(), name: file.name, kind, file, url: URL.createObjectURL(file), ...metadata,
      trimStart: 0, trimEnd: metadata.duration, timelineStart: kind === 'audio' ? playhead : visualEnd, volume: 1, fadeIn: 0, fadeOut: 0,
      visualTrack: 0,
      stageX: 0, stageY: 0,
      attribution, adjustments: { ...DEFAULT_ADJUSTMENTS },
    };
    setAssets((current) => [...current, asset]);
    selectOnly(asset.id);
    setPlayhead(asset.timelineStart);
    return asset;
  }

  function removeSelected() {
    if (!selectedIDs.length) return;
    const removed = assets.filter((item) => selectedIDs.includes(item.id));
    const remaining = assets.filter((item) => !selectedIDs.includes(item.id));
    removed.forEach((asset) => {
      if (!remaining.some((item) => item.url === asset.url)) URL.revokeObjectURL(asset.url);
    });
    setAssets(remaining);
    selectOnly(remaining[0]?.id || '');
  }

  function duplicateSelected() {
    if (!selectedAssets.length) return;
    const copies = selectedAssets.map((asset) => ({
      ...asset,
      id: uid(),
      name: `${asset.name.replace(/(\.[^.]+)?$/, '')} copy$1`,
      timelineStart: asset.timelineStart + 0.25,
      stageX: Math.min(0.48, asset.stageX + 0.02),
      stageY: Math.min(0.48, asset.stageY + 0.02),
      adjustments: { ...asset.adjustments },
    }));
    setAssets((items) => [...items, ...copies]);
    setSelectedIDs(copies.map((asset) => asset.id));
    setSelectedID(copies.at(-1)?.id || '');
  }

  function moveSelectionBetweenLayers(direction: -1 | 1, toEdge = false) {
    const selectedVisuals = selectedAssets.filter((asset) => asset.kind !== 'audio');
    if (!selectedVisuals.length) return;
    const selectedSet = new Set(selectedVisuals.map((asset) => asset.id));
    const selectedMin = Math.min(...selectedVisuals.map((asset) => asset.visualTrack));
    const selectedMax = Math.max(...selectedVisuals.map((asset) => asset.visualTrack));
    const otherMax = Math.max(-1, ...assets.filter((asset) => asset.kind !== 'audio' && !selectedSet.has(asset.id)).map((asset) => asset.visualTrack));
    const delta = direction > 0
      ? Math.min(MAX_VISUAL_TRACKS - 1 - selectedMax, toEdge ? Math.max(0, otherMax + 1 - selectedMax) : 1)
      : (toEdge ? -selectedMin : -Math.min(1, selectedMin));
    if (!delta) {
      setNotice(direction > 0 ? 'Selection is already on the top layer' : 'Selection is already on V1');
      return;
    }
    setAssets((current) => current.map((asset) => selectedSet.has(asset.id) ? { ...asset, visualTrack: asset.visualTrack + delta } : asset));
    const destination = direction > 0 ? `V${selectedMax + delta + 1}` : `V${selectedMin + delta + 1}`;
    setNotice(`${selectedVisuals.length === 1 ? selectedVisuals[0].name : `${selectedVisuals.length} elements`} moved to ${destination}`);
  }

  function copyTimelineSelection() {
    if (!selectedAssets.length) return;
    timelineClipboardRef.current = selectedAssets.map((asset) => ({
      ...asset,
      adjustments: { ...asset.adjustments },
    }));
    setNotice(`${selectedAssets.length === 1 ? selectedAssets[0].name : `${selectedAssets.length} clips`} copied`);
  }

  function pasteTimelineSelection() {
    const copied = timelineClipboardRef.current;
    if (!copied.length) {
      setNotice('Copy one or more timeline clips first');
      return;
    }
    const groupStart = Math.min(...copied.map((asset) => asset.timelineStart));
    const pasted = copied.map((asset) => ({
      ...asset,
      id: uid(),
      url: URL.createObjectURL(asset.file),
      timelineStart: playhead + asset.timelineStart - groupStart,
      adjustments: { ...asset.adjustments },
    }));
    setAssets((current) => [...current, ...pasted]);
    setSelectedIDs(pasted.map((asset) => asset.id));
    setSelectedID(pasted.at(-1)?.id || '');
    setNotice(`${pasted.length === 1 ? pasted[0].name : `${pasted.length} clips`} pasted at ${formatTime(playhead)}`);
  }

  function splitAtPlayhead() {
    const splittable = selectedAssets.filter((asset) => playhead > asset.timelineStart + MIN_CLIP_DURATION && playhead < clipEnd(asset) - MIN_CLIP_DURATION);
    if (!splittable.length) {
      setNotice('Move the playhead inside a selected clip to split it');
      return;
    }
    const replacements = new Map(splittable.map((asset) => {
      const sourceSplit = asset.trimStart + playhead - asset.timelineStart;
      const right = { ...asset, id: uid(), timelineStart: playhead, trimStart: sourceSplit, adjustments: { ...asset.adjustments } };
      return [asset.id, [{ ...asset, trimEnd: sourceSplit }, right] as StudioAsset[]] as const;
    }));
    const rightIDs = [...replacements.values()].map((pair) => pair[1].id);
    setAssets((current) => current.flatMap((asset) => replacements.get(asset.id) || [asset]));
    setSelectedIDs(rightIDs);
    setSelectedID(rightIDs.at(-1) || '');
    setNotice(`${rightIDs.length === 1 ? 'Clip' : `${rightIDs.length} clips`} split at ${formatTime(playhead)}`);
  }

  function timelineTimeAt(clientX: number, pps = pixelsPerSecond, maxTime = timelineDuration) {
    const rect = timelineCanvasRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.max(0, Math.min(maxTime, (clientX - rect.left) / pps));
  }

  function timelineTrackAt(clientY: number) {
    const canvas = timelineCanvasRef.current;
    if (!canvas) return 0;
    const rect = canvas.getBoundingClientRect();
    const computed = getComputedStyle(canvas);
    const rulerHeight = Number.parseFloat(computed.getPropertyValue('--ruler-height')) || 25;
    const trackHeight = Number.parseFloat(computed.getPropertyValue('--video-track-height')) || 70;
    const rowFromTop = Math.max(0, Math.min(visualTrackCount - 1, Math.floor((clientY - rect.top - rulerHeight) / trackHeight)));
    return visualTrackCount - rowFromTop - 1;
  }

  function dragMediaOverTimeline(event: ReactDragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    setDragging(false);
    setTimelineDropTime(timelineTimeAt(event.clientX, pixelsPerSecond, timelineWidth / pixelsPerSecond));
  }

  function leaveTimelineDrop(event: ReactDragEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setTimelineDropTime(null);
  }

  async function dropMediaOnTimeline(event: ReactDragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    const dropTime = timelineTimeAt(event.clientX, pixelsPerSecond, timelineWidth / pixelsPerSecond);
    const dropTrack = timelineTrackAt(event.clientY);
    setTimelineDropTime(null);
    if (event.dataTransfer.files.length) {
      await importFiles(event.dataTransfer.files, dropTime, dropTrack);
      return;
    }
    const uri = event.dataTransfer.getData('text/uri-list').split(/\r?\n/).find((line) => line && !line.startsWith('#')) || '';
    if (!uri) {
      setError('Drop an image, video, or audio file on the timeline');
      return;
    }
    try {
      const parsed = new URL(uri);
      if (!['http:', 'https:', 'data:'].includes(parsed.protocol)) throw new Error('Unsupported media URL');
      setNotice('Loading dropped media…');
      const response = await fetch(uri);
      if (!response.ok) throw new Error(`Media download failed (${response.status})`);
      const blob = await response.blob();
      const fallbackName = `dropped-media.${blob.type.split('/')[1]?.replace('jpeg', 'jpg') || 'bin'}`;
      const name = decodeURIComponent(parsed.pathname.split('/').pop() || fallbackName).split('?')[0] || fallbackName;
      await importFiles([new File([blob], name, { type: blob.type })], dropTime, dropTrack);
    } catch (reason) {
      setError(reason instanceof Error ? `${reason.message}. Try downloading the media and dropping the file.` : 'Could not import dropped media');
    }
  }

  function beginClipDrag(event: ReactPointerEvent<HTMLElement>, asset: StudioAsset, mode: 'move' | 'trim-left' | 'trim-right') {
    event.stopPropagation();
    const additive = event.metaKey || event.ctrlKey || event.shiftKey;
    let dragIDs = [asset.id];
    if (mode === 'move') {
      if (selectedIDs.includes(asset.id)) dragIDs = selectedIDs;
      else if (additive) {
        dragIDs = [...selectedIDs, asset.id];
        setSelectedIDs(dragIDs);
        setSelectedID(asset.id);
      } else {
        selectOnly(asset.id);
      }
      seekTimeline(timelineTimeAt(event.clientX), asset.id);
    } else {
      selectOnly(asset.id);
    }
    const originals = new Map(assets.filter((item) => dragIDs.includes(item.id)).map((item) => [item.id, {
      timelineStart: item.timelineStart,
      trimStart: item.trimStart,
      trimEnd: item.trimEnd,
      duration: item.duration,
      visualTrack: item.visualTrack,
      kind: item.kind,
    }]));
    const trackHeight = Number.parseFloat(getComputedStyle(timelineCanvasRef.current || document.documentElement).getPropertyValue('--video-track-height')) || 70;
    timelineDragRef.current = {
      mode,
      pointerID: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      pixelsPerSecond,
      trackHeight,
      targetID: asset.id,
      didMove: false,
      trackDelta: 0,
      toggleOnClick: mode === 'move' && additive && selectedIDs.includes(asset.id),
      originals,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function beginScrub(event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0) return;
    timelineDragRef.current = {
      mode: 'scrub',
      pointerID: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      pixelsPerSecond,
      trackHeight: 1,
      didMove: false,
      trackDelta: 0,
      originals: new Map(),
    };
    seekTimeline(timelineTimeAt(event.clientX));
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function moveTimelinePointer(event: ReactPointerEvent<HTMLElement>) {
    const drag = timelineDragRef.current;
    if (!drag || drag.pointerID !== event.pointerId) return;
    if (drag.mode === 'scrub') {
      seekTimeline(timelineTimeAt(event.clientX, drag.pixelsPerSecond));
      return;
    }
    let delta = Math.round(((event.clientX - drag.startX) / drag.pixelsPerSecond) * 20) / 20;
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 2) drag.didMove = true;
    if (drag.mode === 'move') {
      const earliest = Math.min(...[...drag.originals.values()].map((item) => item.timelineStart));
      delta = Math.max(-earliest, delta);
      const visualOriginals = [...drag.originals.values()].filter((item) => item.kind !== 'audio');
      let trackDelta = visualOriginals.length ? Math.round((drag.startY - event.clientY) / drag.trackHeight) : 0;
      if (visualOriginals.length) {
        const lowestTrack = Math.min(...visualOriginals.map((item) => item.visualTrack));
        const highestTrack = Math.max(...visualOriginals.map((item) => item.visualTrack));
        trackDelta = Math.max(-lowestTrack, Math.min(MAX_VISUAL_TRACKS - 1 - highestTrack, trackDelta));
      }
      drag.trackDelta = trackDelta;
      setAssets((current) => current.map((asset) => {
        const original = drag.originals.get(asset.id);
        return original ? {
          ...asset,
          timelineStart: Math.max(0, original.timelineStart + delta),
          visualTrack: original.kind === 'audio' ? asset.visualTrack : original.visualTrack + trackDelta,
        } : asset;
      }));
      return;
    }
    const original = drag.targetID ? drag.originals.get(drag.targetID) : null;
    if (!original) return;
    if (drag.mode === 'trim-left') {
      delta = Math.max(-original.timelineStart, -original.trimStart, Math.min(original.trimEnd - original.trimStart - MIN_CLIP_DURATION, delta));
      setAssets((current) => current.map((asset) => asset.id === drag.targetID ? {
        ...asset,
        timelineStart: original.timelineStart + delta,
        trimStart: original.trimStart + delta,
      } : asset));
      return;
    }
    const trimEnd = Math.max(original.trimStart + MIN_CLIP_DURATION, Math.min(original.duration, original.trimEnd + delta));
    setAssets((current) => current.map((asset) => asset.id === drag.targetID ? { ...asset, trimEnd } : asset));
  }

  function endTimelinePointer(event: ReactPointerEvent<HTMLElement>) {
    const drag = timelineDragRef.current;
    if (drag?.pointerID !== event.pointerId) return;
    if (drag.toggleOnClick && !drag.didMove && drag.targetID) selectClip(drag.targetID, true);
    if (drag.mode === 'move' && drag.didMove && drag.trackDelta) {
      setNotice(`Moved ${drag.originals.size === 1 ? 'clip' : `${drag.originals.size} clips`} ${Math.abs(drag.trackDelta)} layer${Math.abs(drag.trackDelta) === 1 ? '' : 's'} ${drag.trackDelta > 0 ? 'up' : 'down'}`);
    }
    timelineDragRef.current = null;
  }

  function beginStageDrag(event: ReactPointerEvent<HTMLDivElement>, asset: StudioAsset) {
    if (asset.kind === 'audio' || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    stageDragRef.current = {
      assetID: asset.id,
      pointerID: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: asset.stageX,
      originY: asset.stageY,
      currentX: asset.stageX,
      currentY: asset.stageY,
      stageWidth: rect.width,
      stageHeight: rect.height,
    };
    selectOnly(asset.id);
    setStageDragPosition({ assetID: asset.id, x: asset.stageX, y: asset.stageY });
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function moveStagePointer(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = stageDragRef.current;
    if (!drag || drag.pointerID !== event.pointerId) return;
    let x = Math.max(-0.48, Math.min(0.48, drag.originX + (event.clientX - drag.startX) / drag.stageWidth));
    let y = Math.max(-0.48, Math.min(0.48, drag.originY + (event.clientY - drag.startY) / drag.stageHeight));
    const vertical = Math.abs(x) * drag.stageWidth <= 6;
    const horizontal = Math.abs(y) * drag.stageHeight <= 6;
    if (vertical) x = 0;
    if (horizontal) y = 0;
    drag.currentX = x;
    drag.currentY = y;
    setStageGuides({ horizontal, vertical });
    setStageDragPosition({ assetID: drag.assetID, x, y });
  }

  function endStagePointer(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = stageDragRef.current;
    if (!drag || drag.pointerID !== event.pointerId) return;
    updateAsset(drag.assetID, { stageX: drag.currentX, stageY: drag.currentY });
    stageDragRef.current = null;
    setStageDragPosition(null);
    setStageGuides({ horizontal: false, vertical: false });
  }

  function nudgeStageElement(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!selected || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 0.02 : 0.005;
    const stageX = Math.max(-0.48, Math.min(0.48, selected.stageX + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0)));
    const stageY = Math.max(-0.48, Math.min(0.48, selected.stageY + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0)));
    updateAsset(selected.id, { stageX, stageY });
  }

  function centerStageElement() {
    if (selected && selected.kind !== 'audio') updateAsset(selected.id, { stageX: 0, stageY: 0 });
  }

  function resetAdjustments() {
    if (selected) updateAsset(selected.id, { adjustments: { ...DEFAULT_ADJUSTMENTS } });
  }

  function togglePlayback() {
    if (!selected) return;
    if (selected.kind === 'audio' && audioRef.current) {
      if (audioRef.current.paused) {
        const sourceTime = selected.trimStart + Math.max(0, Math.min(clipDuration(selected), playhead - selected.timelineStart));
        audioRef.current.currentTime = sourceTime >= selected.trimEnd ? selected.trimStart : sourceTime;
        void audioRef.current.play(); setPlaying(true);
      } else {
        audioRef.current.pause(); setPlaying(false);
      }
      return;
    }
    if (selected.kind !== 'video' || !videoRef.current) return;
    if (videoRef.current.paused) {
      const perf = perfDiagnostics();
      perf.previewFrames = 0; perf.previewStartedAt = 0; perf.previewLastAt = 0;
      const sourceTime = selected.trimStart + Math.max(0, Math.min(clipDuration(selected), playhead - selected.timelineStart));
      videoRef.current.currentTime = sourceTime >= selected.trimEnd ? selected.trimStart : sourceTime;
      void videoRef.current.play();
      setPlaying(true);
    } else {
      videoRef.current.pause();
      setPlaying(false);
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTextEntry = target?.isContentEditable
        || target?.tagName === 'TEXTAREA'
        || target?.tagName === 'SELECT'
        || (target?.tagName === 'INPUT' && /^(text|search|email|password|url|tel|number)$/i.test((target as HTMLInputElement).type));
      if (event.code === 'Space') {
        if (isTextEntry || event.repeat) return;
        event.preventDefault();
        togglePlayback();
        return;
      }
      if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName || '')) return;
      const commandKey = event.metaKey || event.ctrlKey;
      if (commandKey && event.key.toLowerCase() === 'c' && selectedAssets.length) {
        event.preventDefault();
        copyTimelineSelection();
      } else if (commandKey && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        pasteTimelineSelection();
      } else if (commandKey && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        setSelectedIDs(assets.map((asset) => asset.id));
        setSelectedID(assets.at(-1)?.id || '');
      } else if (commandKey && (event.code === 'BracketLeft' || event.code === 'BracketRight')) {
        event.preventDefault();
        moveSelectionBetweenLayers(event.code === 'BracketRight' ? 1 : -1, event.shiftKey);
      } else if (event.key.toLowerCase() === 's' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        splitAtPlayhead();
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        removeSelected();
      } else if (event.key === 'Escape') {
        setSelectedIDs(selectedID ? [selectedID] : []);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  async function uploadPublic(file: File) {
    if (!user) throw new Error('Sign in to use AI tools');
    const query = new URLSearchParams({ filename: file.name, content_type: file.type || 'application/octet-stream', dataset: 'studio' });
    const presign = await fetch(`/api/uploads/presign?${query}`, { headers: authHeaders(user.api_key, false) });
    const data = await parseJSONResponse<{ upload_url: string; public_url: string }>(presign, 'Could not prepare upload');
    const put = await fetch(data.upload_url, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
    if (!put.ok) throw new Error('Asset upload failed');
    return data.public_url;
  }

  function openRestyle(asset: StudioAsset) {
    if (asset.kind !== 'video') return;
    selectOnly(asset.id);
    setPlayhead(asset.timelineStart);
    setRestyleSourceID(asset.id);
    setRestyleOpen(true);
    setContextMenu(null);
  }

  function addRestyleReferences(files: FileList | File[]) {
    const incoming = Array.from(files).map((file) => ({ file, kind: mediaKindForFile(file) })).filter((item): item is { file: File; kind: MediaKind } => !!item.kind);
    setRestyleReferences((current) => {
      const next = [...current];
      for (const { file, kind } of incoming) {
        const limit = kind === 'image' ? 9 : 3;
        if (next.filter((item) => item.kind === kind).length >= limit) continue;
        next.push({ id: uid(), name: file.name, kind, file, url: URL.createObjectURL(file) });
      }
      return next;
    });
  }

  function addProjectReference(asset: StudioAsset) {
    if (asset.id === restyleSourceID && asset.kind === 'video') return;
    const limit = asset.kind === 'image' ? 9 : 3;
    setRestyleReferences((current) => {
      if (current.some((item) => item.id === asset.id) || current.filter((item) => item.kind === asset.kind).length >= limit) return current;
      return [...current, { id: asset.id, name: asset.name, kind: asset.kind, file: asset.file, url: asset.url, cloudURL: asset.cloudURL }];
    });
  }

  function moveRestyleReference(index: number, direction: -1 | 1) {
    setRestyleReferences((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function generateRestyle() {
    const source = assets.find((asset) => asset.id === restyleSourceID);
    if (!source || source.kind !== 'video') return;
    if (!user) {
      setError('Sign in to restyle video');
      return;
    }
    setBusy('restyle'); setError(''); setNotice('Uploading source and references…');
    try {
      const videoURL = source.cloudURL || await uploadPublic(source.file);
      const uploadedReferences = await Promise.all(restyleReferences.map(async (reference) => ({
        ...reference,
        publicURL: reference.cloudURL || await uploadPublic(reference.file),
      })));
      setNotice('Starting video transformation…');
      const response = await fetch('/api/service', {
        method: 'POST', headers: authHeaders(user.api_key),
        body: JSON.stringify({
          service: 'video_restyle', model: restyleModel, video_url: videoURL,
          prompt: restylePrompt, negative_prompt: restyleNegativePrompt,
          strength: restyleStrength, num_frames: restyleFrames, frames_per_second: restyleFPS,
          resolution: restyleResolution, aspect_ratio: restyleAspect,
          duration: restyleDuration, seed: restyleSeed,
          reference_image_urls: uploadedReferences.filter((item) => item.kind === 'image').map((item) => item.publicURL),
          reference_video_urls: uploadedReferences.filter((item) => item.kind === 'video').map((item) => item.publicURL),
          reference_audio_urls: uploadedReferences.filter((item) => item.kind === 'audio').map((item) => item.publicURL),
        }),
      });
      const queued = await parseJSONResponse<{ result?: { job_id?: string; status_url?: string }; job_id?: string; status_url?: string }>(response, 'Could not start video transformation');
      const jobID = queued.result?.job_id || queued.job_id;
      const statusURL = queued.result?.status_url || queued.status_url || `/api/video-jobs/${jobID}`;
      if (!jobID) throw new Error('Video transformation returned no job');
      setRestyleOpen(false);
      for (let attempts = 0; attempts < 1440; attempts += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 2500));
        const poll = await fetch(statusURL, { headers: authHeaders(user.api_key, false) });
        const payload = await parseJSONResponse<{ job?: { status?: string; result?: unknown; error?: string } }>(poll, 'Video transformation status failed');
        const status = payload.job?.status || '';
        if (status === 'failed' || status === 'payment_required') throw new Error(payload.job?.error || 'Video transformation failed');
        if (status === 'completed') {
          const outputURL = resultURL(payload.job?.result);
          if (!outputURL) throw new Error('Video transformation completed without a video');
          setNotice('Downloading transformed video…');
          const result = await fetch(outputURL);
          if (!result.ok) throw new Error('Could not download transformed video');
          const blob = await result.blob();
          const extension = blob.type.includes('webm') || outputURL.includes('.webm') ? 'webm' : 'mp4';
          await addGeneratedFile(new File([blob], `${source.name.replace(/\.[^.]+$/, '')}-restyled.${extension}`, { type: blob.type || `video/${extension}` }), 'video', 'Video restyle');
          const refreshed = await refreshUser(user.api_key).catch(() => null);
          if (refreshed) { setUser(refreshed); saveUser(refreshed); }
          setNotice('Restyled video added to the timeline');
          return;
        }
        setNotice(status === 'processing' ? 'Transforming video…' : 'Video transformation queued…');
      }
      throw new Error('Video transformation is still running and remains available in your account.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Video transformation failed');
    } finally {
      setBusy('');
    }
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
      selectOnly(cutout.id);
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
    setBusy('extend'); setError(''); setNotice('Preparing H.264 source for Grok…');
    try {
      const sourceBlob = await renderSelectedVideo({
        format: 'mp4-h264', resolution: '720p', frameRate: 'source', quality: 'balanced',
      });
      const sourceFile = new File([sourceBlob], `${selected.name.replace(/\.[^.]+$/, '')}-grok-source.mp4`, { type: 'video/mp4' });
      setNotice('Uploading source video…');
      const videoURL = await uploadPublic(sourceFile);
      setNotice('Starting extension…');
      const response = await fetch('/api/studio/extend-video', {
        method: 'POST', headers: authHeaders(user?.api_key || ''),
        body: JSON.stringify({ video_url: videoURL, prompt: extendPrompt, duration: extendDuration, source_duration: clipDuration(selected) }),
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

  async function upscaleVideo() {
    if (!selected || selected.kind !== 'video' || !canUpscaleSelected) return;
    const sourceName = selected.name.replace(/\.[^.]+$/, '');
    setBusy('upscale'); setError(''); setNotice('Uploading source video…');
    try {
      const videoURL = await uploadPublic(selected.file);
      setNotice(`Starting Real-ESRGAN ${upscaleScale}× upscale…`);
      const response = await fetch('/api/studio/upscale-video', {
        method: 'POST', headers: authHeaders(user?.api_key || ''),
        body: JSON.stringify({
          video_url: videoURL, width: selected.width, height: selected.height,
          duration: selected.duration, scale: upscaleScale,
        }),
      });
      const data = await parseJSONResponse<{ job_id: string; status_url?: string; credits_remain?: number }>(response, 'Could not start upscale');
      if (!data.job_id) throw new Error('Upscale returned no job');
      if (user && typeof data.credits_remain === 'number') {
        const next = { ...user, credits: data.credits_remain };
        setUser(next); saveUser(next);
      }
      setUpscaleOpen(false);
      for (let attempts = 0; attempts < 720; attempts += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 2500));
        const poll = await fetch(data.status_url || `/api/video-jobs/${data.job_id}`, { headers: authHeaders(user?.api_key || '', false) });
        const payload = await parseJSONResponse<{ job?: { status?: string; result?: unknown; error?: string } }>(poll, 'Upscale status failed');
        const status = payload.job?.status || '';
        if (status === 'failed' || status === 'payment_required') throw new Error(payload.job?.error || 'Upscale failed');
        if (status === 'completed') {
          const url = resultURL(payload.job?.result);
          if (!url) throw new Error('Upscale completed without a video');
          setNotice('Downloading the upscaled clip…');
          const videoResponse = await fetch(url);
          if (!videoResponse.ok) throw new Error('Could not download the upscaled clip');
          const blob = await videoResponse.blob();
          const extension = blob.type.includes('webm') || url.includes('.webm') ? 'webm' : 'mp4';
          await addGeneratedFile(new File([blob], `${sourceName}-${upscaleScale}x-esrgan.${extension}`, { type: blob.type || (extension === 'webm' ? 'video/webm' : 'video/mp4') }), 'video', 'Real-ESRGAN');
          setNotice(`Real-ESRGAN ${upscaleScale}× clip added to the timeline`);
          return;
        }
        setNotice(status === 'processing' ? `Upscaling every frame ${upscaleScale}×…` : 'Upscale queued…');
      }
      throw new Error('Upscale is taking longer than expected. It remains available in your account.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Video upscale failed');
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

  function stopVoicePreview() {
    const current = voicePreviewRef.current;
    if (current) {
      current.pause();
      current.currentTime = 0;
      current.onended = null;
      current.onerror = null;
    }
    voicePreviewRef.current = null;
    setPreviewingVoice(null);
  }

  function previewVoiceSample(voice: SpeechVoice) {
    setSpeechVoice(voice);
    setVoicePreviewError('');
    if (previewingVoice === voice) {
      stopVoicePreview();
      return;
    }
    stopVoicePreview();
    const preview = new Audio(`${voiceSampleBaseURL}/voice-samples/${voice.toLowerCase()}.opus`);
    preview.preload = 'auto';
    preview.onended = () => {
      voicePreviewRef.current = null;
      setPreviewingVoice(null);
    };
    preview.onerror = () => {
      voicePreviewRef.current = null;
      setPreviewingVoice(null);
      setVoicePreviewError('That preview could not be played. Please try again.');
    };
    voicePreviewRef.current = preview;
    setPreviewingVoice(voice);
    void preview.play().catch(() => {
      voicePreviewRef.current = null;
      setPreviewingVoice(null);
      setVoicePreviewError('Your browser blocked the preview. Tap play again.');
    });
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
		if (audioMode === 'music') {
		  setNotice('Generating music with Fal…');
		  const response = await fetch('/api/studio/generate-music', {
			method: 'POST', headers: authHeaders(user.api_key), body: JSON.stringify({ prompt: audioPrompt.trim(), duration: audioDuration }),
		  });
		  const data = await parseJSONResponse<{ audio_url?: string; credits_remain?: number }>(response, 'Music generation failed');
		  if (!data.audio_url) throw new Error('Music generation returned no audio');
		  const media = await fetch(data.audio_url);
		  if (!media.ok) throw new Error('Could not download generated music');
		  const blob = await media.blob();
		  await addGeneratedFile(new File([blob], `music-${Date.now()}.wav`, { type: blob.type || 'audio/wav' }), 'audio', 'Generated with Fal');
		  if (typeof data.credits_remain === 'number') { const next = { ...user, credits: data.credits_remain }; setUser(next); saveUser(next); }
		  setNotice('Music added · Fal · 80 credits');
		} else {
		  setNotice('Starting sound generation…');
		  const prompt = `Sound effect: ${audioPrompt.trim()}`;
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
		  setNotice('Sound added · metered H3 generation');
		}
      }
      stopVoicePreview(); setAudioGenerateOpen(false); setMobilePanelOpen(false);
    } catch (reason) {
      if (reason instanceof HTTPResponseError && reason.status === 402) {
        stopVoicePreview();
        setAudioGenerateOpen(false);
      }
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

  async function renderSelectedVideo(settings: ExportSettings) {
    if (!selected || selected.kind !== 'video') throw new Error('Select a video first');
    setExportProgress(0.01);
    let input: Input | null = null;
    let output: Output | null = null;
    let exportRenderer: StudioRenderer | null = null;
    try {
      const format = exportFormatDetails(settings.format);
      const codec = format.codec;
      const requestedSize = exportSize(selected.width, selected.height, settings.resolution);
      const qualityLevel = settings.quality === 'draft' ? 'medium' : settings.quality === 'high' ? 'very-high' : 'high';
      const requestedQuality = new Quality(qualityLevel);
      const hardwareSupported = await canEncodeVideo(codec, { ...requestedSize, quality: requestedQuality, hardwareAcceleration: 'prefer-hardware' });
      // Software WebCodecs at 2K can be slower than 0.1x realtime. Keep full
      // 2K/4K when a hardware encoder is exposed and use a 1080p safety path
      // otherwise, so export never wedges a laptop for minutes per second.
      const { width, height } = hardwareSupported || settings.resolution !== 'source'
        ? requestedSize
        : fitWithin(selected.width, selected.height, 1920, 1080);
      const quality = hardwareSupported ? requestedQuality : new Quality(settings.quality === 'high' ? 'high' : qualityLevel);
      const hardwareAcceleration = hardwareSupported
        ? 'prefer-hardware' as const
        : 'no-preference' as const;
      if (!(await canEncodeVideo(codec, { width, height, quality, hardwareAcceleration }))) {
        throw new Error(`${format.label} encoding is not available in this browser`);
      }
      perfDiagnostics().export = { sourceWidth: selected.width, sourceHeight: selected.height, width, height, hardwareAcceleration, hardwareRequested: 'prefer-hardware', startedAt: performance.now(), format: settings.format, frameRate: settings.frameRate, quality: settings.quality };
      input = new Input({ source: new BlobSource(selected.file), formats: ALL_FORMATS });
      const videoTrack = await input.getPrimaryVideoTrack();
      if (!videoTrack || !(await videoTrack.canDecode())) throw new Error('This browser cannot decode the source video');
      const duration = selected.trimEnd - selected.trimStart;
      const timelineAudio = assets.filter((asset) => asset.kind === 'audio');

      const workCanvas = document.createElement('canvas');
      exportRenderer = new StudioRenderer(workCanvas);
      exportRenderer.resize(width, height);
      const target = new BufferTarget();
      output = new Output({
        format: settings.format.startsWith('webm-') ? new WebMOutputFormat() : new Mp4OutputFormat({ fastStart: 'in-memory' }),
        target,
      });
      const videoSource = new CanvasSource(workCanvas, {
        codec, quality, hardwareAcceleration,
        latencyMode: hardwareSupported ? 'quality' : 'realtime',
        contentHint: 'motion',
      });
      output.addVideoTrack(videoSource);

      const audioTrack = await input.getPrimaryAudioTrack();
      let audioSource: AudioSampleSource | null = null;
      let audioSink: AudioSampleSink | null = null;
      let encodedAudioSource: EncodedAudioPacketSource | null = null;
      let encodedAudioSink: EncodedPacketSink | null = null;
      let encodedAudioConfig: AudioDecoderConfig | null = null;
      let mixedAudio: AudioBuffer | null = null;
      const audioCodec = settings.format.startsWith('webm-') || !(await canEncodeAudio('aac')) ? 'opus' : 'aac';
      if (timelineAudio.length) {
        if (!(await canEncodeAudio(audioCodec))) throw new Error(`${audioCodec.toUpperCase()} audio encoding is not available in this browser`);
        mixedAudio = await renderTimelineAudio(selected, timelineAudio, duration, selected.timelineStart);
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
      const outputFPS = settings.frameRate === 'source' ? null : settings.frameRate;
      const progressFPS = outputFPS || 30;
      const frames = Math.max(1, Math.ceil(duration * progressFPS));
      // Decoder preference is intentionally left to the browser. On Linux,
      // forcing `prefer-hardware` can select a nominal VA-API config that never
      // emits frames; WebGL and the encoder retain explicit GPU preferences.
      const sink = new VideoSampleSink(videoTrack, { optimizeForLatency: true });
      let index = 0;
      let encodedFrames = 0;
      let nextOutputTimestamp = 0;
      let hasDrawnFrame = false;
      const outputFrameDuration = outputFPS ? 1 / outputFPS : 0;
      const addOutputFrame = async (timestamp: number, frameDuration: number) => {
        await videoSource.add(timestamp, frameDuration, { keyFrame: encodedFrames % (progressFPS * 2) === 0 });
        encodedFrames += 1;
      };
      for await (const sample of sink.samples(selected.trimStart, selected.trimEnd)) {
        const timestamp = Math.max(0, sample.timestamp - selected.trimStart);
        if (outputFPS && hasDrawnFrame) {
          while (nextOutputTimestamp < Math.min(timestamp, duration) - 1e-7) {
            await addOutputFrame(nextOutputTimestamp, Math.min(outputFrameDuration, duration - nextOutputTimestamp));
            nextOutputTimestamp += outputFrameDuration;
          }
        }
        const frame = sample.toVideoFrame();
        const frameDuration = Math.max(1 / 240, Math.min(sample.duration || 1 / progressFPS, duration - timestamp));
        exportRenderer.draw(frame, selected.adjustments, index);
        frame.close();
        sample.close();
        hasDrawnFrame = true;
        if (!outputFPS) await addOutputFrame(timestamp, frameDuration);
        index += 1;
        setExportProgress(Math.min(0.9, Math.max(encodedFrames / frames, timestamp / duration) * 0.9));
      }
      if (outputFPS && hasDrawnFrame) {
        while (nextOutputTimestamp < duration - 1e-7) {
          await addOutputFrame(nextOutputTimestamp, Math.min(outputFrameDuration, duration - nextOutputTimestamp));
          nextOutputTimestamp += outputFrameDuration;
          setExportProgress(Math.min(0.9, encodedFrames / frames * 0.9));
        }
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
      const perf = perfDiagnostics();
      if (perf.export) {
        perf.export.completedAt = performance.now();
        perf.export.frames = encodedFrames;
      }
      setExportProgress(1);
      return new Blob([target.buffer!], { type: format.mime });
    } catch (reason) {
      await output?.cancel().catch(() => undefined);
      throw reason;
    } finally {
      exportRenderer?.destroy();
      input?.dispose();
    }
  }

  async function exportVideo() {
    if (!selected || selected.kind !== 'video') return;
    setBusy('export'); setError('');
    try {
      const blob = await renderSelectedVideo(exportSettings);
      const { extension } = exportFormatDetails(exportSettings.format);
      downloadBlob(blob, `${selected.name.replace(/\.[^.]+$/, '')}-studio.${extension}`);
      setNotice(`Exported ${extension.toUpperCase()} locally`);
      setExportOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Local export failed');
    } finally {
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
    <main
      className={styles.studio}
      style={{ '--visual-track-count': visualTrackCount, '--visible-visual-track-count': visibleVisualTrackCount } as CSSProperties}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
      onDrop={(event) => { event.preventDefault(); setDragging(false); void importFiles(event.dataTransfer.files); }}
    >
      <header className={styles.topbar}>
        <div className={styles.brandGroup}>
          <button className={styles.iconButton} aria-label="Menu"><Menu size={17} /></button>
          <Link href="/" className={styles.brand} aria-label="Manifold home"><img className={styles.brandMark} src="/brand/logo-mark.webp" alt="" /><span>MANIFOLD</span></Link>
          <span className={styles.divider} />
          <div className={styles.projectPicker}>
            <button data-testid="studio-project-menu" className={styles.projectName} aria-expanded={projectMenuOpen} onClick={() => setProjectMenuOpen((open) => !open)}>{projectName} <ChevronDown size={13} /></button>
            {projectMenuOpen && <div className={styles.projectMenu}>
              <label>Project name<input aria-label="Project name" value={projectName} maxLength={120} onChange={(event) => setProjectName(event.target.value)} onBlur={() => !projectName.trim() && setProjectName('Untitled project')} /></label>
              <button className={styles.newProjectButton} onClick={newProject}><Plus size={13} /> New project</button>
              {user && <span className={styles.projectMenuLabel}>YOUR CLOUD PROJECTS</span>}
              {cloudProjects.map((project) => <button key={project.id} className={project.id === projectID ? styles.currentProject : ''} onClick={() => void openProject(project.id)}><span>{project.name}</span><small>{new Date(project.updated_at).toLocaleDateString()}</small></button>)}
              {user && !cloudProjects.length && <small className={styles.noProjects}>This project will appear here after its first save.</small>}
              {!user && <small className={styles.noProjects}>Sign in to sync projects and media across devices.</small>}
            </div>}
          </div>
        </div>
        <div className={styles.historyActions}>
          <button className={styles.iconButton} aria-label="Undo" disabled><Undo2 size={16} /></button>
          <button className={styles.iconButton} aria-label="Redo" disabled><Redo2 size={16} /></button>
          <span data-testid="studio-save-status" className={styles.saved}>{saveStatus}</span>
        </div>
        <div className={styles.accountActions}>
          <Link href="/account" className={styles.creditPill}><span className={styles.creditDot} /><span className={styles.creditFull}>{creditsLabel}</span><span className={styles.creditCompact}>{user ? compactCredits(user.credits) : 'Sign in'}</span></Link>
          <button type="button" className={styles.topupButton} onClick={() => openPaymentDialog({ message: 'Choose a plan or add credits without leaving the Studio.' })}><Plus size={14} /> Top up</button>
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
              {assets.map((asset) => <button key={asset.id} onContextMenu={(event) => { if (asset.kind !== 'video') return; event.preventDefault(); selectOnly(asset.id); setContextMenu({ assetID: asset.id, x: event.clientX, y: event.clientY }); }} onClick={(event) => { selectClip(asset.id, event.metaKey || event.ctrlKey || event.shiftKey); setPlayhead(asset.timelineStart); }} className={`${styles.assetCard} ${selectedIDs.includes(asset.id) ? styles.assetSelected : ''}`}>
                {asset.kind === 'image' ? <img src={asset.url} alt="" /> : asset.kind === 'video' ? <video src={asset.url} muted preload="metadata" /> : <span className={styles.audioThumb}><AudioLines size={24} /></span>}
                <span className={styles.assetType}>{asset.kind === 'video' ? <Film size={11} /> : asset.kind === 'audio' ? <Volume2 size={11} /> : <ImageIcon size={11} />}</span>
                <span className={styles.assetName}>{asset.name}</span>
              </button>)}
            </div>
            {!assets.length && <div className={styles.emptyLibrary}><Clapperboard size={24} /><p>{user ? 'Imports stay local while they upload securely in the background.' : 'Your imported files stay in this browser. Sign in for cloud sync.'}</p></div>}
          </>}

          {tool === 'adjust' && <>
            <div className={styles.panelHeader}><div><span className={styles.eyebrow}>COLOR</span><h2>Adjustments</h2></div><button className={styles.smallIcon} onClick={resetAdjustments} title="Reset"><RotateCcw size={14} /></button></div>
            {!selected || selected.kind === 'audio' ? <PanelEmpty /> : <div className={styles.controls}>
              {ADJUSTMENTS.map((item) => <label key={item.key} className={styles.sliderRow}><span><b>{item.label}</b><output>{Math.round(selected.adjustments[item.key] * 100)}</output></span><input type="range" min={item.min} max={item.max} step={item.step} value={selected.adjustments[item.key]} onChange={(event) => updateAsset(selected.id, { adjustments: { ...selected.adjustments, [item.key]: Number(event.target.value) } })} /></label>)}
              <fieldset className={styles.toneHues}><legend>Hue by tonal range</legend><p>Shift colour without flattening light or contrast.</p>{([{ key: 'shadowHue', label: 'Shadows' }, { key: 'midtoneHue', label: 'Midtones' }, { key: 'highlightHue', label: 'Highlights' }] as const).map((tone) => <div key={tone.key} className={styles.hueRow}><label><span>{tone.label}</span><input aria-label={`${tone.label} hue colour`} type="color" value={hueToHex(selected.adjustments[tone.key])} onChange={(event) => updateAsset(selected.id, { adjustments: { ...selected.adjustments, [tone.key]: hexToHue(event.target.value) } })} /></label><input aria-label={`${tone.label} hue`} type="range" min="-180" max="180" step="1" value={selected.adjustments[tone.key]} onChange={(event) => updateAsset(selected.id, { adjustments: { ...selected.adjustments, [tone.key]: Number(event.target.value) } })} /><output>{Math.round(selected.adjustments[tone.key])}°</output></div>)}</fieldset>
            </div>}
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
              <button onClick={() => { setAudioMode('music'); setAudioGenerateOpen(true); }}><Music2 size={17} /><span><b>Music</b><small>Fal · 80 cr</small></span></button>
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
              <button data-testid="studio-upscale-open" className={styles.aiCard} disabled={!canOpenUpscale || !!busy} onClick={() => setUpscaleOpen(true)}><span className={styles.aiIcon}><Maximize size={19} /></span><span><b>Upscale video</b><small>{selected?.kind === 'video' && !canOpenUpscale ? 'Select a clip up to 60 seconds' : 'Real-ESRGAN · 2× or 4× detail'}</small></span>{busy === 'upscale' ? <Loader2 className={styles.spin} size={16} /> : <ArrowLeft className={styles.arrowRight} size={14} />}</button>
              <button data-testid="studio-restyle-open" className={styles.aiCard} disabled={selected?.kind !== 'video' || !!busy} onClick={() => selected?.kind === 'video' && openRestyle(selected)}><span className={styles.aiIcon}><WandSparkles size={19} /></span><span><b>Restyle video</b><small>Preserve motion · transform the look</small></span>{busy === 'restyle' ? <Loader2 className={styles.spin} size={16} /> : <ArrowLeft className={styles.arrowRight} size={14} />}</button>
              <button className={styles.aiCard} disabled={!canExtendSelected || !!busy} onClick={() => setExtendOpen(true)}><span className={styles.aiIcon}><Sparkles size={19} /></span><span><b>Extend video</b><small>{selected?.kind === 'video' && !canExtendSelected ? 'Select a 2–15 second clip' : 'Grok · auto-converts to MP4'}</small></span>{busy === 'extend' ? <Loader2 className={styles.spin} size={16} /> : <ArrowLeft className={styles.arrowRight} size={14} />}</button>
            </div>
            <p className={styles.aiNote}>AI tools require a signed-in account. Local editing and export do not use credits.</p>
          </>}
        </aside>

        <section className={styles.stageArea}>
          <div className={styles.stageToolbar}>
            <div className={styles.stageLeft}><button className={styles.toolChip}><MousePointer2 size={14} /> Select</button><button className={styles.toolChip} disabled><Crop size={14} /> Crop</button></div>
            <div data-testid="studio-render-status" className={styles.stageStatus}>{selected ? selected.kind === 'audio' ? `${formatTime(selected.duration).slice(3)} audio` : `${selected.width} × ${selected.height} · GPU preview` : 'GPU editor ready'}</div>
            <div className={styles.stageRight}><button className={styles.iconButton} onClick={() => setStageZoom((value) => Math.max(.5, value - .1))}><Minus size={14} /></button><span>{Math.round(stageZoom * 100)}%</span><button className={styles.iconButton} onClick={() => setStageZoom((value) => Math.min(2, value + .1))}><Plus size={14} /></button><button className={styles.iconButton} onClick={centerStageElement} disabled={!selected || selected.kind === 'audio'} title="Center element"><Maximize size={14} /></button></div>
          </div>
          <div ref={stageRef} className={styles.stage}>
            {selected?.kind === 'audio' ? <div className={styles.audioPreview}>
              <span><AudioLines size={36} /></span><small>AUDIO CLIP</small><h2>{selected.name}</h2>
              <div className={styles.heroWaveform}>{Array.from({ length: 52 }, (_, index) => <i key={index} style={{ height: `${18 + ((index * 31) % 75)}%` }} />)}</div>
              <audio ref={audioRef} src={selected.url} controls preload="metadata" onLoadedMetadata={(event) => { event.currentTarget.currentTime = selected.trimStart + Math.max(0, Math.min(clipDuration(selected), playhead - selected.timelineStart)); }} onTimeUpdate={(event) => { const next = selected.timelineStart + event.currentTarget.currentTime - selected.trimStart; if (next >= clipEnd(selected)) { event.currentTarget.pause(); setPlayhead(clipEnd(selected)); } else setPlayhead(next); }} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
              {selected.attribution && <p>Credit: {selected.attribution}</p>}
            </div> : selected ? stageVisualAssets.map((asset, index) => {
              const isSelected = asset.id === selected.id;
              const dragPosition = stageDragPosition?.assetID === asset.id ? stageDragPosition : null;
              return <div
                key={asset.id}
                data-testid={isSelected ? 'studio-stage-element' : `studio-stage-layer-${asset.id}`}
                data-stage-asset={asset.id}
                data-visual-track={asset.visualTrack}
                data-position-x={(dragPosition?.x ?? asset.stageX).toFixed(4)}
                data-position-y={(dragPosition?.y ?? asset.stageY).toFixed(4)}
                className={`${styles.stageElement} ${isSelected ? styles.canvasWrap : styles.stageLayer} ${dragPosition ? styles.canvasWrapDragging : ''}`}
                style={{
                  left: `${50 + (dragPosition?.x ?? asset.stageX) * 100}%`,
                  top: `${50 + (dragPosition?.y ?? asset.stageY) * 100}%`,
                  transform: `translate(-50%, -50%) scale(${stageZoom})`,
                  aspectRatio: `${asset.width}/${asset.height}`,
                  zIndex: asset.visualTrack * 10_000 + index,
                }}
                role="button"
                tabIndex={isSelected ? 0 : -1}
                aria-label={`Move ${asset.name}`}
                aria-selected={isSelected}
                title="Drag to move · Arrow keys to nudge · Double-click to center"
                onPointerDown={(event) => beginStageDrag(event, asset)}
                onPointerMove={moveStagePointer}
                onPointerUp={endStagePointer}
                onPointerCancel={endStagePointer}
                onKeyDown={isSelected ? nudgeStageElement : undefined}
                onDoubleClick={() => updateAsset(asset.id, { stageX: 0, stageY: 0 })}
              >
                {isSelected ? <>
                  {asset.kind === 'video' && <video ref={videoRef} className={styles.sourceVideo} src={asset.url} muted={false} playsInline preload="auto" onLoadedData={() => { if (videoRef.current) videoRef.current.currentTime = asset.trimStart + Math.max(0, Math.min(clipDuration(asset), playhead - asset.timelineStart)); drawCurrent(); }} />}
                  <canvas ref={canvasRef} className={styles.previewCanvas} />
                  <i className={`${styles.stageHandle} ${styles.stageHandleNW}`} />
                  <i className={`${styles.stageHandle} ${styles.stageHandleNE}`} />
                  <i className={`${styles.stageHandle} ${styles.stageHandleSW}`} />
                  <i className={`${styles.stageHandle} ${styles.stageHandleSE}`} />
                </> : <PassiveStageMedia asset={asset} playhead={playhead} playing={playing} />}
              </div>;
            }) : <button data-testid="studio-empty" className={styles.dropPrompt} onClick={() => fileInputRef.current?.click()}><span><Upload size={26} /></span><b>Drop media to begin</b><small>Video, image, audio, WebM, MP4, WAV, PNG</small><em>Browse files</em></button>}
            {stageGuides.vertical && <span className={`${styles.stageGuide} ${styles.stageGuideVertical}`} />}
            {stageGuides.horizontal && <span className={`${styles.stageGuide} ${styles.stageGuideHorizontal}`} />}
            {dragging && <div className={styles.dropOverlay}><div><Upload size={28} /><b>Drop to import</b></div></div>}
          </div>
          {(notice || error) && <div className={`${styles.toast} ${error ? styles.toastError : ''}`}><span>{error || notice}</span><button onClick={() => { setError(''); setNotice(''); }}><X size={14} /></button></div>}
        </section>
      </div>

      <section className={styles.timeline}>
        <div className={styles.timelineToolbar}>
          <div className={styles.timelineTools}><button onClick={() => fileInputRef.current?.click()}><Plus size={14} /> Add</button><button onClick={splitAtPlayhead} disabled={!selectedAssets.length} title="Split at playhead (S)"><Scissors size={14} /> Split</button><button data-testid="studio-layer-up" onClick={() => moveSelectionBetweenLayers(1)} disabled={!selectedAssets.some((asset) => asset.kind !== 'audio')} title="Move up a layer (Ctrl/Cmd + ])"><ChevronUp size={14} /> Layer</button><button data-testid="studio-layer-down" onClick={() => moveSelectionBetweenLayers(-1)} disabled={!selectedAssets.some((asset) => asset.kind !== 'audio')} title="Move down a layer (Ctrl/Cmd + [)"><ChevronDown size={14} /> Layer</button><button onClick={duplicateSelected} disabled={!selectedAssets.length} title="Duplicate selected clips"><Copy size={14} /></button><button onClick={removeSelected} disabled={!selectedAssets.length} title="Delete selected clips"><Trash2 size={14} /></button>{selectedAssets.length > 1 && <span className={styles.selectionCount}>{selectedAssets.length} selected</span>}</div>
          <div className={styles.transport}><button aria-label={playing ? 'Pause' : 'Play'} title="Play/pause (Space)" className={styles.playButton} onClick={togglePlayback} disabled={!selected || selected.kind === 'image'}>{playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}</button><span>{formatTime(playhead)} <i>/</i> {formatTime(timelineDuration)}</span></div>
          <div className={styles.timelineZoom}><span className={styles.timelineHint}>Drag vertically to layer · Ctrl/Cmd [ ]</span><ZoomIn size={14} /><input aria-label="Timeline zoom" type="range" min="0.5" max="2.5" step="0.1" value={timelineZoom} onChange={(event) => setTimelineZoom(Number(event.target.value))} /></div>
        </div>
        <div className={styles.timelineBody}>
          <div ref={timelineLabelsRef} className={styles.trackLabels} onWheel={(event) => { if (timelineContentRef.current) timelineContentRef.current.scrollTop += event.deltaY; }}><span>VIDEO</span>{Array.from({ length: visualTrackCount }, (_, index) => visualTrackCount - index - 1).map((track) => <div data-testid={`timeline-track-label-v${track + 1}`} key={track}>V{track + 1}</div>)}<div className={styles.audioLabel}>A1</div></div>
          <div ref={timelineContentRef} data-testid="studio-timeline-dropzone" className={`${styles.trackContent} ${timelineDropTime !== null ? styles.timelineDropActive : ''}`} onScroll={(event) => { if (timelineLabelsRef.current) timelineLabelsRef.current.scrollTop = event.currentTarget.scrollTop; }} onDragOver={dragMediaOverTimeline} onDragLeave={leaveTimelineDrop} onDrop={(event) => void dropMediaOnTimeline(event)} onPointerMove={moveTimelinePointer} onPointerUp={endTimelinePointer} onPointerCancel={endTimelinePointer}>
            <div data-testid="studio-timeline-canvas" ref={timelineCanvasRef} className={styles.timelineCanvas} style={{ width: timelineWidth, minWidth: '100%' }}>
              <div data-testid="studio-timeline-ruler" className={styles.ruler} onPointerDown={beginScrub}>{Array.from({ length: Math.floor(rulerDuration / rulerStep) + 1 }, (_, index) => { const time = index * rulerStep; return <span key={time} style={{ left: time * pixelsPerSecond }}>{formatTime(time).slice(3)}</span>; })}</div>
              <div className={styles.videoTracks} onPointerDown={beginScrub}>
            {assets.filter((asset) => asset.kind !== 'audio').map((asset) => <div data-testid={`timeline-clip-${asset.id}`} data-visual-track={asset.visualTrack} role="button" tabIndex={0} aria-selected={selectedIDs.includes(asset.id)} key={asset.id} onContextMenu={(event) => { if (asset.kind !== 'video') return; event.preventDefault(); selectOnly(asset.id); setContextMenu({ assetID: asset.id, x: event.clientX, y: event.clientY }); }} onPointerDown={(event) => beginClipDrag(event, asset, 'move')} className={`${styles.timelineClip} ${selectedIDs.includes(asset.id) ? styles.timelineClipSelected : ''}`} style={{ '--track-from-top': visualTrackCount - asset.visualTrack - 1, left: asset.timelineStart * pixelsPerSecond, width: Math.max(24, clipDuration(asset) * pixelsPerSecond) } as CSSProperties} title={`${asset.name} · V${asset.visualTrack + 1} · ${formatTime(clipDuration(asset))}`}>
                  <span className={`${styles.trimHandle} ${styles.trimHandleLeft}`} onPointerDown={(event) => beginClipDrag(event, asset, 'trim-left')} title="Trim start" />
                  <span className={styles.clipThumb} style={{ backgroundImage: `url(${asset.kind === 'image' ? asset.url : ''})` }}>{asset.kind === 'video' && <Film size={15} />}</span>
                  <span className={styles.clipMeta}><b>{asset.name}</b><small>{formatTime(clipDuration(asset))}</small></span>
                  <span className={`${styles.trimHandle} ${styles.trimHandleRight}`} onPointerDown={(event) => beginClipDrag(event, asset, 'trim-right')} title="Trim end" />
                </div>)}
              </div>
              <div className={styles.audioTrack} onPointerDown={beginScrub}>
                {assets.filter((asset) => asset.kind === 'audio').map((asset) => <div role="button" tabIndex={0} aria-selected={selectedIDs.includes(asset.id)} key={asset.id} className={`${styles.waveformClip} ${selectedIDs.includes(asset.id) ? styles.timelineClipSelected : ''}`} style={{ left: asset.timelineStart * pixelsPerSecond, width: Math.max(24, clipDuration(asset) * pixelsPerSecond) }} onPointerDown={(event) => beginClipDrag(event, asset, 'move')} title={`${asset.name} · ${formatTime(clipDuration(asset))}`}>
                  <span className={`${styles.trimHandle} ${styles.trimHandleLeft}`} onPointerDown={(event) => beginClipDrag(event, asset, 'trim-left')} title="Trim start" />
                  <span className={styles.waveform}>{Array.from({ length: 54 }, (_, index) => <i key={index} style={{ height: `${15 + ((index * 29) % 70)}%` }} />)}</span><b>{asset.name}</b>
                  <span className={`${styles.trimHandle} ${styles.trimHandleRight}`} onPointerDown={(event) => beginClipDrag(event, asset, 'trim-right')} title="Trim end" />
                </div>)}
              </div>
              {timelineDropTime !== null && <div className={styles.timelineDropMarker} style={{ left: timelineDropTime * pixelsPerSecond }}><span>Drop at {formatTime(timelineDropTime)}</span></div>}
              <div className={styles.playhead} style={{ left: playhead * pixelsPerSecond }} />
            </div>
          </div>
        </div>
      </section>

      {exportOpen && <Modal title="Export video" onClose={() => !busy && setExportOpen(false)}>
        <div className={styles.exportOptions}>
          <button data-testid="export-format-mp4-h264" className={exportSettings.format === 'mp4-h264' ? styles.optionSelected : ''} onClick={() => setExportSettings((current) => ({ ...current, format: 'mp4-h264' }))}><span className={styles.optionIcon}>264</span><span><b>MP4 · H.264</b><small>Maximum compatibility</small></span></button>
          <button data-testid="export-format-webm-vp9" className={exportSettings.format === 'webm-vp9' ? styles.optionSelected : ''} onClick={() => setExportSettings((current) => ({ ...current, format: 'webm-vp9' }))}><span className={styles.optionIcon}>VP9</span><span><b>WebM · VP9</b><small>Efficient web playback</small></span></button>
          <button data-testid="export-format-webm-av1" className={exportSettings.format === 'webm-av1' ? styles.optionSelected : ''} onClick={() => setExportSettings((current) => ({ ...current, format: 'webm-av1' }))}><span className={styles.optionIcon}>AV1</span><span><b>WebM · AV1</b><small>Smallest file, modern playback</small></span></button>
        </div>
        <div className={styles.exportSettings}>
          <label><span>Resolution</span><select data-testid="export-resolution" value={exportSettings.resolution} disabled={!!busy} onChange={(event) => setExportSettings((current) => ({ ...current, resolution: event.target.value as ExportResolution }))}><option value="source">Source</option><option value="2160p">4K / 2160p</option><option value="1440p">2K / 1440p</option><option value="1080p">1080p</option><option value="720p">720p</option></select></label>
          <label><span>Frame rate</span><select data-testid="export-frame-rate" value={String(exportSettings.frameRate)} disabled={!!busy} onChange={(event) => setExportSettings((current) => ({ ...current, frameRate: event.target.value === 'source' ? 'source' : Number(event.target.value) as 24 | 30 | 60 }))}><option value="source">Source</option><option value="24">24 fps</option><option value="30">30 fps</option><option value="60">60 fps</option></select></label>
          <label><span>Quality</span><select data-testid="export-quality" value={exportSettings.quality} disabled={!!busy} onChange={(event) => setExportSettings((current) => ({ ...current, quality: event.target.value as ExportQuality }))}><option value="draft">Draft</option><option value="balanced">Balanced</option><option value="high">High</option></select></label>
        </div>
        <p className={styles.exportRemembered}>Settings are remembered on this device.</p>
        <div className={styles.exportSummary}><span>Output <b>{selectedExportSize ? `${selectedExportSize.width} × ${selectedExportSize.height}` : '—'}</b></span><span>Frame rate <b>{exportSettings.frameRate === 'source' ? 'Source timing' : `${exportSettings.frameRate} fps`}</b></span><span>Timeline audio <b>{assets.some((asset) => asset.kind === 'audio') ? 'Mixed · AAC/Opus' : 'Source audio'}</b></span><span>Processing <b>WebGL GPU · hardware codec preferred</b></span><span>Destination <b>Local download</b></span></div>
        {exportProgress > 0 && <div className={styles.progress}><i style={{ width: `${exportProgress * 100}%` }} /></div>}
        <button className={styles.modalPrimary} disabled={!!busy} onClick={() => void exportVideo()}>{busy === 'export' ? <><Loader2 className={styles.spin} size={16} /> Exporting {Math.round(exportProgress * 100)}%</> : <><Download size={16} /> Export locally</>}</button>
      </Modal>}

      {extendOpen && <Modal title="Extend video" onClose={() => !busy && setExtendOpen(false)}>
        <label className={styles.field}><span>What happens next?</span><textarea value={extendPrompt} onChange={(event) => setExtendPrompt(event.target.value)} rows={4} /></label>
        <div className={styles.durationChoices}>{[2, 4, 6, 8, 10].map((duration) => <button key={duration} className={extendDuration === duration ? styles.durationActive : ''} onClick={() => setExtendDuration(duration)}>{duration}s</button>)}</div>
        <div className={styles.priceLine}><span>Price</span><b>${customerExtendUSD.toFixed(2)} · {extendCredits.toLocaleString()} credits</b></div>
        <p className={styles.billingNote}>Your selected 2–15 second clip is rendered to H.264 MP4 before upload. Grok adds 2–10 seconds and preserves the input shape, capped at 720p.</p>
        <button className={styles.modalPrimary} disabled={!extendPrompt.trim() || !!busy} onClick={() => void extendVideo()}><Sparkles size={16} /> Extend video</button>
      </Modal>}

      {upscaleOpen && <Modal title="Upscale video" onClose={() => !busy && setUpscaleOpen(false)}>
        <div className={styles.durationChoices} data-testid="studio-upscale-scales">
          {([2, 4] as const).map((scale) => {
            const supported = !!selected && selected.width * scale <= 8192 && selected.height * scale <= 8192;
            return <button key={scale} disabled={!supported} className={upscaleScale === scale ? styles.durationActive : ''} onClick={() => setUpscaleScale(scale)}>{scale}×</button>;
          })}
        </div>
        <div className={styles.priceLine}><span>Price</span><b>${customerUpscaleUSD.toFixed(2)} · {upscaleCredits.toLocaleString()} credits</b></div>
        <p className={styles.billingNote}>Real-ESRGAN restores each frame with tiled GPU inference, preserves audio, and adds the durable upscaled result to your timeline. Output: {selected ? `${selected.width * upscaleScale} × ${selected.height * upscaleScale}` : '—'}.</p>
        <button data-testid="studio-upscale-submit" className={styles.modalPrimary} disabled={!canUpscaleSelected || !!busy} onClick={() => void upscaleVideo()}>{busy === 'upscale' ? <><Loader2 className={styles.spin} size={16} /> Upscaling…</> : <><Maximize size={16} /> Upscale {upscaleScale}×</>}</button>
      </Modal>}

      {restyleOpen && <Modal title="Restyle video" onClose={() => !busy && setRestyleOpen(false)}>
        <div className={styles.restyleModes} role="tablist" aria-label="Video transformation mode">
          <button role="tab" aria-selected={restyleModel === 'wan-2.2'} className={restyleModel === 'wan-2.2' ? styles.durationActive : ''} onClick={() => { setRestyleModel('wan-2.2'); setRestyleResolution('720p'); setRestyleAspect('auto'); }}>Transform</button>
          <button role="tab" aria-selected={restyleModel === 'h3-reference'} className={restyleModel === 'h3-reference' ? styles.durationActive : ''} onClick={() => { setRestyleModel('h3-reference'); setRestyleResolution('2K'); setRestyleAspect('16:9'); }}>Reference to video</button>
        </div>
        <div className={styles.restyleSource}>
          <Film size={16} /><span><small>SOURCE VIDEO</small><b>{assets.find((asset) => asset.id === restyleSourceID)?.name || 'Selected clip'}</b></span>
        </div>
        <label className={styles.field}><span>Prompt</span><textarea data-testid="studio-restyle-prompt" value={restylePrompt} onChange={(event) => setRestylePrompt(event.target.value)} rows={5} placeholder="Describe the new visual style while calling references Image 1, Video 1, or Audio 1…" /></label>
        {restyleModel === 'wan-2.2' && <label className={styles.field}><span>Negative prompt</span><textarea value={restyleNegativePrompt} onChange={(event) => setRestyleNegativePrompt(event.target.value)} rows={2} /></label>}

        {restyleModel === 'wan-2.2' ? <>
          <label className={styles.sliderRow}><span><b>Transformation strength</b><output>{restyleStrength.toFixed(2)}</output></span><input type="range" min="0.05" max="1" step="0.05" value={restyleStrength} onChange={(event) => setRestyleStrength(Number(event.target.value))} /></label>
          <div className={styles.restyleSettings}>
            <label className={styles.field}><span>Frames</span><input type="number" min="17" max="161" value={restyleFrames} onChange={(event) => setRestyleFrames(Math.max(17, Math.min(161, Number(event.target.value))))} /></label>
            <label className={styles.field}><span>FPS</span><input type="number" min="4" max="60" value={restyleFPS} onChange={(event) => setRestyleFPS(Math.max(4, Math.min(60, Number(event.target.value))))} /></label>
            <label className={styles.field}><span>Resolution</span><select value={restyleResolution} onChange={(event) => setRestyleResolution(event.target.value)}><option>480p</option><option>580p</option><option>720p</option></select></label>
            <label className={styles.field}><span>Aspect</span><select value={restyleAspect} onChange={(event) => setRestyleAspect(event.target.value)}><option value="auto">Source</option><option>16:9</option><option>9:16</option><option>1:1</option></select></label>
          </div>
        </> : <div className={styles.restyleSettings}>
          <label className={styles.field}><span>Duration</span><select value={restyleDuration} onChange={(event) => setRestyleDuration(Number(event.target.value))}><option value="5">5 seconds</option><option value="10">10 seconds</option></select></label>
          <label className={styles.field}><span>Resolution</span><select value={restyleResolution} onChange={(event) => setRestyleResolution(event.target.value)}><option>768p</option><option>2K</option><option>4K</option></select></label>
          <label className={styles.field}><span>Aspect</span><select value={restyleAspect} onChange={(event) => setRestyleAspect(event.target.value)}><option>16:9</option><option>9:16</option><option>1:1</option></select></label>
          <label className={styles.field}><span>Seed</span><input type="number" min="0" value={restyleSeed} onChange={(event) => setRestyleSeed(Math.max(0, Number(event.target.value)))} placeholder="Random" /></label>
        </div>}

        <div className={styles.referenceHeader}><span><b>Ordered references</b><small>Up to 9 images, 3 videos, and 3 audio clips</small></span><button onClick={() => restyleReferenceInputRef.current?.click()}><Plus size={13} /> Add files</button></div>
        <input ref={restyleReferenceInputRef} type="file" multiple accept="video/*,image/*,audio/*" hidden onChange={(event) => { if (event.target.files) addRestyleReferences(event.target.files); event.target.value = ''; }} />
        <div className={styles.referenceDrop} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addRestyleReferences(event.dataTransfer.files); }} onClick={() => restyleReferenceInputRef.current?.click()}><Upload size={16} /><span>Drop reference media here or choose files</span></div>
        {!!assets.filter((asset) => asset.id !== restyleSourceID).length && <div className={styles.projectReferencePicker}>
          <span>FROM THIS PROJECT</span>
          <div>{assets.filter((asset) => asset.id !== restyleSourceID).map((asset) => <button key={asset.id} disabled={restyleReferences.some((item) => item.id === asset.id)} onClick={() => addProjectReference(asset)}>{asset.kind === 'image' ? <ImageIcon size={12} /> : asset.kind === 'video' ? <Film size={12} /> : <AudioLines size={12} />}{asset.name}</button>)}</div>
        </div>}
        <div className={styles.referenceList}>
          {restyleReferences.map((reference, index) => <div key={reference.id}>
            <span className={styles.referencePreview}>{reference.kind === 'image' ? <img src={reference.url} alt="" /> : reference.kind === 'video' ? <video src={reference.url} muted preload="metadata" /> : <AudioLines size={17} />}</span>
            <span><b>{reference.kind === 'image' ? 'Image' : reference.kind === 'video' ? 'Video' : 'Audio'} {restyleReferences.slice(0, index + 1).filter((item) => item.kind === reference.kind).length}</b><small>{reference.name}</small></span>
            <button aria-label="Move reference earlier" disabled={index === 0} onClick={() => moveRestyleReference(index, -1)}>↑</button>
            <button aria-label="Move reference later" disabled={index === restyleReferences.length - 1} onClick={() => moveRestyleReference(index, 1)}>↓</button>
            <button aria-label="Remove reference" onClick={() => setRestyleReferences((current) => current.filter((item) => item.id !== reference.id))}><X size={13} /></button>
          </div>)}
        </div>
        <p className={styles.billingNote}>{restyleModel === 'wan-2.2' ? `About ${(restyleFrames / restyleFPS).toFixed(1)}s output. Higher strength follows the prompt more; lower strength preserves more of the source.` : 'The selected source is Video 1. References stay in the order above and can be cited by number in your prompt.'}</p>
        <div className={styles.priceLine}><span>Estimated charge</span><b>~${restyleEstimateUSD.toFixed(2)} · ~{restyleEstimateCredits.toLocaleString()} credits</b></div>
        <button data-testid="studio-restyle-submit" className={styles.modalPrimary} disabled={!restylePrompt.trim() || !!busy} onClick={() => void generateRestyle()}>{busy === 'restyle' ? <><Loader2 className={styles.spin} size={16} /> Transforming…</> : <><WandSparkles size={16} /> Transform video</>}</button>
      </Modal>}

      {audioGenerateOpen && <Modal title={audioMode === 'music' ? 'Generate music' : audioMode === 'sfx' ? 'Generate sound' : 'Text to speech'} onClose={() => { if (!busy) { stopVoicePreview(); setAudioGenerateOpen(false); } }}>
        {audioMode === 'speech' ? <>
          <label className={styles.field}><span>Script</span><textarea data-testid="studio-speech-text" value={speechText} onChange={(event) => setSpeechText(event.target.value)} rows={5} maxLength={4000} /></label>
          <div className={styles.voicePicker} role="radiogroup" aria-label="Speech voice">
            {SPEECH_VOICES.map((voice) => <div key={voice.id} className={`${styles.voiceCard} ${speechVoice === voice.id ? styles.voiceCardSelected : ''}`}>
              <button type="button" role="radio" aria-checked={speechVoice === voice.id} className={styles.voiceSelect} onClick={() => setSpeechVoice(voice.id)}>
                <span className={styles.voiceBadge}>{voice.id}</span><span><b>{voice.name}</b><small>{voice.character}</small></span>
              </button>
              <button type="button" data-testid={`studio-voice-preview-${voice.id}`} className={styles.voicePreview} aria-label={`${previewingVoice === voice.id ? 'Stop' : 'Play'} ${voice.id} voice sample`} onClick={() => previewVoiceSample(voice.id)}>
                {previewingVoice === voice.id ? <Pause size={14} /> : <Play size={14} />}<span>{previewingVoice === voice.id ? 'Stop' : 'Sample'}</span>
              </button>
            </div>)}
          </div>
          <div className={styles.voiceSampleNote}><span>Pre-rendered Opus previews · free to play</span>{voicePreviewError && <b role="alert">{voicePreviewError}</b>}</div>
          <label className={styles.field}><span>Speed · {speechSpeed.toFixed(1)}×</span><input type="range" min="0.7" max="1.4" step="0.1" value={speechSpeed} onChange={(event) => setSpeechSpeed(Number(event.target.value))} /></label>
          <div className={styles.priceLine}><span>Exact text charge</span><b>${speechUSD.toFixed(4)} · {speechCredits.toFixed(2)} credits</b></div>
        </> : <>
          <label className={styles.field}><span>{audioMode === 'music' ? 'Describe the track' : 'Describe the sound'}</span><textarea data-testid="studio-audio-prompt" value={audioPrompt} onChange={(event) => setAudioPrompt(event.target.value)} rows={4} maxLength={2000} /></label>
          <div className={styles.durationChoices}>{[5, 10, 20, 30, 45].map((duration) => <button key={duration} className={audioDuration === duration ? styles.durationActive : ''} onClick={() => setAudioDuration(duration)}>{duration}s</button>)}</div>
          <div className={styles.priceLine}><span>{audioMode === 'music' ? 'Fal music charge' : 'Estimated H3 charge'}</span><b>{audioMode === 'music' ? '80 credits' : `~$${audioEstimateUSD.toFixed(2)} · ~${audioEstimateCredits.toLocaleString()} credits`}</b></div>
        </>}
        <p className={styles.billingNote}>Catalog search and editing are free. Generation is charged only through your Manifold credits.</p>
        <button data-testid="studio-audio-generate" className={styles.modalPrimary} disabled={!!busy || (audioMode === 'speech' ? !speechText.trim() : !audioPrompt.trim())} onClick={() => void generateAudio()}>{busy.startsWith('generate-') ? <><Loader2 className={styles.spin} size={16} /> Generating…</> : <><Sparkles size={16} /> Generate and add to timeline</>}</button>
      </Modal>}

      {contextMenu && <div className={styles.contextMenuBackdrop} onPointerDown={() => setContextMenu(null)} onContextMenu={(event) => { event.preventDefault(); setContextMenu(null); }}><div className={styles.contextMenu} style={{ left: Math.min(contextMenu.x, window.innerWidth - 190), top: Math.min(contextMenu.y, window.innerHeight - 70) }} onPointerDown={(event) => event.stopPropagation()}><button onClick={() => { const asset = assets.find((item) => item.id === contextMenu.assetID); if (asset) openRestyle(asset); }}><WandSparkles size={15} /><span><b>Restyle video</b><small>Transform look, preserve motion</small></span></button></div></div>}
    </main>
  );
}

function PanelEmpty() {
  return <div className={styles.panelEmpty}><MousePointer2 size={22} /><p>Select a clip to edit.</p></div>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className={styles.modalBackdrop} onMouseDown={(event) => event.currentTarget === event.target && onClose()}><div className={styles.modal}><div className={styles.modalHeader}><div><span className={styles.eyebrow}>STUDIO</span><h2>{title}</h2></div><button onClick={onClose}><X size={17} /></button></div><div className={styles.modalBody}>{children}</div></div></div>;
}
