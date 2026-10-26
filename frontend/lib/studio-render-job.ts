import { decodeStudioLUTs, migrateStudioDocument, type PortableStudioDocument } from './studio-projects';
import { DEFAULT_EXPORT_SETTINGS, renderStudioVideo, timelineComposition, type ExportFormat, type ExportQuality, type ExportResolution, type ExportSettings } from './studio-export';
import { documentAudioTrackVolume, documentDesignSize, materializeStudioAsset } from './studio-document';
import { stackOverlappingVisuals } from './studio-timeline-ops';
import { renderTextFile } from './studio-text';

export type StudioRenderSettings = Partial<ExportSettings> & { softwareMaxSize?: { width: number; height: number } };
export type StudioRenderRequest = { document: PortableStudioDocument; settings?: StudioRenderSettings };
export type StudioRenderOptions = { base: string; sameOrigin: boolean; onProgress?: (value: number) => void };

const FORMATS: ExportFormat[] = ['mp4-h264', 'webm-vp9', 'webm-av1'];
const RESOLUTIONS: ExportResolution[] = ['source', '2160p', '1440p', '1080p', '720p'];
const QUALITIES: ExportQuality[] = ['draft', 'balanced', 'high'];

export function renderSettings(input: StudioRenderSettings = {}): ExportSettings {
  const fps = Number(input.frameRate);
  return {
    format: FORMATS.includes(input.format as ExportFormat) ? input.format as ExportFormat : DEFAULT_EXPORT_SETTINGS.format,
    resolution: RESOLUTIONS.includes(input.resolution as ExportResolution) ? input.resolution as ExportResolution : DEFAULT_EXPORT_SETTINGS.resolution,
    frameRate: Number.isInteger(fps) && fps >= 1 && fps <= 60 ? fps : DEFAULT_EXPORT_SETTINGS.frameRate,
    quality: QUALITIES.includes(input.quality as ExportQuality) ? input.quality as ExportQuality : DEFAULT_EXPORT_SETTINGS.quality,
    audio: input.audio === 'opus' ? 'opus' : 'aac',
  };
}

export function renderMediaURL(raw: string, base: string, sameOrigin: boolean) {
  const url = new URL(raw, base);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error(`Unsupported media URL ${url.protocol}`);
  if (sameOrigin && url.origin !== new URL(base).origin) throw new Error('Media must be served by the render host');
  return url;
}

export function softwareMaxSize(value: StudioRenderSettings['softwareMaxSize']) {
  if (!value) return undefined;
  const width = Math.round(Number(value.width));
  const height = Math.round(Number(value.height));
  return width >= 16 && height >= 16 && width <= 4096 && height <= 4096 ? { width, height } : undefined;
}

export async function renderStudioDocument(request: StudioRenderRequest, options: StudioRenderOptions) {
  const document = migrateStudioDocument(request.document);
  const luts = decodeStudioLUTs(document.luts);
  const assets = [];
  for (const stored of document.assets) {
    let file: File | null = null;
    if (stored.cloudURL) {
      const response = await fetch(renderMediaURL(stored.cloudURL, options.base, options.sameOrigin), { credentials: 'omit' });
      if (!response.ok) throw new Error(`Could not download ${stored.name}`);
      const blob = await response.blob();
      file = new File([blob], stored.name, { type: stored.contentType || blob.type, lastModified: stored.lastModified });
    } else if (stored.text) {
      file = await renderTextFile(stored.text);
    }
    if (file) assets.push(materializeStudioAsset(stored, file));
  }
  const stacked = stackOverlappingVisuals(assets);
  try {
    const { visuals, duration } = timelineComposition(stacked);
    if (!visuals.length) throw new Error('Add an image or video to the timeline first');
    return await renderStudioVideo({
      visualAssets: visuals,
      mediaAssets: stacked,
      canvas: documentDesignSize(document, stacked),
      duration,
      luts,
      audioTrackVolume: documentAudioTrackVolume(document),
      settings: renderSettings(request.settings),
      softwareMaxSize: softwareMaxSize(request.settings?.softwareMaxSize),
      onProgress: options.onProgress,
    });
  } finally {
    stacked.forEach((asset) => URL.revokeObjectURL(asset.url));
  }
}

export async function blobChunks(blob: Blob, size = 1 << 20) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += size) {
    let binary = '';
    const slice = bytes.subarray(offset, offset + size);
    for (let index = 0; index < slice.length; index += 0x8000) binary += String.fromCharCode(...slice.subarray(index, index + 0x8000));
    chunks.push(btoa(binary));
  }
  return chunks;
}
