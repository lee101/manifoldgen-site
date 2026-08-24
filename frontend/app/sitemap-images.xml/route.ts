import { articles } from '../blog/articles';

export const dynamic = 'force-static';

const SITE_URL = 'https://manifoldgen.com';

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (char) => (
    char === '<' ? '&lt;' : char === '>' ? '&gt;' : char === '&' ? '&amp;' : char === "'" ? '&apos;' : '&quot;'
  ));
}

export function GET() {
  const imageEntries = [
    { loc: `${SITE_URL}/blog`, imageLoc: `${SITE_URL}/blog/og/index.jpg`, title: 'ManifoldGen Blog — AI Video Guides', caption: 'AI video guides with real prompts and real outputs.' },
    ...articles.map((article) => ({
      loc: `${SITE_URL}/blog/${article.slug}`,
      imageLoc: `${SITE_URL}${article.ogImage}`,
      title: article.title,
      caption: article.excerpt,
    })),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${imageEntries.map((entry) => `  <url>
    <loc>${escapeXml(entry.loc)}</loc>
    <image:image>
      <image:loc>${escapeXml(entry.imageLoc)}</image:loc>
      <image:title>${escapeXml(entry.title)}</image:title>
      <image:caption>${escapeXml(entry.caption)}</image:caption>
    </image:image>
  </url>`).join('\n')}
</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=3600' } });
}
