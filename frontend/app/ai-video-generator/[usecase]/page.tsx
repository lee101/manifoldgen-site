import type { Metadata } from 'next';
import type { VideoModelRef } from '@/lib/seo/types';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import MediaGrid from '@/components/seo/media-grid';
import { CtaStrip, CrossLinks, FaqSection, JsonLd, PageShell, breadcrumbJsonLd, faqJsonLd } from '@/components/seo/kit';
import { COMPARISONS } from '@/lib/seo/comparisons';
import { USE_CASES } from '@/lib/seo/usecases';
import { videoModel } from '@/lib/seo/models';
import { mediaBundle } from '@/lib/seo/media';

export const dynamicParams = false;

export function generateStaticParams() {
  return USE_CASES.map(({ slug }) => ({ usecase: slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ usecase: string }> }): Promise<Metadata> {
  const { usecase } = await params;
  const useCase = USE_CASES.find((entry) => entry.slug === usecase);
  if (!useCase) return {};
  return {
    title: useCase.title,
    description: useCase.metaDescription,
    alternates: { canonical: `/ai-video-generator/${useCase.slug}` },
  };
}

export default async function UseCasePage({ params }: { params: Promise<{ usecase: string }> }) {
  const { usecase } = await params;
  const useCase = USE_CASES.find((entry) => entry.slug === usecase);
  if (!useCase) notFound();
  const media = mediaBundle(useCase.mediaKey);
  const recommended = useCase.recommendedModels
    .map((entry) => ({ entry, model: videoModel(entry.slug) }))
    .filter((row): row is { entry: (typeof useCase.recommendedModels)[number]; model: VideoModelRef } => Boolean(row.model));
  const relatedUseCases = USE_CASES.filter((entry) => entry.slug !== useCase.slug).slice(0, 6);
  const comparisonLinks = COMPARISONS.slice(0, 4).map((comparison) => ({ label: comparison.h1, href: `/compare/${comparison.slug}` }));

  return (
    <PageShell>
      <JsonLd data={breadcrumbJsonLd([{ name: 'Use cases', path: '/ai-video-generator' }, { name: useCase.h1, path: `/ai-video-generator/${useCase.slug}` }])} />
      <JsonLd data={faqJsonLd(useCase.faqs)} />
      <nav className="text-sm text-white/50">
        <Link href="/ai-video-generator" className="hover:text-white">Use cases</Link>
        <span className="mx-2">/</span>
        <span className="text-white/80">{useCase.h1}</span>
      </nav>
      <section className="mt-6 max-w-3xl">
        <h1 className="font-display text-4xl font-700 tracking-tight md:text-5xl">{useCase.h1}</h1>
        <p className="mt-5 text-lg leading-8 text-white/70">{useCase.intro}</p>
        <p className="mt-4 text-sm font-medium uppercase tracking-[0.14em] text-white/45">For: {useCase.audience}</p>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {useCase.workflow.map((step, index) => (
          <div key={step.step} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="font-display text-3xl font-700 text-white/15">{String(index + 1).padStart(2, '0')}</div>
            <h2 className="mt-1 font-semibold text-white/90">{step.step}</h2>
            <p className="mt-2 text-sm leading-6 text-white/60">{step.detail}</p>
          </div>
        ))}
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-700 tracking-tight">Best models for this job</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {recommended.map(({ entry, model }) => (
            <Link key={entry.slug} href={`/models/${model.slug}`} className="group rounded-3xl border border-white/12 bg-white/[0.04] p-6 transition hover:border-white/35">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-display text-lg font-700" style={{ color: model.accent }}>{model.name}</h3>
                <span className="whitespace-nowrap text-xs text-white/50">{model.priceFrom.split(' per ')[0]}</span>
              </div>
              <p className="mt-2 text-sm leading-7 text-white/65">{entry.why}</p>
              <span className="mt-3 inline-block text-sm font-semibold text-white/70 group-hover:text-white">{model.shortName} details →</span>
            </Link>
          ))}
        </div>
      </section>

      {media.videos.length + media.images.length > 0 && (
        <section className="mt-12">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-2xl font-700 tracking-tight">Real examples generated on ManifoldGen</h2>
            <span className="text-xs text-white/40">hover for prompts</span>
          </div>
          <div className="mt-5">
            <MediaGrid videos={media.videos} images={media.images} />
          </div>
        </section>
      )}

      <section className="mt-12 grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="font-display text-lg font-700">Prompt starters</h2>
          <ul className="mt-4 space-y-3">
            {useCase.prompts.map((prompt) => (
              <li key={prompt} className="rounded-xl bg-black/40 p-4 font-mono text-xs leading-6 text-white/75">{prompt}</li>
            ))}
          </ul>
          <Link href="/studio" className="mt-4 inline-block rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-white/85">Open Studio with these</Link>
        </div>
        <FaqSection faqs={useCase.faqs} title={`${useCase.h1} FAQ`} />
      </section>

      <CrossLinks title="Other use cases" links={relatedUseCases.map((entry) => ({ label: entry.h1, href: `/ai-video-generator/${entry.slug}` }))} />
      <CrossLinks title="Model decisions" links={comparisonLinks} />
      <CtaStrip heading={`Make your first ${useCase.h1.toLowerCase()}`} sub="Prepaid credits from $0.01 — no subscription. Drafts cost cents." />
    </PageShell>
  );
}
