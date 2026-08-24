import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import MediaGrid from '@/components/seo/media-grid';
import { CtaStrip, CrossLinks, JsonLd, PageShell, breadcrumbJsonLd } from '@/components/seo/kit';
import { COMPARISONS } from '@/lib/seo/comparisons';
import { USE_CASES } from '@/lib/seo/usecases';
import { VIDEO_MODELS, videoModel } from '@/lib/seo/models';
import { mediaBundle } from '@/lib/seo/media';

export const dynamicParams = false;

export function generateStaticParams() {
  return VIDEO_MODELS.map(({ slug }) => ({ model: slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ model: string }> }): Promise<Metadata> {
  const model = videoModel((await params).model);
  if (!model) return {};
  return {
    title: `${model.name} on ManifoldGen — ${model.tagline.split('.')[0]}`.slice(0, 65),
    description: `${model.description.slice(0, 150)}…`,
    alternates: { canonical: `/models/${model.slug}` },
  };
}

export default async function ModelPage({ params }: { params: Promise<{ model: string }> }) {
  const model = videoModel((await params).model);
  if (!model) notFound();
  const media = mediaBundle(model.mediaKey);
  const comparisons = COMPARISONS.filter((c) => c.a.modelSlug === model.slug || c.b.modelSlug === model.slug);
  const useCases = USE_CASES.filter((u) => u.recommendedModels.some((r) => r.slug === model.slug));
  const siblings = VIDEO_MODELS.filter((m) => m.slug !== model.slug);

  return (
    <PageShell>
      <JsonLd data={breadcrumbJsonLd([{ name: 'Models', path: '/models' }, { name: model.name, path: `/models/${model.slug}` }])} />
      <section className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: model.accent }}>{model.vendor}</div>
          <h1 className="mt-4 font-display text-4xl font-700 tracking-tight md:text-6xl">{model.name}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-white/70">{model.description}</p>
          <p className="mt-4 max-w-3xl text-white/60">
            Choose <strong className="text-white/85">{model.shortName}</strong> for {model.verdictFor}.
          </p>
        </div>
        <aside className="rounded-3xl border border-white/12 bg-white/[0.04] p-6">
          <dl className="space-y-3 text-sm">
            {[['Price', model.priceFrom], ['Resolutions', model.resolutions.join(', ')], ['Durations', model.durations], ['Native audio', model.audio ? 'Yes — generated soundtrack' : 'No — add music/SFX in Studio']].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b border-white/8 pb-3 last:border-0 last:pb-0">
                <dt className="text-white/50">{label}</dt>
                <dd className="text-right text-white/85">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 space-y-2">
            {model.toolHrefs.map((tool) => (
              <Link key={tool.href} href={tool.href} className="block rounded-xl bg-white px-4 py-2.5 text-center text-sm font-semibold text-black hover:bg-white/85">{tool.label}</Link>
            ))}
            {model.apiHref && (
              <Link href={model.apiHref} className="block rounded-xl border border-white/20 px-4 py-2.5 text-center text-sm font-semibold hover:border-white/45">API reference</Link>
            )}
          </div>
        </aside>
      </section>

      <section className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {model.bestFor.map((strength) => (
          <div key={strength} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/75">{strength}</div>
        ))}
      </section>

      {media.videos.length + media.images.length > 0 && (
        <section className="mt-14">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-2xl font-700 tracking-tight">Real output generated on ManifoldGen</h2>
            <span className="text-xs text-white/40">hover for prompts</span>
          </div>
          <div className="mt-5">
            <MediaGrid videos={media.videos} images={media.images} />
          </div>
        </section>
      )}

      {useCases.length > 0 && (
        <CrossLinks
          title={`Use ${model.shortName} for`}
          links={useCases.map((useCase) => ({ label: useCase.h1, href: `/ai-video-generator/${useCase.slug}` }))}
        />
      )}
      {comparisons.length > 0 && (
        <CrossLinks
          title={`${model.shortName} vs the field`}
          links={comparisons.map((comparison) => ({ label: comparison.h1, href: `/compare/${comparison.slug}` }))}
        />
      )}
      <CrossLinks title="Other models" links={siblings.map((sibling) => ({ label: sibling.name, href: `/models/${sibling.slug}` }))} />

      <CtaStrip
        heading={`Run ${model.shortName} in seconds`}
        sub="Open Studio, paste a prompt, or wire the same model into your product through the API."
      />

      <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="font-display text-lg font-700">Build with every model, not just one</h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-white/60">
          Draft on LTX 2 at ~$0.09 a clip, hero-shot on {model.name}, then score it with $0.35 music and ~$0.86 sound effects — same
          key, same balance. See the <Link href="/api" className="text-[var(--color-accent-2)] hover:underline">API overview <ArrowRight size={12} className="inline" /></Link> or browse all <Link href="/ai-video-generator" className="text-[var(--color-accent-2)] hover:underline">use cases</Link>.
        </p>
      </section>
    </PageShell>
  );
}
