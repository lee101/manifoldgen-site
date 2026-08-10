import Link from 'next/link';
import { ArrowRight, BookOpen, Clapperboard, Cpu, Image as ImageIcon, Sparkles } from 'lucide-react';
import { articles } from './articles';

export const metadata = {
  title: 'Blog',
  description: 'Technical notes on faster generative AI workloads and better image and video prompts.',
};

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
            <Link href="/api" className="hover:text-white">API</Link>
            <Link href="/account" className="hover:text-white">Account</Link>
          </nav>
          <Link href="/studio" className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white">
            Open Studio <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 pb-20 pt-16 sm:pt-24">
        <section className="max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
            <BookOpen size={13} /> FIELD NOTES FROM MANIFOLDGEN
          </div>
          <h1 className="font-display text-5xl font-700 tracking-tight sm:text-7xl">Make the model do less work.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/55 sm:text-xl">
            Technical notes on latent-space systems, prompt craft, and the small decisions that make generative video and images more useful.
          </p>
        </section>

        <section className="mt-16 grid overflow-hidden rounded-3xl border border-white/10 bg-white/[.035] lg:grid-cols-[1.05fr_.95fr]" aria-labelledby="featured-heading">
          <div className="relative min-h-[280px] overflow-hidden bg-[radial-gradient(circle_at_28%_28%,rgba(124,108,255,.55),transparent_34%),linear-gradient(135deg,#17132e,#0d1119_58%,#0d2d2b)] p-7 sm:p-10">
            <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:36px_36px]" />
            <div className="relative flex h-full flex-col justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-[.14em] text-white/60"><Cpu size={14} /> FEATURED SYSTEMS NOTE</div>
              <div className="mt-16 max-w-md">
                <p className="text-sm text-[#bcb2ff]">{featured.category} · {featured.readTime}</p>
                <h2 id="featured-heading" className="mt-3 font-display text-3xl font-700 tracking-tight sm:text-4xl">{featured.title}</h2>
              </div>
            </div>
          </div>
          <div className="flex flex-col justify-between p-7 sm:p-10">
            <div>
              <p className="text-base leading-7 text-white/55">{featured.excerpt}</p>
              <p className="mt-5 text-sm leading-6 text-white/45">Why representation changes, caching, and a clear boundary between orchestration and inference matter when every second of GPU time counts.</p>
            </div>
            <Link href={`/blog/${featured.slug}`} className="mt-10 inline-flex w-fit items-center gap-2 text-sm font-semibold text-[#bcb2ff] hover:text-white">Read the systems note <ArrowRight size={15} /></Link>
          </div>
        </section>

        <section className="mt-16" aria-labelledby="latest-heading">
          <div className="flex items-end justify-between gap-4 border-b border-white/10 pb-4">
            <div><p className="text-xs font-semibold tracking-[.15em] text-white/40">LATEST NOTES</p><h2 id="latest-heading" className="mt-2 font-display text-3xl font-700">Prompts that carry their weight</h2></div>
            <span className="hidden text-sm text-white/35 sm:block">Short, useful, copyable</span>
          </div>
          <div className="mt-7 grid gap-4 md:grid-cols-2">
            {rest.map((article) => (
              <Link key={article.slug} href={`/blog/${article.slug}`} className="group rounded-2xl border border-white/10 bg-white/[.025] p-6 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[.05]">
                <div className="flex items-center justify-between text-xs text-white/40"><span>{article.category}</span><span>{article.readTime}</span></div>
                <h3 className="mt-8 font-display text-2xl font-700 tracking-tight text-white/90 group-hover:text-white">{article.title}</h3>
                <p className="mt-3 leading-7 text-white/50">{article.excerpt}</p>
                <span className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[#bcb2ff]">Read article <ArrowRight size={14} /></span>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-16 grid gap-4 md:grid-cols-3" aria-label="Blog topics">
          {[[Clapperboard, 'Video prompts', 'Camera language, motion, continuity, and useful endings.'], [ImageIcon, 'Image prompts', 'Framing, light, materials, and references that models can follow.'], [Cpu, 'Fast workloads', 'Latency, caching, batching, and the shape of a good pipeline.']].map(([Icon, title, copy]) => {
            const TopicIcon = Icon as typeof Clapperboard;
            return <div key={String(title)} className="rounded-2xl border border-white/10 bg-white/[.025] p-5"><TopicIcon size={18} className="text-[var(--color-accent-2)]" /><h3 className="mt-4 text-sm font-semibold">{String(title)}</h3><p className="mt-2 text-sm leading-6 text-white/45">{String(copy)}</p></div>;
          })}
        </section>

        <section className="mt-16 flex flex-col justify-between gap-6 rounded-3xl border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/[.08] p-7 sm:flex-row sm:items-center sm:p-9">
          <div><div className="flex items-center gap-2 text-xs font-semibold tracking-[.14em] text-[#bcb2ff]"><Sparkles size={14} /> TRY THE IDEAS</div><h2 className="mt-3 font-display text-2xl font-700">Turn a prompt into a clip.</h2><p className="mt-2 max-w-xl text-sm leading-6 text-white/50">Open the Studio and put the shot structure, references, and pacing into practice.</p></div>
          <Link href="/studio" className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#14121f]">Open Studio <ArrowRight size={15} /></Link>
        </section>
      </div>
    </main>
  );
}
