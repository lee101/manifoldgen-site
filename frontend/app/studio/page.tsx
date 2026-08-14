'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent as ReactDragEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  BookOpen,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Clapperboard,
  Copy,
  CreditCard,
  Crop,
  Download,
  Film,
  GripVertical,
  Image as ImageIcon,
  KeyRound,
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
  RotateCw,
  Search,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Type,
  Trash2,
  Undo2,
  Upload,
  UserRound,
  Volume2,
  VolumeX,
  WandSparkles,
  X,
  ZoomIn,
} from 'lucide-react';
import {
  ALL_FORMATS,
  AudioBufferSink,
  AudioSample,
  AudioSampleSource,
  BlobSource,
  BufferTarget,
  CanvasSource,
  Input,
  Mp4OutputFormat,
  Output,
  Quality,
  VideoSampleSink,
  VideoSample,
  WebMOutputFormat,
  canEncodeAudio,
  canEncodeVideo,
} from 'mediabunny';
import { loadStoredUser, refreshUser, saveUser, type StoredUser } from '../../lib/auth';
import { HTTPResponseError, parseJSONResponse } from '../../lib/http';
import { ManifoldLoader } from '../../components/manifold-loader';
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
  type PortableStudioHistoryState,
} from '../../lib/studio-projects';
import { h3Dimensions, loopAnchorURL, type H3Aspect, type H3Size } from '../../lib/h3-loop';
import { VIDEO_GENERATORS } from '../../lib/video-generators';
import styles from './page.module.css';

type MediaKind = 'video' | 'image' | 'audio';
type Tool = 'media' | 'text' | 'adjust' | 'crop' | 'effects' | 'audio' | 'ai';
type MediaBrowserMode = 'project' | 'videos' | 'images' | 'music' | 'tools';
type ImageGenerationEngine = 'images3' | 'omniserve';
type ExportFormat = 'mp4-h264' | 'webm-vp9' | 'webm-av1';
type ExportResolution = 'source' | '2160p' | '1440p' | '1080p' | '720p';
type ExportFrameRate = 'source' | 24 | 30 | 60;
type ExportQuality = 'draft' | 'balanced' | 'high';
type H3Format = 'webm-av1' | 'webm-vp9' | 'mp4-h264';
type ExportSettings = {
  format: ExportFormat;
  resolution: ExportResolution;
  frameRate: ExportFrameRate;
  quality: ExportQuality;
};
type SpeechVoice = 'M1' | 'F1' | 'M2' | 'F2';
type TimelineDrag = {
  mode: 'move' | 'trim-left' | 'trim-right' | 'scrub' | 'marquee';
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
  baseSelection?: string[];
  marqueeIDs?: string[];
  historySnapshot?: EditorHistoryState;
};
type StageDrag = {
  mode: 'move' | 'scale' | 'rotate';
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
  originScale: number;
  originRotation: number;
  currentScale: number;
  currentRotation: number;
  centerX: number;
  centerY: number;
  startDistance: number;
  startAngle: number;
};

type AudioCatalogAsset = {
  id: number | string;
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

const CATALOG_AUDIO_DRAG_TYPE = 'application/x-manifold-audio';

function catalogWaveform(seedValue: string, count = 44) {
  let seed = 2166136261;
  for (const character of seedValue) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
  return Array.from({ length: count }, (_, index) => {
    seed = Math.imul(seed ^ (index + 1), 2246822519);
    const noise = ((seed >>> 8) & 255) / 255;
    const envelope = .55 + Math.sin((index / Math.max(1, count - 1)) * Math.PI) * .45;
    return Math.round(18 + noise * 72 * envelope);
  });
}

function ProjectAudioThumb({ asset }: { asset: Pick<StudioAsset, 'id' | 'name' | 'url'> }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const waveform = useMemo(() => catalogWaveform(`project:${asset.id}:${asset.name}`, 28), [asset.id, asset.name]);

  useEffect(() => {
    const pauseOther = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== `project:${asset.id}`) audioRef.current?.pause();
    };
    window.addEventListener('manifold:audio-preview', pauseOther);
    return () => {
      window.removeEventListener('manifold:audio-preview', pauseOther);
      audioRef.current?.pause();
    };
  }, [asset.id]);

  const toggle = (event: ReactMouseEvent<HTMLSpanElement>) => {
    event.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      window.dispatchEvent(new CustomEvent('manifold:audio-preview', { detail: `project:${asset.id}` }));
      void audio.play();
    } else {
      audio.pause();
    }
  };

  return <span className={styles.audioThumb} role="button" tabIndex={0} aria-label={`${playing ? 'Pause' : 'Play'} ${asset.name}`} onClick={toggle} onKeyDown={(event) => {
    if (event.key === 'Enter' || event.key === ' ') toggle(event as unknown as ReactMouseEvent<HTMLSpanElement>);
  }}>
    <audio ref={audioRef} src={asset.url} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={(event) => { event.currentTarget.currentTime = 0; setProgress(0); setPlaying(false); }} onTimeUpdate={(event) => {
      const duration = event.currentTarget.duration;
      setProgress(Number.isFinite(duration) && duration > 0 ? event.currentTarget.currentTime / duration : 0);
    }} />
    <span className={styles.audioThumbWave} aria-hidden="true">{waveform.map((height, index) => <i key={index} style={{ height: `${height}%`, opacity: index / waveform.length <= progress ? 1 : .28 }} />)}</span>
    <span className={styles.audioThumbPlay}>{playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}</span>
  </span>;
}

function catalogAudioFromTransfer(dataTransfer: DataTransfer) {
  const encoded = dataTransfer.getData(CATALOG_AUDIO_DRAG_TYPE);
  if (!encoded) return null;
  try {
    const asset = JSON.parse(encoded) as Partial<AudioCatalogAsset>;
    if ((typeof asset.id !== 'number' && typeof asset.id !== 'string') || typeof asset.title !== 'string' || typeof asset.url !== 'string') return null;
    return asset as AudioCatalogAsset;
  } catch {
    return null;
  }
}

function CatalogAudioCard({
  asset,
  loading,
  onAdd,
  onDragStart,
  onPromptContext,
  testID,
}: {
  asset: AudioCatalogAsset;
  loading: boolean;
  onAdd: (asset: AudioCatalogAsset) => void;
  onDragStart: (event: ReactDragEvent<HTMLElement>, asset: AudioCatalogAsset) => void;
  onPromptContext?: (event: ReactMouseEvent<HTMLElement>, asset: AudioCatalogAsset) => void;
  testID?: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const duration = Math.max(.01, asset.duration || audioRef.current?.duration || 0);
  const waveform = useMemo(() => catalogWaveform(`${asset.id}:${asset.title}`), [asset.id, asset.title]);
  const progress = Math.max(0, Math.min(1, currentTime / duration));
  const previewURL = asset.preview_url || asset.url;

  useEffect(() => {
    const stopOtherPreview = (event: Event) => {
      if ((event as CustomEvent<string>).detail === String(asset.id)) return;
      audioRef.current?.pause();
    };
    window.addEventListener('manifold:audio-preview', stopOtherPreview);
    return () => {
      window.removeEventListener('manifold:audio-preview', stopOtherPreview);
      audioRef.current?.pause();
    };
  }, [asset.id]);

  const play = () => {
    const audio = audioRef.current;
    if (!audio) return;
    window.dispatchEvent(new CustomEvent('manifold:audio-preview', { detail: String(asset.id) }));
    void audio.play().catch(() => setPlaying(false));
  };

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) play();
    else audio.pause();
  };

  const seek = (value: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = Math.max(0, Math.min(Number.isFinite(audio.duration) ? audio.duration : duration, value));
    audio.currentTime = next;
    setCurrentTime(next);
  };

  return <article
    key={asset.id}
    data-testid={testID || `studio-audio-hit-${asset.id}`}
    className={styles.catalogAudioCard}
    draggable
    onDragStart={(event) => onDragStart(event, asset)}
    onContextMenu={(event) => onPromptContext?.(event, asset)}
  >
    <audio
      ref={audioRef}
      src={previewURL}
      preload="metadata"
      onLoadedMetadata={(event) => setCurrentTime(Math.min(currentTime, event.currentTarget.duration || duration))}
      onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onEnded={(event) => { event.currentTarget.currentTime = 0; setCurrentTime(0); setPlaying(false); }}
    />
    <button className={styles.catalogPlay} onClick={toggle} aria-label={`${playing ? 'Pause' : 'Preview'} ${asset.title}`}>
      {playing ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
    </button>
    <div className={styles.catalogAudioBody}>
      <div className={styles.catalogAudioTitle}><b>{asset.title}</b><span>{formatTime(currentTime).slice(3)} / {formatTime(duration).slice(3)}</span></div>
      <div data-testid={`studio-audio-waveform-${asset.id}`} className={styles.catalogWaveform} title="Drag the handle to preview any part">
        <div className={styles.catalogWaveformBars} aria-hidden="true">{waveform.map((height, index) => <i key={index} style={{ height: `${height}%`, opacity: index / waveform.length <= progress ? 1 : .32 }} />)}</div>
        <input
          data-testid={`studio-audio-scrubber-${asset.id}`}
          aria-label={`Preview position for ${asset.title}`}
          type="range"
          min="0"
          max={duration}
          step="0.01"
          value={Math.min(currentTime, duration)}
          onChange={(event) => seek(Number(event.target.value))}
          onPointerUp={play}
          onKeyUp={play}
        />
      </div>
      <small>{formatTime(asset.duration).slice(3)} · {asset.license.toUpperCase()} · {asset.attribution || asset.provider}</small>
    </div>
    <span className={styles.catalogDragHandle} title="Drag to the timeline" aria-hidden="true"><GripVertical size={14} /></span>
    <button className={styles.catalogAdd} aria-label={`Add ${asset.title} to timeline at playhead`} disabled={loading} onClick={() => onAdd(asset)}>{loading ? <Loader2 className={styles.spin} size={13} /> : <Plus size={13} />}</button>
  </article>;
}

type RestyleReference = {
  id: string;
  name: string;
  kind: MediaKind;
  file: File;
  url: string;
  cloudURL?: string;
};

type StudioTextStyle = {
  content: string;
  fontSize: number;
  fontFamily: 'Inter' | 'Arial' | 'Georgia' | 'Courier New' | 'Playfair Display';
  fontWeight: 400 | 600 | 800;
  color: string;
  align: 'left' | 'center' | 'right';
};

const STUDIO_FONTS: StudioTextStyle['fontFamily'][] = ['Inter', 'Arial', 'Georgia', 'Courier New', 'Playfair Display'];

type StudioImageHit = {
  id: string;
  prompt: string;
  image_url?: string;
  thumb_url?: string;
  file_path?: string;
  thumb_path?: string;
  model?: string;
  similarity?: number;
};

type StudioVideoHit = {
  job_id: string;
  prompt: string;
  video_url?: string;
  service?: string;
  similarity?: number;
};

const SPEECH_VOICES: { id: SpeechVoice; name: string; character: string }[] = [
  { id: 'M1', name: 'Balanced', character: 'Natural and versatile' },
  { id: 'F1', name: 'Clear', character: 'Crisp and articulate' },
  { id: 'M2', name: 'Warm', character: 'Relaxed and inviting' },
  { id: 'F2', name: 'Bright', character: 'Lively and expressive' },
];

const voiceSampleBaseURL = (process.env.NEXT_PUBLIC_STATIC_BASE_URL || '/static').replace(/\/$/, '');
const GALLERY_CDN = 'https://manifoldgenstatic.manifoldgen.com/gallery';

type StudioAsset = {
  id: string;
  mediaID: string;
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
  sourceAudioMuted?: boolean;
  stageX: number;
  stageY: number;
  stageScale: number;
  stageRotation: number;
  attribution?: string;
  adjustments: StudioAdjustments;
  cloudURL?: string;
  objectKey?: string;
  text?: StudioTextStyle;
};

type EditorHistoryState = {
  assets: StudioAsset[];
  selectedID: string;
  selectedIDs: string[];
  playhead: number;
};

type EditorHistory = {
  undo: EditorHistoryState[];
  redo: EditorHistoryState[];
};

const HISTORY_LIMIT = 20;

type CloudProject = {
  id: string;
  name: string;
  document?: PortableStudioDocument;
  revision: number;
  created_at: string;
  updated_at: string;
};

type GenerationJob = {
  job_id: string;
  status: string;
  prompt?: string;
  result?: unknown;
  error?: string;
  created_at?: string;
  updated_at?: string;
};

type BackgroundActivity = {
  id: string;
  label: string;
  progress?: number;
};

type StudioPerfDiagnostics = {
  renderer?: ReturnType<StudioRenderer['diagnostics']>;
  previewFrames: number;
  previewStartedAt: number;
  previewLastAt: number;
  previewMediaTime?: number;
  redrawPreview?: () => void;
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
  const scaledWidth = Math.max(2, Math.round(width * scale / 2) * 2);
  const scaledHeight = Math.max(2, Math.round(height * scale / 2) * 2);
  // WebCodecs implementations commonly reject icon-sized 2×2/4×4 frames.
  // Preserve aspect while meeting a conservative encoder minimum.
  const encoderScale = Math.max(1, 16 / scaledWidth, 16 / scaledHeight);
  return {
    width: Math.max(16, Math.round(scaledWidth * encoderScale / 2) * 2),
    height: Math.max(16, Math.round(scaledHeight * encoderScale / 2) * 2),
  };
}

function fitStagePreview(width: number, height: number, maxWidth: number, maxHeight: number) {
  const scale = Math.min(maxWidth / Math.max(1, width), maxHeight / Math.max(1, height));
  return {
    width: Math.max(16, Math.round(width * scale)),
    height: Math.max(16, Math.round(height * scale)),
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
    id: asset.id, mediaID: asset.mediaID, name: asset.name, kind: asset.kind,
    duration: asset.duration, width: asset.width, height: asset.height,
    trimStart: asset.trimStart, trimEnd: asset.trimEnd, timelineStart: asset.timelineStart,
    visualTrack: asset.visualTrack,
    volume: asset.volume, fadeIn: asset.fadeIn, fadeOut: asset.fadeOut,
    sourceAudioMuted: asset.sourceAudioMuted,
    stageX: asset.stageX, stageY: asset.stageY, attribution: asset.attribution,
    stageScale: asset.stageScale, stageRotation: asset.stageRotation,
    adjustments: asset.adjustments, cloudURL: asset.cloudURL, objectKey: asset.objectKey,
    text: asset.text,
    contentType: asset.file.type || 'application/octet-stream', size: asset.file.size,
    lastModified: asset.file.lastModified,
  };
}

function portableHistoryState(state: EditorHistoryState): PortableStudioHistoryState {
  return {
    selectedID: state.selectedID,
    selectedIDs: state.selectedIDs,
    playhead: state.playhead,
    assets: state.assets.map(portableAsset),
  };
}

function projectDocument(assets: StudioAsset[], selectedID: string, history: EditorHistory): PortableStudioDocument {
  const document: PortableStudioDocument = {
    version: STUDIO_PROJECT_VERSION,
    selectedID,
    assets: assets.map(portableAsset),
    history: {
      undo: history.undo.map(portableHistoryState),
      redo: history.redo.map(portableHistoryState),
    },
  };
  // Project documents are capped by the API. Preserve the newest history
  // entries, but trim the oldest ones before a large project can block sync.
  while (JSON.stringify(document).length > 1_500_000 && (document.history!.undo.length || document.history!.redo.length)) {
    if (document.history!.undo.length) document.history!.undo.shift();
    else document.history!.redo.shift();
  }
  return document;
}

async function materializeProject(document: PortableStudioDocument, localFiles = new Map<string, File>()) {
  const assets: StudioAsset[] = [];
  for (const stored of document.assets || []) {
    const mediaID = stored.mediaID || stored.id;
    let file = localFiles.get(mediaID);
    if (!file && stored.cloudURL) {
      const response = await fetchWithRetry(stored.cloudURL);
      if (!response.ok) throw new Error(`Could not download ${stored.name}`);
      const blob = await response.blob();
      file = new File([blob], stored.name, { type: stored.contentType || blob.type, lastModified: stored.lastModified });
      // History states often reference the same asset. Reuse the download for
      // the remaining snapshots instead of fetching the media repeatedly.
      localFiles.set(mediaID, file);
    }
    if (!file) continue;
    assets.push({
      ...stored,
      mediaID,
      visualTrack: stored.kind === 'audio' ? 0 : Math.max(0, Math.floor(stored.visualTrack || 0)),
      stageScale: Math.max(0.1, Math.min(4, stored.stageScale ?? 1)),
      stageRotation: stored.stageRotation ?? 0,
      file,
      url: URL.createObjectURL(file),
      adjustments: { ...DEFAULT_ADJUSTMENTS, ...stored.adjustments },
    });
  }
  return stackOverlappingVisuals(assets);
}

const MIN_CLIP_DURATION = 0.1;
const MAX_VISUAL_TRACKS = 12;

function clipDuration(asset: Pick<StudioAsset, 'trimStart' | 'trimEnd'>) {
  return Math.max(0, asset.trimEnd - asset.trimStart);
}

function clipEnd(asset: Pick<StudioAsset, 'timelineStart' | 'trimStart' | 'trimEnd'>) {
  return asset.timelineStart + clipDuration(asset);
}

function visualClipsOverlap(left: StudioAsset, right: StudioAsset) {
  return left.kind !== 'audio' && right.kind !== 'audio'
    && left.timelineStart < clipEnd(right) - 0.0001
    && right.timelineStart < clipEnd(left) - 0.0001;
}

// A visual lane may contain many sequential clips, but never two clips that
// occupy the same time. Stable asset order keeps older material below newer
// overlays, while pinned IDs let an explicit layer command take precedence.
function stackOverlappingVisuals(items: StudioAsset[], pinnedIDs = new Set<string>()) {
  const visuals = items.map((asset, index) => ({ asset, index })).filter(({ asset }) => asset.kind !== 'audio');
  visuals.sort((left, right) => (
    left.asset.visualTrack - right.asset.visualTrack
    || Number(pinnedIDs.has(right.asset.id)) - Number(pinnedIDs.has(left.asset.id))
    || left.index - right.index
  ));
  const lanes: StudioAsset[][] = Array.from({ length: MAX_VISUAL_TRACKS }, () => []);
  const assigned = new Map<string, number>();
  for (const { asset } of visuals) {
    let track = Math.max(0, Math.min(MAX_VISUAL_TRACKS - 1, Math.floor(asset.visualTrack)));
    while (track < MAX_VISUAL_TRACKS - 1 && lanes[track].some((other) => visualClipsOverlap(asset, other))) track += 1;
    assigned.set(asset.id, track);
    lanes[track].push(asset);
  }
  return items.map((asset) => asset.kind === 'audio' ? asset : { ...asset, visualTrack: assigned.get(asset.id) ?? asset.visualTrack });
}

function moveVisualLayersWithSwap(items: StudioAsset[], selectedIDs: Set<string>, delta: number) {
  if (!delta) return stackOverlappingVisuals(items, selectedIDs);
  const moved = items.map((asset) => selectedIDs.has(asset.id) && asset.kind !== 'audio'
    ? { ...asset, visualTrack: Math.max(0, Math.min(MAX_VISUAL_TRACKS - 1, asset.visualTrack + delta)) }
    : asset);
  const selected = moved.filter((asset) => selectedIDs.has(asset.id) && asset.kind !== 'audio');
  const swapped = moved.map((asset) => {
    if (asset.kind === 'audio' || selectedIDs.has(asset.id)) return asset;
    const displaced = selected.some((chosen) => chosen.visualTrack === asset.visualTrack && visualClipsOverlap(chosen, asset));
    return displaced ? { ...asset, visualTrack: Math.max(0, Math.min(MAX_VISUAL_TRACKS - 1, asset.visualTrack - delta)) } : asset;
  });
  return stackOverlappingVisuals(swapped, selectedIDs);
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
  if (file.type.startsWith('audio/') || /\.(wav|mp3|ogg|oga|opus|m4a|aac|flac)$/i.test(file.name)) return 'audio';
  if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|avif|bmp)$/i.test(file.name)) return 'image';
  return null;
}

function authHeaders(apiKey: string, json = true): HeadersInit {
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${apiKey}`,
  };
}

const RETRYABLE_FETCH_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: { attempts?: number; baseDelayMs?: number } = {},
) {
  const attempts = Math.max(1, options.attempts ?? 3);
  const baseDelayMs = options.baseDelayMs ?? 350;
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(input, init);
      if (response.ok || !RETRYABLE_FETCH_STATUS.has(response.status) || attempt === attempts - 1) return response;
      lastError = new Error(`Request failed (${response.status})`);
    } catch (reason) {
      lastError = reason;
      if (attempt === attempts - 1) throw reason;
    }
    await new Promise((resolve) => window.setTimeout(resolve, baseDelayMs * (2 ** attempt)));
  }
  throw lastError instanceof Error ? lastError : new Error('Network request failed');
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

const ACTIVE_GENERATION_STATUSES = new Set(['queued', 'pending', 'processing', 'running', 'accepted']);
const READY_GENERATION_STATUSES = new Set(['completed', 'complete', 'succeeded', 'success']);

function generationStatus(job: GenerationJob) {
  return job.status.trim().toLowerCase();
}

function isActiveGeneration(job: GenerationJob) {
  return ACTIVE_GENERATION_STATUSES.has(generationStatus(job));
}

function mergeGenerationJobs(current: GenerationJob[], incoming: GenerationJob[]) {
  const currentByID = new Map(current.map((job) => [job.job_id, job]));
  return incoming.map((job) => {
    const previous = currentByID.get(job.job_id);
    if (!previous) return job;
    const previousUpdated = Date.parse(previous.updated_at || previous.created_at || '');
    const incomingUpdated = Date.parse(job.updated_at || job.created_at || '');
    if (Number.isFinite(previousUpdated) && Number.isFinite(incomingUpdated) && previousUpdated > incomingUpdated) return previous;
    if (!isActiveGeneration(previous) && isActiveGeneration(job)) return previous;
    return job;
  });
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

function generatedImageItems(payload: unknown): { url?: string; base64?: string }[] {
  if (!payload || typeof payload !== 'object') return [];
  const data = payload as Record<string, unknown>;
  const collection = Array.isArray(data.images) ? data.images : Array.isArray(data.data) ? data.data : null;
  if (collection) {
    return collection.flatMap((item) => generatedImageItems(item));
  }
  const url = [data.image_url, data.url, data.path].find((value): value is string => typeof value === 'string' && Boolean(value.trim()));
  const base64 = [data.image_base64, data.b64_json].find((value): value is string => typeof value === 'string' && Boolean(value.trim()));
  return url || base64 ? [{ url, base64 }] : [];
}

function galleryImageURL(value?: string) {
  const source = value?.trim();
  if (!source) return '';
  if (source.startsWith(`${GALLERY_CDN}/`)) return source;
  if (/^https?:\/\//i.test(source)) {
    try {
      const parsed = new URL(source);
      if (parsed.pathname.startsWith('/gallery/')) return `${GALLERY_CDN}${parsed.pathname.slice('/gallery'.length)}${parsed.search}`;
      if (parsed.pathname.startsWith('/images/')) return `${GALLERY_CDN}/${parsed.pathname.slice('/images/'.length)}${parsed.search}`;
    } catch { return source; }
    return source;
  }
  return `${GALLERY_CDN}/${source.replace(/^\/?(?:images\/|gallery\/)?/, '')}`;
}

function galleryImportURL(value: string) {
  try {
    const parsed = new URL(value);
    if (parsed.hostname === 'manifoldgenstatic.manifoldgen.com' && parsed.pathname.startsWith('/gallery/')) {
      return `/api/gallery-assets/${parsed.pathname.slice('/gallery/'.length)}?v=1`;
    }
  } catch {
    // The URL is validated by the caller; use the original value for its error.
  }
  return value;
}

function textFileName(content: string) {
  const stem = content.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 42) || 'text';
  return `${stem}.png`;
}

async function renderTextFile(style: StudioTextStyle) {
  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  canvas.height = 1080;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Text rendering is unavailable');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = style.color;
  context.textAlign = style.align;
  context.textBaseline = 'middle';
  context.font = `${style.fontWeight} ${style.fontSize}px ${JSON.stringify(style.fontFamily)}, sans-serif`;
  const maxWidth = 1600;
  const words = style.content.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) { lines.push(line); line = word; }
    else line = candidate;
  }
  if (line) lines.push(line);
  const visible = lines.slice(0, 8);
  const lineHeight = style.fontSize * 1.18;
  const startY = canvas.height / 2 - (visible.length - 1) * lineHeight / 2;
  const x = style.align === 'left' ? 160 : style.align === 'right' ? canvas.width - 160 : canvas.width / 2;
  visible.forEach((value, index) => context.fillText(value, x, startY + index * lineHeight, maxWidth));
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Could not render text')), 'image/png'));
  return new File([blob], textFileName(style.content), { type: 'image/png' });
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

async function renderTimelineAudio(timelineAssets: StudioAsset[], duration: number) {
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
  for (const clip of timelineAssets.filter((asset) => asset.kind !== 'image' && !(asset.kind === 'video' && asset.sourceAudioMuted))) {
    const overlapStart = Math.max(0, clip.timelineStart);
    const overlapEnd = Math.min(duration, clipEnd(clip));
    if (overlapEnd <= overlapStart) continue;
    await schedule(clip, overlapStart, clip.trimStart + overlapStart - clip.timelineStart, overlapEnd - overlapStart);
  }
  await decoder.close();
  if (!scheduled) return null;
  return offline.startRendering();
}

async function extractAudioClip(asset: StudioAsset) {
  const duration = clipDuration(asset);
  const input = new Input({ source: new BlobSource(asset.file), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track) throw new Error('This video does not contain an audio track');
    if (!(await track.canDecode())) throw new Error('This browser cannot decode the video audio track');

    const offline = new OfflineAudioContext(2, Math.max(1, Math.ceil(duration * 48_000)), 48_000);
    const sink = new AudioBufferSink(track);
    let scheduled = 0;
    for await (const wrapped of sink.buffers(asset.trimStart, asset.trimEnd)) {
      const sourceStart = Math.max(asset.trimStart, wrapped.timestamp);
      const sourceEnd = Math.min(asset.trimEnd, wrapped.timestamp + wrapped.buffer.duration);
      const grainDuration = sourceEnd - sourceStart;
      if (grainDuration <= 0) continue;
      const source = offline.createBufferSource();
      source.buffer = wrapped.buffer;
      source.connect(offline.destination);
      source.start(sourceStart - asset.trimStart, sourceStart - wrapped.timestamp, grainDuration);
      scheduled += 1;
    }
    if (!scheduled) throw new Error('No decodable audio was found in the selected video range');
    const rendered = await offline.startRendering();
    const baseName = asset.name.replace(/\.[^.]+$/, '') || 'video';
    return new File([wavBlob(rendered)], `${baseName}-audio.wav`, { type: 'audio/wav' });
  } finally {
    input.dispose();
  }
}

export default function StudioPage() {
  const [assets, setAssets] = useState<StudioAsset[]>([]);
  const [projectID, setProjectID] = useState('');
  const [projectName, setProjectName] = useState('Untitled project');
  const [projectReady, setProjectReady] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cloudProjects, setCloudProjects] = useState<CloudProject[]>([]);
  const [saveStatus, setSaveStatus] = useState('Loading project…');
  const [syncRetry, setSyncRetry] = useState(0);
  const [selectedID, setSelectedID] = useState('');
  const [selectedIDs, setSelectedIDs] = useState<string[]>([]);
  const [editHistory, setEditHistory] = useState<EditorHistory>({ undo: [], redo: [] });
  const [tool, setTool] = useState<Tool>('media');
  const [user, setUser] = useState<StoredUser | null>(null);
  const [generationJobs, setGenerationJobs] = useState<GenerationJob[]>([]);
  const [generationContextMenu, setGenerationContextMenu] = useState<{ jobID: string; x: number; y: number } | null>(null);
  const [mediaBrowserMode, setMediaBrowserMode] = useState<MediaBrowserMode>('project');
  const [mediaSearch, setMediaSearch] = useState('');
  const [mediaSearchBusy, setMediaSearchBusy] = useState(false);
  const [imageHits, setImageHits] = useState<StudioImageHit[]>([]);
  const [videoHits, setVideoHits] = useState<StudioVideoHit[]>([]);
  const [imagePrompt, setImagePrompt] = useState('Editorial portrait lit by soft window light, tactile detail, restrained color palette');
  const [imageEngine, setImageEngine] = useState<ImageGenerationEngine>('images3');
  const [imageAspect, setImageAspect] = useState<H3Aspect>('1:1');
  const [imageCount, setImageCount] = useState<1 | 4>(4);
  const [textDraft, setTextDraft] = useState<StudioTextStyle>({ content: 'Your story starts here', fontSize: 112, fontFamily: 'Inter', fontWeight: 800, color: '#ffffff', align: 'center' });
  const [fontSearch, setFontSearch] = useState('');
  const [creditPrice, setCreditPrice] = useState(0.01);
  const [extendRates, setExtendRates] = useState({ input: 0.012, output: 0.084 });
  const [upscaleRates, setUpscaleRates] = useState({ base: 0.10, outputMPSecond: 0.012 });
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [stageZoom, setStageZoom] = useState(1);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [stageDragPosition, setStageDragPosition] = useState<{ assetID: string; x: number; y: number; scale: number; rotation: number } | null>(null);
  const [stageGuides, setStageGuides] = useState({ horizontal: false, vertical: false });
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [timelineDropTime, setTimelineDropTime] = useState<number | null>(null);
  const [timelineMarquee, setTimelineMarquee] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [activeTimelineClip, setActiveTimelineClip] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [videoGenerateOpen, setVideoGenerateOpen] = useState(false);
  const [imageGenerateOpen, setImageGenerateOpen] = useState(false);
  const [videoGeneratePrompt, setVideoGeneratePrompt] = useState('');
  const [videoGenerateAspect, setVideoGenerateAspect] = useState<H3Aspect>('16:9');
  const [videoGenerateSize, setVideoGenerateSize] = useState<H3Size>('balanced');
  const [videoGenerateDuration, setVideoGenerateDuration] = useState(5);
  const [videoGenerateSteps, setVideoGenerateSteps] = useState(20);
  const [videoGenerateFormat, setVideoGenerateFormat] = useState<H3Format>('webm-av1');
  const [videoGenerateAudio, setVideoGenerateAudio] = useState(true);
  const [videoGenerateLoop, setVideoGenerateLoop] = useState(false);
  const [videoGenerateUseSelected, setVideoGenerateUseSelected] = useState(false);
  const [videoGenerateQueueStatus, setVideoGenerateQueueStatus] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [exportSettings, setExportSettings] = useState<ExportSettings>(loadExportSettings);
  const [exportProgress, setExportProgress] = useState(0);
  const [busy, setBusy] = useState('');
  const [backgroundActivities, setBackgroundActivities] = useState<BackgroundActivity[]>([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendPrompt, setExtendPrompt] = useState('The camera continues forward as the scene naturally unfolds.');
  const [extendDuration, setExtendDuration] = useState(6);
  const [upscaleOpen, setUpscaleOpen] = useState(false);
  const [upscaleScale, setUpscaleScale] = useState<2 | 4>(2);
  const [restyleOpen, setRestyleOpen] = useState(false);
  const [restyleSourceID, setRestyleSourceID] = useState('');
  const [restyleModel, setRestyleModel] = useState<'wan-2.2' | 'h3-reference' | 'wan-animate-2'>('wan-2.2');
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
  const [contextMenu, setContextMenu] = useState<{ assetID?: string; prompt?: string; promptKind?: 'image' | 'video' | 'music' | 'sfx' | 'speech'; x: number; y: number } | null>(null);
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
  const [sfxFiveSecondEstimateUSD, setSFXFiveSecondEstimateUSD] = useState(.51);
  const [ttsPer100USD, setTTSPer100USD] = useState(0.005);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const restyleReferenceInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<StudioRenderer | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const galleryImportStartedRef = useRef(false);
  const mediaHandoffProjectIDRef = useRef('');
  const timelineCanvasRef = useRef<HTMLDivElement>(null);
  const timelineContentRef = useRef<HTMLDivElement>(null);
  const timelineLabelsRef = useRef<HTMLDivElement>(null);
  const timelineDragRef = useRef<TimelineDrag | null>(null);
  const timelineClipboardRef = useRef<StudioAsset[]>([]);
  const stageRef = useRef<HTMLDivElement>(null);
  const stageDragRef = useRef<StageDrag | null>(null);
  const uploadInFlightRef = useRef(new Set<File>());
  const projectSaveSequenceRef = useRef(0);
  const projectPickerRef = useRef<HTMLDivElement>(null);
  const editHistoryRef = useRef<EditorHistory>({ undo: [], redo: [] });
  const historyMergeRef = useRef<{ key: string; at: number } | null>(null);
  const voicePreviewRef = useRef<HTMLAudioElement | null>(null);

  const startBackgroundActivity = useCallback((label: string) => {
    const id = uid();
    setBackgroundActivities((current) => [{ id, label }, ...current].slice(0, 12));
    return id;
  }, []);

  const updateBackgroundActivity = useCallback((id: string, label: string, progress?: number) => {
    setBackgroundActivities((current) => current.map((activity) => activity.id === id ? { ...activity, label, progress } : activity));
  }, []);

  const finishBackgroundActivity = useCallback((id: string) => {
    setBackgroundActivities((current) => current.filter((activity) => activity.id !== id));
  }, []);

  const clearMediaDragUI = useCallback(() => {
    setDragging(false);
    setTimelineDropTime(null);
  }, []);

  useEffect(() => {
    const clear = () => clearMediaDragUI();
    window.addEventListener('dragend', clear, true);
    window.addEventListener('drop', clear, true);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('dragend', clear, true);
      window.removeEventListener('drop', clear, true);
      window.removeEventListener('blur', clear);
    };
  }, [clearMediaDragUI]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const updateSize = () => {
      const { width, height } = stage.getBoundingClientRect();
      setStageSize((current) => current.width === width && current.height === height ? current : { width, height });
    };
    const observer = new ResizeObserver(updateSize);
    observer.observe(stage);
    updateSize();
    return () => observer.disconnect();
  }, []);

  const selected = assets.find((asset) => asset.id === selectedID) || null;
  const selectedAssets = useMemo(() => assets.filter((asset) => selectedIDs.includes(asset.id)), [assets, selectedIDs]);
  const stageVisualAssets = useMemo(() => assets
    .filter((asset) => asset.kind !== 'audio' && (asset.id === selectedID || (playhead >= asset.timelineStart && playhead < clipEnd(asset))))
    .sort((left, right) => left.visualTrack - right.visualTrack), [assets, playhead, selectedID]);
  const timelineVisuals = useMemo(() => assets.filter((asset) => asset.kind !== 'audio'), [assets]);
  const compositionBase = useMemo(() => [...timelineVisuals].sort((left, right) => left.timelineStart - right.timelineStart || left.visualTrack - right.visualTrack)[0] || null, [timelineVisuals]);
  const selectedExportSize = compositionBase ? exportSize(compositionBase.width, compositionBase.height, exportSettings.resolution) : null;
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
  const customerUpscaleUSD = useMemo(() => {
    if (!selected || selected.kind !== 'video') return upscaleRates.base;
    const outputMP = selected.width * selected.height * upscaleScale * upscaleScale / 1_000_000;
    return Math.ceil((upscaleRates.base + outputMP * selected.duration * upscaleRates.outputMPSecond) * 100 - 1e-8) / 100;
  }, [selected, upscaleRates, upscaleScale]);
  const videoGeneratePrompts = useMemo(() => videoGeneratePrompt
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12), [videoGeneratePrompt]);
  const videoGenerateUnitUSD = useMemo(() => {
    const sizeFactor = videoGenerateSize === 'preview' ? 0.45 : videoGenerateSize === 'balanced' ? 0.7 : 1;
    return Math.max(0.1, Math.ceil(h3AudioEstimateUSD * (videoGenerateDuration / 5) * (videoGenerateSteps / 20) * sizeFactor * 100) / 100);
  }, [h3AudioEstimateUSD, videoGenerateDuration, videoGenerateSize, videoGenerateSteps]);
  const videoGenerateBatchCount = Math.max(1, videoGeneratePrompts.length);
  const videoGenerateBatchUSD = videoGenerateUnitUSD * videoGenerateBatchCount;
  const videoGenerateBatchCredits = Math.ceil(videoGenerateBatchUSD / creditPrice);
  const audioEstimateUSD = Math.max(0.1, Math.ceil(sfxFiveSecondEstimateUSD * audioDuration / 5 * 100) / 100);
  const speechUSD = Math.max(ttsPer100USD * 0.1, Math.ceil(Math.max(1, speechText.trim().length) / 100 * ttsPer100USD * 10000) / 10000);
  const speechCredits = speechUSD / creditPrice;
  const restyleEstimateUSD = useMemo(() => {
    if (restyleModel === 'wan-animate-2') {
      const rate = restyleResolution === 'high' ? .60 : restyleResolution === 'balanced' ? .32 : .20;
      return Math.ceil(rate * restyleDuration * 100) / 100;
    }
    if (restyleModel === 'h3-reference') {
      const rate = restyleResolution === '4K' ? 0.16 : restyleResolution === '2K' ? 0.13 : 0.08;
      const images = restyleReferences.filter((item) => item.kind === 'image').length;
      return Math.ceil((rate * restyleDuration + Math.max(0, images - 5) * 0.08) * 1.2 * 100) / 100;
    }
    const rate = restyleResolution === '480p' ? 0.04 : restyleResolution === '580p' ? 0.06 : 0.08;
    return Math.ceil(rate * restyleFrames / 16 * 1.2 * 100) / 100;
  }, [restyleDuration, restyleFrames, restyleModel, restyleReferences, restyleResolution]);
  const creditsLabel = useMemo(() => {
    if (!user) return 'Sign in';
    const usd = user.credits_usd ?? user.credits * creditPrice;
    return `$${usd.toFixed(2)}`;
  }, [user, creditPrice]);

  const replaceEditHistory = useCallback((next: EditorHistory | ((current: EditorHistory) => EditorHistory)) => {
    const value = typeof next === 'function' ? next(editHistoryRef.current) : next;
    editHistoryRef.current = value;
    setEditHistory(value);
  }, []);

  const snapshotEditor = useCallback((): EditorHistoryState => ({
    assets: assets.map((asset) => ({ ...asset, adjustments: { ...asset.adjustments } })),
    selectedID,
    selectedIDs: [...selectedIDs],
    playhead,
  }), [assets, playhead, selectedID, selectedIDs]);

  const rememberSnapshot = useCallback((snapshot: EditorHistoryState) => {
    historyMergeRef.current = null;
    replaceEditHistory((current) => ({
      undo: [...current.undo, snapshot].slice(-HISTORY_LIMIT),
      redo: [],
    }));
  }, [replaceEditHistory]);

  const rememberEdit = useCallback((mergeKey?: string) => {
    const now = Date.now();
    if (mergeKey && historyMergeRef.current?.key === mergeKey && now - historyMergeRef.current.at < 700) {
      historyMergeRef.current.at = now;
      return;
    }
    const snapshot = snapshotEditor();
    replaceEditHistory((current) => ({
      undo: [...current.undo, snapshot].slice(-HISTORY_LIMIT),
      redo: [],
    }));
    historyMergeRef.current = mergeKey ? { key: mergeKey, at: now } : null;
  }, [replaceEditHistory, snapshotEditor]);

  const updateAsset = useCallback((id: string, update: Partial<StudioAsset>) => {
    rememberEdit(`asset:${id}:${Object.keys(update).sort().join(',')}`);
    setAssets((current) => current.map((item) => (item.id === id ? { ...item, ...update } : item)));
  }, [rememberEdit]);

  const restoreEditor = useCallback((state: EditorHistoryState) => {
    historyMergeRef.current = null;
    setAssets(stackOverlappingVisuals(state.assets.map((asset) => ({ ...asset, adjustments: { ...asset.adjustments } }))));
    setSelectedID(state.selectedID);
    setSelectedIDs([...state.selectedIDs]);
    setPlayhead(state.playhead);
  }, []);

  const undo = useCallback(() => {
    const current = editHistoryRef.current;
    const previous = current.undo.at(-1);
    if (!previous) return;
    const present = snapshotEditor();
    replaceEditHistory({ undo: current.undo.slice(0, -1), redo: [...current.redo, present].slice(-HISTORY_LIMIT) });
    restoreEditor(previous);
    setNotice('Undid timeline edit');
  }, [replaceEditHistory, restoreEditor, snapshotEditor]);

  const redo = useCallback(() => {
    const current = editHistoryRef.current;
    const next = current.redo.at(-1);
    if (!next) return;
    const present = snapshotEditor();
    replaceEditHistory({ undo: [...current.undo, present].slice(-HISTORY_LIMIT), redo: current.redo.slice(0, -1) });
    restoreEditor(next);
    setNotice('Redid timeline edit');
  }, [replaceEditHistory, restoreEditor, snapshotEditor]);

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
    const restoreHistoryState = async (state: PortableStudioHistoryState): Promise<EditorHistoryState> => ({
      assets: await materializeProject({ version: document.version, selectedID: state.selectedID, assets: state.assets }, files),
      selectedID: state.selectedID,
      selectedIDs: state.selectedIDs?.filter((assetID) => state.assets.some((asset) => asset.id === assetID)) || (state.selectedID ? [state.selectedID] : []),
      playhead: Number.isFinite(state.playhead) ? Math.max(0, state.playhead) : 0,
    });
    const storedHistory = document.history;
    const restoredHistory: EditorHistory = {
      undo: await Promise.all((storedHistory?.undo || []).slice(-HISTORY_LIMIT).map(restoreHistoryState)),
      redo: await Promise.all((storedHistory?.redo || []).slice(-HISTORY_LIMIT).map(restoreHistoryState)),
    };
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
    replaceEditHistory(restoredHistory);
    window.history.replaceState({}, '', `/studio?project=${encodeURIComponent(id)}`);
  }, [replaceEditHistory]);

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
    replaceEditHistory({ undo: [], redo: [] });
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
      if (data.video_estimate?.estimated_cost_usd) setH3AudioEstimateUSD(data.video_estimate.estimated_cost_usd);
      const sfxPrice = Array.isArray(data.pricing) ? data.pricing.find((item: { service?: string }) => item.service === 'sfx')?.price_usd : 0;
      if (sfxPrice) setSFXFiveSecondEstimateUSD(sfxPrice);
      const ttsPrice = Array.isArray(data.pricing) ? data.pricing.find((item: { service?: string }) => item.service === 'speech')?.price_usd : 0;
      if (ttsPrice) setTTSPer100USD(ttsPrice);
    }).catch(() => undefined);
    return () => assets.forEach((asset) => URL.revokeObjectURL(asset.url));
    // Object URLs are revoked as individual assets are deleted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user?.api_key) {
      setGenerationJobs([]);
      return;
    }
    let cancelled = false;
    let timer = 0;
    let inFlight = false;
    let rerun = false;
    let failures = 0;
    const controller = new AbortController();
    const schedule = (delay: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void loadJobs(), delay);
    };
    const loadJobs = async () => {
      if (inFlight) { rerun = true; return; }
      inFlight = true;
      try {
        const response = await fetch('/api/video-jobs', { headers: authHeaders(user.api_key, false), signal: controller.signal });
        const data = await parseJSONResponse<{ jobs?: GenerationJob[] }>(response, 'Could not load generations');
        const listed = data.jobs || [];
        const refreshed = new Map<string, GenerationJob>();
        for (let index = 0; index < listed.length; index += 4) {
          const batch = listed.slice(index, index + 4);
          const statuses = await Promise.allSettled(batch.map(async (job) => {
            if (!isActiveGeneration(job)) return job;
            const statusResponse = await fetch(`/api/video-jobs/${encodeURIComponent(job.job_id)}`, {
              headers: authHeaders(user.api_key, false),
              signal: controller.signal,
            });
            const statusData = await parseJSONResponse<{ job?: GenerationJob }>(statusResponse, 'Could not refresh generation');
            return statusData.job || job;
          }));
          statuses.forEach((status, offset) => refreshed.set(batch[offset].job_id, status.status === 'fulfilled' ? status.value : batch[offset]));
        }
        const next = listed.map((job) => refreshed.get(job.job_id) || job);
        failures = 0;
        if (!cancelled) setGenerationJobs((current) => mergeGenerationJobs(current, next));
        const hasActive = next.some(isActiveGeneration);
        schedule(document.hidden ? 30_000 : hasActive ? 2_500 : 12_000);
      } catch (reason) {
        if (!cancelled && !(reason instanceof DOMException && reason.name === 'AbortError')) {
          failures += 1;
          schedule(Math.min(30_000, 2_500 * (2 ** failures)));
        }
      } finally {
        inFlight = false;
        if (!cancelled && rerun) { rerun = false; schedule(0); }
      }
    };
    void loadJobs();
    const wake = () => schedule(0);
    const visibilityChanged = () => { if (!document.hidden) wake(); };
    window.addEventListener('focus', wake);
    window.addEventListener('online', wake);
    document.addEventListener('visibilitychange', visibilityChanged);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
      window.removeEventListener('focus', wake);
      window.removeEventListener('online', wake);
      document.removeEventListener('visibilitychange', visibilityChanged);
    };
  }, [user?.api_key]);

  useEffect(() => {
    const updateCredits = () => {
      const stored = loadStoredUser();
      if (stored) setUser(stored);
    };
    window.addEventListener(CREDITS_UPDATED_EVENT, updateCredits);
    return () => window.removeEventListener(CREDITS_UPDATED_EVENT, updateCredits);
  }, []);

  useEffect(() => {
    if (mediaBrowserMode === 'project' || mediaBrowserMode === 'tools') return;
    void searchStudioMedia(mediaBrowserMode, mediaSearch);
    // Switching library modes should immediately populate useful public work.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaBrowserMode]);

  useEffect(() => {
    if (selected?.text) {
      setTextDraft({ ...selected.text });
      setFontSearch(selected.text.fontFamily);
    }
  }, [selected?.id, selected?.text]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  useEffect(() => {
    if (!projectMenuOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!projectPickerRef.current?.contains(event.target as Node)) setProjectMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [projectMenuOpen]);

  useEffect(() => {
    window.localStorage.setItem(EXPORT_SETTINGS_KEY, JSON.stringify(exportSettings));
  }, [exportSettings]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const storedUser = loadStoredUser();
      const params = new URLSearchParams(window.location.search);
      const hasMediaHandoff = Boolean((params.get('video_url') || params.get('image_url') || params.get('audio_url'))?.trim());
      const forceNewProject = hasMediaHandoff || params.get('new') === '1';
      const requestedID = forceNewProject ? null : params.get('project');
      try {
        if (forceNewProject) {
          const id = uid();
          mediaHandoffProjectIDRef.current = id;
          setProjectID(id);
          setProjectName(params.get('name')?.trim().slice(0, 80) || 'Untitled project');
        } else if (storedUser && requestedID) {
          const local = await loadLocalStudioProject(requestedID);
          if (cancelled) return;
          if (local) {
            await applyProject(local.id, local.name, local.document, local.files);
          } else {
            const cloud = await fetchCloudProject(requestedID, storedUser.api_key);
            if (cancelled) return;
            await applyProject(cloud.id, cloud.name, cloud.document!);
          }
        } else {
          const local = await loadLocalStudioProject(requestedID);
          if (cancelled) return;
          if (local) {
            await applyProject(local.id, local.name, local.document, local.files);
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
    const retainedAssets = [
      ...assets,
      ...editHistory.undo.flatMap((state) => state.assets),
      ...editHistory.redo.flatMap((state) => state.assets),
    ];
    const pending = [...new Map(retainedAssets.map((asset) => [asset.file, asset])).values()]
      .filter((asset) => !asset.cloudURL && !uploadInFlightRef.current.has(asset.file));
    if (!pending.length) return;
    let started = false;
    const start = () => {
      started = true;
      const batch = pending.slice(0, 2);
      batch.forEach((asset) => uploadInFlightRef.current.add(asset.file));
      setSaveStatus(`Uploading ${pending.length} asset${pending.length === 1 ? '' : 's'}…`);
      void Promise.all(batch.map(async (asset) => {
        const fallbackType = asset.kind === 'video' ? 'video/mp4' : asset.kind === 'audio' ? 'audio/wav' : 'image/png';
        const contentType = asset.file.type || fallbackType;
        try {
          const response = await fetchWithRetry('/api/studio/assets/presign', {
            method: 'POST', headers: authHeaders(user.api_key),
            body: JSON.stringify({ project_id: projectID, asset_id: asset.mediaID, filename: asset.name, content_type: contentType, size: asset.file.size }),
          });
          const prepared = await parseJSONResponse<{ upload_url: string; public_url: string; object_key: string }>(response, `Could not upload ${asset.name}`);
          const uploaded = await fetchWithRetry(prepared.upload_url, { method: 'PUT', headers: { 'Content-Type': contentType }, body: asset.file });
          if (!uploaded.ok) throw new Error(`Asset upload failed (${uploaded.status})`);
          // Attach the URL to every snapshot sharing these immutable bytes,
          // but never to a newer media revision of the same logical asset.
          setAssets((current) => current.map((item) => item.mediaID === asset.mediaID && item.file === asset.file ? { ...item, cloudURL: prepared.public_url, objectKey: prepared.object_key } : item));
          replaceEditHistory((current) => ({
            undo: current.undo.map((state) => ({ ...state, assets: state.assets.map((item) => item.mediaID === asset.mediaID && item.file === asset.file ? { ...item, cloudURL: prepared.public_url, objectKey: prepared.object_key } : item) })),
            redo: current.redo.map((state) => ({ ...state, assets: state.assets.map((item) => item.mediaID === asset.mediaID && item.file === asset.file ? { ...item, cloudURL: prepared.public_url, objectKey: prepared.object_key } : item) })),
          }));
        } catch (reason) {
          setSaveStatus('Cloud upload will retry');
          setError(reason instanceof Error ? reason.message : `Could not upload ${asset.name}`);
          window.setTimeout(() => setSyncRetry((value) => value + 1), 5000);
        } finally {
          uploadInFlightRef.current.delete(asset.file);
          // If a newer revision was skipped while this ID was in flight, give
          // the uploader another pass even when no other state changed.
          setSyncRetry((value) => value + 1);
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
  }, [assets, editHistory, projectID, projectReady, replaceEditHistory, syncRetry, user]);

  useEffect(() => {
    if (!projectReady || !projectID) return;
    const sequence = ++projectSaveSequenceRef.current;
    setSaveStatus(user ? (assets.some((asset) => !asset.cloudURL) ? 'Uploading assets…' : 'Saving to cloud…') : 'Saving locally…');
    const timer = window.setTimeout(() => {
      const document = projectDocument(assets, selectedID, editHistory);
      const retainedAssets = [
        ...assets,
        ...editHistory.undo.flatMap((state) => state.assets),
        ...editHistory.redo.flatMap((state) => state.assets),
      ];
      const files = new Map(retainedAssets.map((asset) => [asset.mediaID, asset.file]));
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
  }, [assets, editHistory, projectID, projectName, projectReady, selectedID, syncRetry, user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mediaURL = (params.get('video_url') || params.get('image_url') || params.get('audio_url'))?.trim();
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
    const isAudio = !!params.get('audio_url');
    const mediaKind = isVideo ? 'video' : isAudio ? 'audio' : 'image';
    const name = params.get('name')?.trim() || (isVideo ? 'Gallery video' : isAudio ? 'Generated voice' : 'Gallery image');
    setNotice(`Loading ${mediaKind}…`);
    // Keep gallery handoffs same-origin. The CDN permits the apex domain today,
    // but Studio is also served from www.manifoldgen.com, which is a distinct
    // browser origin and otherwise makes its direct media fetch fail CORS.
    fetchWithRetry(isAudio ? mediaURL : galleryImportURL(mediaURL))
      .then(async (response) => {
        if (!response.ok) throw new Error(`Could not load the ${mediaKind}`);
        const blob = await response.blob();
        const extension = blob.type.split('/')[1]?.replace('jpeg', 'jpg').replace('mpeg', 'mp3') || (isVideo ? 'mp4' : isAudio ? 'mp3' : 'webp');
        return importFiles([new File([blob], `${name.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80)}.${extension}`, { type: blob.type || (isVideo ? 'video/mp4' : isAudio ? 'audio/mpeg' : 'image/webp') })]);
      })
      .then((imported) => {
        const first = imported?.[0];
        setNotice(`${mediaKind[0].toUpperCase() + mediaKind.slice(1)} added to the studio`);
        const projectID = mediaHandoffProjectIDRef.current;
        window.history.replaceState({}, '', projectID ? `/studio?project=${encodeURIComponent(projectID)}` : '/studio');
        if (isVideo && params.get('restyle') === '1' && first?.kind === 'video') openRestyle(first);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : `Could not load the ${mediaKind}`));
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
      if (video && video.readyState >= 2) {
        renderer.draw(video, selected.adjustments, video.currentTime * 24);
        perfDiagnostics().previewMediaTime = video.currentTime;
      }
    } else if (imageRef.current) {
      renderer.draw(imageRef.current, selected.adjustments, 0);
    }
  }, [selected]);

  useEffect(() => {
    const diagnostics = perfDiagnostics();
    diagnostics.redrawPreview = drawCurrent;
    return () => {
      if (diagnostics.redrawPreview === drawCurrent) delete diagnostics.redrawPreview;
    };
  }, [drawCurrent]);

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
    if (selected?.kind === 'video' && videoRef.current) {
      videoRef.current.muted = !!selected.sourceAudioMuted;
      videoRef.current.volume = Math.max(0, Math.min(1, selected.volume));
    }
    if (selected?.kind === 'audio' && audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, selected.volume));
    }
  }, [selected?.kind, selected?.sourceAudioMuted, selected?.volume]);

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
        const id = uid();
        next.push({
          id, mediaID: id, name: file.name, kind, file, url: URL.createObjectURL(file),
          ...metadata, trimStart: 0, trimEnd: metadata.duration,
          timelineStart, visualTrack: kind === 'audio' ? 0 : visualTrackPlacement, volume: 1, fadeIn: 0, fadeOut: 0,
          stageX: 0, stageY: 0, stageScale: 1, stageRotation: 0,
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
    if (next.length) rememberEdit();
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

  async function addGenerationToTimeline(job: GenerationJob) {
    const url = resultURL(job.result);
    if (!url) return;
    setError('');
    try {
      const response = await fetchWithRetry(url);
      if (!response.ok) throw new Error('Could not download this generated video');
      const blob = await response.blob();
      const extension = blob.type.includes('webm') ? 'webm' : 'mp4';
      await importFiles([new File([blob], `manifold-generation-${job.job_id.slice(-8)}.${extension}`, { type: blob.type || 'video/mp4' })]);
      setNotice('Generated video added to this project');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not add generated video');
    }
  }

  async function addRemoteMedia(url: string, name: string, kind: 'image' | 'video', attribution: string) {
    const response = await fetchWithRetry(url);
    if (!response.ok) throw new Error(`Could not download this ${kind}`);
    const blob = await response.blob();
    const fallback = kind === 'image' ? 'webp' : 'mp4';
    const extension = blob.type.split('/')[1]?.replace('jpeg', 'jpg').replace('quicktime', 'mov') || fallback;
    return addGeneratedFile(new File([blob], `${name.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 72) || kind}.${extension}`, { type: blob.type || `${kind}/${fallback}` }), kind, attribution);
  }

  async function addDiscoveredMedia(url: string, prompt: string, kind: 'image' | 'video') {
    if (!url) return;
    setBusy('import-discovery');
    setError('');
    try {
      await addRemoteMedia(url, prompt || `Community ${kind}`, kind, `Community ${kind} · ${prompt}`);
      setNotice(`Community ${kind} added to the timeline`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Could not add ${kind}`);
    } finally {
      setBusy('');
    }
  }

  async function searchStudioMedia(mode: Exclude<MediaBrowserMode, 'project'>, query = mediaSearch) {
    setMediaSearchBusy(true);
    setError('');
    try {
      const q = query.trim();
      if (mode === 'videos') {
        const endpoint = q ? `/api/search?q=${encodeURIComponent(q)}&top_k=24` : '/api/videos/featured?limit=24';
        const response = await fetch(endpoint);
        const data = await parseJSONResponse<{ results?: StudioVideoHit[] }>(response, 'Could not search videos');
        setVideoHits((data.results || []).filter((item) => item.video_url));
      } else if (mode === 'images') {
        const endpoint = q ? `/api/images/semantic?q=${encodeURIComponent(q)}&top_k=24` : '/api/images?skip_total=true&varied=true&per_page=24&allow_nsfw=true';
        const response = await fetch(endpoint);
        const data = await parseJSONResponse<{ results?: StudioImageHit[]; images?: StudioImageHit[] }>(response, 'Could not search images');
        setImageHits(data.results || data.images || []);
      } else {
        const params = new URLSearchParams({ q, kind: 'music', limit: '24' });
        const response = await fetch(`/api/studio/audio-search?${params}`);
        const data = await parseJSONResponse<{ results?: AudioCatalogAsset[] }>(response, 'Could not search music');
        setAudioResults(data.results || []);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Could not search ${mode}`);
    } finally {
      setMediaSearchBusy(false);
    }
  }

  async function generateStudioImages() {
    if (!user) { setError('Sign in to generate images'); return; }
    const prompt = imagePrompt.trim();
    if (!prompt) return;
    const activityID = startBackgroundActivity(`Creating ${imageCount} image${imageCount === 1 ? '' : 's'}`);
    setError('');
    setNotice('Images started');
    setMediaBrowserMode('images');
    setMediaSearch(prompt);
    const discovery = searchStudioMedia('images', prompt);
    try {
      const [width, height] = h3Dimensions(imageAspect, 'balanced');
      const response = await fetch('/api/service', {
        method: 'POST', headers: authHeaders(user.api_key),
        body: JSON.stringify({ service: 'zimage', prompt, width, height, n: imageCount, num_images: imageCount, image_backend: imageEngine }),
      });
      const data = await parseJSONResponse<unknown>(response, 'Image generation failed');
      const generated = generatedImageItems(data).slice(0, imageCount);
      if (!generated.length) throw new Error('Image generation returned no images');
      const imported: StudioAsset[] = [];
      for (const [index, item] of generated.entries()) {
        if (item.base64) {
          const file = base64File(item.base64.replace(/^data:[^,]+,/, ''), 'image/webp', `generated-${index + 1}.webp`);
          imported.push(await addGeneratedFile(file, 'image', `${imageEngine === 'images3' ? 'RA1 · Images3' : 'Z-Image · OmniServe Native'} · ${prompt}`));
        } else if (item.url) {
          imported.push(await addRemoteMedia(item.url, `generated-${index + 1}`, 'image', `${imageEngine === 'images3' ? 'RA1 · Images3' : 'Z-Image · OmniServe Native'} · ${prompt}`));
        }
      }
      if (!imported.length) throw new Error('Generated images could not be imported');
      const refreshed = await refreshUser(user.api_key).catch(() => null);
      if (refreshed) { setUser(refreshed); saveUser(refreshed); }
      setNotice(`${imported.length} image${imported.length === 1 ? '' : 's'} added`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Image generation failed');
    } finally {
      await discovery;
      finishBackgroundActivity(activityID);
    }
  }

  async function deleteGeneration(jobID: string) {
    if (!user?.api_key) return;
    try {
      const response = await fetch(`/api/video-jobs/${encodeURIComponent(jobID)}`, { method: 'DELETE', headers: authHeaders(user.api_key, false) });
      await parseJSONResponse(response, 'Could not delete generation');
      setGenerationJobs((current) => current.filter((job) => job.job_id !== jobID));
      setNotice('Generation removed from your media library');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not delete generation');
    }
  }

  async function retryGeneration(jobID: string) {
    if (!user?.api_key) return;
    setError('');
    try {
      const response = await fetch(`/api/video-jobs/${encodeURIComponent(jobID)}/retry`, {
        method: 'POST',
        headers: authHeaders(user.api_key, false),
      });
      const data = await parseJSONResponse<{ job?: GenerationJob }>(response, 'Could not retry generation');
      setGenerationJobs((current) => current.map((job) => (
        job.job_id === jobID ? (data.job || { ...job, status: 'queued', error: '', updated_at: new Date().toISOString() }) : job
      )));
      setNotice('Generation queued for retry');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not retry generation');
    }
  }

  async function copyGenerationPrompt(job: GenerationJob) {
    if (!job.prompt?.trim()) return;
    setGenerationContextMenu(null);
    try {
      try {
        await navigator.clipboard.writeText(job.prompt);
      } catch {
        const input = document.createElement('textarea');
        input.value = job.prompt;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        const copied = document.execCommand('copy');
        input.remove();
        if (!copied) throw new Error('Clipboard unavailable');
      }
      setNotice('Generation prompt copied');
    } catch {
      setError('Could not copy the prompt');
    }
  }

  function generateSimilar(job: GenerationJob) {
    if (!job.prompt?.trim()) return;
    setVideoGeneratePrompt(job.prompt);
    setVideoGenerateQueueStatus('');
    setVideoGenerateOpen(true);
    setGenerationContextMenu(null);
  }

  function openStudioContextMenu(event: ReactMouseEvent<HTMLElement>, asset?: StudioAsset) {
    event.preventDefault();
    event.stopPropagation();
    if (asset) {
      selectOnly(asset.id);
      setPlayhead(asset.timelineStart);
    }
    setGenerationContextMenu(null);
    setContextMenu({ assetID: asset?.id, x: event.clientX, y: event.clientY });
  }

  function openPromptContextMenu(event: ReactMouseEvent<HTMLElement>, promptKind: 'image' | 'video' | 'music' | 'sfx' | 'speech', prompt: string) {
    event.preventDefault();
    event.stopPropagation();
    setGenerationContextMenu(null);
    setContextMenu({ prompt, promptKind, x: event.clientX, y: event.clientY });
  }

  function openPromptGenerator(promptKind: 'image' | 'video' | 'music' | 'sfx' | 'speech', prompt: string) {
    if (promptKind === 'image') {
      setImagePrompt(prompt);
      setImageGenerateOpen(true);
    } else if (promptKind === 'video') {
      setVideoGeneratePrompt(prompt);
      setVideoGenerateQueueStatus('');
      setVideoGenerateOpen(true);
    } else {
      setAudioMode(promptKind);
      setAudioDuration(promptKind === 'music' ? 30 : 10);
      if (promptKind === 'speech') setSpeechText(prompt);
      else setAudioPrompt(prompt);
      setAudioGenerateOpen(true);
    }
    setContextMenu(null);
  }

  function promptForAsset(asset: StudioAsset) {
    if (asset.text?.content.trim()) return asset.text.content.trim();
    const attributionPrompt = asset.attribution?.split(' · ').at(-1)?.trim();
    if (attributionPrompt && !/^(editable text|generated music|generated voice|video restyle)$/i.test(attributionPrompt)) return attributionPrompt;
    return asset.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
  }

  function openSimilarAsset(asset: StudioAsset) {
    const prompt = promptForAsset(asset);
    if (asset.kind === 'video') {
      setVideoGeneratePrompt(prompt);
      setVideoGenerateQueueStatus('');
      setVideoGenerateOpen(true);
    } else if (asset.kind === 'image') {
      setImagePrompt(prompt);
      setImageGenerateOpen(true);
    } else {
      const attribution = asset.attribution?.toLowerCase() || '';
      const mode = attribution.includes('music') ? 'music' : attribution.includes('voice') || attribution.includes('speech') ? 'speech' : 'sfx';
      setAudioMode(mode);
      if (mode === 'speech') setSpeechText(prompt);
      else setAudioPrompt(prompt);
      setAudioGenerateOpen(true);
    }
    setContextMenu(null);
  }

  function openAudioGenerator(mode: 'music' | 'sfx' | 'speech') {
    setAudioMode(mode);
    setAudioDuration(mode === 'music' ? 30 : 10);
    setAudioGenerateOpen(true);
    setContextMenu(null);
  }

  async function addGeneratedFile(file: File, kind: MediaKind, attribution?: string, text?: StudioTextStyle, timelinePlacement?: number) {
    const metadata = await readDimensions(file, kind);
    const visualEnd = assets.filter((item) => item.kind !== 'audio').reduce((end, item) => Math.max(end, clipEnd(item)), 0);
    const id = uid();
    const asset: StudioAsset = {
      id, mediaID: id, name: file.name, kind, file, url: URL.createObjectURL(file), ...metadata,
      trimStart: 0, trimEnd: metadata.duration, timelineStart: kind === 'audio' ? (timelinePlacement ?? playhead) : visualEnd, volume: 1, fadeIn: 0, fadeOut: 0,
      visualTrack: 0,
      stageX: 0, stageY: 0, stageScale: 1, stageRotation: 0,
      attribution, text, adjustments: { ...DEFAULT_ADJUSTMENTS },
    };
    rememberEdit();
    setAssets((current) => [...current, asset]);
    selectOnly(asset.id);
    setPlayhead(asset.timelineStart);
    return asset;
  }

  async function addText(style: StudioTextStyle) {
    setError('');
    try {
      const file = await renderTextFile(style);
      await addGeneratedFile(file, 'image', 'Editable text', { ...style });
      setNotice('Text added to the timeline');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not add text');
    }
  }

  async function updateSelectedText() {
    if (!selected?.text || !textDraft.content.trim()) return;
    setError('');
    try {
      const file = await renderTextFile(textDraft);
      rememberEdit();
      const url = URL.createObjectURL(file);
      setAssets((current) => current.map((asset) => asset.id === selected.id ? {
        ...asset, mediaID: uid(), name: file.name, file, url, width: 1920, height: 1080, text: { ...textDraft }, cloudURL: undefined, objectKey: undefined,
      } : asset));
      setNotice('Text updated');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update text');
    }
  }

  function removeSelected() {
    if (!selectedIDs.length) return;
    const remaining = assets.filter((item) => !selectedIDs.includes(item.id));
    // Keep the files and object URLs alive in the history snapshot so Ctrl/Cmd
    // + Z can restore a deleted clip, including after the project syncs.
    rememberEdit();
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
    rememberEdit();
    setAssets((items) => stackOverlappingVisuals([...items, ...copies]));
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
    rememberEdit();
    setAssets((current) => moveVisualLayersWithSwap(current, selectedSet, delta));
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
    rememberEdit();
    setAssets((current) => stackOverlappingVisuals([...current, ...pasted]));
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
    rememberEdit();
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
    const nextTarget = event.relatedTarget;
    if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) setTimelineDropTime(null);
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
    const catalogAudio = catalogAudioFromTransfer(event.dataTransfer);
    if (catalogAudio) {
      await importCatalogAudio(catalogAudio, dropTime);
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
      const response = await fetchWithRetry(uri);
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
      historySnapshot: snapshotEditor(),
    };
    setActiveTimelineClip(asset.id);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function beginScrub(event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0) return;
    if (event.shiftKey) {
      const rect = timelineCanvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      event.preventDefault();
      timelineDragRef.current = {
        mode: 'marquee', pointerID: event.pointerId,
        startX: event.clientX, startY: event.clientY,
        pixelsPerSecond, trackHeight: 1, didMove: false, trackDelta: 0,
        originals: new Map(), baseSelection: [...selectedIDs], marqueeIDs: [...selectedIDs],
      };
      setTimelineMarquee({
        left: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
        top: Math.max(0, Math.min(rect.height, event.clientY - rect.top)),
        width: 0, height: 0,
      });
      event.currentTarget.setPointerCapture?.(event.pointerId);
      return;
    }
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
    if (drag.mode === 'marquee') {
      const canvas = timelineCanvasRef.current;
      const rect = canvas?.getBoundingClientRect();
      if (!canvas || !rect) return;
      const startX = Math.max(0, Math.min(rect.width, drag.startX - rect.left));
      const startY = Math.max(0, Math.min(rect.height, drag.startY - rect.top));
      const currentX = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
      const currentY = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
      const selection = { left: Math.min(startX, currentX), top: Math.min(startY, currentY), width: Math.abs(currentX - startX), height: Math.abs(currentY - startY) };
      setTimelineMarquee(selection);
      drag.didMove = selection.width > 2 || selection.height > 2;
      const selectionRight = rect.left + selection.left + selection.width;
      const selectionBottom = rect.top + selection.top + selection.height;
      const selectionLeft = rect.left + selection.left;
      const selectionTop = rect.top + selection.top;
      const hitIDs = [...canvas.querySelectorAll<HTMLElement>('[data-timeline-asset]')].filter((element) => {
        const clip = element.getBoundingClientRect();
        return clip.right >= selectionLeft && clip.left <= selectionRight && clip.bottom >= selectionTop && clip.top <= selectionBottom;
      }).map((element) => element.dataset.timelineAsset || '').filter(Boolean);
      const next = [...new Set([...(drag.baseSelection || []), ...hitIDs])];
      drag.marqueeIDs = next;
      setSelectedIDs(next);
      setSelectedID(hitIDs.at(-1) || next.at(-1) || '');
      return;
    }
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
    if (drag.didMove && drag.historySnapshot && ['move', 'trim-left', 'trim-right'].includes(drag.mode)) {
      rememberSnapshot(drag.historySnapshot);
    }
    if (drag.toggleOnClick && !drag.didMove && drag.targetID) selectClip(drag.targetID, true);
    if (drag.mode === 'move' && drag.didMove && drag.trackDelta) {
      setNotice(`Moved ${drag.originals.size === 1 ? 'clip' : `${drag.originals.size} clips`} ${Math.abs(drag.trackDelta)} layer${Math.abs(drag.trackDelta) === 1 ? '' : 's'} ${drag.trackDelta > 0 ? 'up' : 'down'}`);
    }
    if (drag.mode === 'move' && drag.didMove) {
      const movedIDs = new Set(drag.originals.keys());
      setAssets((current) => drag.trackDelta
        ? moveVisualLayersWithSwap(current.map((asset) => {
          const original = drag.originals.get(asset.id);
          return original && asset.kind !== 'audio' ? { ...asset, visualTrack: original.visualTrack } : asset;
        }), movedIDs, drag.trackDelta)
        : stackOverlappingVisuals(current));
    }
    if (drag.mode === 'marquee') {
      const count = drag.marqueeIDs?.length || 0;
      if (drag.didMove && count > 1) setNotice(`${count} timeline items selected`);
      setTimelineMarquee(null);
    }
    setActiveTimelineClip(null);
    timelineDragRef.current = null;
  }

  function beginStageDrag(event: ReactPointerEvent<HTMLElement>, asset: StudioAsset) {
    if (asset.kind === 'audio' || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    stageDragRef.current = {
      mode: 'move',
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
      originScale: asset.stageScale,
      originRotation: asset.stageRotation,
      currentScale: asset.stageScale,
      currentRotation: asset.stageRotation,
      centerX: rect.left + rect.width * (0.5 + asset.stageX),
      centerY: rect.top + rect.height * (0.5 + asset.stageY),
      startDistance: 1,
      startAngle: 0,
    };
    selectOnly(asset.id);
    setStageDragPosition({ assetID: asset.id, x: asset.stageX, y: asset.stageY, scale: asset.stageScale, rotation: asset.stageRotation });
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function beginStageTransform(event: ReactPointerEvent<HTMLElement>, asset: StudioAsset, mode: 'scale' | 'rotate') {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.left + rect.width * (0.5 + asset.stageX);
    const centerY = rect.top + rect.height * (0.5 + asset.stageY);
    const startAngle = Math.atan2(event.clientY - centerY, event.clientX - centerX);
    stageDragRef.current = {
      mode, assetID: asset.id, pointerID: event.pointerId,
      startX: event.clientX, startY: event.clientY,
      originX: asset.stageX, originY: asset.stageY,
      currentX: asset.stageX, currentY: asset.stageY,
      stageWidth: rect.width, stageHeight: rect.height,
      originScale: asset.stageScale, originRotation: asset.stageRotation,
      currentScale: asset.stageScale, currentRotation: asset.stageRotation,
      centerX, centerY,
      startDistance: Math.max(1, Math.hypot(event.clientX - centerX, event.clientY - centerY)),
      startAngle,
    };
    selectOnly(asset.id);
    setStageDragPosition({ assetID: asset.id, x: asset.stageX, y: asset.stageY, scale: asset.stageScale, rotation: asset.stageRotation });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function moveStagePointer(event: ReactPointerEvent<HTMLElement>) {
    const drag = stageDragRef.current;
    if (!drag || drag.pointerID !== event.pointerId) return;
    if (drag.mode === 'scale') {
      const distance = Math.hypot(event.clientX - drag.centerX, event.clientY - drag.centerY);
      drag.currentScale = Math.max(0.1, Math.min(4, drag.originScale * distance / drag.startDistance));
      setStageDragPosition({ assetID: drag.assetID, x: drag.currentX, y: drag.currentY, scale: drag.currentScale, rotation: drag.currentRotation });
      return;
    }
    if (drag.mode === 'rotate') {
      const angle = Math.atan2(event.clientY - drag.centerY, event.clientX - drag.centerX);
      let rotation = drag.originRotation + (angle - drag.startAngle) * 180 / Math.PI;
      if (event.shiftKey) rotation = Math.round(rotation / 15) * 15;
      drag.currentRotation = ((rotation + 180) % 360 + 360) % 360 - 180;
      setStageDragPosition({ assetID: drag.assetID, x: drag.currentX, y: drag.currentY, scale: drag.currentScale, rotation: drag.currentRotation });
      return;
    }
    let x = Math.max(-0.48, Math.min(0.48, drag.originX + (event.clientX - drag.startX) / drag.stageWidth));
    let y = Math.max(-0.48, Math.min(0.48, drag.originY + (event.clientY - drag.startY) / drag.stageHeight));
    const vertical = Math.abs(x) * drag.stageWidth <= 6;
    const horizontal = Math.abs(y) * drag.stageHeight <= 6;
    if (vertical) x = 0;
    if (horizontal) y = 0;
    drag.currentX = x;
    drag.currentY = y;
    setStageGuides({ horizontal, vertical });
    setStageDragPosition({ assetID: drag.assetID, x, y, scale: drag.currentScale, rotation: drag.currentRotation });
  }

  function endStagePointer(event: ReactPointerEvent<HTMLElement>) {
    const drag = stageDragRef.current;
    if (!drag || drag.pointerID !== event.pointerId) return;
    updateAsset(drag.assetID, {
      stageX: drag.currentX, stageY: drag.currentY,
      stageScale: drag.currentScale, stageRotation: drag.currentRotation,
    });
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
      if (helpOpen) {
        if (event.key === 'Escape' || (event.key === '?' && !isTextEntry)) {
          event.preventDefault();
          setHelpOpen(false);
        }
        return;
      }
      if (event.key === '?' && !isTextEntry && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        setHelpOpen(true);
        return;
      }
      if (event.code === 'Space') {
        if (isTextEntry || event.repeat) return;
        event.preventDefault();
        togglePlayback();
        return;
      }
      if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName || '')) return;
      const commandKey = event.metaKey || event.ctrlKey;
      if (commandKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
      } else if (commandKey && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
      } else if (commandKey && event.key.toLowerCase() === 'c' && selectedAssets.length) {
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
      } else if (event.key.toLowerCase() === 't' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        setTool('text');
        setMobilePanelOpen(true);
        void addText({ content: 'Add body text', fontSize: 48, fontFamily: 'Inter', fontWeight: 400, color: '#ffffff', align: 'left' });
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
    const presign = await fetchWithRetry(`/api/uploads/presign?${query}`, { headers: authHeaders(user.api_key, false) });
    const data = await parseJSONResponse<{ upload_url: string; public_url: string }>(presign, 'Could not prepare upload');
    const put = await fetchWithRetry(data.upload_url, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
    if (!put.ok) throw new Error('Asset upload failed');
    return data.public_url;
  }

  async function startStudioVideoGeneration(prompt: string, selectedImageURL = '') {
    if (!user) throw new Error('Sign in to generate videos');
    let firstFrame = selectedImageURL;
    if (videoGenerateLoop) {
      const [width, height] = h3Dimensions(videoGenerateAspect, videoGenerateSize);
      const imageResponse = await fetch('/api/service', {
        method: 'POST',
        headers: authHeaders(user.api_key),
        body: JSON.stringify({ service: 'zimage', prompt, width, height, n: 1 }),
      });
      const imageData = await parseJSONResponse<Parameters<typeof loopAnchorURL>[0]>(imageResponse, 'Loop keyframe generation failed');
      firstFrame = loopAnchorURL(imageData, window.location.origin);
    }
    const response = await fetch('/api/service', {
      method: 'POST',
      headers: authHeaders(user.api_key),
      body: JSON.stringify({
        service: 'h3_video',
        prompt,
        aspect_ratio: videoGenerateAspect,
        size: videoGenerateSize,
        duration: videoGenerateDuration,
        num_steps: videoGenerateSteps,
        output_format: videoGenerateFormat,
        include_audio: videoGenerateAudio,
        loop: videoGenerateLoop,
        structured_prompt: true,
        ...(firstFrame ? { first_frame: firstFrame } : {}),
      }),
    });
    const data = await parseJSONResponse<unknown>(response, 'Could not queue video generation');
    const jobID = resultJobID(data);
    if (!jobID) throw new Error('Video generation returned no job');
    return jobID;
  }

  async function queueVideoGenerations() {
    if (!user) {
      setVideoGenerateQueueStatus('Sign in to queue videos.');
      return;
    }
    if (!videoGeneratePrompts.length) {
      setVideoGenerateQueueStatus('Add a prompt.');
      return;
    }
    setMediaBrowserMode('videos');
    setMediaSearch(videoGeneratePrompts[0]);
    void searchStudioMedia('videos', videoGeneratePrompts[0]);
    const activityID = startBackgroundActivity(`Queueing ${videoGeneratePrompts.length} video${videoGeneratePrompts.length === 1 ? '' : 's'}`);
    setError('');
    setVideoGenerateQueueStatus(`Queueing ${videoGeneratePrompts.length}…`);
    try {
      let selectedImageURL = '';
      if (videoGenerateUseSelected) {
        if (selected?.kind !== 'image') throw new Error('Select an image in the timeline or turn off “Use selected image”.');
        selectedImageURL = selected.cloudURL || await uploadPublic(selected.file);
      }
      const submissions = await Promise.allSettled(videoGeneratePrompts.map(async (prompt) => ({
        prompt,
        jobID: await startStudioVideoGeneration(prompt, selectedImageURL),
      })));
      const queued = submissions
        .filter((submission): submission is PromiseFulfilledResult<{ prompt: string; jobID: string }> => submission.status === 'fulfilled')
        .map((submission) => submission.value);
      if (!queued.length) {
        const failed = submissions.find((submission): submission is PromiseRejectedResult => submission.status === 'rejected');
        throw failed?.reason instanceof Error ? failed.reason : new Error('Could not queue any video creations');
      }
      const now = new Date().toISOString();
      setGenerationJobs((current) => [
        ...queued.map(({ jobID, prompt }) => ({ job_id: jobID, status: 'queued', prompt, created_at: now })),
        ...current.filter((job) => !queued.some(({ jobID }) => jobID === job.job_id)),
      ]);
      const failedCount = submissions.length - queued.length;
      setVideoGenerateQueueStatus(`${queued.length} queued${failedCount ? ` · ${failedCount} failed` : ''}. Keep creating.`);
    } catch (reason) {
      setVideoGenerateQueueStatus(reason instanceof Error ? reason.message : 'Could not queue video creation');
    } finally {
      finishBackgroundActivity(activityID);
    }
  }

  function openRestyle(asset: StudioAsset) {
    if (asset.kind !== 'video') return;
    selectOnly(asset.id);
    setPlayhead(asset.timelineStart);
    setRestyleSourceID(asset.id);
    setRestyleOpen(true);
    setContextMenu(null);
  }

  function openAnimationTransfer(asset: StudioAsset) {
    if (asset.kind !== 'video') return;
    selectOnly(asset.id);
    setPlayhead(asset.timelineStart);
    setRestyleSourceID(asset.id);
    setRestyleModel('wan-animate-2');
    setRestyleResolution('preview');
    setRestyleDuration(Math.max(1, Math.min(15, Math.round(asset.trimEnd - asset.trimStart) || 5)));
    setRestyleFPS(24);
    setRestyleFrames(37);
    setRestylePrompt('A full-body character matching the reference image, natural face, detailed clothing, cinematic lighting, clean background');
    setRestyleReferences((current) => current.filter((item) => item.kind === 'image').slice(0, 1));
    setRestyleOpen(true);
    setContextMenu(null);
  }

  function setAnimationReference(files: FileList | File[]) {
    const file = Array.from(files).find((candidate) => candidate.type.startsWith('image/'));
    if (!file) return;
    setRestyleReferences([{ id: uid(), name: file.name, kind: 'image', file, url: URL.createObjectURL(file) }]);
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
    const activityID = startBackgroundActivity('Preparing restyle');
    setError(''); setNotice('Restyle started');
    try {
      const videoURL = source.cloudURL || await uploadPublic(source.file);
      const uploadedReferences = await Promise.all(restyleReferences.map(async (reference) => ({
        ...reference,
        publicURL: reference.cloudURL || await uploadPublic(reference.file),
      })));
      updateBackgroundActivity(activityID, 'Restyling video');
      const response = await fetch('/api/service', {
        method: 'POST', headers: authHeaders(user.api_key),
        body: JSON.stringify({
          service: 'video_restyle', model: restyleModel, video_url: videoURL,
          ...(restyleModel === 'wan-animate-2' ? { image_url: uploadedReferences.find((item) => item.kind === 'image')?.publicURL } : {}),
          prompt: restylePrompt, negative_prompt: restyleNegativePrompt,
          strength: restyleStrength, num_frames: restyleFrames, frames_per_second: restyleFPS,
          resolution: restyleResolution, aspect_ratio: restyleAspect,
          duration: restyleDuration, seed: restyleSeed,
          ...(restyleModel === 'wan-animate-2' ? { num_steps: 10, include_audio: true } : {}),
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
          updateBackgroundActivity(activityID, 'Adding restyled video');
          const result = await fetch(outputURL);
          if (!result.ok) throw new Error('Could not download transformed video');
          const blob = await result.blob();
          const extension = blob.type.includes('webm') || outputURL.includes('.webm') ? 'webm' : 'mp4';
          const animationTransfer = restyleModel === 'wan-animate-2';
          await addGeneratedFile(new File([blob], `${source.name.replace(/\.[^.]+$/, '')}-${animationTransfer ? 'animated' : 'restyled'}.${extension}`, { type: blob.type || `video/${extension}` }), 'video', animationTransfer ? 'Animation transfer' : 'Video restyle');
          const refreshed = await refreshUser(user.api_key).catch(() => null);
          if (refreshed) { setUser(refreshed); saveUser(refreshed); }
          setNotice(animationTransfer ? 'Animation Transfer added to the timeline' : 'Restyled video added to the timeline');
          return;
        }
        setNotice(status === 'processing' ? 'Transforming video…' : 'Video transformation queued…');
      }
      throw new Error('Video transformation is still running and remains available in your account.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Video transformation failed');
    } finally {
      finishBackgroundActivity(activityID);
    }
  }

  async function removeBackground() {
    if (!selected || selected.kind !== 'image') return;
    const activityID = startBackgroundActivity('Removing background');
    setError(''); setNotice('Background removal started');
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
      const id = uid();
      const cutout: StudioAsset = { ...selected, id, mediaID: id, name: file.name, file, url: URL.createObjectURL(file), ...metadata, trimStart: 0, trimEnd: 5 };
      rememberEdit();
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
      finishBackgroundActivity(activityID);
    }
  }

  async function extendVideo() {
    if (!selected || selected.kind !== 'video') return;
    const activityID = startBackgroundActivity('Preparing extension');
    setError(''); setNotice('Extension started');
    try {
      const sourceBlob = await renderTimelineVideo({
        format: 'mp4-h264', resolution: '720p', frameRate: 'source', quality: 'balanced',
      }, selected);
      const sourceFile = new File([sourceBlob], `${selected.name.replace(/\.[^.]+$/, '')}-grok-source.mp4`, { type: 'video/mp4' });
      updateBackgroundActivity(activityID, 'Uploading extension');
      const videoURL = await uploadPublic(sourceFile);
      updateBackgroundActivity(activityID, 'Extending video');
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
      finishBackgroundActivity(activityID);
    }
  }

  async function upscaleVideo() {
    if (!selected || selected.kind !== 'video' || !canUpscaleSelected) return;
    const sourceName = selected.name.replace(/\.[^.]+$/, '');
    const activityID = startBackgroundActivity(`Upscaling ${upscaleScale}×`);
    setError(''); setNotice('Upscale started');
    try {
      const videoURL = await uploadPublic(selected.file);
      updateBackgroundActivity(activityID, `Upscaling ${upscaleScale}×`);
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
          updateBackgroundActivity(activityID, 'Adding upscaled video');
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
      finishBackgroundActivity(activityID);
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

  function startCatalogAudioDrag(event: ReactDragEvent<HTMLElement>, asset: AudioCatalogAsset) {
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData(CATALOG_AUDIO_DRAG_TYPE, JSON.stringify(asset));
    event.dataTransfer.setData('text/uri-list', asset.url);
    event.dataTransfer.setData('text/plain', asset.title);
  }

  async function importCatalogAudio(asset: AudioCatalogAsset, timelinePlacement = playhead) {
    setBusy(`catalog-${asset.id}`); setError(''); setNotice(`Importing ${asset.title}…`);
    try {
      const response = await fetch(asset.url);
      if (!response.ok) throw new Error('Could not download this catalog track');
      const blob = await response.blob();
      const extension = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('wav') ? 'wav' : blob.type.includes('mpeg') ? 'mp3' : blob.type.includes('webm') ? 'webm' : 'opus';
      await addGeneratedFile(new File([blob], `${asset.title}.${extension}`, { type: blob.type || 'audio/ogg' }), 'audio', asset.attribution || asset.provider, undefined, timelinePlacement);
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
      const response = await fetch(`/api/audio-jobs/${jobID}`, { headers: authHeaders(user?.api_key || '', false) });
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
    const activityID = startBackgroundActivity(audioMode === 'speech' ? 'Creating voice' : audioMode === 'music' ? 'Creating music' : 'Creating sound');
    setError('');
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
        const voice = SPEECH_VOICES.find((item) => item.id === speechVoice);
        await addGeneratedFile(base64File(data.result.audio_base64, data.result.content_type || 'audio/wav', `voice-${speechVoice.toLowerCase()}-${Date.now()}.${format}`), 'audio', voice ? `${voice.name} voice` : 'Generated voice');
        if (typeof data.credits_remain === 'number') {
          const next = { ...user, credits: data.credits_remain }; setUser(next); saveUser(next);
        }
        setNotice(`Speech added · ${speechCredits.toFixed(2)} credits`);
      } else {
		if (audioMode === 'music') {
		  setNotice('Generating music…');
		  const response = await fetch('/api/studio/generate-music', {
			method: 'POST', headers: authHeaders(user.api_key), body: JSON.stringify({ prompt: audioPrompt.trim(), duration: audioDuration }),
		  });
		  const data = await parseJSONResponse<{ audio_url?: string; credits_used?: number; credits_remain?: number }>(response, 'Music generation failed');
		  if (!data.audio_url) throw new Error('Music generation returned no audio');
		  const media = await fetch(data.audio_url);
		  if (!media.ok) throw new Error('Could not download generated music');
		  const blob = await media.blob();
		  await addGeneratedFile(new File([blob], `music-${Date.now()}.wav`, { type: blob.type || 'audio/wav' }), 'audio', 'Generated music');
		  if (typeof data.credits_remain === 'number') { const next = { ...user, credits: data.credits_remain }; setUser(next); saveUser(next); }
		  setNotice(data.credits_used === 0 ? 'Music added · unlimited' : `Music added · ${data.credits_used ?? 80} credits`);
		} else {
		  setNotice('Starting sound generation…');
		  const prompt = audioPrompt.trim();
        const response = await fetch('/api/service', {
          method: 'POST', headers: authHeaders(user.api_key),
          body: JSON.stringify({ service: 'sfx', prompt, duration: audioDuration, output_format: 'webm-av1' }),
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
      finishBackgroundActivity(activityID);
    }
  }

  async function separateSelectedAudio() {
    if (!selected || selected.kind !== 'video' || selected.sourceAudioMuted) return;
    setBusy('separate-audio'); setError(''); setNotice('Separating audio…');
    try {
      const file = await extractAudioClip(selected);
      const duration = clipDuration(selected);
      const id = uid();
      const audioAsset: StudioAsset = {
        id, mediaID: id, name: file.name, kind: 'audio', file, url: URL.createObjectURL(file),
        duration, width: 1, height: 1, trimStart: 0, trimEnd: duration,
        timelineStart: selected.timelineStart, visualTrack: 0,
        volume: selected.volume, fadeIn: selected.fadeIn, fadeOut: selected.fadeOut,
        stageX: 0, stageY: 0, stageScale: 1, stageRotation: 0,
        attribution: `Separated from ${selected.name}`,
        adjustments: { ...DEFAULT_ADJUSTMENTS },
      };
      rememberEdit();
      setAssets((current) => [
        ...current.map((asset) => asset.id === selected.id ? { ...asset, sourceAudioMuted: true } : asset),
        audioAsset,
      ]);
      selectOnly(audioAsset.id);
      setPlayhead(audioAsset.timelineStart);
      setTool('audio');
      setNotice('Audio separated into an independent track');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not separate this video audio');
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

  function downloadBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = name; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function renderTimelineVideo(settings: ExportSettings, singleAsset?: StudioAsset) {
    const visualAssets = singleAsset ? [{ ...singleAsset, timelineStart: 0 }] : timelineVisuals;
    const exportBase = singleAsset || compositionBase;
    const exportDuration = singleAsset ? clipDuration(singleAsset) : timelineDuration;
    const exportAssets = singleAsset ? visualAssets : assets;
    if (!exportBase || !visualAssets.length) throw new Error('Add an image or video to the timeline first');
    setExportProgress(0.01);
    let output: Output | null = null;
    type ExportVisualState = {
      asset: StudioAsset;
      rasterCanvas: HTMLCanvasElement;
      rasterContext: CanvasRenderingContext2D;
      renderer: StudioRenderer;
      image: HTMLImageElement | null;
      input: Input | null;
      iterator: AsyncIterator<VideoSample> | null;
      current: VideoSample | null;
      next: VideoSample | null;
    };
    const visualStates: ExportVisualState[] = [];
    try {
      const format = exportFormatDetails(settings.format);
      const codec = format.codec;
      const requestedSize = exportSize(exportBase.width, exportBase.height, settings.resolution);
      const qualityLevel = settings.quality === 'draft' ? 'medium' : settings.quality === 'high' ? 'very-high' : 'high';
      const requestedQuality = new Quality(qualityLevel);
      const hardwareSupported = await canEncodeVideo(codec, { ...requestedSize, quality: requestedQuality, hardwareAcceleration: 'prefer-hardware' });
      // Software WebCodecs at 2K can be slower than 0.1x realtime. Keep full
      // 2K/4K when a hardware encoder is exposed and use a 1080p safety path
      // otherwise, so export never wedges a laptop for minutes per second.
      const { width, height } = hardwareSupported || settings.resolution !== 'source'
        ? requestedSize
        : fitWithin(exportBase.width, exportBase.height, 1920, 1080);
      const quality = hardwareSupported ? requestedQuality : new Quality(settings.quality === 'high' ? 'high' : qualityLevel);
      const hardwareAcceleration = hardwareSupported
        ? 'prefer-hardware' as const
        : 'no-preference' as const;
      if (!(await canEncodeVideo(codec, { width, height, quality, hardwareAcceleration }))) {
        throw new Error(`${format.label} encoding is not available in this browser`);
      }
      perfDiagnostics().export = { sourceWidth: exportBase.width, sourceHeight: exportBase.height, width, height, hardwareAcceleration, hardwareRequested: 'prefer-hardware', startedAt: performance.now(), format: settings.format, frameRate: settings.frameRate, quality: settings.quality };
      const duration = exportDuration;

      const workCanvas = document.createElement('canvas');
      workCanvas.width = width;
      workCanvas.height = height;
      const compositor = workCanvas.getContext('2d', { alpha: false, desynchronized: true });
      if (!compositor) throw new Error('This browser cannot start the timeline compositor');

      for (const asset of visualAssets) {
        const filteredCanvas = document.createElement('canvas');
        // Export reads finished WebGL pixels into a 2D raster before handing
        // frames to WebCodecs, avoiding compositor timing issues.
        const renderer = new StudioRenderer(filteredCanvas, { preserveDrawingBuffer: true });
        renderer.resize(asset.width, asset.height);
        const rasterCanvas = document.createElement('canvas');
        rasterCanvas.width = filteredCanvas.width;
        rasterCanvas.height = filteredCanvas.height;
        const rasterContext = rasterCanvas.getContext('2d', { alpha: false });
        if (!rasterContext) throw new Error('This browser cannot prepare the export frame buffer');
        const state: ExportVisualState = { asset, rasterCanvas, rasterContext, renderer, image: null, input: null, iterator: null, current: null, next: null };
        if (asset.kind === 'image') {
          state.image = new Image();
          state.image.src = asset.url;
          await state.image.decode();
          renderer.draw(state.image, asset.adjustments, 0);
          renderer.copyToCanvas(rasterContext);
        } else {
          state.input = new Input({ source: new BlobSource(asset.file), formats: ALL_FORMATS });
          const track = await state.input.getPrimaryVideoTrack();
          if (!track || !(await track.canDecode())) throw new Error(`${asset.name} cannot be decoded in this browser`);
          const sink = new VideoSampleSink(track, { optimizeForLatency: true });
          state.iterator = sink.samples(asset.trimStart, asset.trimEnd)[Symbol.asyncIterator]();
          const first = await state.iterator.next();
          state.next = first.done ? null : first.value;
        }
        visualStates.push(state);
      }

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

      let audioSource: AudioSampleSource | null = null;
      const audioCodec = settings.format.startsWith('webm-') || !(await canEncodeAudio('aac')) ? 'opus' : 'aac';
      const mixedAudio = exportAssets.some((asset) => asset.kind !== 'image') ? await renderTimelineAudio(exportAssets, duration) : null;
      if (mixedAudio) {
        if (!(await canEncodeAudio(audioCodec))) throw new Error(`${audioCodec.toUpperCase()} audio encoding is not available in this browser`);
        audioSource = new AudioSampleSource({ codec: audioCodec, quality: new Quality('high') });
        output.addAudioTrack(audioSource);
      }

      await output.start();
      // A mixed timeline has no single source cadence. "Source" therefore uses
      // a deterministic 30 fps clock; explicit 24/30/60 choices stay exact.
      const outputFPS = settings.frameRate === 'source' ? 30 : settings.frameRate;
      const frameDuration = 1 / outputFPS;
      const frames = Math.max(1, Math.ceil(duration * outputFPS));
      const orderedStates = [...visualStates].sort((left, right) => left.asset.visualTrack - right.asset.visualTrack || visualAssets.indexOf(left.asset) - visualAssets.indexOf(right.asset));

      for (let index = 0; index < frames; index += 1) {
        const timestamp = index * frameDuration;
        compositor.setTransform(1, 0, 0, 1, 0, 0);
        compositor.fillStyle = '#000';
        compositor.fillRect(0, 0, width, height);
        for (const state of orderedStates) {
          const { asset } = state;
          if (timestamp < asset.timelineStart || timestamp >= clipEnd(asset)) continue;
          if (asset.kind === 'video') {
            const sourceTime = asset.trimStart + timestamp - asset.timelineStart;
            while (state.next && state.next.timestamp <= sourceTime + 1e-7) {
              state.current?.close();
              state.current = state.next;
              const following = await state.iterator!.next();
              state.next = following.done ? null : following.value;
            }
            const sample = state.current || state.next;
            if (!sample) continue;
            const frame = sample.toVideoFrame();
            state.renderer.draw(frame, asset.adjustments, index);
            state.renderer.copyToCanvas(state.rasterContext);
            frame.close();
          }
          const fit = Math.min(width / Math.max(1, asset.width), height / Math.max(1, asset.height));
          const drawWidth = asset.width * fit * asset.stageScale;
          const drawHeight = asset.height * fit * asset.stageScale;
          compositor.save();
          compositor.translate(width * (0.5 + asset.stageX), height * (0.5 + asset.stageY));
          compositor.rotate(asset.stageRotation * Math.PI / 180);
          compositor.drawImage(state.rasterCanvas, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
          compositor.restore();
        }
        await videoSource.add(timestamp, Math.min(frameDuration, duration - timestamp), { keyFrame: index % (outputFPS * 2) === 0 });
        setExportProgress(Math.min(0.9, (index + 1) / frames * 0.9));
      }

      if (audioSource && mixedAudio) {
        for (const sample of AudioSample.fromAudioBuffer(mixedAudio, 0)) {
          await audioSource.add(sample);
          sample.close();
        }
      }
      await output.finalize();
      const perf = perfDiagnostics();
      if (perf.export) {
        perf.export.completedAt = performance.now();
        perf.export.frames = frames;
      }
      setExportProgress(1);
      return new Blob([target.buffer!], { type: format.mime });
    } catch (reason) {
      await output?.cancel().catch(() => undefined);
      throw reason;
    } finally {
      for (const state of visualStates) {
        state.current?.close();
        state.next?.close();
        state.renderer.destroy();
        state.input?.dispose();
      }
    }
  }

  async function exportVideo() {
    if (!timelineVisuals.length) return;
    setBusy('export'); setError('');
    try {
      const blob = await renderTimelineVideo(exportSettings);
      const { extension } = exportFormatDetails(exportSettings.format);
      const safeName = projectName.replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 100) || 'manifold-project';
      downloadBlob(blob, `${safeName}-studio.${extension}`);
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
    { id: 'text', label: 'Text', icon: Type },
    { id: 'adjust', label: 'Adjust', icon: SlidersHorizontal },
    { id: 'crop', label: 'Transform', icon: Crop },
    { id: 'effects', label: 'Looks', icon: WandSparkles },
    { id: 'audio', label: 'Audio', icon: AudioLines },
    { id: 'ai', label: 'AI tools', icon: Sparkles },
  ];
  const foregroundActivityLabel = busy === 'export' ? 'Exporting timeline'
    : busy === 'export-audio' ? 'Exporting audio'
      : busy === 'separate-audio' ? 'Separating audio'
        : busy === 'extend' ? 'Extending video'
          : busy === 'upscale' ? 'Upscaling video'
            : busy === 'restyle' ? 'Restyling video'
              : busy ? 'Working' : '';
  const activeVideoGenerationCount = generationJobs.filter(isActiveGeneration).length;
  const runningActivityCount = backgroundActivities.length + activeVideoGenerationCount;
  const activityLabel = runningActivityCount > 1
    ? `${runningActivityCount} tasks running`
    : backgroundActivities[0]?.label || (activeVideoGenerationCount ? 'Generating video' : foregroundActivityLabel);
  const activityProgress = runningActivityCount === 1 && backgroundActivities.length === 1
    ? backgroundActivities[0].progress
    : busy === 'export' ? exportProgress : null;

  return (
    <main
      className={styles.studio}
      style={{ '--visual-track-count': visualTrackCount, '--visible-visual-track-count': visibleVisualTrackCount } as CSSProperties}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={(event) => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) clearMediaDragUI();
      }}
      onDrop={(event) => {
        event.preventDefault();
        clearMediaDragUI();
        const catalogAudio = catalogAudioFromTransfer(event.dataTransfer);
        if (catalogAudio) void importCatalogAudio(catalogAudio, playhead);
        else void importFiles(event.dataTransfer.files);
      }}
      onContextMenu={(event) => {
        if (event.defaultPrevented || (event.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]')) return;
        openStudioContextMenu(event);
      }}
    >
      <header className={styles.topbar}>
        <div className={styles.brandGroup}>
          <button type="button" className={styles.iconButton} aria-label="Menu" aria-expanded={menuOpen} aria-controls="studio-navigation" onClick={() => setMenuOpen((open) => !open)}><Menu size={17} /></button>
          <Link href="/" className={styles.brand} aria-label="Manifold home"><img className={styles.brandMark} src="/brand/logo-mark.webp" alt="" /><span>MANIFOLD</span></Link>
          <span className={styles.divider} />
          <div ref={projectPickerRef} className={styles.projectPicker}>
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
          <button className={styles.iconButton} aria-label="Undo" title="Undo (Ctrl/Cmd + Z)" onClick={undo} disabled={!editHistory.undo.length}><Undo2 size={16} /></button>
          <button className={styles.iconButton} aria-label="Redo" title="Redo (Ctrl/Cmd + Shift + Z)" onClick={redo} disabled={!editHistory.redo.length}><Redo2 size={16} /></button>
          <span data-testid="studio-save-status" className={styles.saved}>{saveStatus.startsWith('Uploading ') ? '' : saveStatus}</span>
          {activityLabel && <div className={styles.activityIndicator} data-testid="studio-background-activity"><ManifoldLoader compact label={activityLabel} progress={activityProgress} /></div>}
        </div>
        <div className={styles.accountActions}>
          <Link href="/account" className={styles.creditPill}><span className={styles.creditDot} /><span className={styles.creditFull}>{creditsLabel}</span><span className={styles.creditCompact}>{creditsLabel}</span></Link>
          <button type="button" className={styles.topupButton} onClick={() => openPaymentDialog({ message: 'Choose a plan or add funds.' })}><Plus size={14} /> Top up</button>
          <Link href="/account" className={styles.avatar} aria-label="Account"><UserRound size={16} /></Link>
          <button data-testid="studio-export" className={styles.exportButton} disabled={!assets.length || !!busy} onClick={() => timelineVisuals.length ? setExportOpen(true) : void exportAudio()}><Download size={15} /> Export</button>
        </div>
      </header>

      {activityLabel && <div className={styles.mobileActivity} data-testid="studio-mobile-background-activity"><ManifoldLoader compact label={activityLabel} progress={activityProgress} /></div>}

      {menuOpen && <div className={styles.menuBackdrop} onMouseDown={(event) => { if (event.currentTarget === event.target) setMenuOpen(false); }}>
        <aside id="studio-navigation" className={styles.menuDrawer} aria-label="Manifold navigation" onMouseDown={(event) => event.stopPropagation()}>
          <div className={styles.menuHeader}>
            <div><span className={styles.eyebrow}>MANIFOLDGEN</span><h2>Navigate</h2></div>
            <button type="button" className={styles.menuClose} aria-label="Close menu" onClick={() => setMenuOpen(false)}><X size={16} /></button>
          </div>
          <nav className={styles.menuNav}>
            <span className={styles.menuLabel}>WORKSPACE</span>
            <Link href="/studio" className={styles.menuLink} onClick={() => setMenuOpen(false)}><Clapperboard size={17} /><span><b>Studio</b><small>Edit, generate, and export</small></span></Link>
            <Link href="/voice" className={styles.menuLink} onClick={() => setMenuOpen(false)}><Mic2 size={17} /><span><b>Voice Studio</b><small>Generate speech and audio scenes</small></span></Link>
            <Link href="/" className={styles.menuLink} onClick={() => setMenuOpen(false)}><Sparkles size={17} /><span><b>Generator</b><small>Start from a prompt</small></span></Link>

            <span className={styles.menuLabel}>ACCOUNT</span>
            <Link href="/api" className={styles.menuLink} onClick={() => setMenuOpen(false)}><KeyRound size={17} /><span><b>API</b><small>Build with ManifoldGen</small></span></Link>
            <Link href="/account" className={styles.menuLink} onClick={() => setMenuOpen(false)}><UserRound size={17} /><span><b>Account</b><small>Keys, sign-in, and billing</small></span></Link>
            <Link href="/account#credits" className={styles.menuLink} onClick={() => setMenuOpen(false)}><CreditCard size={17} /><span><b>Billing</b><small>Balance and plans</small></span></Link>

            <span className={styles.menuLabel}>LEARN</span>
            <Link href="/blog" className={styles.menuLink} onClick={() => setMenuOpen(false)}><BookOpen size={17} /><span><b>Blog</b><small>Prompt craft and faster AI systems</small></span></Link>
          </nav>
        </aside>
      </div>}

      <div className={styles.workspace}>
        <aside className={styles.rail}>
          {toolItems.map(({ id, label, icon: Icon }) => <button data-testid={`studio-tool-${id}`} key={id} title={`Open ${label} tools`} className={tool === id ? styles.railActive : ''} onClick={() => { setTool(id); setMobilePanelOpen(tool !== id || !mobilePanelOpen); }}><Icon size={19} /><span>{label}</span></button>)}
          <div className={styles.railBottom}><button type="button" data-testid="studio-help" aria-haspopup="dialog" aria-expanded={helpOpen} title="Keyboard shortcuts (?)" onClick={() => setHelpOpen(true)}><CircleHelp size={18} /><span>Help</span></button></div>
        </aside>

        <aside data-testid="studio-panel" className={`${styles.panel} ${mobilePanelOpen ? styles.panelOpen : ''}`}>
          <button className={styles.panelClose} aria-label="Close tools" onClick={() => setMobilePanelOpen(false)}><X size={16} /></button>
          {tool === 'media' && <>
            <div className={styles.panelHeader}><div><span className={styles.eyebrow}>CREATE + DISCOVER</span><h2>Media</h2></div>{mediaBrowserMode === 'project' && <button className={styles.smallIcon} title="Add media" onClick={() => fileInputRef.current?.click()}><Plus size={15} /></button>}</div>
            <div className={styles.mediaTabs} role="tablist" aria-label="Media library">
              {([['project', 'Project'], ['videos', 'Videos'], ['images', 'Images'], ['music', 'Music'], ['tools', 'Tools']] as const).map(([id, label]) => <button key={id} role="tab" aria-selected={mediaBrowserMode === id} data-testid={`studio-media-${id}`} className={mediaBrowserMode === id ? styles.mediaTabActive : ''} onClick={() => setMediaBrowserMode(id)}>{label}</button>)}
            </div>
            <input ref={fileInputRef} type="file" multiple accept="video/*,image/*,audio/*" hidden onChange={(event) => event.target.files && void importFiles(event.target.files)} />
            {mediaBrowserMode === 'project' && <>
              <div className={styles.mediaActions}>
                <button className={styles.importButton} onClick={() => fileInputRef.current?.click()}><Upload size={16} /> Import media</button>
                <button data-testid="studio-generate-media" className={styles.generateMediaButton} onClick={() => { setMediaBrowserMode('videos'); setVideoGenerateQueueStatus(''); setVideoGenerateOpen(true); }}><Sparkles size={16} /> Generate video</button>
              </div>
              <div className={styles.assetGrid}>
                {assets.map((asset) => <article role="button" tabIndex={0} key={asset.id} onContextMenu={(event) => openStudioContextMenu(event, asset)} onClick={(event) => { selectClip(asset.id, event.metaKey || event.ctrlKey || event.shiftKey); setPlayhead(asset.timelineStart); }} onKeyDown={(event) => { if (event.key === 'Enter') { selectClip(asset.id, event.metaKey || event.ctrlKey || event.shiftKey); setPlayhead(asset.timelineStart); } }} className={`${styles.assetCard} ${selectedIDs.includes(asset.id) ? styles.assetSelected : ''}`}>
                  {asset.kind === 'image' ? <img src={asset.url} alt="" /> : asset.kind === 'video' ? <video src={asset.url} muted preload="metadata" /> : <ProjectAudioThumb asset={asset} />}
                  <span className={styles.assetType}>{asset.text ? <Type size={11} /> : asset.kind === 'video' ? <Film size={11} /> : asset.kind === 'audio' ? <Volume2 size={11} /> : <ImageIcon size={11} />}</span>
                  <span className={styles.assetName}>{asset.text?.content || asset.name}</span>
                </article>)}
              </div>
            {user && <section className={styles.generationLibrary}>
              <div className={styles.generationHeader}><span>YOUR GENERATIONS</span><small>Saved automatically</small></div>
              {!generationJobs.length ? <p className={styles.generationEmpty}>New videos started from Generate appear here. Finished videos can be added to this timeline.</p> : generationJobs.map((generation) => {
                const readyURL = resultURL(generation.result);
                const status = generationStatus(generation);
                const ready = READY_GENERATION_STATUSES.has(status) && Boolean(readyURL);
                const pending = isActiveGeneration(generation);
                const failed = ['failed', 'error', 'payment_required', 'cancelled', 'canceled'].includes(status);
                return <article key={generation.job_id} data-testid={`studio-generation-${generation.job_id}`} className={styles.generationCard} onContextMenu={(event) => {
                  if (!ready || !generation.prompt?.trim()) return;
                  event.preventDefault();
                  setGenerationContextMenu({ jobID: generation.job_id, x: event.clientX, y: event.clientY });
                }}>
                  <button className={styles.generationMain} aria-disabled={!ready && !failed} onClick={() => failed ? void retryGeneration(generation.job_id) : ready ? void addGenerationToTimeline(generation) : undefined} title={ready ? 'Add to timeline' : failed ? 'Retry generation' : undefined}>
                    <span className={styles.generationPreview}>{ready && readyURL ? <video src={readyURL} muted playsInline preload="metadata" /> : pending ? <ManifoldLoader compact label="Generating" /> : <span className={styles.generationThumb}>{failed ? <RotateCcw size={20} /> : <X size={20} />}</span>}{ready && <span className={styles.generationAdd}><Plus size={13} /> Add</span>}</span>
                    <span className={styles.generationMeta}><b>{ready ? 'Ready' : pending ? 'Generating' : failed ? 'Retry' : 'Unavailable'}</b><small>{generation.prompt || generation.error || 'Manifold video'}</small></span>
                  </button>
                  <button className={styles.deleteGeneration} aria-label="Delete generation" onClick={() => void deleteGeneration(generation.job_id)}><Trash2 size={13} /></button>
                </article>;
              })}
            </section>}
              {!assets.length && <div className={styles.emptyLibrary}><Clapperboard size={24} /><p>{user ? 'Imports stay local while they upload securely in the background.' : 'Your imported files stay in this browser. Sign in for cloud sync.'}</p></div>}
            </>}

            {mediaBrowserMode === 'videos' && <>
              <button data-testid="studio-video-create" className={styles.mediaCreateCard} onClick={() => { setVideoGenerateQueueStatus(''); setVideoGenerateOpen(true); }}><span className={styles.mediaCreateIcon}><Sparkles size={18} /></span><span><b>Generate videos</b><small>H3 · batches, audio, loops, image guidance</small></span></button>
              <div className={styles.discoveryLabel}><span>VIDEOS FROM THE COMMUNITY</span><small>Semantic search</small></div>
              <div className={styles.searchRow}><Search size={14} /><input data-testid="studio-media-search" value={mediaSearch} onChange={(event) => setMediaSearch(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void searchStudioMedia('videos')} placeholder="Search motion, subjects, styles…" /><button title="Search (Enter)" disabled={mediaSearchBusy} onClick={() => void searchStudioMedia('videos')}>{mediaSearchBusy ? <Loader2 className={styles.spin} size={14} /> : 'Find'}</button></div>
              <div className={styles.discoveryGrid}>{videoHits.map((hit) => <button data-testid={`studio-video-hit-${hit.job_id}`} className={styles.discoveryCard} key={hit.job_id} disabled={!hit.video_url || busy === 'import-discovery'} onContextMenu={(event) => openPromptContextMenu(event, 'video', hit.prompt)} onClick={() => void addDiscoveredMedia(hit.video_url || '', hit.prompt, 'video')}>
                <span className={styles.discoveryPreview}>{hit.video_url && <video src={hit.video_url} muted playsInline preload="metadata" />}<span><Plus size={13} /> Add</span></span>
                <b>{hit.prompt || 'Community video'}</b><small>{hit.service || 'H3'}{typeof hit.similarity === 'number' ? ` · ${Math.round(hit.similarity * 100)}% match` : ''}</small>
              </button>)}</div>
              {!mediaSearchBusy && !videoHits.length && <p className={styles.discoveryEmpty}>No videos found yet. Try a broader visual description.</p>}
            </>}

            {mediaBrowserMode === 'images' && <>
              <section className={styles.imageComposer}>
                <div className={styles.imageComposerTitle}><span><Sparkles size={15} /></span><div><b>Generate images</b><small>Related community work appears while rendering</small></div></div>
                <textarea data-testid="studio-image-prompt" value={imagePrompt} maxLength={2000} rows={4} onChange={(event) => setImagePrompt(event.target.value)} placeholder="Describe the image you want…" />
                <div className={styles.engineChoices}>
                  <button data-testid="studio-image-engine-images3" className={imageEngine === 'images3' ? styles.engineActive : ''} onClick={() => setImageEngine('images3')}><b>RA1</b><small>Images3 · netwrck</small></button>
                  <button data-testid="studio-image-engine-omniserve" className={imageEngine === 'omniserve' ? styles.engineActive : ''} onClick={() => setImageEngine('omniserve')}><b>Z-Image</b><small>OmniServe Native</small></button>
                </div>
                <div className={styles.imageSettings}>
                  <label><span>Aspect</span><select data-testid="studio-image-aspect" value={imageAspect} onChange={(event) => setImageAspect(event.target.value as H3Aspect)}>{(['16:9', '9:16', '1:1', '4:3', '3:4'] as H3Aspect[]).map((aspect) => <option key={aspect}>{aspect}</option>)}</select></label>
                  <label><span>Outputs</span><select data-testid="studio-image-count" value={imageCount} onChange={(event) => setImageCount(Number(event.target.value) as 1 | 4)}><option value="1">1 image</option><option value="4">4 images</option></select></label>
                </div>
                <button data-testid="studio-image-generate" className={styles.imageGenerateButton} disabled={!imagePrompt.trim()} onClick={() => void generateStudioImages()}><Sparkles size={15} /> Generate {imageCount}</button>
              </section>
              <div className={styles.discoveryLabel}><span>SIMILAR IMAGES</span><small>From everyone</small></div>
              <div className={styles.searchRow}><Search size={14} /><input data-testid="studio-media-search" value={mediaSearch} onChange={(event) => setMediaSearch(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void searchStudioMedia('images')} placeholder="Search subjects, lighting, composition…" /><button title="Search (Enter)" disabled={mediaSearchBusy} onClick={() => void searchStudioMedia('images')}>{mediaSearchBusy ? <Loader2 className={styles.spin} size={14} /> : 'Find'}</button></div>
              <div className={styles.discoveryGrid}>{imageHits.map((hit) => {
                const imageURL = galleryImageURL(hit.image_url || hit.file_path);
                const thumbURL = galleryImageURL(hit.thumb_url || hit.thumb_path || hit.image_url || hit.file_path);
                return <button data-testid={`studio-image-hit-${hit.id}`} className={styles.discoveryCard} key={hit.id} disabled={!imageURL || busy === 'import-discovery'} onContextMenu={(event) => openPromptContextMenu(event, 'image', hit.prompt)} onClick={() => void addDiscoveredMedia(imageURL, hit.prompt, 'image')}>
                  <span className={styles.discoveryPreview}>{thumbURL && <img src={thumbURL} alt="" />}<span><Plus size={13} /> Add</span></span>
                  <b>{hit.prompt || 'Community image'}</b><small>{hit.model || 'Generated'}{typeof hit.similarity === 'number' ? ` · ${Math.round(hit.similarity * 100)}% match` : ''}</small>
                </button>;
              })}</div>
              {!mediaSearchBusy && !imageHits.length && <p className={styles.discoveryEmpty}>No related images found yet. Generation still works independently.</p>}
            </>}

            {mediaBrowserMode === 'music' && <>
              <button data-testid="studio-music-create" className={styles.mediaCreateCard} onClick={() => { setAudioMode('music'); setAudioDuration(30); setAudioGenerateOpen(true); }}><span className={styles.mediaCreateIcon}><Music2 size={18} /></span><span><b>Generate music</b><small>Describe a soundtrack and add it directly to the timeline</small></span></button>
              <div className={styles.discoveryLabel}><span>LICENSED MUSIC</span><small>Netwrck catalog</small></div>
              <div className={styles.searchRow}><Search size={14} /><input data-testid="studio-media-search" value={mediaSearch} onChange={(event) => setMediaSearch(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void searchStudioMedia('music')} placeholder="Search mood, genre, instruments…" /><button title="Search (Enter)" disabled={mediaSearchBusy} onClick={() => void searchStudioMedia('music')}>{mediaSearchBusy ? <Loader2 className={styles.spin} size={14} /> : 'Find'}</button></div>
              <div className={styles.catalogList}>{audioResults.map((asset) => <CatalogAudioCard
                key={asset.id}
                testID={`studio-music-hit-${asset.id}`}
                asset={asset}
                loading={busy === `catalog-${asset.id}`}
                onAdd={(item) => void importCatalogAudio(item)}
                onDragStart={startCatalogAudioDrag}
                onPromptContext={(event, item) => openPromptContextMenu(event, 'music', item.description || item.title)}
              />)}</div>
              {!mediaSearchBusy && !audioResults.length && <p className={styles.discoveryEmpty}>No music found yet. Try a mood, genre, or instrument.</p>}
            </>}

            {mediaBrowserMode === 'tools' && <section className={styles.mediaTools} data-testid="studio-tools-pane">
              <div className={styles.toolsIntro}><span><WandSparkles size={16} /></span><div><b>Video generators</b><small>Choose a model, generate a shot, then send it back to this timeline.</small></div></div>
              <div className={styles.toolGeneratorList}><Link data-testid="studio-tool-animate-video" href="/tool/animate-video" className={styles.toolGeneratorCard}>
                <span className={styles.toolGeneratorMark} style={{ '--tool-color': '#9c8cff' } as CSSProperties}>A</span>
                <span className={styles.toolGeneratorCopy}><b>Animation Transfer</b><small>Image + driving video</small><em>from 60 Manifold credits</em></span>
                <ArrowRight size={13} />
              </Link>{VIDEO_GENERATORS.map((generator) => <Link data-testid={`studio-tool-${generator.slug}`} href={`/tools/${generator.slug}`} className={styles.toolGeneratorCard} key={generator.slug}>
                <span className={styles.toolGeneratorMark} style={{ '--tool-color': generator.accent } as CSSProperties}>{generator.shortName.slice(0, 1)}</span>
                <span className={styles.toolGeneratorCopy}><b>{generator.shortName}</b><small>{generator.mode === 'text' ? 'Text to video' : generator.mode === 'image' ? 'Image to video' : 'Reference to video'}</small><em>{generator.price}</em></span>
                <ArrowRight size={13} />
              </Link>)}</div>
              <Link href="/tools" className={styles.allToolsLink}>Browse all generator tools <ArrowRight size={13} /></Link>
            </section>}
          </>}

          {tool === 'text' && <>
            <div className={styles.panelHeader}><div><span className={styles.eyebrow}>TYPOGRAPHY</span><h2>Text</h2></div></div>
            <div className={styles.textPresets}>
              <button data-testid="studio-add-title" onClick={() => void addText({ content: 'Add a title', fontSize: 132, fontFamily: 'Inter', fontWeight: 800, color: '#ffffff', align: 'center' })}><b>Add a title</b><small>Bold display text</small></button>
              <button onClick={() => void addText({ content: 'Add a subtitle', fontSize: 76, fontFamily: 'Inter', fontWeight: 600, color: '#ffffff', align: 'center' })}><b>Add a subtitle</b><small>Supporting line</small></button>
              <button data-testid="studio-add-body-text" title="Add body text (T)" onClick={() => void addText({ content: 'Add body text', fontSize: 48, fontFamily: 'Inter', fontWeight: 400, color: '#ffffff', align: 'left' })}><b>Add body text</b><small>Paragraph or caption</small></button>
            </div>
            {selected?.text ? <section className={styles.textEditor}>
              <span className={styles.sectionLabel}>SELECTED TEXT</span>
              <textarea data-testid="studio-text-content" rows={5} maxLength={800} value={textDraft.content} onChange={(event) => setTextDraft((current) => ({ ...current, content: event.target.value }))} />
              <div className={styles.textEditorGrid}>
                <label><span>Typeface</span><input data-testid="studio-font-search" value={fontSearch} onChange={(event) => setFontSearch(event.target.value)} placeholder="Search fonts" /></label>
                <label><span>Weight</span><select value={textDraft.fontWeight} onChange={(event) => setTextDraft((current) => ({ ...current, fontWeight: Number(event.target.value) as StudioTextStyle['fontWeight'] }))}><option value="400">Regular</option><option value="600">Semibold</option><option value="800">Bold</option></select></label>
                <label><span>Size</span><input type="number" min="20" max="240" value={textDraft.fontSize} onChange={(event) => setTextDraft((current) => ({ ...current, fontSize: Math.max(20, Math.min(240, Number(event.target.value))) }))} /></label>
                <label><span>Color</span><input aria-label="Text color" type="color" value={textDraft.color} onChange={(event) => setTextDraft((current) => ({ ...current, color: event.target.value }))} /></label>
              </div>
              {fontSearch.trim() && STUDIO_FONTS.filter((font) => font.toLowerCase().includes(fontSearch.trim().toLowerCase()) && font !== textDraft.fontFamily).map((font) => <button key={font} role="option" aria-selected="false" onClick={() => { setTextDraft((current) => ({ ...current, fontFamily: font })); setFontSearch(font); }}>{font}</button>)}
              <div className={styles.textAlignChoices}>{(['left', 'center', 'right'] as const).map((align) => <button key={align} className={textDraft.align === align ? styles.textAlignActive : ''} onClick={() => setTextDraft((current) => ({ ...current, align }))}>{align}</button>)}</div>
              <button data-testid="studio-text-apply" className={styles.imageGenerateButton} disabled={!textDraft.content.trim()} onClick={() => void updateSelectedText()}><Type size={15} /> Update text</button>
              <p className={styles.textHint}>Text remains editable after reopening the project and uses the same stage scale, rotation, layering, and export path as other visual elements.</p>
            </section> : <div className={styles.panelEmpty}><Type size={22} /><p>Add a text style above, or select existing text on the stage.</p></div>}
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
            {!selected || selected.kind === 'audio' ? <PanelEmpty /> : <>
              <div className={styles.transformGrid}><button data-testid="studio-transform-reset" className={styles.settingCard} onClick={() => updateAsset(selected.id, { stageX: 0, stageY: 0, stageScale: 1, stageRotation: 0 })}><Maximize size={17} /><span><b>Fit & center</b><small>Reset position, scale, and rotation</small></span></button></div>
              <div className={styles.transformControls}>
                <label className={styles.sliderRow}><span><b>Scale</b><output>{Math.round(selected.stageScale * 100)}%</output></span><input data-testid="studio-transform-scale" type="range" min="0.1" max="4" step="0.01" value={selected.stageScale} onChange={(event) => updateAsset(selected.id, { stageScale: Number(event.target.value) })} /></label>
                <label className={styles.sliderRow}><span><b>Rotation</b><output>{Math.round(selected.stageRotation)}°</output></span><input data-testid="studio-transform-rotation" type="range" min="-180" max="180" step="1" value={selected.stageRotation} onChange={(event) => updateAsset(selected.id, { stageRotation: Number(event.target.value) })} /></label>
                <div className={styles.rotateButtons}><button onClick={() => updateAsset(selected.id, { stageRotation: Math.max(-180, selected.stageRotation - 90) })}><RotateCcw size={14} /> -90°</button><button onClick={() => updateAsset(selected.id, { stageRotation: Math.min(180, selected.stageRotation + 90) })}><RotateCw size={14} /> +90°</button></div>
              </div>
              <div className={styles.metaList}><span>Dimensions <b>{selected.width} × {selected.height}</b></span><span>Aspect <b>{(selected.width / selected.height).toFixed(2)}:1</b></span></div>
            </>}
          </>}

          {tool === 'audio' && <>
            <div className={styles.panelHeader}><div><span className={styles.eyebrow}>SOUND</span><h2>Audio</h2></div></div>
            <div className={styles.quickGenerate}>
              <button onClick={() => { setAudioMode('music'); setAudioDuration(30); setAudioGenerateOpen(true); }}><Music2 size={17} /><span><b>Music</b><small>AI music · 80 cr</small></span></button>
              <button onClick={() => { setAudioMode('sfx'); setAudioGenerateOpen(true); }}><AudioLines size={17} /><span><b>Sound</b><small>AI · metered</small></span></button>
              <button onClick={() => { setAudioMode('speech'); setAudioGenerateOpen(true); }}><Mic2 size={17} /><span><b>Speech</b><small>from {speechCredits.toFixed(2)} cr</small></span></button>
            </div>
            {(selected?.kind === 'audio' || selected?.kind === 'video') && <div className={styles.audioControls}>
              <span className={styles.sectionLabel}>SELECTED {selected.kind === 'video' ? 'VIDEO SOUND' : 'AUDIO TRACK'}</span>
              {selected.kind === 'video' && <button data-testid="studio-separate-audio" className={styles.settingCard} disabled={!!busy || !!selected.sourceAudioMuted} onClick={() => void separateSelectedAudio()}><AudioLines size={17} /><span><b>{selected.sourceAudioMuted ? 'Audio separated' : 'Separate audio'}</b><small>{selected.sourceAudioMuted ? 'The embedded track is muted' : 'Create an independent WAV track'}</small></span></button>}
              <label className={styles.sliderRow}><span><b>Volume</b><output>{selected.sourceAudioMuted ? 'Muted' : `${Math.round(selected.volume * 100)}%`}</output></span><input data-testid={selected.kind === 'video' ? 'studio-video-volume' : 'studio-audio-volume'} disabled={!!selected.sourceAudioMuted} type="range" min="0" max="2" step="0.01" value={selected.volume} onChange={(event) => updateAsset(selected.id, { volume: Number(event.target.value) })} /></label>
              {selected.kind === 'video' && <button data-testid="studio-video-audio-toggle" className={styles.settingCard} onClick={() => updateAsset(selected.id, { sourceAudioMuted: !selected.sourceAudioMuted })}>{selected.sourceAudioMuted ? <Volume2 size={17} /> : <VolumeX size={17} />}<span><b>{selected.sourceAudioMuted ? 'Restore source audio' : 'Mute source audio'}</b><small>{selected.sourceAudioMuted ? 'Use the embedded video sound again' : 'Keep the picture silent in preview and export'}</small></span></button>}
              <label className={styles.sliderRow}><span><b>Fade in</b><output>{selected.fadeIn.toFixed(1)}s</output></span><input data-testid="studio-audio-fade-in" disabled={!!selected.sourceAudioMuted} type="range" min="0" max={Math.min(5, (selected.trimEnd - selected.trimStart) / 2)} step="0.1" value={selected.fadeIn} onChange={(event) => updateAsset(selected.id, { fadeIn: Number(event.target.value) })} /></label>
              <label className={styles.sliderRow}><span><b>Fade out</b><output>{selected.fadeOut.toFixed(1)}s</output></span><input data-testid="studio-audio-fade-out" disabled={!!selected.sourceAudioMuted} type="range" min="0" max={Math.min(5, (selected.trimEnd - selected.trimStart) / 2)} step="0.1" value={selected.fadeOut} onChange={(event) => updateAsset(selected.id, { fadeOut: Number(event.target.value) })} /></label>
            </div>}
            <div className={styles.catalogHeader}><span className={styles.sectionLabel}>LICENSED CATALOG</span><Library size={14} /></div>
            <div className={styles.searchRow}><Search size={14} /><input data-testid="studio-audio-search" value={audioSearch} onChange={(event) => setAudioSearch(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void searchAudioCatalog()} placeholder="Search music and sounds" /><button title="Search (Enter)" disabled={audioSearching} onClick={() => void searchAudioCatalog()}>{audioSearching ? <Loader2 className={styles.spin} size={14} /> : 'Find'}</button></div>
            <div className={styles.kindChips}>{(['music', 'sfx', 'voice'] as const).map((kind) => <button key={kind} className={audioKind === kind ? styles.kindActive : ''} onClick={() => setAudioKind(kind)}>{kind === 'sfx' ? 'SFX' : kind}</button>)}</div>
            <div className={styles.catalogList}>{audioResults.map((asset) => <CatalogAudioCard
              key={asset.id}
              asset={asset}
              loading={busy === `catalog-${asset.id}`}
              onAdd={(item) => void importCatalogAudio(item)}
              onDragStart={startCatalogAudioDrag}
              onPromptContext={(event, item) => openPromptContextMenu(event, item.kind === 'sfx' ? 'sfx' : 'music', item.description || item.title)}
            />)}</div>
          </>}

          {tool === 'ai' && <>
            <div className={styles.panelHeader}><div><span className={styles.eyebrow}>ASSIST</span><h2>AI tools</h2></div></div>
            <div className={styles.aiStack}>
              <button className={styles.aiCard} disabled={selected?.kind !== 'image'} onClick={() => void removeBackground()}><span className={styles.aiIcon}><ImageIcon size={19} /></span><span><b>Remove background</b><small>WebP · 1 credit</small></span><ArrowLeft className={styles.arrowRight} size={14} /></button>
              <button data-testid="studio-upscale-open" className={styles.aiCard} disabled={!canOpenUpscale} onClick={() => setUpscaleOpen(true)}><span className={styles.aiIcon}><Maximize size={19} /></span><span><b>Upscale video</b><small>{selected?.kind === 'video' && !canOpenUpscale ? 'Use a clip under 60s' : 'Real-ESRGAN · 2× or 4×'}</small></span><ArrowLeft className={styles.arrowRight} size={14} /></button>
              <button data-testid="studio-restyle-open" className={styles.aiCard} disabled={selected?.kind !== 'video'} onClick={() => selected?.kind === 'video' && openRestyle(selected)}><span className={styles.aiIcon}><WandSparkles size={19} /></span><span><b>Restyle video</b><small>Keep motion · change look</small></span><ArrowLeft className={styles.arrowRight} size={14} /></button>
              <button data-testid="studio-animation-open" className={styles.aiCard} disabled={selected?.kind !== 'video'} onClick={() => selected?.kind === 'video' && openAnimationTransfer(selected)}><span className={styles.aiIcon}><Clapperboard size={19} /></span><span><b>Animation Transfer</b><small>Drive a character from this clip</small></span><ArrowLeft className={styles.arrowRight} size={14} /></button>
              <button className={styles.aiCard} disabled={!canExtendSelected} onClick={() => setExtendOpen(true)}><span className={styles.aiIcon}><Sparkles size={19} /></span><span><b>Extend video</b><small>{selected?.kind === 'video' && !canExtendSelected ? 'Use a 2–15s clip' : 'Grok · MP4'}</small></span><ArrowLeft className={styles.arrowRight} size={14} /></button>
            </div>
            <p className={styles.aiNote}>AI tools require a signed-in account. Local editing and export do not use credits.</p>
          </>}
        </aside>

        <div className={styles.panelResize} aria-hidden="true"><span /></div>
        <section className={styles.stageArea}>
          <div className={styles.stageToolbar}>
            <div className={styles.stageLeft}><button className={styles.toolChip}><MousePointer2 size={14} /> Select</button><button className={styles.toolChip} disabled><Crop size={14} /> Crop</button></div>
            <div data-testid="studio-render-status" className={styles.stageStatus}>{selected ? selected.kind === 'audio' ? `${formatTime(selected.duration).slice(3)} audio` : `${selected.width} × ${selected.height} · GPU preview` : 'GPU editor ready'}</div>
            <div className={styles.stageRight}><button className={styles.iconButton} onClick={() => setStageZoom((value) => Math.max(.5, value - .1))}><Minus size={14} /></button><span>{Math.round(stageZoom * 100)}%</span><button className={styles.iconButton} onClick={() => setStageZoom((value) => Math.min(2, value + .1))}><Plus size={14} /></button><button className={styles.iconButton} onClick={centerStageElement} disabled={!selected || selected.kind === 'audio'} title="Center element"><Maximize size={14} /></button></div>
          </div>
          <div ref={stageRef} data-testid="studio-stage" className={styles.stage}>
            {selected?.kind === 'audio' ? <audio hidden ref={audioRef} src={selected.url} preload="metadata" onLoadedMetadata={(event) => { event.currentTarget.currentTime = selected.trimStart + Math.max(0, Math.min(clipDuration(selected), playhead - selected.timelineStart)); }} onTimeUpdate={(event) => { const next = selected.timelineStart + event.currentTarget.currentTime - selected.trimStart; if (next >= clipEnd(selected)) { event.currentTarget.pause(); setPlayhead(clipEnd(selected)); } else setPlayhead(next); }} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} /> : selected ? stageVisualAssets.map((asset, index) => {
              const isSelected = asset.id === selected.id;
              const dragPosition = stageDragPosition?.assetID === asset.id ? stageDragPosition : null;
              // The observer updates later resizes; reading the mounted stage
              // here also covers the first asset render before the grid has
              // delivered its first ResizeObserver callback.
              const measuredStage = stageRef.current?.getBoundingClientRect();
              const stageWidth = stageSize.width || measuredStage?.width || 0;
              const stageHeight = stageSize.height || measuredStage?.height || 0;
              const previewSize = stageWidth && stageHeight
                ? fitStagePreview(asset.width, asset.height, stageWidth - 24, stageHeight - 24)
                : undefined;
              return <div
                key={asset.id}
                data-testid={isSelected ? 'studio-stage-element' : `studio-stage-layer-${asset.id}`}
                data-stage-asset={asset.id}
                data-visual-track={asset.visualTrack}
                data-position-x={(dragPosition?.x ?? asset.stageX).toFixed(4)}
                data-position-y={(dragPosition?.y ?? asset.stageY).toFixed(4)}
                data-scale={(dragPosition?.scale ?? asset.stageScale).toFixed(4)}
                data-rotation={(dragPosition?.rotation ?? asset.stageRotation).toFixed(2)}
                className={`${styles.stageElement} ${isSelected ? styles.canvasWrap : styles.stageLayer} ${dragPosition ? styles.canvasWrapDragging : ''}`}
                style={{
                  left: `${50 + (dragPosition?.x ?? asset.stageX) * 100}%`,
                  top: `${50 + (dragPosition?.y ?? asset.stageY) * 100}%`,
                  transform: `translate(-50%, -50%) rotate(${dragPosition?.rotation ?? asset.stageRotation}deg) scale(${stageZoom * (dragPosition?.scale ?? asset.stageScale)})`,
                  aspectRatio: `${asset.width}/${asset.height}`,
                  width: previewSize ? `${previewSize.width}px` : undefined,
                  height: previewSize ? `${previewSize.height}px` : undefined,
                  zIndex: asset.visualTrack * 10_000 + index,
                }}
                role="button"
                tabIndex={isSelected ? 0 : -1}
                aria-label={`Move ${asset.name}`}
                aria-selected={isSelected}
                title="Drag to move · Arrow keys to nudge · Double-click to center"
                onContextMenu={(event) => openStudioContextMenu(event, asset)}
                onPointerDown={(event) => beginStageDrag(event, asset)}
                onPointerMove={moveStagePointer}
                onPointerUp={endStagePointer}
                onPointerCancel={endStagePointer}
                onKeyDown={isSelected ? nudgeStageElement : undefined}
                onDoubleClick={() => updateAsset(asset.id, { stageX: 0, stageY: 0 })}
              >
                {asset.text && <span data-testid="studio-stage-text-editor" aria-hidden="true" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', fontFamily: isSelected ? textDraft.fontFamily : asset.text.fontFamily }} />}
                {isSelected ? <>
                  {asset.kind === 'video' && <video ref={videoRef} className={styles.sourceVideo} src={asset.url} muted={!!asset.sourceAudioMuted} playsInline preload="auto" onLoadedData={() => { if (videoRef.current) { videoRef.current.currentTime = asset.trimStart + Math.max(0, Math.min(clipDuration(asset), playhead - asset.timelineStart)); videoRef.current.volume = Math.max(0, Math.min(1, asset.volume)); } drawCurrent(); }} onSeeked={drawCurrent} />}
                  <canvas ref={canvasRef} className={styles.previewCanvas} />
                  <i className={`${styles.stageHandle} ${styles.stageHandleNW}`} onPointerDown={(event) => beginStageTransform(event, asset, 'scale')} />
                  <i className={`${styles.stageHandle} ${styles.stageHandleNE}`} onPointerDown={(event) => beginStageTransform(event, asset, 'scale')} />
                  <i className={`${styles.stageHandle} ${styles.stageHandleSW}`} onPointerDown={(event) => beginStageTransform(event, asset, 'scale')} />
                  <i className={`${styles.stageHandle} ${styles.stageHandleSE}`} onPointerDown={(event) => beginStageTransform(event, asset, 'scale')} />
                  <i className={styles.stageRotateHandle} title="Drag to rotate · hold Shift to snap" onPointerDown={(event) => beginStageTransform(event, asset, 'rotate')}><RotateCw size={10} /></i>
                </> : <PassiveStageMedia asset={asset} playhead={playhead} playing={playing} />}
              </div>;
            }) : <button data-testid="studio-empty" className={styles.dropPrompt} onClick={() => fileInputRef.current?.click()}><span><Upload size={26} /></span><b>Drop media to begin</b><small>Video, image, audio, WebM, MP4, WAV, PNG</small><em>Browse files</em></button>}
            {stageGuides.vertical && <span className={`${styles.stageGuide} ${styles.stageGuideVertical}`} />}
            {stageGuides.horizontal && <span className={`${styles.stageGuide} ${styles.stageGuideHorizontal}`} />}
            {dragging && <div data-testid="studio-drop-overlay" className={styles.dropOverlay}><div><Upload size={28} /><b>Drop to import</b></div></div>}
          </div>
          {(notice || error) && <div data-testid="studio-notice" className={`${styles.toast} ${error ? styles.toastError : ''}`}><span>{error || notice}</span><button onClick={() => { setError(''); setNotice(''); }}><X size={14} /></button></div>}
        </section>
      </div>

      <section className={styles.timeline}>
        <div className={styles.timelineToolbar}>
          <div className={styles.timelineTools}><button title="Add media" onClick={() => fileInputRef.current?.click()}><Plus size={14} /> Add</button><button onClick={splitAtPlayhead} disabled={!selectedAssets.length} title="Split at playhead (S)"><Scissors size={14} /> Split</button><button data-testid="studio-layer-up" onClick={() => moveSelectionBetweenLayers(1)} disabled={!selectedAssets.some((asset) => asset.kind !== 'audio')} title="Move up a layer (Ctrl/Cmd + ])"><ChevronUp size={14} /> Layer</button><button data-testid="studio-layer-down" onClick={() => moveSelectionBetweenLayers(-1)} disabled={!selectedAssets.some((asset) => asset.kind !== 'audio')} title="Move down a layer (Ctrl/Cmd + [)"><ChevronDown size={14} /> Layer</button><button onClick={duplicateSelected} disabled={!selectedAssets.length} title="Duplicate selected clips"><Copy size={14} /></button><button onClick={removeSelected} disabled={!selectedAssets.length} title="Delete selected clips"><Trash2 size={14} /></button>{selectedAssets.length > 1 && <span className={styles.selectionCount}>{selectedAssets.length} selected</span>}</div>
          <div className={styles.transport}><button aria-label={playing ? 'Pause' : 'Play'} title="Play/pause (Space)" className={styles.playButton} onClick={togglePlayback} disabled={!selected || selected.kind === 'image'}>{playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}</button><span>{formatTime(playhead)} <i>/</i> {formatTime(timelineDuration)}</span></div>
          <div className={styles.timelineZoom}><span className={styles.timelineHint}>Shift-drag to select · Ctrl/Cmd [ ] to layer</span><span className={styles.mobileGestureHint}>Long-press + drag to move · drag edges to trim</span><ZoomIn size={14} /><input aria-label="Timeline zoom" type="range" min="0.5" max="2.5" step="0.1" value={timelineZoom} onChange={(event) => setTimelineZoom(Number(event.target.value))} /></div>
        </div>
        <div className={styles.timelineBody}>
          <div ref={timelineLabelsRef} className={styles.trackLabels} onWheel={(event) => { if (timelineContentRef.current) timelineContentRef.current.scrollTop += event.deltaY; }}><span>VIDEO</span>{Array.from({ length: visualTrackCount }, (_, index) => visualTrackCount - index - 1).map((track) => <div data-testid={`timeline-track-label-v${track + 1}`} key={track}>V{track + 1}</div>)}<div className={styles.audioLabel}>A1</div></div>
          <div ref={timelineContentRef} data-testid="studio-timeline-dropzone" className={`${styles.trackContent} ${timelineDropTime !== null ? styles.timelineDropActive : ''}`} onScroll={(event) => { if (timelineLabelsRef.current) timelineLabelsRef.current.scrollTop = event.currentTarget.scrollTop; }} onDragOver={dragMediaOverTimeline} onDragLeave={leaveTimelineDrop} onDrop={(event) => void dropMediaOnTimeline(event)} onPointerMove={moveTimelinePointer} onPointerUp={endTimelinePointer} onPointerCancel={endTimelinePointer}>
            <div data-testid="studio-timeline-canvas" ref={timelineCanvasRef} className={styles.timelineCanvas} style={{ width: timelineWidth, minWidth: '100%' }}>
              <div data-testid="studio-timeline-ruler" className={styles.ruler} onPointerDown={beginScrub}>{Array.from({ length: Math.floor(rulerDuration / rulerStep) + 1 }, (_, index) => { const time = index * rulerStep; return <span key={time} style={{ left: time * pixelsPerSecond }}>{formatTime(time).slice(3)}</span>; })}</div>
              <div className={styles.videoTracks} onPointerDown={beginScrub}>
            {assets.filter((asset) => asset.kind !== 'audio').map((asset) => <div data-testid={`timeline-clip-${asset.id}`} data-timeline-asset={asset.id} data-visual-track={asset.visualTrack} role="button" tabIndex={0} aria-selected={selectedIDs.includes(asset.id)} key={asset.id} onContextMenu={(event) => openStudioContextMenu(event, asset)} onPointerDown={(event) => beginClipDrag(event, asset, 'move')} className={`${styles.timelineClip} ${selectedIDs.includes(asset.id) ? styles.timelineClipSelected : ''} ${activeTimelineClip === asset.id ? styles.timelineClipActive : ''}`} style={{ '--track-from-top': visualTrackCount - asset.visualTrack - 1, left: asset.timelineStart * pixelsPerSecond, width: Math.max(24, clipDuration(asset) * pixelsPerSecond) } as CSSProperties} title={`${asset.name} · V${asset.visualTrack + 1} · ${formatTime(clipDuration(asset))}`}>
                  <span className={`${styles.trimHandle} ${styles.trimHandleLeft}`} onPointerDown={(event) => beginClipDrag(event, asset, 'trim-left')} title="Trim start" />
                  <span className={styles.clipThumb} style={{ backgroundImage: `url(${asset.kind === 'image' ? asset.url : ''})` }}>{asset.kind === 'video' && <Film size={15} />}</span>
                  <span className={styles.clipMeta}><b>{asset.name}</b><small>{formatTime(clipDuration(asset))}</small></span>
                  <span className={`${styles.trimHandle} ${styles.trimHandleRight}`} onPointerDown={(event) => beginClipDrag(event, asset, 'trim-right')} title="Trim end" />
                </div>)}
              </div>
              <div className={styles.audioTrack} onPointerDown={beginScrub}>
                {assets.filter((asset) => asset.kind === 'audio').map((asset) => <div data-testid={`timeline-audio-${asset.id}`} data-timeline-asset={asset.id} role="button" tabIndex={0} aria-selected={selectedIDs.includes(asset.id)} key={asset.id} className={`${styles.waveformClip} ${selectedIDs.includes(asset.id) ? styles.timelineClipSelected : ''} ${activeTimelineClip === asset.id ? styles.timelineClipActive : ''}`} style={{ left: asset.timelineStart * pixelsPerSecond, width: Math.max(24, clipDuration(asset) * pixelsPerSecond) }} onContextMenu={(event) => openStudioContextMenu(event, asset)} onPointerDown={(event) => beginClipDrag(event, asset, 'move')} title={`${asset.name} · ${formatTime(clipDuration(asset))}`}>
                  <span className={`${styles.trimHandle} ${styles.trimHandleLeft}`} onPointerDown={(event) => beginClipDrag(event, asset, 'trim-left')} title="Trim start" />
                  <span className={styles.waveform}>{Array.from({ length: 54 }, (_, index) => <i key={index} style={{ height: `${15 + ((index * 29) % 70)}%` }} />)}</span><b>{asset.name}</b>
                  <span className={`${styles.trimHandle} ${styles.trimHandleRight}`} onPointerDown={(event) => beginClipDrag(event, asset, 'trim-right')} title="Trim end" />
                </div>)}
              </div>
              {timelineDropTime !== null && <div data-testid="studio-timeline-drop-marker" className={styles.timelineDropMarker} style={{ left: timelineDropTime * pixelsPerSecond }}><span>Drop at {formatTime(timelineDropTime)}</span></div>}
              {timelineMarquee && <div data-testid="studio-timeline-marquee" className={styles.timelineMarquee} style={timelineMarquee} />}
              <div className={styles.playhead} style={{ left: playhead * pixelsPerSecond }} />
            </div>
          </div>
        </div>
      </section>

      {videoGenerateOpen && <Modal title="Generate videos" onClose={() => setVideoGenerateOpen(false)}>
        <label className={styles.field}>
          <span>Video prompts · one per line</span>
          <textarea data-testid="studio-video-generate-prompt" value={videoGeneratePrompt} onChange={(event) => setVideoGeneratePrompt(event.target.value)} rows={5} maxLength={6000} placeholder={'A cinematic macro shot of glass flowers blooming\nA slow aerial move above a bioluminescent coast'} />
        </label>
        <p className={styles.generateHint}>Up to 12 prompts per launch. Keep launching.</p>
        <div className={styles.generateSettings}>
          <label><span>Aspect</span><select data-testid="studio-video-generate-aspect" value={videoGenerateAspect} onChange={(event) => setVideoGenerateAspect(event.target.value as H3Aspect)}>{(['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'] as H3Aspect[]).map((aspect) => <option key={aspect}>{aspect}</option>)}</select></label>
          <label><span>Canvas</span><select data-testid="studio-video-generate-size" value={videoGenerateSize} onChange={(event) => setVideoGenerateSize(event.target.value as H3Size)}><option value="preview">Preview</option><option value="balanced">Balanced</option><option value="native">Native</option></select></label>
          <label><span>Duration</span><select data-testid="studio-video-generate-duration" value={videoGenerateDuration} onChange={(event) => { const duration = Number(event.target.value); setVideoGenerateDuration(duration); if (duration > 15) { setVideoGenerateLoop(false); setVideoGenerateAudio(false); } }}><option value="5">5 seconds</option><option value="10">10 seconds</option><option value="15">15 seconds · single shot</option><option value="30">30 seconds · chained</option><option value="45">45 seconds · chained</option><option value="60">60 seconds · chained</option></select></label>
          <label><span>Steps</span><select data-testid="studio-video-generate-steps" value={videoGenerateSteps} onChange={(event) => setVideoGenerateSteps(Number(event.target.value))}><option value="12">12 · Fast</option><option value="20">20 · Standard</option><option value="28">28 · Detailed</option></select></label>
          <label><span>Output</span><select data-testid="studio-video-generate-format" value={videoGenerateFormat} onChange={(event) => setVideoGenerateFormat(event.target.value as H3Format)}><option value="webm-av1">WebM · AV1</option><option value="webm-vp9">WebM · VP9</option><option value="mp4-h264">MP4 · H.264</option></select></label>
        </div>
        <div className={styles.generateToggles}>
          <label className={videoGenerateDuration > 15 ? styles.generateToggleDisabled : ''}><input data-testid="studio-video-generate-audio" type="checkbox" disabled={videoGenerateDuration > 15} checked={videoGenerateAudio} onChange={(event) => setVideoGenerateAudio(event.target.checked)} /><span><b>Native audio</b><small>{videoGenerateDuration > 15 ? 'Add one continuous soundtrack in Audio after generation' : 'Generate synchronized sound with the video'}</small></span></label>
          <label className={videoGenerateDuration > 15 ? styles.generateToggleDisabled : ''}><input data-testid="studio-video-generate-loop" type="checkbox" disabled={videoGenerateDuration > 15} checked={videoGenerateLoop} onChange={(event) => setVideoGenerateLoop(event.target.checked)} /><span><b>Match start + end</b><small>{videoGenerateDuration > 15 ? 'Available for single shots up to 15 seconds' : 'Create and reuse one keyframe for a seamless loop'}</small></span></label>
          <label className={selected?.kind !== 'image' ? styles.generateToggleDisabled : ''}><input data-testid="studio-video-generate-selected-image" type="checkbox" disabled={selected?.kind !== 'image' || videoGenerateLoop} checked={videoGenerateUseSelected && selected?.kind === 'image' && !videoGenerateLoop} onChange={(event) => setVideoGenerateUseSelected(event.target.checked)} /><span><b>Use selected image</b><small>{selected?.kind === 'image' ? selected.name : 'Select an image on the timeline first'}</small></span></label>
        </div>
        {videoGenerateDuration > 15 && <p className={styles.generateHint}>Long videos chain shots. Add one soundtrack across the result.</p>}
        <div className={styles.priceLine}><span>Estimated batch · {videoGenerateBatchCount} video{videoGenerateBatchCount === 1 ? '' : 's'}</span><b>~${videoGenerateBatchUSD.toFixed(2)} · ~{videoGenerateBatchCredits.toLocaleString()} credits</b></div>
        {videoGenerateQueueStatus && <p data-testid="studio-video-generate-status" className={styles.queueStatus} role="status">{videoGenerateQueueStatus}</p>}
        <button data-testid="studio-video-generate-submit" className={styles.modalPrimary} disabled={!videoGeneratePrompts.length} onClick={() => void queueVideoGenerations()}><Sparkles size={16} /> Queue {videoGenerateBatchCount} video{videoGenerateBatchCount === 1 ? '' : 's'}</button>
      </Modal>}

      {imageGenerateOpen && <Modal title="Generate images" onClose={() => setImageGenerateOpen(false)}>
        <label className={styles.field}><span>Prompt</span><textarea data-testid="studio-image-modal-prompt" value={imagePrompt} maxLength={2000} rows={5} onChange={(event) => setImagePrompt(event.target.value)} placeholder="Describe the image you want…" /></label>
        <div className={styles.engineChoices}>
          <button className={imageEngine === 'images3' ? styles.engineActive : ''} onClick={() => setImageEngine('images3')}><b>RA1</b><small>Images3 · netwrck</small></button>
          <button className={imageEngine === 'omniserve' ? styles.engineActive : ''} onClick={() => setImageEngine('omniserve')}><b>Z-Image</b><small>OmniServe Native</small></button>
        </div>
        <div className={styles.imageSettings}>
          <label><span>Aspect</span><select value={imageAspect} onChange={(event) => setImageAspect(event.target.value as H3Aspect)}>{(['16:9', '9:16', '1:1', '4:3', '3:4'] as H3Aspect[]).map((aspect) => <option key={aspect}>{aspect}</option>)}</select></label>
          <label><span>Outputs</span><select value={imageCount} onChange={(event) => setImageCount(Number(event.target.value) as 1 | 4)}><option value="1">1 image</option><option value="4">4 images</option></select></label>
        </div>
        <p className={styles.generateHint}>Related work appears while yours renders.</p>
        <button data-testid="studio-image-modal-generate" className={styles.modalPrimary} disabled={!imagePrompt.trim()} onClick={() => void generateStudioImages()}><Sparkles size={15} /> Generate {imageCount}</button>
      </Modal>}

      {helpOpen && <Modal title="Keyboard shortcuts" onClose={() => setHelpOpen(false)}>
        <p className={styles.shortcutsIntro}>Use these controls anywhere in the Studio, unless you are typing in a field.</p>
        <section className={styles.shortcutSection} aria-labelledby="timeline-shortcuts">
          <h3 id="timeline-shortcuts">Timeline</h3>
          <div className={styles.shortcutList}>
            <div><span>Play or pause the selected video or audio</span><kbd>Space</kbd></div>
            <div><span>Select every clip</span><span className={styles.shortcutKeys}><kbd>⌘ / Ctrl</kbd><kbd>A</kbd></span></div>
            <div><span>Copy or paste selected clips at the playhead</span><span className={styles.shortcutKeys}><kbd>⌘ / Ctrl</kbd><kbd>C</kbd><em>/</em><kbd>V</kbd></span></div>
            <div><span>Split selected clips at the playhead</span><kbd>S</kbd></div>
            <div><span>Delete selected clips</span><span className={styles.shortcutKeys}><kbd>Delete</kbd><em>or</em><kbd>Backspace</kbd></span></div>
            <div><span>Move selected visual clips between layers</span><span className={styles.shortcutKeys}><kbd>⌘ / Ctrl</kbd><kbd>[</kbd><kbd>]</kbd></span></div>
          </div>
        </section>
        <section className={styles.shortcutSection} aria-labelledby="canvas-shortcuts">
          <h3 id="canvas-shortcuts">Canvas</h3>
          <div className={styles.shortcutList}>
            <div><span>Nudge the selected element on the canvas</span><kbd>Arrow keys</kbd></div>
            <div><span>Nudge further</span><span className={styles.shortcutKeys}><kbd>Shift</kbd><kbd>Arrow keys</kbd></span></div>
            <div><span>Return to the Help panel</span><kbd>?</kbd></div>
            <div><span>Exit a multi-selection and keep the active clip</span><kbd>Esc</kbd></div>
          </div>
        </section>
        <section className={styles.shortcutTips} aria-label="Editing tips">
          <h3>Editing tips</h3>
          <ul><li>Drop files anywhere to import them, or use <b>Add</b> in the timeline.</li><li>Drag clips left or right to retime them; drag vertically to change video layers.</li><li>Drag either end of a clip to trim it. Double-click a canvas element to center it.</li></ul>
        </section>
      </Modal>}

      {exportOpen && <Modal title="Export" onClose={() => setExportOpen(false)}>
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
        <p className={styles.exportRemembered}>Complete {formatTime(timelineDuration)} timeline · settings saved on this device.</p>
        <div className={styles.exportSummary}><span>Output <b>{selectedExportSize ? `${selectedExportSize.width} × ${selectedExportSize.height}` : 'Not set'}</b></span><span>Frame rate <b>{exportSettings.frameRate === 'source' ? '30 fps timeline' : `${exportSettings.frameRate} fps`}</b></span><span>Audio <b>{assets.some((asset) => asset.kind !== 'image') ? 'Mixed · AAC/Opus' : 'None'}</b></span></div>
        {exportProgress > 0 && <div className={styles.progress}><i style={{ width: `${exportProgress * 100}%` }} /></div>}
        <button className={styles.modalPrimary} disabled={!!busy} onClick={() => void exportVideo()}>{busy === 'export' ? <><Loader2 className={styles.spin} size={16} /> Exporting {Math.round(exportProgress * 100)}%</> : <><Download size={16} /> Export</>}</button>
      </Modal>}

      {extendOpen && <Modal title="Extend video" onClose={() => setExtendOpen(false)}>
        <label className={styles.field}><span>What happens next?</span><textarea value={extendPrompt} onChange={(event) => setExtendPrompt(event.target.value)} rows={4} /></label>
        <div className={styles.durationChoices}>{[2, 4, 6, 8, 10].map((duration) => <button key={duration} className={extendDuration === duration ? styles.durationActive : ''} onClick={() => setExtendDuration(duration)}>{duration}s</button>)}</div>
        <div className={styles.priceLine}><span>Price</span><b>${customerExtendUSD.toFixed(2)}</b></div>
        <p className={styles.billingNote}>Your selected 2–15 second clip is rendered to H.264 MP4 before upload. Grok adds 2–10 seconds and preserves the input shape, capped at 720p.</p>
        <button className={styles.modalPrimary} disabled={!extendPrompt.trim()} onClick={() => void extendVideo()}><Sparkles size={16} /> Extend video</button>
      </Modal>}

      {upscaleOpen && <Modal title="Upscale video" onClose={() => setUpscaleOpen(false)}>
        <div className={styles.durationChoices} data-testid="studio-upscale-scales">
          {([2, 4] as const).map((scale) => {
            const supported = !!selected && selected.width * scale <= 8192 && selected.height * scale <= 8192;
            return <button key={scale} disabled={!supported} className={upscaleScale === scale ? styles.durationActive : ''} onClick={() => setUpscaleScale(scale)}>{scale}×</button>;
          })}
        </div>
        <div className={styles.priceLine}><span>Price</span><b>${customerUpscaleUSD.toFixed(2)}</b></div>
        <p className={styles.billingNote}>Real-ESRGAN restores each frame with tiled GPU inference, preserves audio, and adds the durable upscaled result to your timeline. Output: {selected ? `${selected.width * upscaleScale} × ${selected.height * upscaleScale}` : 'Not set'}.</p>
        <button data-testid="studio-upscale-submit" className={styles.modalPrimary} disabled={!canUpscaleSelected} onClick={() => void upscaleVideo()}><Maximize size={16} /> Upscale {upscaleScale}×</button>
      </Modal>}

      {restyleOpen && <Modal title={restyleModel === 'wan-animate-2' ? 'Animation Transfer' : 'Restyle video'} onClose={() => setRestyleOpen(false)}>
        <div className={styles.restyleModes} role="tablist" aria-label="Video transformation mode">
          <button role="tab" aria-selected={restyleModel === 'wan-2.2'} className={restyleModel === 'wan-2.2' ? styles.durationActive : ''} onClick={() => { setRestyleModel('wan-2.2'); setRestyleResolution('720p'); setRestyleAspect('auto'); }}>Transform</button>
          <button role="tab" aria-selected={restyleModel === 'wan-animate-2'} className={restyleModel === 'wan-animate-2' ? styles.durationActive : ''} onClick={() => { setRestyleModel('wan-animate-2'); setRestyleResolution('preview'); setRestyleDuration(5); setRestyleFPS(24); setRestyleFrames(37); setRestyleReferences((current) => current.filter((item) => item.kind === 'image').slice(0, 1)); }}>Animation Transfer</button>
          <button role="tab" aria-selected={restyleModel === 'h3-reference'} className={restyleModel === 'h3-reference' ? styles.durationActive : ''} onClick={() => { setRestyleModel('h3-reference'); setRestyleResolution('2K'); setRestyleAspect('16:9'); }}>Reference to video</button>
        </div>
        <div className={styles.restyleSource}>
          <Film size={16} /><span><small>SOURCE VIDEO</small><b>{assets.find((asset) => asset.id === restyleSourceID)?.name || 'Selected clip'}</b></span>
        </div>
        <label className={styles.field}><span>{restyleModel === 'wan-animate-2' ? 'Describe the reference subject and scene' : 'Prompt'}</span><textarea data-testid="studio-restyle-prompt" value={restylePrompt} onChange={(event) => setRestylePrompt(event.target.value)} rows={5} placeholder={restyleModel === 'wan-animate-2' ? 'A full-body dancer matching the reference image, detailed clothing, clean background…' : 'Describe the new visual style while calling references Image 1, Video 1, or Audio 1…'} /></label>
        {restyleModel === 'wan-2.2' && <label className={styles.field}><span>Negative prompt</span><textarea value={restyleNegativePrompt} onChange={(event) => setRestyleNegativePrompt(event.target.value)} rows={2} /></label>}

        {restyleModel === 'wan-2.2' ? <>
          <label className={styles.sliderRow}><span><b>Transformation strength</b><output>{restyleStrength.toFixed(2)}</output></span><input type="range" min="0.05" max="1" step="0.05" value={restyleStrength} onChange={(event) => setRestyleStrength(Number(event.target.value))} /></label>
          <div className={styles.restyleSettings}>
            <label className={styles.field}><span>Frames</span><input type="number" min="17" max="161" value={restyleFrames} onChange={(event) => setRestyleFrames(Math.max(17, Math.min(161, Number(event.target.value))))} /></label>
            <label className={styles.field}><span>FPS</span><input type="number" min="4" max="60" value={restyleFPS} onChange={(event) => setRestyleFPS(Math.max(4, Math.min(60, Number(event.target.value))))} /></label>
            <label className={styles.field}><span>Resolution</span><select value={restyleResolution} onChange={(event) => setRestyleResolution(event.target.value)}><option>480p</option><option>580p</option><option>720p</option></select></label>
            <label className={styles.field}><span>Aspect</span><select value={restyleAspect} onChange={(event) => setRestyleAspect(event.target.value)}><option value="auto">Source</option><option>16:9</option><option>9:16</option><option>1:1</option></select></label>
          </div>
        </> : restyleModel === 'wan-animate-2' ? <div className={styles.restyleSettings}>
          <label className={styles.field}><span>Duration</span><select value={restyleDuration} onChange={(event) => setRestyleDuration(Number(event.target.value))}>{[3, 5, 10, 15].map((value) => <option key={value} value={value}>{value} seconds</option>)}</select></label>
          <label className={styles.field}><span>Quality</span><select value={restyleResolution} onChange={(event) => setRestyleResolution(event.target.value)}><option value="preview">Preview</option><option value="balanced">Balanced</option><option value="high">High</option></select></label>
          <label className={styles.field}><span>FPS</span><select value={restyleFPS} onChange={(event) => setRestyleFPS(Number(event.target.value))}>{[12, 16, 24, 30].map((value) => <option key={value} value={value}>{value} fps</option>)}</select></label>
          <label className={styles.field}><span>Seed</span><input type="number" min="0" value={restyleSeed} onChange={(event) => setRestyleSeed(Math.max(0, Number(event.target.value)))} placeholder="Random" /></label>
        </div> : <div className={styles.restyleSettings}>
          <label className={styles.field}><span>Duration</span><select value={restyleDuration} onChange={(event) => setRestyleDuration(Number(event.target.value))}><option value="5">5 seconds</option><option value="10">10 seconds</option></select></label>
          <label className={styles.field}><span>Resolution</span><select value={restyleResolution} onChange={(event) => setRestyleResolution(event.target.value)}><option>768p</option><option>2K</option><option>4K</option></select></label>
          <label className={styles.field}><span>Aspect</span><select value={restyleAspect} onChange={(event) => setRestyleAspect(event.target.value)}><option>16:9</option><option>9:16</option><option>1:1</option></select></label>
          <label className={styles.field}><span>Seed</span><input type="number" min="0" value={restyleSeed} onChange={(event) => setRestyleSeed(Math.max(0, Number(event.target.value)))} placeholder="Random" /></label>
        </div>}

        <div className={styles.referenceHeader}><span><b>{restyleModel === 'wan-animate-2' ? 'Reference character' : 'Ordered references'}</b><small>{restyleModel === 'wan-animate-2' ? 'One clear, full-body image' : 'Up to 9 images, 3 videos, and 3 audio clips'}</small></span><button onClick={() => restyleReferenceInputRef.current?.click()}><Plus size={13} /> {restyleModel === 'wan-animate-2' ? 'Choose image' : 'Add files'}</button></div>
        <input ref={restyleReferenceInputRef} type="file" multiple={restyleModel !== 'wan-animate-2'} accept={restyleModel === 'wan-animate-2' ? 'image/*' : 'video/*,image/*,audio/*'} hidden onChange={(event) => { if (event.target.files) { if (restyleModel === 'wan-animate-2') setAnimationReference(event.target.files); else addRestyleReferences(event.target.files); } event.target.value = ''; }} />
        <div className={styles.referenceDrop} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (restyleModel === 'wan-animate-2') setAnimationReference(event.dataTransfer.files); else addRestyleReferences(event.dataTransfer.files); }} onClick={() => restyleReferenceInputRef.current?.click()}><Upload size={16} /><span>{restyleModel === 'wan-animate-2' ? 'Drop the character image here or choose a file' : 'Drop reference media here or choose files'}</span></div>
        {!!assets.filter((asset) => asset.id !== restyleSourceID && (restyleModel !== 'wan-animate-2' || asset.kind === 'image')).length && <div className={styles.projectReferencePicker}>
          <span>FROM THIS PROJECT</span>
          <div>{assets.filter((asset) => asset.id !== restyleSourceID && (restyleModel !== 'wan-animate-2' || asset.kind === 'image')).map((asset) => <button key={asset.id} disabled={restyleReferences.some((item) => item.id === asset.id)} onClick={() => { if (restyleModel === 'wan-animate-2') setRestyleReferences([{ id: asset.id, name: asset.name, kind: 'image', file: asset.file, url: asset.url, cloudURL: asset.cloudURL }]); else addProjectReference(asset); }}>{asset.kind === 'image' ? <ImageIcon size={12} /> : asset.kind === 'video' ? <Film size={12} /> : <AudioLines size={12} />}{asset.name}</button>)}</div>
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
        <p className={styles.billingNote}>{restyleModel === 'wan-2.2' ? `About ${(restyleFrames / restyleFPS).toFixed(1)}s output. Higher strength follows the prompt more; lower strength preserves more of the source.` : restyleModel === 'wan-animate-2' ? 'The selected video drives body motion, expression, timing, and audio. Wan Animate redraws it around the reference character image.' : 'The selected source is Video 1. References stay in the order above and can be cited by number in your prompt.'}</p>
        <div className={styles.priceLine}><span>{restyleModel === 'wan-animate-2' ? 'Estimated price' : 'Estimate'}</span><b>~{Math.ceil(restyleEstimateUSD / creditPrice)} credits · ${restyleEstimateUSD.toFixed(2)}</b></div>
        <button data-testid={restyleModel === 'wan-animate-2' ? 'studio-animation-submit' : 'studio-restyle-submit'} className={styles.modalPrimary} disabled={!restylePrompt.trim() || (restyleModel === 'wan-animate-2' && !restyleReferences.some((item) => item.kind === 'image'))} onClick={() => void generateRestyle()}><WandSparkles size={16} /> {restyleModel === 'wan-animate-2' ? 'Transfer animation' : 'Transform video'}</button>
      </Modal>}

      {audioGenerateOpen && <Modal title={audioMode === 'music' ? 'Generate music' : audioMode === 'sfx' ? 'Generate sound' : 'Text to speech'} onClose={() => { stopVoicePreview(); setAudioGenerateOpen(false); }}>
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
          <div className={styles.priceLine}><span>Price</span><b>${speechUSD.toFixed(4)}</b></div>
        </> : <>
          <label className={styles.field}><span>{audioMode === 'music' ? 'Describe the track' : 'Describe the sound'}</span><textarea data-testid="studio-audio-prompt" value={audioPrompt} onChange={(event) => setAudioPrompt(event.target.value)} rows={4} maxLength={2000} /></label>
          <div className={styles.durationChoices}>{(audioMode === 'music' ? [30, 45, 60, 90, 180] : [5, 10, 20, 30, 45]).map((duration) => <button key={duration} className={audioDuration === duration ? styles.durationActive : ''} onClick={() => setAudioDuration(duration)}>{duration}s</button>)}</div>
          <div className={styles.priceLine}><span>{audioMode === 'music' ? 'Price' : 'Estimate'}</span><b>{audioMode === 'music' ? '$0.80' : `~$${audioEstimateUSD.toFixed(2)}`}</b></div>
        </>}
        <p className={styles.billingNote}>Search and editing are free. You only pay for generation.</p>
        <button data-testid="studio-audio-generate" className={styles.modalPrimary} disabled={audioMode === 'speech' ? !speechText.trim() : !audioPrompt.trim()} onClick={() => void generateAudio()}><Sparkles size={16} /> Generate</button>
      </Modal>}

      {contextMenu && <div className={styles.contextMenuBackdrop} onPointerDown={() => setContextMenu(null)} onContextMenu={(event) => { event.preventDefault(); setContextMenu(null); }}><div data-testid="studio-context-menu" className={styles.contextMenu} style={{ left: Math.max(8, Math.min(contextMenu.x, window.innerWidth - 248)), top: Math.max(8, Math.min(contextMenu.y, window.innerHeight - 480)) }} onPointerDown={(event) => event.stopPropagation()}>{(() => {
        const asset = contextMenu.assetID ? assets.find((item) => item.id === contextMenu.assetID) : undefined;
        const audioFlavor = asset?.kind === 'audio' ? (asset.attribution?.toLowerCase().includes('music') ? 'music' : asset.attribution?.toLowerCase().match(/voice|speech/) ? 'voice' : 'sound') : '';
        return <>
          <span className={styles.contextMenuLabel}>BROWSER</span>
          <div className={styles.contextMenuRow}>
            <button data-testid="studio-context-back" title="Back" onClick={() => { setContextMenu(null); window.history.back(); }}><ArrowLeft size={15} /><span><b>Back</b></span></button>
            <button data-testid="studio-context-forward" title="Forward" onClick={() => { setContextMenu(null); window.history.forward(); }}><ArrowRight size={15} /><span><b>Forward</b></span></button>
            <button title="Reload" onClick={() => window.location.reload()}><RotateCw size={15} /><span><b>Reload</b></span></button>
          </div>
          <span className={styles.contextMenuSeparator} />
          <button disabled={!editHistory.undo.length} onClick={() => { undo(); setContextMenu(null); }}><Undo2 size={15} /><span><b>Undo edit</b><small>{editHistory.undo.length ? `${editHistory.undo.length} step${editHistory.undo.length === 1 ? '' : 's'} available` : 'No edits to undo'}</small></span></button>
          <button disabled={!editHistory.redo.length} onClick={() => { redo(); setContextMenu(null); }}><Redo2 size={15} /><span><b>Redo edit</b><small>{editHistory.redo.length ? `${editHistory.redo.length} step${editHistory.redo.length === 1 ? '' : 's'} available` : 'No edits to redo'}</small></span></button>
          <span className={styles.contextMenuSeparator} />
          {asset ? <>
            <span className={styles.contextMenuLabel}>SELECTED {asset.kind.toUpperCase()}</span>
            <button data-testid="studio-context-save-as" onClick={() => { downloadBlob(asset.file, asset.name); setNotice(`${asset.name} saved locally`); setContextMenu(null); }}><Download size={15} /><span><b>Save media as…</b><small>Download the original file</small></span></button>
            <button data-testid="studio-context-similar" onClick={() => openSimilarAsset(asset)}><Sparkles size={15} /><span><b>Make similar {asset.kind === 'audio' ? audioFlavor : asset.kind}</b><small>Open a prompt window with this starting point</small></span></button>
            {asset.kind === 'video' && <button data-testid="studio-context-animation-transfer" onClick={() => openAnimationTransfer(asset)}><Clapperboard size={15} /><span><b>Animation Transfer</b><small>Drive a reference character with this performance</small></span></button>}
            {asset.kind === 'video' && <button onClick={() => openRestyle(asset)}><WandSparkles size={15} /><span><b>Restyle video</b><small>Transform look, preserve motion</small></span></button>}
            <button onClick={() => { duplicateSelected(); setContextMenu(null); }}><Copy size={15} /><span><b>Duplicate clip</b><small>Add a copy to the timeline</small></span></button>
            <button className={styles.contextMenuDanger} onClick={() => { removeSelected(); setContextMenu(null); }}><Trash2 size={15} /><span><b>Delete clip</b><small>Undo restores it</small></span></button>
          </> : contextMenu.promptKind && contextMenu.prompt !== undefined ? <>
            <span className={styles.contextMenuLabel}>RELATED {contextMenu.promptKind.toUpperCase()}</span>
            <button data-testid="studio-context-similar" onClick={() => openPromptGenerator(contextMenu.promptKind!, contextMenu.prompt!)}><Sparkles size={15} /><span><b>Make similar {contextMenu.promptKind === 'speech' ? 'voice' : contextMenu.promptKind}</b><small>Open its prompt in the matching generator</small></span></button>
          </> : <>
            <span className={styles.contextMenuLabel}>CREATE</span>
            <button disabled={!timelineVisuals.length} onClick={() => { setExportOpen(true); setContextMenu(null); }}><Download size={15} /><span><b>Save project as…</b><small>Choose format, size, and quality</small></span></button>
            <button data-testid="studio-context-generate-image" onClick={() => { setImageGenerateOpen(true); setContextMenu(null); }}><ImageIcon size={15} /><span><b>Generate image</b><small>Open the image prompt window</small></span></button>
            <button onClick={() => { setVideoGenerateQueueStatus(''); setVideoGenerateOpen(true); setContextMenu(null); }}><Film size={15} /><span><b>Generate video</b><small>Open the video prompt window</small></span></button>
            <button data-testid="studio-context-generate-sfx" onClick={() => openAudioGenerator('sfx')}><AudioLines size={15} /><span><b>Generate sound effect</b><small>Describe a sound for the timeline</small></span></button>
            <button data-testid="studio-context-generate-music" onClick={() => openAudioGenerator('music')}><Music2 size={15} /><span><b>Generate music</b><small>Create a soundtrack in the audio window</small></span></button>
            <button data-testid="studio-context-generate-voice" onClick={() => openAudioGenerator('speech')}><Mic2 size={15} /><span><b>Generate voice</b><small>Open text to speech</small></span></button>
          </>}
        </>;
      })()}</div></div>}
      {generationContextMenu && <div className={styles.contextMenuBackdrop} onPointerDown={() => setGenerationContextMenu(null)} onContextMenu={(event) => { event.preventDefault(); setGenerationContextMenu(null); }}><div className={styles.contextMenu} style={{ left: Math.min(generationContextMenu.x, window.innerWidth - 210), top: Math.min(generationContextMenu.y, window.innerHeight - 130) }} onPointerDown={(event) => event.stopPropagation()}>{(() => {
        const generation = generationJobs.find((job) => job.job_id === generationContextMenu.jobID);
        if (!generation) return null;
        return <><span className={styles.contextMenuLabel}>BROWSER</span><div className={styles.contextMenuRow}><button title="Back" onClick={() => { setGenerationContextMenu(null); window.history.back(); }}><ArrowLeft size={15} /><span><b>Back</b></span></button><button title="Forward" onClick={() => { setGenerationContextMenu(null); window.history.forward(); }}><ArrowRight size={15} /><span><b>Forward</b></span></button><button title="Reload" onClick={() => window.location.reload()}><RotateCw size={15} /><span><b>Reload</b></span></button></div><span className={styles.contextMenuSeparator} /><span className={styles.contextMenuLabel}>GENERATION</span><button data-testid="studio-generation-copy-prompt" onClick={() => void copyGenerationPrompt(generation)}><Copy size={15} /><span><b>Copy prompt</b><small>Copy the exact text used</small></span></button><button data-testid="studio-generation-similar" onClick={() => generateSimilar(generation)}><Sparkles size={15} /><span><b>Make similar video</b><small>Open Generate with this prompt</small></span></button></>;
      })()}</div></div>}
    </main>
  );
}

function PanelEmpty() {
  return <div className={styles.panelEmpty}><MousePointer2 size={22} /><p>Select a clip to edit.</p></div>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusableElements = () => Array.from(modalRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    ) || []).filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
    const focusFrame = window.requestAnimationFrame(() => (focusableElements()[0] || modalRef.current)?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = focusableElements();
      if (!focusable.length) {
        event.preventDefault();
        modalRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !modalRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown, true);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, []);

  return <div className={styles.modalBackdrop} onMouseDown={(event) => event.currentTarget === event.target && closeRef.current()}><div ref={modalRef} className={styles.modal} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}><div className={styles.modalHeader}><h2>{title}</h2><button aria-label={`Close ${title}`} onClick={() => closeRef.current()}><X size={18} /></button></div><div className={styles.modalBody}>{children}</div></div></div>;
}
