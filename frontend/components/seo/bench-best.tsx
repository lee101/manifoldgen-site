import Link from 'next/link';
import { CATEGORIES, MODELS, completedClip, medianSpeed, rankedModels, type BenchCategory } from '@/lib/seo/benchmarks';
import { BenchHeader, ClipCard, CtaBanner, JsonLd, PromptBlock, SITE_URL } from '@/lib/seo/ui';

export default function BenchBest({ category }: { category: BenchCategory }) {
  const ranked = rankedModels(category);
  const [winner, ...rest] = ranked;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `Best AI video model for ${category.label.toLowerCase()} (2026)`,
    description: `Same-prompt benchmark of AI video models for ${category.label.toLowerCase()}, with all generations embedded.`,
    author: { '@type': 'Organization', name: 'ManifoldGen', url: SITE_URL },
  };

  return (
    <main className="min-h-screen bg-[var(--color-ink)] text-white">
      <JsonLd data={jsonLd} />
      <BenchHeader backHref="/best" backLabel="← All answers" />

      <section className="mx-auto max-w-6xl px-5 pb-8 pt-14 sm:pt-20">
        <p className="text-xs font-semibold tracking-[.14em] text-[#bcb2ff]">SAME-PROMPT BENCHMARK · AUGUST 2026</p>
        <h1 className="mt-4 max-w-4xl font-display text-4xl font-700 tracking-tight sm:text-6xl">
          Best AI Video Model for {category.label}
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-white/55">
          {category.tagline}. We gave five models the identical brief on ManifoldGen — here are the actual
          generations, ranked.
        </p>
      </section>

      <section className="mx-auto max-w-6xl space-y-5 px-5">
        <PromptBlock prompt={category.prompt} />
        <div>
          <p className="mb-3 text-xs font-semibold tracking-[.14em] text-[#7be7d9]">WINNER</p>
          <ClipCard categoryKey={category.key} modelKey={winner.key} model={winner} rank={1} />
          <div className="mt-5 rounded-2xl border border-[#37d6c5]/20 bg-[#37d6c5]/[.06] p-5 text-[15px] leading-7 text-white/70">
            <span className="font-semibold" style={{ color: winner.accent }}>{winner.name}</span>
            {' '}{category.why[winner.key]}{' '}
            {winner.toolSlug && (
              <Link href={`/tools/${winner.toolSlug}`} className="text-[#7be7d9] hover:underline">Try {winner.name} →</Link>
            )}
          </div>
        </div>

        <div className="pt-4">
          <p className="mb-3 text-xs font-semibold tracking-[.14em] text-white/40">THE REST OF THE FIELD — SAME PROMPT</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {rest.map((model) => (
              <ClipCard
                key={model.key}
                categoryKey={category.key}
                modelKey={model.key}
                model={MODELS.find((entry) => entry.key === model.key) ?? model}
                rank={category.ranking.indexOf(model.key) + 1}
              />
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-3xl border border-white/10 bg-white/[.03]">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs tracking-[.12em] text-white/40">
                <th className="px-6 py-4 font-semibold">RANK</th>
                <th className="px-6 py-4 font-semibold">MODEL</th>
                <th className="px-6 py-4 font-semibold">WHY IT PLACED HERE</th>
                <th className="px-6 py-4 font-semibold">MEDIAN SPEED*</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((model, index) => (
                <tr key={model.key} className="border-b border-white/[.06] last:border-0">
                  <td className="px-6 py-4 text-white/30">{index + 1}</td>
                  <td className="px-6 py-4 font-semibold" style={{ color: model.accent }}>{model.name}</td>
                  <td className="px-6 py-4 text-white/55">{category.why[model.key]}</td>
                  <td className="px-6 py-4 font-mono text-white/60">{medianSpeed(model.key) ? `${medianSpeed(model.key)}s` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs leading-5 text-white/35">
          *Median wall-clock time across this model&apos;s completed runs in our harness. Placements are editorial calls made
          from these exact generations — watch the clips above and disagree with us.{completedClip(category.key, winner.key) ? '' : ' Generations for this category are still running.'}
        </p>
      </section>

      <div className="mx-auto max-w-6xl px-5">
        <CtaBanner
          title={`Making ${category.label.toLowerCase()} shots?`}
          body="Paste your prompt into ManifoldGen. One subscription, every model — pick the winner yourself or let routing do it."
        />
        <nav className="mt-10 pb-20 text-sm text-white/35">
          Other benchmarks:{' '}
          {CATEGORIES.filter((entry) => entry.key !== category.key).map((entry, index) => (
            <span key={entry.key}>
              {index > 0 && ' · '}
              <Link href={`/best/${entry.key}`} className="text-[#7be7d9] hover:underline">{entry.label}</Link>
            </span>
          ))}
          {' · '}
          <Link href="/leaderboard" className="text-[#7be7d9] hover:underline">Full leaderboard</Link>
        </nav>
      </div>
    </main>
  );
}
