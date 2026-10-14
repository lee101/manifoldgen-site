import {
  ALL_FORMATS,
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
  WebMOutputFormat,
  canEncodeAudio,
  canEncodeVideo,
  type VideoSample,
} from 'mediabunny';
import { DEFAULT_ADJUSTMENTS, StudioRenderer } from './studio-renderer';
import type { StudioAdjustments, StudioLUT } from './studio-grade';
import { fxAnimated } from './studio-fx/registry';
import { blendMode, clipWindow, transitionState, wipeRect, type StudioBlendMode, type StudioCrop, type StudioTransition } from './studio-composite';
import type { StudioTextStyle } from './studio-text';

export type ExportFormat = 'mp4-h264' | 'webm-vp9' | 'webm-av1';
export type ExportResolution = 'source' | '2160p' | '1440p' | '1080p' | '720p';
export type ExportFrameRate = 'source' | 24 | 30 | 60;
export type ExportQuality = 'draft' | 'balanced' | 'high';
export type ExportAudioCodec = 'aac' | 'opus';
export type ExportSettings = {
  format: ExportFormat;
  resolution: ExportResolution;
  frameRate: ExportFrameRate | number;
  quality: ExportQuality;
  audio: ExportAudioCodec;
};

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  format: 'mp4-h264',
  resolution: 'source',
  frameRate: 'source',
  quality: 'balanced',
  audio: 'aac',
};

export type StudioExportAsset = {
  id: string;
  name: string;
  kind: 'video' | 'image' | 'audio';
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
  adjustments: StudioAdjustments;
  opacity?: number;
  blendMode?: StudioBlendMode;
  crop?: StudioCrop;
  transition?: StudioTransition;
  text?: StudioTextStyle;
};

export type StudioExportDiagnostics = {
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
  frameRate?: ExportSettings['frameRate'];
  quality?: ExportQuality;
  preparedAt?: number;
  framesCompletedAt?: number;
  outputBytes?: number;
  estimatedWorkingSetBytes?: number;
  heapStartedBytes?: number;
  heapCompletedBytes?: number;
};

export type StudioExportJob = {
  visualAssets: StudioExportAsset[];
  mediaAssets: StudioExportAsset[];
  canvas: { width: number; height: number };
  duration: number;
  luts: Record<string, StudioLUT>;
  audioTrackVolume: number;
  settings: ExportSettings;
  softwareMaxSize?: { width: number; height: number };
  onProgress?: (value: number) => void;
  diagnostics?: { export?: StudioExportDiagnostics };
};

export function fitWithin(width: number, height: number, maxWidth: number, maxHeight: number) {
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

export function exportSize(width: number, height: number, resolution: ExportResolution) {
  if (resolution === 'source') return fitWithin(width, height, 4096, 4096);
  const shortEdge = Number.parseInt(resolution, 10);
  const longEdge = Math.round(shortEdge * 16 / 9);
  return width >= height
    ? fitWithin(width, height, longEdge, shortEdge)
    : fitWithin(width, height, shortEdge, longEdge);
}

export function exportFormatDetails(format: ExportFormat) {
  if (format === 'mp4-h264') return { codec: 'avc' as const, extension: 'mp4', mime: 'video/mp4', label: 'H.264' };
  if (format === 'webm-vp9') return { codec: 'vp9' as const, extension: 'webm', mime: 'video/webm', label: 'VP9' };
  return { codec: 'av1' as const, extension: 'webm', mime: 'video/webm', label: 'AV1' };
}

export function outputFrameRate(frameRate: ExportSettings['frameRate']) {
  return frameRate === 'source' ? 30 : frameRate;
}

export function clipDuration(asset: { trimStart: number; trimEnd: number }) {
  return Math.max(0, asset.trimEnd - asset.trimStart);
}

export function clipEnd(asset: { timelineStart: number; trimStart: number; trimEnd: number }) {
  return asset.timelineStart + clipDuration(asset);
}

export function timelineComposition<T extends { kind: 'video' | 'image' | 'audio'; timelineStart: number; trimStart: number; trimEnd: number; visualTrack: number }>(assets: T[]) {
  const visuals = assets.filter((asset) => asset.kind !== 'audio');
  const base = [...visuals].sort((left, right) => left.timelineStart - right.timelineStart || left.visualTrack - right.visualTrack)[0] || null;
  return { visuals, base, duration: Math.max(1, ...assets.map(clipEnd)) };
}

export async function renderTimelineAudio(timelineAssets: StudioExportAsset[], duration: number, audioTrackVolume = 1) {
  const decoder = new AudioContext();
  const offline = new OfflineAudioContext(2, Math.max(1, Math.ceil(duration * 48_000)), 48_000);
  let scheduled = 0;
  const schedule = async (asset: StudioExportAsset, start: number, offset: number, length: number) => {
    try {
      const decoded = await decoder.decodeAudioData(await asset.file.arrayBuffer());
      const available = Math.min(length, decoded.duration - offset, duration - start);
      if (available <= 0) return;
      const source = offline.createBufferSource(); source.buffer = decoded;
      const gain = offline.createGain();
      const fadeIn = Math.min(asset.fadeIn, available / 2);
      const fadeOut = Math.min(asset.fadeOut, available / 2);
      const volume = asset.volume * (asset.kind === 'audio' ? audioTrackVolume : 1);
      gain.gain.setValueAtTime(fadeIn > 0 ? 0 : volume, start);
      if (fadeIn > 0) gain.gain.linearRampToValueAtTime(volume, start + fadeIn);
      if (fadeOut > 0) {
        gain.gain.setValueAtTime(volume, start + available - fadeOut);
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

export async function renderStudioVideo(job: StudioExportJob) {
  const { visualAssets, mediaAssets, settings, luts, audioTrackVolume } = job;
  const diagnostics = job.diagnostics || {};
  const onProgress = job.onProgress || (() => undefined);
  onProgress(0.01);
  let output: Output | null = null;
  // Chrome caps a page at ~16 live WebGL contexts and silently force-loses
  // the oldest ones beyond that. Giving every clip its own StudioRenderer
  // made long timelines export black segments for exactly those evicted
  // clips (draw() no-ops and readPixels returns zeros without throwing), so
  // all clips share one GL context; each frame's draws are sequential, so
  // nothing needs to stay resident between clips.
  const sharedCanvas = document.createElement('canvas');
  const sharedRenderer = new StudioRenderer(sharedCanvas, { preserveDrawingBuffer: true });
  const sharedRaster = document.createElement('canvas');
  const sharedRasterContext = sharedRaster.getContext('2d', { alpha: true });
  const lutFor = (asset: StudioExportAsset) => (asset.adjustments.lutID ? luts[asset.adjustments.lutID] || null : null);
  let sharedContextLost = false;
  sharedCanvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    sharedContextLost = true;
  });
  type ExportVisualState = {
    asset: StudioExportAsset;
    /** Images composite from a persistent raster; videos share sharedRaster. */
    rasterCanvas: HTMLCanvasElement | null;
    /** Glitched stills retain their source so the shader can animate them. */
    imageSource: HTMLImageElement | null;
    input: Input | null;
    iterator: AsyncIterator<VideoSample> | null;
    current: VideoSample | null;
    next: VideoSample | null;
  };
  const resizeSharedRaster = (sourceWidth: number, sourceHeight: number) => {
    sharedRenderer.resize(sourceWidth, sourceHeight);
    if (sharedRaster.width !== sharedCanvas.width) sharedRaster.width = sharedCanvas.width;
    if (sharedRaster.height !== sharedCanvas.height) sharedRaster.height = sharedCanvas.height;
  };
  const visualStates: ExportVisualState[] = [];
  let antiAliasRenderer: StudioRenderer | null = null;
  try {
    const format = exportFormatDetails(settings.format);
    const codec = format.codec;
    const sourceCanvas = job.canvas;
    const requestedSize = exportSize(sourceCanvas.width, sourceCanvas.height, settings.resolution);
    const qualityLevel = settings.quality === 'draft' ? 'medium' : settings.quality === 'high' ? 'very-high' : 'high';
    const requestedQuality = new Quality(qualityLevel);
    const hardwareSupported = await canEncodeVideo(codec, { ...requestedSize, quality: requestedQuality, hardwareAcceleration: 'prefer-hardware' });
    // Software WebCodecs at 2K can be slower than 0.1x realtime. Keep full
    // 2K/4K when a hardware encoder is exposed and use a 1080p safety path
    // otherwise, so export never wedges a laptop for minutes per second.
    const softwareMax = job.softwareMaxSize || { width: 1920, height: 1080 };
    const softwareSafeSize = fitWithin(requestedSize.width, requestedSize.height, softwareMax.width, softwareMax.height);
    const { width, height } = hardwareSupported ? requestedSize : softwareSafeSize;
    const quality = hardwareSupported ? requestedQuality : new Quality(settings.quality === 'high' ? 'high' : qualityLevel);
    const hardwareAcceleration = hardwareSupported
      ? 'prefer-hardware' as const
      : 'no-preference' as const;
    if (!(await canEncodeVideo(codec, { width, height, quality, hardwareAcceleration }))) {
      throw new Error(`${format.label} encoding is not available in this browser`);
    }
    const performanceWithMemory = performance as Performance & { memory?: { usedJSHeapSize?: number } };
    diagnostics.export = {
      sourceWidth: sourceCanvas.width, sourceHeight: sourceCanvas.height, width, height,
      hardwareAcceleration, hardwareRequested: 'prefer-hardware', startedAt: performance.now(),
      format: settings.format, frameRate: settings.frameRate, quality: settings.quality,
      heapStartedBytes: performanceWithMemory.memory?.usedJSHeapSize,
    };
    const duration = job.duration;

    const workCanvas = document.createElement('canvas');
    workCanvas.width = width;
    workCanvas.height = height;
    const compositor = workCanvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!compositor) throw new Error('This browser cannot start the timeline compositor');
    compositor.imageSmoothingEnabled = true;
    compositor.imageSmoothingQuality = 'high';
    if (!sharedRasterContext) throw new Error('This browser cannot prepare the export frame buffer');

    // Editable text starts as a crisp transparent PNG, but the 2D
    // compositor has to resample it when it is rotated. A final, tiny FXAA
    // pass repairs those diagonal glyph edges without changing ordinary
    // photo/video exports or adding an export control users need to manage.
    const needsTextAntiAlias = visualAssets.some((asset) => asset.text && Math.abs(asset.stageRotation % 90) > 0.01);
    const exportCanvas = needsTextAntiAlias ? document.createElement('canvas') : workCanvas;
    if (needsTextAntiAlias) {
      exportCanvas.width = width;
      exportCanvas.height = height;
      antiAliasRenderer = new StudioRenderer(exportCanvas, { preserveDrawingBuffer: true });
      antiAliasRenderer.resize(width, height);
    }

    for (const asset of visualAssets) {
      const state: ExportVisualState = { asset, rasterCanvas: null, imageSource: null, input: null, iterator: null, current: null, next: null };
      if (asset.kind === 'image') {
        const image = new Image();
        image.src = asset.url;
        await image.decode();
        if (asset.adjustments.glitchAmount > 0 || fxAnimated(asset.adjustments.fx)) {
          state.imageSource = image;
        } else {
          resizeSharedRaster(asset.width, asset.height);
          sharedRenderer.draw(image, asset.adjustments, 0, { time: 0, lut: lutFor(asset), stateKey: asset.id });
          // Ordinary images filter once and keep a persistent raster. An
          // animated glitch still instead goes through the shared renderer
          // per output frame below, just like video.
          const rasterCanvas = document.createElement('canvas');
          rasterCanvas.width = sharedRaster.width;
          rasterCanvas.height = sharedRaster.height;
          sharedRenderer.copyToCanvas(sharedRasterContext);
          rasterCanvas.getContext('2d')?.drawImage(sharedRaster, 0, 0);
          state.rasterCanvas = rasterCanvas;
        }
      } else {
        state.input = new Input({ source: new BlobSource(asset.file), formats: ALL_FORMATS });
        const track = await state.input.getPrimaryVideoTrack();
        if (!track || !(await track.canDecode())) throw new Error(`${asset.name} cannot be decoded in this browser`);
        const sink = new VideoSampleSink(track, { optimizeForLatency: true });
        const span = clipWindow(asset, visualAssets);
        state.iterator = sink.samples(Math.max(0, asset.trimStart - span.handleIn), Math.min(asset.duration, asset.trimEnd + span.handleOut))[Symbol.asyncIterator]();
        const first = await state.iterator.next();
        state.next = first.done ? null : first.value;
      }
      visualStates.push(state);
    }

    const exportDiagnostics = diagnostics.export;
    if (exportDiagnostics) {
      const outputCanvases = needsTextAntiAlias ? 2 : 1;
      exportDiagnostics.estimatedWorkingSetBytes = width * height * 4 * (outputCanvases + 1)
        + visualStates.reduce((total, state) => total + (state.rasterCanvas ? state.rasterCanvas.width * state.rasterCanvas.height * 4 : 0), 0);
    }

    const target = new BufferTarget();
    output = new Output({
      format: settings.format.startsWith('webm-') ? new WebMOutputFormat() : new Mp4OutputFormat({ fastStart: 'in-memory' }),
      target,
    });
    const videoSource = new CanvasSource(exportCanvas, {
      codec, quality, hardwareAcceleration,
      latencyMode: hardwareSupported ? 'quality' : 'realtime',
      contentHint: 'motion',
    });
    output.addVideoTrack(videoSource);

    let audioSource: AudioSampleSource | null = null;
    const audioCodec: ExportAudioCodec = !settings.format.startsWith('webm-') && settings.audio === 'aac' && (await canEncodeAudio('aac'))
      ? 'aac'
      : 'opus';
    const mixedAudio = mediaAssets.some((asset) => asset.kind !== 'image') ? await renderTimelineAudio(mediaAssets, duration, audioTrackVolume) : null;
    if (mixedAudio) {
      if (!(await canEncodeAudio(audioCodec))) throw new Error(`${audioCodec.toUpperCase()} audio encoding is not available in this browser`);
      audioSource = new AudioSampleSource({ codec: audioCodec, quality: new Quality('high') });
      output.addAudioTrack(audioSource);
    }

    await output.start();
    if (diagnostics.export) diagnostics.export.preparedAt = performance.now();
    // A mixed timeline has no single source cadence. "Source" therefore uses
    // a deterministic 30 fps clock; explicit 24/30/60 choices stay exact.
    const outputFPS = outputFrameRate(settings.frameRate);
    const frameDuration = 1 / outputFPS;
    const frames = Math.max(1, Math.ceil(duration * outputFPS));
    const orderedStates = [...visualStates].sort((left, right) => left.asset.visualTrack - right.asset.visualTrack || left.asset.timelineStart - right.asset.timelineStart || visualAssets.indexOf(left.asset) - visualAssets.indexOf(right.asset));

    for (let index = 0; index < frames; index += 1) {
      const timestamp = index * frameDuration;
      compositor.setTransform(1, 0, 0, 1, 0, 0);
      compositor.fillStyle = '#000';
      compositor.fillRect(0, 0, width, height);
      for (const state of orderedStates) {
        const { asset } = state;
        const transition = transitionState(asset, visualAssets, timestamp);
        if (!transition) continue;
        if (state.imageSource) {
          if (sharedContextLost) throw new Error('The graphics context was lost during export. Retry the export once other graphics-heavy tabs are closed.');
          resizeSharedRaster(asset.width, asset.height);
          sharedRenderer.draw(state.imageSource, asset.adjustments, timestamp * 24, { time: timestamp - asset.timelineStart, lut: lutFor(asset), stateKey: asset.id });
          sharedRenderer.copyToCanvas(sharedRasterContext!);
        } else if (asset.kind === 'video') {
          const sourceTime = Math.max(0, Math.min(asset.duration, asset.trimStart + timestamp - asset.timelineStart));
          while (state.next && state.next.timestamp <= sourceTime + 1e-7) {
            state.current?.close();
            state.current = state.next;
            const following = await state.iterator!.next();
            state.next = following.done ? null : following.value;
          }
          const sample = state.current || state.next;
          if (!sample) continue;
          if (sharedContextLost) throw new Error('The graphics context was lost during export. Retry the export once other graphics-heavy tabs are closed.');
          resizeSharedRaster(asset.width, asset.height);
          const frame = sample.toVideoFrame();
          sharedRenderer.draw(frame, asset.adjustments, timestamp * 24, { time: sourceTime - asset.trimStart, lut: lutFor(asset), stateKey: asset.id });
          sharedRenderer.copyToCanvas(sharedRasterContext!);
          frame.close();
        }
        const fit = Math.min(width / Math.max(1, asset.width), height / Math.max(1, asset.height));
        const drawWidth = asset.width * fit * asset.stageScale;
        const drawHeight = asset.height * fit * asset.stageScale;
        const raster = state.rasterCanvas ?? sharedRaster;
        const crop = asset.crop || { left: 0, top: 0, right: 0, bottom: 0 };
        compositor.save();
        compositor.globalAlpha = Math.max(0, Math.min(1, (asset.opacity ?? 1) * transition.alpha));
        compositor.globalCompositeOperation = blendMode(asset.blendMode).canvas;
        compositor.translate(width * (0.5 + asset.stageX), height * (0.5 + asset.stageY));
        compositor.rotate(asset.stageRotation * Math.PI / 180);
        if (transition.wipe) {
          const rect = wipeRect(transition.wipe.type, transition.wipe.progress, drawWidth, drawHeight);
          compositor.beginPath();
          compositor.rect(rect.x - drawWidth / 2, rect.y - drawHeight / 2, rect.width, rect.height);
          compositor.clip();
        }
        const sourceWidth = raster.width * (1 - crop.left - crop.right);
        const sourceHeight = raster.height * (1 - crop.top - crop.bottom);
        if (sourceWidth >= 1 && sourceHeight >= 1) {
          compositor.drawImage(raster, raster.width * crop.left, raster.height * crop.top, sourceWidth, sourceHeight,
            -drawWidth / 2 + drawWidth * crop.left, -drawHeight / 2 + drawHeight * crop.top, drawWidth * (1 - crop.left - crop.right), drawHeight * (1 - crop.top - crop.bottom));
        }
        compositor.restore();
      }
      if (antiAliasRenderer) antiAliasRenderer.draw(workCanvas, DEFAULT_ADJUSTMENTS, index, { fxaa: true });
      await videoSource.add(timestamp, Math.min(frameDuration, duration - timestamp), { keyFrame: index % (outputFPS * 2) === 0 });
      onProgress(Math.min(0.9, (index + 1) / frames * 0.9));
    }

    if (diagnostics.export) diagnostics.export.framesCompletedAt = performance.now();

    if (audioSource && mixedAudio) {
      for (const sample of AudioSample.fromAudioBuffer(mixedAudio, 0)) {
        await audioSource.add(sample);
        sample.close();
      }
    }
    await output.finalize();
    if (diagnostics.export) {
      diagnostics.export.completedAt = performance.now();
      diagnostics.export.frames = frames;
      diagnostics.export.outputBytes = target.buffer?.byteLength || 0;
      diagnostics.export.heapCompletedBytes = performanceWithMemory.memory?.usedJSHeapSize;
    }
    onProgress(1);
    return new Blob([target.buffer!], { type: format.mime });
  } catch (reason) {
    await output?.cancel().catch(() => undefined);
    throw reason;
  } finally {
    for (const state of visualStates) {
      state.current?.close();
      state.next?.close();
      state.input?.dispose();
    }
    sharedRenderer.destroy();
    antiAliasRenderer?.destroy();
  }
}
