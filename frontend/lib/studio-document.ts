import { DEFAULT_ADJUSTMENTS } from './studio-grade';
import type { PortableStudioAsset, PortableStudioDocument, PortableStudioLUT } from './studio-projects';
import type { StudioTextStyle } from './studio-text';

export type DesignSize = { width: number; height: number };

export const DEFAULT_DESIGN_SIZE: DesignSize = { width: 1920, height: 1080 };
export const MIN_DESIGN_EDGE = 64;
export const MAX_DESIGN_EDGE = 8192;

export function normalizeDesignSize(value: Partial<DesignSize> | undefined, fallback = DEFAULT_DESIGN_SIZE): DesignSize {
  const width = Number(value?.width);
  const height = Number(value?.height);
  return {
    width: Number.isFinite(width) ? Math.max(MIN_DESIGN_EDGE, Math.min(MAX_DESIGN_EDGE, Math.round(width))) : fallback.width,
    height: Number.isFinite(height) ? Math.max(MIN_DESIGN_EDGE, Math.min(MAX_DESIGN_EDGE, Math.round(height))) : fallback.height,
  };
}

export function documentDesignSize(document: Pick<PortableStudioDocument, 'canvas'>, assets: { kind: string; width: number; height: number }[]) {
  const inferred = assets.find((asset) => asset.kind !== 'audio');
  return normalizeDesignSize(document.canvas, inferred ? normalizeDesignSize({ width: inferred.width, height: inferred.height }) : DEFAULT_DESIGN_SIZE);
}

export function documentAudioTrackVolume(document: Pick<PortableStudioDocument, 'audioTrackVolume'>) {
  return Math.max(0, Math.min(2, document.audioTrackVolume ?? 1));
}

export function materializeStudioAsset(stored: PortableStudioAsset, file: File) {
  return {
    ...stored,
    mediaID: stored.mediaID || stored.id,
    visualTrack: stored.kind === 'audio' ? 0 : Math.max(0, Math.floor(stored.visualTrack || 0)),
    stageScale: Math.max(0.1, Math.min(4, stored.stageScale ?? 1)),
    stageRotation: stored.stageRotation ?? 0,
    file,
    url: URL.createObjectURL(file),
    adjustments: { ...DEFAULT_ADJUSTMENTS, ...stored.adjustments },
  };
}

export const STUDIO_DOCUMENT_KEYS = {
  version: true, selectedID: true, assets: true, canvas: true, luts: true, audioTrackVolume: true, history: true,
} satisfies Record<keyof PortableStudioDocument, true>;

export const STUDIO_ASSET_KEYS = {
  id: true, mediaID: true, name: true, kind: true, duration: true, width: true, height: true,
  trimStart: true, trimEnd: true, timelineStart: true, visualTrack: true, volume: true, fadeIn: true, fadeOut: true,
  sourceAudioMuted: true, stageX: true, stageY: true, stageScale: true, stageRotation: true, attribution: true,
  adjustments: true, opacity: true, blendMode: true, crop: true, transition: true, cloudURL: true, objectKey: true,
  previewURL: true, contentType: true, size: true, lastModified: true, text: true,
} satisfies Record<keyof PortableStudioAsset, true>;

export const STUDIO_TEXT_KEYS = {
  content: true, fontSize: true, fontFamily: true, fontWeight: true, color: true, align: true,
} satisfies Record<keyof StudioTextStyle, true>;

export const STUDIO_LUT_KEYS = { name: true, size: true, data: true } satisfies Record<keyof PortableStudioLUT, true>;
