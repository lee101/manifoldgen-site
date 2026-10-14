import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Api, ApiError, type Fetch } from './api';
import { isRemote, uploadFile } from './media';

type Doc = { assets?: { cloudURL?: unknown }[]; luts?: Record<string, { url?: unknown; cube?: unknown }>; [key: string]: unknown };

export function readTimeline(file: string): { document: Doc; base: string } {
  const path = resolve(file);
  if (!existsSync(path)) throw new ApiError(`File not found: ${file}`, 0);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    throw new ApiError(`${file} is not valid JSON: ${(err as Error).message}`, 0);
  }
  const value = parsed as Doc & { document?: Doc };
  const document = value && typeof value === 'object' && value.document && typeof value.document === 'object' ? value.document : value;
  if (!document || typeof document !== 'object' || !Array.isArray(document.assets)) throw new ApiError(`${file} needs an assets array (see https://manifoldgen.com/api/studio/schema)`, 0);
  return { document, base: dirname(path) };
}

export function localTimelineFiles(document: Doc, base: string): string[] {
  const files = new Set<string>();
  for (const asset of document.assets || []) {
    if (typeof asset.cloudURL === 'string' && asset.cloudURL && !isRemote(asset.cloudURL)) files.add(resolve(base, asset.cloudURL));
  }
  return [...files];
}

export async function prepareTimeline(api: Api, fetcher: Fetch, file: string, log: (s: string) => void): Promise<Doc> {
  const { document, base } = readTimeline(file);
  const uploaded = new Map<string, string>();
  for (const asset of document.assets || []) {
    if (typeof asset.cloudURL !== 'string' || !asset.cloudURL || isRemote(asset.cloudURL)) continue;
    const path = resolve(base, asset.cloudURL);
    if (!uploaded.has(path)) {
      log(`uploading ${asset.cloudURL}`);
      uploaded.set(path, await uploadFile(api, fetcher, path));
    }
    asset.cloudURL = uploaded.get(path);
  }
  for (const lut of Object.values(document.luts || {})) {
    if (lut && typeof lut.url === 'string' && !isRemote(lut.url)) {
      const path = resolve(base, lut.url);
      if (!existsSync(path)) throw new ApiError(`LUT not found: ${lut.url}`, 0);
      lut.cube = readFileSync(path, 'utf8');
      delete lut.url;
    }
  }
  return document;
}
