import Link from 'next/link';
import { CATEGORIES, medianSpeed, type BenchModel, comparePairs } from '@/lib/seo/benchmarks';
import { BenchHeader, ClipCard, CtaBanner, JsonLd, PromptBlock } from '@/lib/seo/ui';

export default function BenchCompare({ slug, a, b }: { slug: string; a: BenchModel; b: BenchModel }) {
  let aWins = 0;
  let bWins = 0;
  for (const category of CATEGORIES) {
    const aRank = category.ranking.indexOf(a.key);
    const bRank = category.ranking.indexOf(b.key);
    if (aRank < bRank) aWins += 1;
    else if (bRank < aRank) bWins += 1;
  }
  const overall = aWins === bWins ? 'Tied overall' : aWins > bWins ? `${a.name} wins overall` : `${b.name} wins overall`;

  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `Is ${a.name} or ${b.name} better for AI video?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `In our same-prompt benchmark on ManifoldGen, ${overall.toLowerCase()}: ${a.name} takes ${aWins} of ${CATEGORIES.length} categories and ${b.name} takes ${bWins}. Watch the clips above — every pair ran the identical prompt.`,
        },
      },
      {
        '@type': 'Question',
        name: `Which is faster, ${a.name} or ${b.name}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Median generation time in our harness: ${a.name} ${medianSpeed(a.key) ?? '—'}s vs ${b.name} ${medianSpeed(b.key) ?? '—'}s.`,
        },
      },
    ],
  };

  return (
    <main className="min-h-screen bg-[var(--color-ink)] text-white">
      <JsonLd data={faq} />
      <BenchHeader backHref="/compare" backLabel="← All comparisons" />

      <section className="mx-auto max-w-6xl px-5 pb-8 pt-14 sm:pt-20">
        <p className="text-xs font-semibold tracking-[.14em] text-[#bcb2ff]">SAME PROMPT · SAME BUDGET · REAL GENERATIONS</p>
        <h1 className="mt-4 font-display text-4xl font-700 tracking-tight sm:text-6xl">
          <span style={{ color: a.accent }}>{a.name}</span> vs <span style={{ color: b.accent }}>{b.name}</span>
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-white/55">
          We gave both models the exact same six prompts on ManifoldGen. No cherry-picking: every clip below is the
          output you get, side by side.
        </p>
        <p className="mt-4 inline-block rounded-full border border-white/15 bg-white/[.05] px-4 py-1.5 text-sm font-semibold">
          Verdict: {overall} <span className="text-white/40">({aWins}–{bWins} across {CATEGORIES.length} categories)</span>
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-5">
        <div className="overflow-x-auto rounded-3xl border border-white/10 bg-white/[.03]">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs tracking-[.12em] text-white/40">
                <th className="px-6 py-4 font-semibold">CATEGORY</th>
                <th className="px-6 py-4 font-semibold" style={{ color: a.accent }}>{a.name}</th>
                <th className="px-6 py-4 font-semibold" style={{ color: b.accent }}>{b.name}</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((category) => {
                const aRank = category.ranking.indexOf(a.key);
                const bRank = category.ranking.indexOf(b.key);
                return (
                  <tr key={category.key} className="border-b border-white/[.06] last:border-0">
                    <td className="px-6 py-3 font-medium">{category.label}</td>
                    <td className={`px-6 py-3 ${aRank < bRank ? 'font-semibold' : 'text-white/50'}`}>{aRank < bRank ? '✓ Winner' : '#' + (aRank + 1)}</td>
                    <td className={`px-6 py-3 ${bRank < aRank ? 'font-semibold' : 'text-white/50'}`}>{bRank < aRank ? '✓ Winner' : '#' + (bRank + 1)}</td>
                  </tr>
                );
              })}
              <tr>
                <td className="px-6 py-3 font-medium">Median generation time</td>
                <td className="px-6 py-3 font-mono">{medianSpeed(a.key) ? `${medianSpeed(a.key)}s` : '—'}</td>
                <td className="px-6 py-3 font-mono">{medianSpeed(b.key) ? `${medianSpeed(b.key)}s` : '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div className="mx-auto mt-16 max-w-6xl space-y-14 px-5">
        {CATEGORIES.map((category) => (
          <section key={category.key} className="space-y-5">
            <h2 className="font-display text-2xl font-700 tracking-tight">{category.label}</h2>
            <PromptBlock prompt={category.prompt} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs tracking-[.12em] text-white/40">RANK #{category.ranking.indexOf(a.key) + 1} OVERALL</p>
                <ClipCard categoryKey={category.key} modelKey={a.key} model={a} rank={category.ranking.indexOf(a.key) < category.ranking.indexOf(b.key) ? 1 : undefined} />
              </div>
              <div className="space-y-2">
                <p className="text-xs tracking-[.12em] text-white/40">RANK #{category.ranking.indexOf(b.key) + 1} OVERALL</p>
                <ClipCard categoryKey={category.key} modelKey={b.key} model={b} rank={category.ranking.indexOf(b.key) < category.ranking.indexOf(a.key) ? 1 : undefined} />
              </div>
            </div>
            {(category.why[a.key] || category.why[b.key]) && (
              <p className="text-sm leading-7 text-white/50">
                {category.why[a.key] && <><span className="font-semibold" style={{ color: a.accent }}>{a.name}:</span> {category.why[a.key]} </>}
                {category.why[b.key] && <><span className="font-semibold" style={{ color: b.accent }}>{b.name}:</span> {category.why[b.key]}</>}
              </p>
            )}
          </section>
        ))}
      </div>

      <div className="mx-auto max-w-6xl px-5">
        <CtaBanner
          title={`Run your own ${a.name} vs ${b.name} test`}
          body={`Open ManifoldGen Studio, paste your prompt, and switch models with one dropdown. Both of these are live right now.`}
        />
        <p className="mt-10 pb-20 text-sm text-white/35">
          More head-to-heads:{' '}
          {comparePairs()
            .filter((entry) => entry.slug !== slug)
            .map((entry, index) => (
              <span key={entry.slug}>
                {index > 0 && ' · '}
                <Link href={`/compare/${entry.slug}`} className="text-[#7be7d9] hover:underline">
                  {entry.a.name} vs {entry.b.name}
                </Link>
              </span>
            ))}
        </p>
      </div>
    </main>
  );
}
