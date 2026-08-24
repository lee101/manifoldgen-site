import type { ImageAsset, MediaBundle, ManifestEntry, VideoAsset } from './types';
import manifest from './media-manifest.json';

function manifestEntries(source: unknown): Record<string, ManifestEntry> {
  if (source && typeof source === 'object' && 'entries' in source) {
    const entries: unknown = source.entries;
    if (entries && typeof entries === 'object' && !(Array.isArray(entries))) {
      return entries as Record<string, ManifestEntry>;
    }
  }
  return {};
}

const entries = manifestEntries(manifest);

const EMPTY: MediaBundle = { images: [], videos: [] };

export function mediaBundle(key: string): MediaBundle {
  const entry = entries[key];
  if (!entry) return EMPTY;
  const images: ImageAsset[] = (entry.images ?? []).map((image) => ({ kind: 'image', ...image }));
  const videos: VideoAsset[] = (entry.videos ?? []).map((video) => ({ kind: 'video', ...video }));
  return { images, videos };
}

export function galleryURL(path: string): string {
  if (path.startsWith('http')) return path;
  return `https://manifoldgenstatic.manifoldgen.com/gallery/${path.replace(/^\/?(images\/)?/, '')}`;
}
