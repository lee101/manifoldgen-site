import { articles } from '../blog/articles';

export const dynamic = 'force-static';

const SITE_URL = 'https://manifoldgen.com';

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (char) => (
    char === '<' ? '&lt;' : char === '>' ? '&gt;' : char === '&' ? '&amp;' : char === "'" ? '&apos;' : '&quot;'
  ));
}

type VideoEntry = {
  articleSlug: string;
  thumbnail: string;
  title: string;
  description: string;
  contentUrl: string;
  seconds?: number;
};

function collectBlogVideos(): VideoEntry[] {
  const entries: VideoEntry[] = [];
  for (const article of articles) {
    for (const block of article.blocks) {
      if (block.type !== 'example') continue;
      const mediaList = [...(block.example.input && block.example.input.kind === 'video' ? [block.example.input] : []), ...block.example.media];
      for (const item of mediaList) {
        entries.push({
          articleSlug: article.slug,
          thumbnail: `${SITE_URL}${item.poster || article.ogImage}`,
          title: `${article.title} — ${block.example.label || item.caption || 'Generated example'}`.slice(0, 100),
          description: block.example.prompt.slice(0, 200),
          contentUrl: `${SITE_URL}${item.src}`,
          seconds: item.seconds,
        });
      }
    }
  }
  return entries;
}

export function GET() {
  const entries = collectBlogVideos();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${entries.map((entry) => `  <url>
    <loc>${SITE_URL}/blog/${entry.articleSlug}</loc>
    <video:video>
      <video:thumbnail_loc>${escapeXml(entry.thumbnail)}</video:thumbnail_loc>
      <video:title>${escapeXml(entry.title)}</video:title>
      <video:description>${escapeXml(entry.description)}</video:description>
      <video:content_loc>${escapeXml(entry.contentUrl)}</video:content_loc>
      <video:publication_date>${new Date(`${articles.find((a) => a.slug === entry.articleSlug)?.date ?? '2026-08-24'}T00:00:00Z`).toISOString()}</video:publication_date>
      <video:family_friendly>yes</video:family_friendly>
      <video:live>no</video:live>${entry.seconds ? `
      <video:duration>${entry.seconds}</video:duration>` : ''}
    </video:video>
  </url>`).join('\n')}
</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=3600' } });
}
