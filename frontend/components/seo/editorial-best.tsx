import Link from 'next/link';
import MediaGrid from '@/components/seo/media-grid';
import { CtaStrip, CrossLinks, FaqSection, JsonLd, PageShell, SpecTable, breadcrumbJsonLd, faqJsonLd } from '@/components/seo/kit';
import type { BestTopic } from '@/lib/seo/types';
import { mediaBundle } from '@/lib/seo/media';

export default function EditorialBest({ topic, others }: { topic: BestTopic; others: BestTopic[] }) {
  const media = mediaBundle(topic.mediaKey);

  return (
    <PageShell>
      <JsonLd data={breadcrumbJsonLd([{ name: 'Answers', path: '/best' }, { name: topic.question, path: `/best/${topic.slug}` }])} />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'QAPage',
          mainEntity: {
            '@type': 'Question',
            name: topic.question,
            text: topic.question,
            answerCount: 1,
            acceptedAnswer: { '@type': 'Answer', text: topic.directAnswer },
          },
        }}
      />
      <JsonLd data={faqJsonLd(topic.faqs)} />
      <nav className="text-sm text-white/50">
        <Link href="/best" className="hover:text-white">Answers</Link>
        <span className="mx-2">/</span>
        <span className="text-white/80">{topic.h1}</span>
      </nav>
      <section className="mt-6 max-w-3xl">
        <h1 className="font-display text-4xl font-700 tracking-tight md:text-5xl">{topic.h1}</h1>
        <div className="mt-6 rounded-2xl border border-[var(--color-accent-2)]/30 bg-[var(--color-accent-2)]/[0.06] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-accent-2)]">Short answer</p>
          <p className="mt-2 text-lg leading-8 text-white/90">{topic.directAnswer}</p>
        </div>
      </section>

      <section className="mt-12 max-w-4xl">
        <h2 className="font-display text-2xl font-700 tracking-tight">The evidence</h2>
        <div className="mt-5 space-y-3">
          {topic.evidence.map((item) => (
            <div key={item.claim} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="font-semibold text-white/90">{item.claim}</h3>
              <p className="mt-1.5 text-sm leading-7 text-white/60">{item.support}</p>
            </div>
          ))}
        </div>
      </section>

      {topic.table && (
        <section className="mt-12 max-w-4xl">
          <SpecTable columns={[topic.table.columns[0], topic.table.columns[1], topic.table.columns[2]]} rows={topic.table.rows.map((row) => [row[0], row[1], row[2]])} />
        </section>
      )}

      {media.videos.length + media.images.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl font-700 tracking-tight">Generated on ManifoldGen</h2>
          <div className="mt-5">
            <MediaGrid videos={media.videos} images={media.images} />
          </div>
        </section>
      )}

      {topic.runnersUp && (
        <section className="mt-12 max-w-3xl rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Also worth knowing</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-white/65">
            {topic.runnersUp.map((runner) => <li key={runner}>{runner}</li>)}
          </ul>
        </section>
      )}

      <FaqSection faqs={topic.faqs} />
      <CrossLinks title="More answers" links={others.slice(0, 8).map((other) => ({ label: other.question, href: `/best/${other.slug}` }))} />
      <CtaStrip heading="Check our work" sub="Every price here is live at /api/pricing — and every model runs in Studio on the same balance." />
    </PageShell>
  );
}
