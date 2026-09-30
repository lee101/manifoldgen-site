export const MEDIA_DRAG_TYPE = 'application/x-manifold-media';
export const GALLERY_CDN_HOST = 'manifoldgenstatic.manifoldgen.com';

export type DraggedMedia = {
  kind: 'image' | 'video';
  url: string;
  name: string;
  attribution?: string;
  duration?: number;
  assetID?: string;
};

export function encodeMediaDrag(media: DraggedMedia) {
  return JSON.stringify(media);
}

export function decodeMediaDrag(raw: string): DraggedMedia | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<DraggedMedia>;
    if (value.kind !== 'image' && value.kind !== 'video') return null;
    if (typeof value.url !== 'string' || !value.url || typeof value.name !== 'string') return null;
    const duration = typeof value.duration === 'number' && Number.isFinite(value.duration) && value.duration > 0 ? value.duration : undefined;
    return {
      kind: value.kind,
      url: value.url,
      name: value.name,
      attribution: typeof value.attribution === 'string' ? value.attribution : undefined,
      duration,
      assetID: typeof value.assetID === 'string' ? value.assetID : undefined,
    };
  } catch {
    return null;
  }
}

export function galleryProxyURL(value: string) {
  try {
    const parsed = new URL(value);
    if (parsed.hostname === GALLERY_CDN_HOST && parsed.pathname.startsWith('/gallery/')) {
      return `/api/gallery-assets/${parsed.pathname.slice('/gallery/'.length)}?v=1`;
    }
  } catch {
    // Callers validate the URL; return it unchanged so their error path reports it.
  }
  return value;
}

export function mediaKindFromURL(value: string): 'image' | 'video' | 'audio' | null {
  let path = value;
  try {
    path = new URL(value, 'https://placeholder.invalid').pathname;
  } catch {
    // fall through with the raw string
  }
  if (/\.(mp4|webm|mov|m4v|mkv)$/i.test(path)) return 'video';
  if (/\.(wav|mp3|ogg|oga|opus|m4a|aac|flac)$/i.test(path)) return 'audio';
  if (/\.(png|jpe?g|webp|gif|avif|bmp)$/i.test(path)) return 'image';
  return null;
}

const placeholders = new WeakSet<File>();

export function streamingPlaceholder(name: string, type: string) {
  const file = new File([], name, { type });
  placeholders.add(file);
  return file;
}

export function isStreamingPlaceholder(file: File) {
  return placeholders.has(file);
}
