import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Api, ApiError, type Fetch } from './api';

const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.avif': 'image/avif', '.bmp': 'image/bmp', '.tif': 'image/tiff', '.tiff': 'image/tiff', '.svg': 'image/svg+xml',
  '.heic': 'image/heic', '.exr': 'image/x-exr',
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo', '.mxf': 'video/mxf',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4',
  '.aac': 'audio/aac', '.opus': 'audio/opus',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.obj': 'model/obj', '.fbx': 'model/fbx', '.stl': 'model/stl', '.ply': 'model/ply',
};

export function contentTypeFor(file: string): string | undefined {
  return CONTENT_TYPES[extname(file).toLowerCase()];
}

export function isRemote(value: string): boolean {
  return /^(https?:|data:)/i.test(value.trim());
}

export async function uploadFile(api: Api, fetcher: Fetch, file: string): Promise<string> {
  const path = resolve(file);
  if (!existsSync(path) || !statSync(path).isFile()) throw new ApiError(`File not found: ${file}`, 0);
  const contentType = contentTypeFor(path);
  if (!contentType) throw new ApiError(`Unsupported file type: ${file} (image, video, audio or 3D model)`, 0);
  api.requireKey();
  const bytes = readFileSync(path);
  const presign = await api.request<{ upload_url: string; public_url: string }>('POST', '/api/studio/assets/presign', {
    project_id: randomUUID(),
    asset_id: randomUUID(),
    filename: basename(path),
    content_type: contentType,
    size: bytes.length,
  });
  const put = await fetcher(presign.upload_url, { method: 'PUT', headers: { 'Content-Type': contentType }, body: bytes });
  if (!put.ok) throw new ApiError(`Upload failed for ${file} (HTTP ${put.status})`, put.status);
  return presign.public_url;
}

const SKIP_KEYS = new Set(['status_url', 'response_url', 'upload_url', 'cancel_url', 'thumb_url', 'thumbnail_url', 'preview_url', 'subscribe_url', 'buy_token_url']);
const MEDIA_EXT = /\.(png|jpe?g|webp|gif|avif|bmp|tiff?|svg|exr|mp4|m4v|webm|mov|mkv|mp3|wav|flac|ogg|m4a|aac|opus|glb|gltf|obj|fbx|stl|ply|usdz|blend|cube|3dl|psd|otio|fcpxml|edl|zip|pdf|srt|vtt)$/i;

export function mediaUrls(value: unknown): string[] {
  const top = value as Record<string, unknown> | null;
  if (top && Array.isArray(top.saved_image_urls) && top.saved_image_urls.length) {
    return top.saved_image_urls.filter((u): u is string => typeof u === 'string');
  }
  const found = new Set<string>();
  const walk = (node: unknown, key: string) => {
    if (SKIP_KEYS.has(key)) return;
    if (typeof node === 'string') {
      if (/^https?:\/\//i.test(node)) {
        try {
          if (MEDIA_EXT.test(new URL(node).pathname)) found.add(node);
        } catch {}
      }
      return;
    }
    if (Array.isArray(node)) node.forEach((item) => walk(item, key));
    else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) walk(v, k);
  };
  walk(value, '');
  return [...found];
}

export async function downloadAll(fetcher: Fetch, urls: string[], outDir: string): Promise<string[]> {
  mkdirSync(outDir, { recursive: true });
  const used = new Set<string>();
  const saved: string[] = [];
  for (const [i, url] of urls.entries()) {
    let name = '';
    try {
      name = decodeURIComponent(basename(new URL(url).pathname)).replace(/[^\w.\-]+/g, '_');
    } catch {}
    if (!name) name = `output-${i + 1}`;
    if (used.has(name) || existsSync(join(outDir, name))) name = `${i + 1}-${name}`;
    used.add(name);
    const res = await fetcher(url);
    if (!res.ok) throw new ApiError(`Download failed: ${url} (HTTP ${res.status})`, res.status);
    const target = join(outDir, name);
    writeFileSync(target, Buffer.from(await res.arrayBuffer()));
    saved.push(target);
  }
  return saved;
}
