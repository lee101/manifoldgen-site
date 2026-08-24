import type { Metadata } from 'next';
import Link from 'next/link';
import { CATEGORIES, MODELS, leaderboardModels, medianSpeed, rankedModels, completedClip } from '@/lib/seo/benchmarks';
import { BenchHeader, CategoryHeading, ClipCard, CtaBanner, JsonLd, PromptBlock, SITE_URL } from '@/lib/seo/ui';

export const metadata: Metadata = {
  title: 'AI Video Model Leaderboard (2026) — Same Prompt, Every Model',
  description:
    'We ran the exact same prompts through Manifold H3, Seedance 2, Seedance Fast, LTX 2 and Wan. Real generations, measured speed, per-category winners — watch every model fight on identical inputs.',
  alternates: { canonical: '/leaderboard' },
};

const UPDATED = 'August 2026';

export default function LeaderboardPage() {
  const ranked = leaderboardModels();

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'AI Video Model Leaderboard',
    description: 'Same-prompt benchmark of AI video models on ManifoldGen with real generated clips.',
    datePublished: UPDATED,
    itemListElement: ranked.map((model, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: `${model.name} — ${model.score} points`,
      url: model.toolSlug ? `${SITE_URL}/tools/${model.toolSlug}` : SITE_URL,
    })),
  };

  return (
    <main className="min-h-screen bg-[var(--color-ink)] text-white">
      <JsonLd data={itemList} />
      <BenchHeader backLabel="manifoldgen.com" />

      <section className="mx-auto max-w-6xl px-5 pb-10 pt-14 sm:pt-20">
        <p className="text-xs font-semibold tracking-[.14em] text-[#bcb2ff]">INDEPENDENT BENCHMARK · UPDATED {UPDATED.toUpperCase()}</p>
        <h1 className="mt-4 max-w-4xl font-display text-4xl font-700 tracking-tight sm:text-6xl">AI Video Model Leaderboard</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-white/55">
          Which AI video model is actually best? We stopped arguing and ran the same prompts through
          {' '}Manifold H3, Seedance 2, Seedance 2 Fast, LTX 2 and Wan. Every clip below is a real generation from
          ManifoldGen — identical inputs, measured speed, winner picked from the outputs you can watch.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-5">
        <div className="overflow-x-auto rounded-3xl border border-white/10 bg-white/[.03]">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs tracking-[.12em] text-white/40">
                <th className="px-6 py-4 font-semibold">RANK · MODEL</th>
                <th className="px-6 py-4 font-semibold">SCORE</th>
                <th className="px-6 py-4 font-semibold">MEDIAN GENERATION TIME*</th>
                <th className="px-6 py-4 font-semibold">TRY IT</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((model, index) => (
                <tr key={model.key} className="border-b border-white/[.06] last:border-0">
                  <td className="px-6 py-4">
                    <span className="mr-3 text-white/30">{index + 1}</span>
                    <span className="font-semibold" style={{ color: model.accent }}>{model.name}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-28 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${(model.score / (CATEGORIES.length * 6)) * 100}%`, background: model.accent }}
                        />
                      </div>
                      <span className="font-mono text-white/70">{model.score}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-white/60">{medianSpeed(model.key) ? `${medianSpeed(model.key)}s` : '—'}</td>
                  <td className="px-6 py-4">
                    {model.toolSlug && (
                      <Link href={`/tools/${model.toolSlug}`} className="text-[#7be7d9] hover:underline">Generate →</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-5 text-white/35">
          *Median wall-clock time of this model&apos;s completed runs in our harness. Score = category wins across the six
          benchmarks below (6 points for first place, down to 2 for fifth). Rankings are editorial picks made from these exact generations.
        </p>
      </section>

      <div className="mx-auto mt-16 max-w-6xl space-y-16 px-5">
        {CATEGORIES.map((category) => (
          <section key={category.key} id={category.key} className="space-y-5">
            <CategoryHeading category={category} />
            <PromptBlock prompt={category.prompt} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rankedModels(category).map((model, rankIndex) => (
                <ClipCard
                  key={model.key}
                  categoryKey={category.key}
                  modelKey={model.key}
                  model={MODELS.find((m) => m.key === model.key)!}
                  rank={completedClip(category.key, model.key) ? rankIndex + 1 : undefined}
                />
              ))}
            </div>
            {category.why[category.ranking[0]] && (
              <p className="text-sm leading-7 text-white/50">
                <span className="font-semibold text-[#7be7d9]">Why {rankedModels(category)[0].name} wins:</span>
                {' '}{category.why[category.ranking[0]]}
              </p>
            )}
          </section>
        ))}
      </div>

      <div className="mx-auto max-w-6xl px-5">
        <CtaBanner
          title="Not sure which model to use?"
          body="Give Manifold your prompt — we route it to the model that performs best on shots like yours, and you only pay for what you generate."
        />
      </div>
    </main>
  );
}
