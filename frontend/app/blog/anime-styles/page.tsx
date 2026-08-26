import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Images, Sparkles } from 'lucide-react';
import StyleGallery from './Gallery';
import { CATEGORIES, STYLES } from './styles';

const SITE_URL = 'https://manifoldgen.com';
const title = 'One Elf, 1000 Anime Styles — An Interactive Style Explorer';
const excerpt =
  'We took one prompt — aesthetic elf woman — and re-ran it 1000 times, changing only the style modifier: art movements, printmaking, retro games, subculture fashion, lighting grades. Browse every result with the exact prompt that made it.';

export const metadata: Metadata = {
  title,
  description: excerpt,
  alternates: { canonical: '/blog/anime-styles' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/blog/anime-styles`,
    title,
    description: excerpt,
    images: [{ url: STYLES[0].url, width: 832, height: 1216, alt: 'Aesthetic elf woman in 1000 anime styles' }],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description: excerpt,
    images: [STYLES[0].url],
  },
};

function JsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description: excerpt,
    image: STYLES[0].url,
    datePublished: '2026-08-24',
    author: { '@type': 'Organization', name: 'ManifoldGen', url: SITE_URL },
    publisher: { '@type': 'Organization', name: 'ManifoldGen', url: SITE_URL },
    mainEntityOfPage: `${SITE_URL}/blog/anime-styles`,
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

export default function AnimeStylesPage() {
  return (
    <main className="min-h-screen bg-[var(--color-ink)] text-white">
      <JsonLd />
      <header className="border-b border-white/10 bg-[#07070a]/85">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/blog" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white">
            <ArrowLeft size={16} /> All notes
          </Link>
          <Link href="/tools/make-image" className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold">
            Bulk generate <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-6xl px-5 pb-24 pt-14 sm:pt-20">
        <section className="max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
            <Images size={13} /> STYLE EXPLORER · {STYLES.length} IMAGES
          </div>
          <h1 className="font-display text-4xl font-700 tracking-tight sm:text-6xl">One elf. One thousand styles.</h1>
          <p className="mt-6 text-lg leading-8 text-white/55">
            Style is the loudest word in an image prompt — louder than composition, louder than lighting. To measure just how loud, we held everything constant and changed a single thing. The base subject never moved:{' '}
            <span className="font-mono text-[15px] text-white/80">aesthetic elf woman</span>. Only the modifier after the comma changed, one thousand times.
          </p>
          <p className="mt-4 leading-7 text-white/55">
            The modifiers span thirteen families — anime eras and manga lineages, studio-auteur looks, traditional media from oil glazing to thangka, printmaking and craft, retro game hardware, 3D render passes, subculture
            fashion, color science and lighting setups, regional folk arts, film stocks and camera moves, surrealism, material studies, and weather moods. Every image below was generated at 832×1216 as webp (~quality 85) through
            the same images3 pipeline, so differences you see are the style term doing all the work.
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            {CATEGORIES.map(({ name, count }) => (
              <span key={name} className="rounded-full border border-white/10 bg-white/[.04] px-3 py-1 text-xs text-white/55">
                {name} <span className="text-white/35">{count}</span>
              </span>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-3 sm:grid-cols-3">
          {[
            ['Fixed subject', '"aesthetic elf woman" starts every prompt. No seed lock — each run samples fresh, which keeps comparisons about style, not lucky rolls.'],
            ['One variable', 'Everything after the first comma is a single style modifier, from "1960s retro anime style" to "wearing stormcloud tulle, framed by aurora sky".'],
            ['Same pipeline', 'All 1000 went through create_and_upload_image at 832×1216 and came back as ~50KB webp files on the netwrckstatic CDN.'],
          ].map(([h, p]) => (
            <div key={h} className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-[.14em] text-[#bcb2ff]">
                <Sparkles size={13} /> {h.toUpperCase()}
              </div>
              <p className="mt-3 text-sm leading-6 text-white/55">{p}</p>
            </div>
          ))}
        </section>

        <section className="mt-14">
          <h2 className="font-display text-2xl font-700 tracking-tight">Browse the gallery</h2>
          <p className="mb-6 mt-2 max-w-2xl text-sm leading-6 text-white/50">
            Filter by family or search for a technique. Click any tile to open it large, read the full prompt, copy it in one tap, and step through with arrow keys.
          </p>
          <StyleGallery />
        </section>

        <section className="mt-16 rounded-3xl border border-[#bcb2ff]/20 bg-[#bcb2ff]/[.05] p-7 sm:p-9">
          <h2 className="font-display text-2xl font-700 tracking-tight">Run your own grid</h2>
          <p className="mt-3 max-w-2xl leading-7 text-white/55">
            This page is itself a prompt experiment you can fork: pick a subject, write twenty modifiers, and let the bulk tool iterate while you judge the results side by side. The same trick works for lighting audits,
            wardrobe boards, and finding a signature look for a character before you animate them.
          </p>
          <Link href="/tools/make-image" className="mt-6 inline-flex w-fit items-center gap-2 text-sm font-semibold text-[#bcb2ff] hover:text-white">
            Open the bulk image tool <ArrowRight size={15} />
          </Link>
        </section>
      </article>
    </main>
  );
}
