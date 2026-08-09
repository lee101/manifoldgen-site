import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ManifoldGen — AI Video Generator',
    short_name: 'ManifoldGen',
    description: 'Create cinematic AI video from a text prompt.',
    start_url: '/',
    display: 'standalone',
    background_color: '#07070a',
    theme_color: '#07070a',
    icons: [
      {
        src: '/brand/logo-192.webp',
        sizes: '192x192',
        type: 'image/webp',
      },
      {
        src: '/brand/logo-mark.webp',
        sizes: '512x512',
        type: 'image/webp',
      },
    ],
  };
}
