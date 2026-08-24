import Link from 'next/link';
import { ArrowLeft, ArrowRight, BookOpen, Compass } from 'lucide-react';
import { guideSections, guides } from './registry';

export const metadata = {
  title: 'AI Creation Guides — ManifoldGen',
  description:
    'Practical guides on making money with AI — faceless channels, ad pipelines, UGC, product photos — plus character consistency, AI personas, scene continuity, ComfyUI thinking, and directing agents.',
};

export default function GuidesPage() {
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
            <Link href="/blog" className="hover:text-white">Blog</Link>
            <Link href="/account" className="hover:text-white">Account</Link>
          </nav>
          <Link href="/studio" className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white">
            Open Studio <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 pb-24 pt-16 sm:pt-24">
        <section className="max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
            <Compass size={13} /> GUIDES · MONEY, CHARACTER, SCENES, PIPELINES
          </div>
          <h1 className="font-display text-5xl font-700 tracking-tight sm:text-7xl">Make it, then make it pay.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/55 sm:text-xl">
            Everything we know about keeping faces, personas, locations, and pipelines consistent — plus the money playbooks that turn that output into income, from $10K faceless channels to 100-ad pipelines.
          </p>
        </section>

        {guideSections.map((section) => {
          const sectionGuides = guides.filter((guide) => guide.section === section.id);
          if (sectionGuides.length === 0) return null;
          return (
            <section key={section.id} className="mt-16" aria-labelledby={`section-${section.id}`}>
              <div className="border-b border-white/10 pb-4">
                <p className="text-xs font-semibold tracking-[.15em] text-white/40">{section.blurb.toUpperCase()}</p>
                <h2 id={`section-${section.id}`} className="mt-2 font-display text-3xl font-700">{section.title}</h2>
              </div>
              <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sectionGuides.map((guide) => (
                  <Link
                    key={guide.slug}
                    href={`/blog/guides/${guide.slug}`}
                    className="group flex flex-col rounded-2xl border border-white/10 bg-white/[.025] p-6 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[.05]"
                  >
                    <div className="flex items-center justify-between text-xs text-white/40"><span>{guide.category}</span><span>{guide.readTime}</span></div>
                    <h3 className="mt-6 font-display text-xl font-700 leading-snug tracking-tight text-white/90 group-hover:text-white">{guide.title}</h3>
                    <p className="mt-3 flex-1 text-sm leading-6 text-white/50">{guide.excerpt}</p>
                    <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#bcb2ff]">Read guide <ArrowRight size={14} /></span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}

        <section className="mt-16 flex flex-col justify-between gap-6 rounded-3xl border border-white/10 bg-white/[.035] p-7 sm:flex-row sm:items-center sm:p-9">
          <div className="flex items-start gap-4">
            <BookOpen size={22} className="mt-1 shrink-0 text-[var(--color-accent-2)]" />
            <div>
              <h2 className="font-display text-2xl font-700">Shorter field notes live in the blog.</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/50">Systems notes on latent-space workloads and prompt craft — the compressed versions of these ideas.</p>
            </div>
          </div>
          <Link href="/blog" className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#14121f]"><ArrowLeft size={14} /> Back to the blog</Link>
        </section>
      </div>
    </main>
  );
}
