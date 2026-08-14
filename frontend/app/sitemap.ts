import type { MetadataRoute } from 'next';
import { VIDEO_GENERATORS } from '@/lib/video-generators';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://manifoldgen.com';
  const now = new Date();
  const staticRoutes = ['', '/tools', '/tool/animate-video', '/tool/image-editor', '/api', '/api/video-generators', '/studio', '/blog', '/account'];
  return [
    ...staticRoutes.map((path) => ({ url: `${base}${path}`, lastModified: now, changeFrequency: path === '' ? 'daily' as const : 'weekly' as const, priority: path === '' ? 1 : 0.8 })),
    ...VIDEO_GENERATORS.flatMap((generator) => [
      { url: `${base}/tools/${generator.slug}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.8 },
      { url: `${base}/api/video-generators/${generator.slug}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.75 },
    ]),
  ];
}
