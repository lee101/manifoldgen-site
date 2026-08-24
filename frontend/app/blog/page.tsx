import Link from 'next/link';
import { ArrowRight, BookOpen, Sparkles } from 'lucide-react';
import { articles } from './articles';

export const metadata = {
  title: 'Blog — AI Video Guides and Prompt Craft',
  description: 'Practical guides for AI video: scripts to video, realism, TikTok content, documentaries, product shots, faceless channels, character consistency, and camera control — every example generated with ManifoldGen.',
  alternates: { canonical: '/blog' },
  openGraph: {
    title: 'ManifoldGen Blog — AI Video Guides',
    description: 'AI video guides with real prompts and real outputs. Generated with ManifoldGen.',
    url: 'https://manifoldgen.com/blog',
    images: [{ url: 'https://manifoldgen.com/blog/og/index.jpg', width: 1200, height: 630, alt: 'ManifoldGen blog' }],
  },
  twitter: {
    card: 'summary_large_image' as const,
    title: 'ManifoldGen Blog — AI Video Guides',
    description: 'AI video guides with real prompts and real outputs.',
    images: ['https://manifoldgen.com/blog/og/index.jpg'],
  },
};

function ArticleCard({ article }: { article: (typeof articles)[number] }) {
  return (
    <Link href={`/blog/${article.slug}`} className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[.025] transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[.05]">
      <div className="aspect-[1200/630] w-full overflow-hidden bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={article.ogImage} alt="" loading="lazy" className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100" />
      </div>
      <div className="p-6">
        <div className="flex items-center justify-between text-xs text-white/40"><span>{article.category}</span><span>{new Date(`${article.date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</span></div>
        <h3 className="mt-4 font-display text-xl font-700 leading-snug tracking-tight text-white/90 group-hover:text-white">{article.title}</h3>
        <p className="mt-3 text-sm leading-6 text-white/50">{article.excerpt}</p>
        <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#bcb2ff]">Read guide <ArrowRight size={14} /></span>
      </div>
    </Link>
  );
}

export default function BlogPage() {
  const [featured, ...rest] = articles;

  return (
    <main className="min-h-screen bg-[var(--color-ink)] text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#07070a]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold tracking-[.12em] text-white">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-white text-xs font-black tracking-[-.08em] text-[#0c0d10]">M</span>
            MANIFOLD
          </Link>
          <nav className="hidden items-center gap-5 text-sm text-white/55 sm:flex">
            <Link href="/studio" className="hover:text-white">Studio</Link>
            <Link href="/tools" className="hover:text-white">Tools</Link>
            <Link href="/api" className="hover:text-white">API</Link>
            <Link href="/blog/guides" className="text-[#bcb2ff] hover:text-white">Guides</Link>
          </nav>
          <Link href="/studio" className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white">
            Open Studio <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 pb-20 pt-16 sm:pt-24">
        <section className="max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
            <BookOpen size={13} /> MANIFOLDGEN BLOG
          </div>
          <h1 className="font-display text-5xl font-700 tracking-tight sm:text-7xl">Make the model do less work.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/55 sm:text-xl">
            Guides for making AI video that actually ships — scripts, realism, TikTok, documentaries, product shots, faceless channels, consistency, and camera control. Every example shows the exact prompt and the real output.
          </p>
        </section>

        <section className="mt-16 grid overflow-hidden rounded-3xl border border-white/10 bg-white/[.035] lg:grid-cols-[1.05fr_.95fr]" aria-labelledby="featured-heading">
          <Link href={`/blog/${featured.slug}`} className="relative block min-h-[280px] overflow-hidden bg-black lg:min-h-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={featured.ogImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#07070a]/90 via-transparent to-transparent" />
          </Link>
          <div className="flex flex-col justify-between p-7 sm:p-10">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold tracking-[.14em] text-white/60"><Sparkles size={14} /> LATEST GUIDE</div>
              <p className="mt-6 text-sm text-[#bcb2ff]">{featured.category} · {featured.readTime}</p>
              <h2 id="featured-heading" className="mt-3 font-display text-3xl font-700 tracking-tight sm:text-4xl">{featured.title}</h2>
              <p className="mt-5 text-base leading-7 text-white/55">{featured.excerpt}</p>
            </div>
            <Link href={`/blog/${featured.slug}`} className="mt-10 inline-flex w-fit items-center gap-2 text-sm font-semibold text-[#bcb2ff] hover:text-white">Read the guide <ArrowRight size={15} /></Link>
          </div>
        </section>

        <section className="mt-16 rounded-3xl border border-[#bcb2ff]/20 bg-[#bcb2ff]/[.05] p-7 sm:p-9" aria-labelledby="creation-guides-heading">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-[.15em] text-[#bcb2ff]">CREATION GUIDES</p>
              <h2 id="creation-guides-heading" className="mt-2 font-display text-3xl font-700">Make money with it, keep it consistent</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">Faceless channels, 100-ad pipelines, AI UGC, product photos, persona consistency — the full playbook from first render to first invoice.</p>
            </div>
            <Link href="/blog/guides" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[#bcb2ff] hover:text-white">All creation guides <ArrowRight size={14} /></Link>
          </div>
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {[
              ['make-money-with-ai', 'Make Money With AI: The Five Paths That Actually Pay', 'Ad creative, faceless channels, UGC, product visuals, automated studios — what buyers pay and which runbook wins.'],
              ['100-creative-ads-without-a-team', 'How to Produce 100+ Creative Ads Without a Team', 'Hook matrix, asset library, batch production, kill thresholds — the solo pipeline.'],
              ['soul-id-explained', 'Soul ID Explained', 'Anchors, descriptor block, derivation rules — the identity layer every money path runs on.'],
            ].map(([href, title, copy]) => (
              <Link key={href} href={`/blog/guides/${href}`} className="group rounded-2xl border border-white/10 bg-white/[.025] p-5 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[.05]">
                <h3 className="font-display text-lg font-700 leading-snug text-white/90 group-hover:text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/50">{copy}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-16" aria-labelledby="latest-heading">
          <div className="flex items-end justify-between gap-4 border-b border-white/10 pb-4">
            <div><p className="text-xs font-semibold tracking-[.15em] text-white/40">ALL GUIDES</p><h2 id="latest-heading" className="mt-2 font-display text-3xl font-700">Prompt it, generate it, ship it</h2></div>
            <span className="hidden text-sm text-white/35 sm:block">Real prompts · Real outputs</span>
          </div>
          <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rest.map((article) => <ArticleCard key={article.slug} article={article} />)}
          </div>
        </section>

        <section className="mt-16 flex flex-col justify-between gap-6 rounded-3xl border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/[.08] p-7 sm:flex-row sm:items-center sm:p-9">
          <div><div className="flex items-center gap-2 text-xs font-semibold tracking-[.14em] text-[#bcb2ff]"><Sparkles size={14} /> TRY THE IDEAS</div><h2 className="mt-3 font-display text-2xl font-700">Turn a prompt into a clip.</h2><p className="mt-2 max-w-xl text-sm leading-6 text-white/50">Open the Studio and put the shot structure, references, and pacing into practice.</p></div>
          <Link href="/studio" className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#14121f]">Open Studio <ArrowRight size={15} /></Link>
        </section>
      </div>
    </main>
  );
}
