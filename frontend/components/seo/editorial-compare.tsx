import Link from 'next/link';
import MediaGrid from '@/components/seo/media-grid';
import { CtaStrip, CrossLinks, FaqSection, JsonLd, PageShell, SpecTable, breadcrumbJsonLd, faqJsonLd } from '@/components/seo/kit';
import type { Comparison } from '@/lib/seo/types';
import { videoModel } from '@/lib/seo/models';
import { mediaBundle } from '@/lib/seo/media';

const TOOL_HREFS: Record<string, string> = {
  'flux-2-dev': '/tools/flux-2',
  'gpt-image-2': '/tools/gpt-image',
  'nano-banana-2': '/tools/nano-banana',
};

export default function EditorialCompare({ comparison, others }: { comparison: Comparison; others: Comparison[] }) {
  const media = mediaBundle(comparison.mediaKey);
  const aName = comparison.a.displayName;
  const bName = comparison.b.displayName;

  return (
    <PageShell>
      <JsonLd data={breadcrumbJsonLd([{ name: 'Compare', path: '/compare' }, { name: comparison.h1, path: `/compare/${comparison.slug}` }])} />
      <JsonLd data={faqJsonLd(comparison.faqs)} />
      <nav className="text-sm text-white/50">
        <Link href="/compare" className="hover:text-white">Compare</Link>
        <span className="mx-2">/</span>
        <span className="text-white/80">{comparison.h1}</span>
      </nav>
      <section className="mt-6 max-w-3xl">
        <h1 className="font-display text-4xl font-700 tracking-tight md:text-5xl">{comparison.h1}</h1>
        <p className="mt-3 text-lg font-medium leading-8 text-white/85">{comparison.question}</p>
        <div className="mt-5 rounded-2xl border border-[var(--color-accent-2)]/30 bg-[var(--color-accent-2)]/[0.06] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-accent-2)]">Verdict</p>
          <p className="mt-2 leading-8 text-white/85">{comparison.verdict}</p>
        </div>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-2">
        {[comparison.a, comparison.b].map((side) => (
          <div key={side.modelSlug} className="rounded-3xl border border-white/12 bg-white/[0.04] p-6">
            <h2 className="font-display text-xl font-700">{side.displayName}</h2>
            <ul className="mt-4 space-y-2">
              {side.bullets.map((bullet) => (
                <li key={bullet} className="flex gap-2 text-sm leading-7 text-white/70"><span className="text-[var(--color-accent-2)]">✓</span>{bullet}</li>
              ))}
            </ul>
            <Link href={TOOL_HREFS[side.modelSlug] ?? `/models/${side.modelSlug}`} className="mt-4 inline-block text-sm font-semibold text-white/80 hover:text-white">Open {side.displayName} →</Link>
          </div>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-700 tracking-tight">Specs side by side</h2>
        <div className="mt-5">
          <SpecTable columns={['', aName, bName]} rows={comparison.specRows.map((row) => [row.label, row.a, row.b])} />
        </div>
      </section>

      {media.videos.length + media.images.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl font-700 tracking-tight">{aName} and {bName} on real prompts</h2>
          <p className="mt-2 text-sm text-white/55">Genuine ManifoldGen generations from our public gallery — hover any card for its prompt.</p>
          <div className="mt-5">
            <MediaGrid videos={media.videos} images={media.images} />
          </div>
        </section>
      )}

      <section className="mt-12 grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <h3 className="font-display text-lg font-700">Choose {aName} if</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-white/65">{comparison.chooseA.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <h3 className="font-display text-lg font-700">Choose {bName} if</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-white/65">{comparison.chooseB.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      </section>

      <FaqSection faqs={comparison.faqs} />
      <CrossLinks title="More comparisons" links={others.slice(0, 8).map((other) => ({ label: other.h1, href: `/compare/${other.slug}` }))} />
      <CtaStrip heading="Try both on your own prompt" sub={`${aName} and ${bName} run on the same balance — switch models mid-project.`} />
    </PageShell>
  );
}
