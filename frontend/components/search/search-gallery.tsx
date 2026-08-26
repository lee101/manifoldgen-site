'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Clapperboard, Copy, Download, ExternalLink, RotateCw } from 'lucide-react';
import { ContextMenuItem, MediaContextMenu, copyImageToClipboard, copyText, createLongPressRegistry, downloadMedia } from '../media-action-sheet';

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

function studioHref(img: SearchImage) {
  return `/studio?image_url=${encodeURIComponent(img.image_url || img.thumb_url || '')}&name=${encodeURIComponent(img.prompt.slice(0, 80))}`;
}

const PAGE_SIZE = 48;
const FIRST_PAGE = 24;

export default function SearchGallery({ query, initial }: { query: string; initial?: SearchImage[] }) {
  const [images, setImages] = useState<SearchImage[]>(() => (initial ? normalizeSearchImages(initial).slice(0, FIRST_PAGE) : []));
  const [state, setState] = useState<LoadState>(initial ? 'ready' : 'loading');
  const [fetching, setFetching] = useState(false);
  const [menuImage, setMenuImage] = useState<{ img: SearchImage; x: number; y: number } | null>(null);
  const exhausted = useRef(false);
  const inFlight = useRef(false);
  const offsetRef = useRef(initial ? Math.min(initial.length, FIRST_PAGE) : 0);
  const seen = useRef<Set<string>>(new Set());
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const menuPress = useMemo(
    () => createLongPressRegistry((img: SearchImage, at) => setMenuImage({ img, x: at.x, y: at.y })),
    [],
  );

  const mergeImages = useCallback((rows: SearchImage[]) => {
    const fresh = rows.filter((img) => img.id && !seen.current.has(img.id));
    for (const img of fresh) seen.current.add(img.id);
    if (fresh.length) setImages((prev) => [...prev, ...fresh]);
  }, []);

  const loadMore = useCallback(async () => {
    if (inFlight.current || exhausted.current) return;
    inFlight.current = true;
    setFetching(true);
    try {
      const res = await fetch(
        `/api/images/semantic?q=${encodeURIComponent(query)}&top_k=${PAGE_SIZE}&offset=${offsetRef.current}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const rows: SearchImage[] = normalizeSearchImages(data.results || data.images || []);
      offsetRef.current += PAGE_SIZE;
      mergeImages(rows);
      if (data.has_more === false || rows.length === 0) exhausted.current = true;
    } catch {
      // Network hiccup: allow a retry on the next intersection instead of
      // permanently disabling the feed.
    } finally {
      inFlight.current = false;
      setFetching(false);
      // Appending results can leave the sentinel inside the observer's margin
      // without a new intersection transition, so re-check it explicitly.
      const node = sentinelRef.current;
      if (node && !exhausted.current) {
        const rect = node.getBoundingClientRect();
        if (rect.top < window.innerHeight + 1600 && rect.bottom > -1600) {
          window.setTimeout(() => void loadMore(), 40);
        }
      }
    }
  }, [mergeImages, query]);

  useEffect(() => {
    const onScroll = () => {
      const node = sentinelRef.current;
      if (!node || exhausted.current || inFlight.current) return;
      const rect = node.getBoundingClientRect();
      if (rect.top < window.innerHeight + 1600 && rect.bottom > -1600) void loadMore();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [loadMore]);

  useEffect(() => {
    if (initial) return;
    let alive = true;
    fetch(`/api/images/semantic?q=${encodeURIComponent(query)}&top_k=${FIRST_PAGE}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => {
        if (!alive) return;
        const rows = normalizeSearchImages(data.results || data.images || []).slice(0, FIRST_PAGE);
        for (const img of rows) seen.current.add(img.id);
        setImages(rows);
        setState('ready');
      })
      .catch(() => {
        if (alive) setState('error');
      });
    return () => {
      alive = false;
    };
  }, [initial, query]);

  useEffect(() => {
    void loadMore();
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { rootMargin: '1600px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore]);

  if (state === 'loading') {
    return (
      <div className="grid grid-cols-2 gap-[1px] bg-black sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8">
        {Array.from({ length: 16 }, (_, i) => (
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
      <div className="grid grid-cols-2 gap-[1px] bg-black sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8">
        {images.map((img) => {
          const src = img.thumb_url || img.image_url;
          if (!src) return null;
          const ratio = img.width && img.height ? `${img.width} / ${img.height}` : '3 / 4';
          return (
            <Link
              key={img.id}
              href={studioHref(img)}
              className="group relative overflow-hidden bg-[#0c0c12]"
              title={img.prompt}
              style={{ aspectRatio: ratio }}
              {...menuPress(img)}
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
      <div ref={sentinelRef} aria-hidden className="h-px w-full" />
      <div className="flex justify-center py-8">
        {fetching ? (
          <span className="text-xs uppercase tracking-[0.16em] text-white/45">Loading more…</span>
        ) : exhausted.current ? null : (
          <button
            type="button"
            onClick={() => void loadMore()}
            className="rounded-full border border-white/20 px-5 py-2 text-sm text-white/75 transition hover:border-white/40 hover:text-white"
          >
            Load more
          </button>
        )}
      </div>
      {menuImage && (() => {
        const src = menuImage.img.image_url || menuImage.img.thumb_url || '';
        const imageItems: ContextMenuItem[] = [];
        if (src) {
          imageItems.push(
            { label: 'Copy image', detail: 'Paste into any app or post', icon: <Copy size={15} />, onClick: () => void copyImageToClipboard(src) },
            { label: 'Open image', detail: 'Full resolution in a new tab', icon: <ExternalLink size={15} />, onClick: () => window.open(src, '_blank', 'noopener') },
            { label: 'Download image', detail: 'Save the original file', icon: <Download size={15} />, onClick: () => downloadMedia(src) },
          );
        }
        imageItems.push(
          { label: 'Copy prompt', detail: 'Paste it into any generator', icon: <Copy size={15} />, onClick: () => void copyText(menuImage.img.prompt) },
          { label: 'Open in Studio', detail: 'Edit this image on a timeline', icon: <Clapperboard size={15} />, onClick: () => window.location.assign(studioHref(menuImage.img)) },
        );
        return (
          <MediaContextMenu
            x={menuImage.x}
            y={menuImage.y}
            label={menuImage.img.prompt || 'Gallery image'}
            onClose={() => setMenuImage(null)}
            groups={[
              {
                label: 'Browser',
                row: true,
                items: [
                  { label: 'Back', icon: <ArrowLeft size={15} />, onClick: () => window.history.back() },
                  { label: 'Forward', icon: <ArrowRight size={15} />, onClick: () => window.history.forward() },
                  { label: 'Reload', icon: <RotateCw size={15} />, onClick: () => window.location.reload() },
                ],
              },
              { label: 'Image', items: imageItems },
            ]}
          />
        );
      })()}
    </>
  );
}
