'use client';

import { useEffect, useRef, useState, type VideoHTMLAttributes } from 'react';

export default function LazyPreviewVideo({ src, ...props }: VideoHTMLAttributes<HTMLVideoElement> & { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setNear(true);
        observer.disconnect();
      }
    }, { rootMargin: '300px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [near]);
  return <video ref={ref} src={src} preload={near ? 'metadata' : 'none'} {...props} />;
}
