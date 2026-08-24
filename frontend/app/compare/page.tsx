import type { Metadata } from 'next';
import Link from 'next/link';
import { comparePairs } from '@/lib/seo/benchmarks';
import { COMPARISONS } from '@/lib/seo/comparisons';
import { CtaStrip, PageShell } from '@/components/seo/kit';

export const metadata: Metadata = {
  title: 'AI Model Comparisons — Seedance vs Wan, LTX vs Manifold & More',
  description:
    'Head-to-head AI video and image model comparisons on real ManifoldGen output: prices per clip, resolution, audio, and which model wins for which job.',
  alternates: { canonical: '/compare' },
};

export default function CompareIndex() {
  return (
    <PageShell>
      <section className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-2)]">Head to head</p>
        <h1 className="mt-4 font-display text-4xl font-700 tracking-tight md:text-6xl">Same prompt, different models</h1>
        <p className="mt-5 text-lg leading-8 text-white/70">
          Every model here runs on one platform with published per-second pricing, so comparisons end with numbers instead of
          vibes. Verdicts name the winner per job; examples are real generations served from our gallery.
        </p>
      </section>
      <section className="mt-12">
        <h2 className="font-display text-xl font-700">Same-prompt benchmarks</h2>
        <p className="mt-2 text-sm text-white/55">
          Every pair from our five-model harness ran six identical prompts — watch the actual outputs. Full results on the{' '}
          <Link href="/leaderboard" className="text-[var(--color-accent-2)] hover:underline">leaderboard</Link>.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {comparePairs().map((pair) => (
            <Link key={pair.slug} href={`/compare/${pair.slug}`} className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/75 transition hover:border-white/40 hover:text-white">
              {pair.a.name} vs {pair.b.name}
            </Link>
          ))}
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {COMPARISONS.map((comparison) => (
            <Link
              key={comparison.slug}
              href={`/compare/${comparison.slug}`}
              className="group rounded-3xl border border-white/12 bg-white/[0.04] p-6 transition hover:border-white/35"
            >
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">{comparison.kind === 'image' ? 'Image models' : 'Video models'}</span>
              <h2 className="mt-2 font-display text-2xl font-700">{comparison.h1}</h2>
              <p className="mt-2 line-clamp-2 text-sm leading-7 text-white/65">{comparison.verdict}</p>
              <span className="mt-3 inline-block text-sm font-semibold text-[var(--color-accent-2)] opacity-0 transition group-hover:opacity-100">Read verdict →</span>
            </Link>
          ))}
        </div>
      </section>
      <CtaStrip heading="Benchmark your own prompts" sub="Run any prompt across every model from one Studio session — pay only for what generates." />
    </PageShell>
  );
}
