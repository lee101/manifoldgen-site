import { articles } from './blog/articles';
import { guides } from './blog/guides/registry';
import type { MetadataRoute } from 'next';
import { VIDEO_GENERATORS } from '@/lib/video-generators';
import { CURATED_SEARCH_PAGES } from '@/lib/search-pages';
import { USE_CASES } from '@/lib/seo/usecases';
import { COMPARISONS } from '@/lib/seo/comparisons';
import { BEST_TOPICS } from '@/lib/seo/best-topics';
import { VIDEO_MODELS } from '@/lib/seo/models';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://manifoldgen.com';
  const now = new Date();
  const staticRoutes = ['', '/tools', '/tool/animate-video', '/tool/image-editor', '/api', '/api/video-generators', '/studio', '/blog', '/blog/guides', '/account', '/ai-video-generator', '/compare', '/best', '/models'];
  const toolSlugs = ['make-image', 'style-transfer', 'h3-image', 'h3-image-editor', 'character-animator', 'video-background-remover', 'music-generator', 'cinematic-cameras', 'relight', 'inpaint', 'image-upscale', 'outpaint', 'moodboard', 'nano-banana', 'grok-imagine', 'flux-2', 'gpt-image'];
  return [
    ...staticRoutes.map((path) => ({ url: `${base}${path}`, lastModified: now, changeFrequency: path === '' ? 'daily' as const : 'weekly' as const, priority: path === '' ? 1 : 0.8 })),
    ...VIDEO_GENERATORS.flatMap((generator) => [
      { url: `${base}/tools/${generator.slug}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.8 },
      { url: `${base}/api/video-generators/${generator.slug}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.75 },
    ]),
    ...toolSlugs.map((slug) => ({ url: `${base}/tools/${slug}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...articles.map(({ slug, date }) => ({ url: `${base}/blog/${slug}`, lastModified: new Date(`${date}T00:00:00Z`), changeFrequency: 'monthly' as const, priority: 0.7 })),
    ...CURATED_SEARCH_PAGES.map(({ slug }) => ({ url: `${base}/search/${slug}`, changeFrequency: 'weekly' as const, priority: 0.7 })),
    ...USE_CASES.map(({ slug }) => ({ url: `${base}/ai-video-generator/${slug}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.75 })),
    ...COMPARISONS.map(({ slug }) => ({ url: `${base}/compare/${slug}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.75 })),
    ...BEST_TOPICS.map(({ slug }) => ({ url: `${base}/best/${slug}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.75 })),
    ...VIDEO_MODELS.map(({ slug }) => ({ url: `${base}/models/${slug}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.75 })),
    ...guides.map(({ slug }) => ({ url: `${base}/blog/guides/${slug}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.7 })),
  ];
}
