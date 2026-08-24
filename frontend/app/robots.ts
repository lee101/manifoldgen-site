import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    // Cross-host sitemaps are legal from any owned host; geo.manifoldgen.com
    // carries the agent-facing markdown mirror.
    sitemap: [
      'https://manifoldgen.com/sitemap.xml',
      'https://manifoldgen.com/sitemap-images.xml',
      'https://manifoldgen.com/videos.xml',
      'https://geo.manifoldgen.com/sitemap.xml',
    ],
    host: 'https://manifoldgen.com',
  };
}
