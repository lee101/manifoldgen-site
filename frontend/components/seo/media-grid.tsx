'use client';

import { useEffect, useRef } from 'react';
import type { ImageAsset, VideoAsset } from '@/lib/seo/types';

function VideoCard({ asset, eager }: { asset: VideoAsset; eager: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) void node.play().catch(() => undefined);
          else node.pause();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <figure className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black">
      <video
        ref={ref}
        src={asset.url}
        muted
        loop
        playsInline
        autoPlay={eager}
        preload="metadata"
        className="aspect-video w-full object-cover"
      />
      <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 line-clamp-2 bg-gradient-to-t from-black/85 to-transparent p-3 text-xs leading-snug text-white/70 opacity-0 transition group-hover:opacity-100">
        {asset.prompt}
      </figcaption>
    </figure>
  );
}

export default function MediaGrid({ videos, images }: { videos: VideoAsset[]; images: ImageAsset[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {videos.map((asset) => (
        <VideoCard key={asset.url} asset={asset} eager={false} />
      ))}
      {images.map((asset, index) => (
        <figure key={asset.url} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={asset.url}
            alt={asset.prompt}
            loading={index < 2 ? 'eager' : 'lazy'}
            className="aspect-video w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
          <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 line-clamp-2 bg-gradient-to-t from-black/85 to-transparent p-3 text-xs leading-snug text-white/70 opacity-0 transition group-hover:opacity-100">
            {asset.prompt}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
