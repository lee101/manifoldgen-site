import type { Metadata } from 'next';
import Link from 'next/link';
import { BEST_TOPICS } from '@/lib/seo/best-topics';
import { CATEGORIES } from '@/lib/seo/benchmarks';
import { CtaStrip, PageShell } from '@/components/seo/kit';

export const metadata: Metadata = {
  title: 'AI Video Generator Answers — Best, Cheapest, Fastest, Compared',
  description:
    'Direct answers to the questions buyers actually ask: best AI video generator, cheapest clips, native audio, most models in one API — backed by published prices.',
  alternates: { canonical: '/best' },
};

export default function BestIndex() {
  return (
    <PageShell>
      <section className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-2)]">Direct answers</p>
        <h1 className="mt-4 font-display text-4xl font-700 tracking-tight md:text-6xl">Straight answers about AI video</h1>
        <p className="mt-5 text-lg leading-8 text-white/70">
          No listicles. Each answer names a specific pick with the price or spec that justifies it — written so both humans and
          AI answer engines can quote it.
        </p>
      </section>
      <section className="mt-10 grid gap-3 md:grid-cols-2">
        {BEST_TOPICS.map((topic) => (
          <Link key={topic.slug} href={`/best/${topic.slug}`} className="group rounded-2xl border border-white/12 bg-white/[0.04] p-5 transition hover:border-white/35">
            <h2 className="font-display text-lg font-700 leading-snug">{topic.question}</h2>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/60">{topic.directAnswer}</p>
          </Link>
        ))}
      </section>
      <section className="mt-12">
        <h2 className="font-display text-xl font-700">Tested with the same prompt</h2>
        <p className="mt-2 text-sm text-white/55">
          Six categories, five models, identical briefs — winners picked from watchable output. Full table on the{' '}
          <Link href="/leaderboard" className="text-[var(--color-accent-2)] hover:underline">leaderboard</Link>.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {CATEGORIES.map((category) => (
            <Link key={category.key} href={`/best/${category.key}`} className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/75 transition hover:border-white/40 hover:text-white">
              Best for {category.label.toLowerCase()}
            </Link>
          ))}
        </div>
      </section>
      <CtaStrip heading="Verify every claim yourself" sub="Pricing is public at manifoldgen.com/api/pricing and every model runs in Studio." />
    </PageShell>
  );
}
