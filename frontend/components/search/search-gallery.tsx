'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export interface SearchImage {
  id: string;
  prompt: string;
  width?: number;
  height?: number;
  thumb_url?: string;
  image_url?: string;
}

const GALLERY_CDN = 'https://manifoldgenstatic.manifoldgen.com/gallery';
const GALLERY_ASSET_VERSION = '20260817-gallery-index-refresh';

function galleryImageURL(value?: string) {
  const cacheBusted = (url: string) => `${url}${url.includes('?') ? '&' : '?'}v=${GALLERY_ASSET_VERSION}`;
  const path = (value || '').trim();
  if (!path) return undefined;
  if (path.startsWith(`${GALLERY_CDN}/`)) return cacheBusted(path);
  if (/^https?:\/\//i.test(path)) {
    try {
      const parsed = new URL(path);
      if (parsed.pathname.startsWith('/gallery/')) return cacheBusted(`${GALLERY_CDN}${parsed.pathname.slice('/gallery'.length)}${parsed.search}`);
      if (!parsed.pathname.startsWith('/images/')) return path;
      return cacheBusted(`${GALLERY_CDN}/${parsed.pathname.slice('/images/'.length)}${parsed.search}`);
    } catch {
      return path;
    }
  }
  return cacheBusted(`${GALLERY_CDN}/${path.replace(/^\/?(?:images\/)?(?:gallery\/)?/, '')}`);
}

export function normalizeSearchImages(rows: SearchImage[]): SearchImage[] {
  return rows.map((img) => ({
    ...img,
    thumb_url: galleryImageURL(img.thumb_url),
    image_url: galleryImageURL(img.image_url),
  }));
}

type LoadState = 'ready' | 'loading' | 'error';

export default function SearchGallery({ query, initial }: { query: string; initial?: SearchImage[] }) {
  const [images, setImages] = useState<SearchImage[]>(() => (initial ? normalizeSearchImages(initial).slice(0, 24) : []));
  const [state, setState] = useState<LoadState>(initial ? 'ready' : 'loading');

  useEffect(() => {
    if (initial) return;
    let alive = true;
    fetch(`/api/images/semantic?q=${encodeURIComponent(query)}&top_k=24`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => {
        if (!alive) return;
        setImages(normalizeSearchImages(data.results || data.images || []).slice(0, 24));
        setState('ready');
      })
      .catch(() => {
        if (alive) setState('error');
      });
    return () => {
      alive = false;
    };
  }, [initial, query]);

  if (state === 'loading') {
    return (
      <div className="grid grid-cols-2 gap-[1px] bg-black sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="aspect-[3/4] animate-pulse bg-white/[0.04]" />
        ))}
      </div>
    );
  }

  if (state === 'error' || images.length === 0) {
    return (
      <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-6 text-sm text-white/60">
        Live results are unavailable right now. Try again from the{' '}
        <Link href="/" className="underline decoration-white/30 underline-offset-4 hover:text-white">homepage search</Link>.
      </p>
    );
  }

  return (
    <>
      <p className="pb-3 text-xs uppercase tracking-[0.16em] text-white/45">{images.length} images</p>
      <div className="grid grid-cols-2 gap-[1px] bg-black sm:grid-cols-3 lg:grid-cols-4">
        {images.map((img) => {
          const src = img.thumb_url || img.image_url;
          if (!src) return null;
          const ratio = img.width && img.height ? `${img.width} / ${img.height}` : '3 / 4';
          return (
            <Link
              key={img.id}
              href={`/studio?image_url=${encodeURIComponent(img.image_url || src)}&name=${encodeURIComponent(img.prompt.slice(0, 80))}`}
              className="group relative overflow-hidden bg-[#0c0c12]"
              title={img.prompt}
              style={{ aspectRatio: ratio }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={img.prompt.slice(0, 120)}
                width={img.width || 768}
                height={img.height || 1024}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden bg-gradient-to-t from-black/85 to-transparent p-3 pt-10 text-left text-xs leading-snug text-white/90 opacity-0 transition group-hover:opacity-100 sm:block sm:line-clamp-2 md:text-sm">
                {img.prompt.slice(0, 140)}
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
