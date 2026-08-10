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
        src: '/images/favicon-192.webp',
        sizes: '192x192',
        type: 'image/webp',
      },
      {
        src: '/images/apple-touch-icon.webp',
        sizes: '180x180',
        type: 'image/webp',
      },
    ],
  };
}
