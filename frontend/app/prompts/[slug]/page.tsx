import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Check } from 'lucide-react';
import PromptBuilder from '@/components/prompt-builder';
import { CrossLinks, FaqSection, JsonLd, PageShell, breadcrumbJsonLd, faqJsonLd } from '@/components/seo/kit';
import { PROMPT_TOOLS, promptTool } from '@/lib/prompt-tools';
import { USE_CASES } from '@/lib/seo/usecases';

export const dynamicParams = false;

export function generateStaticParams() {
  return PROMPT_TOOLS.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const tool = promptTool((await params).slug);
  if (!tool) return {};
  return {
    title: tool.title,
    description: tool.metaDescription,
    alternates: { canonical: `/prompts/${tool.slug}` },
    openGraph: {
      title: tool.title,
      description: tool.metaDescription,
      images: [{ url: tool.image, alt: tool.imageAlt }],
    },
  };
}

export default async function PromptToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const tool = promptTool((await params).slug);
  if (!tool) notFound();
  const related = PROMPT_TOOLS.filter((entry) => entry.slug !== tool.slug).slice(0, 7);
  const useCases = USE_CASES.filter((entry) => tool.relatedUseCases.includes(entry.slug));
  const appJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: tool.name,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web',
    url: `https://manifoldgen.com/prompts/${tool.slug}`,
    description: tool.metaDescription,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };

  return (
    <PageShell>
      <JsonLd data={breadcrumbJsonLd([{ name: 'Prompt tools', path: '/prompts' }, { name: tool.h1, path: `/prompts/${tool.slug}` }])} />
      <JsonLd data={faqJsonLd(tool.faqs)} />
      <JsonLd data={appJsonLd} />
      <nav className="text-sm text-white/50"><Link href="/prompts" className="hover:text-white">Prompt tools</Link><span className="mx-2">/</span><span className="text-white/80">{tool.h1}</span></nav>

      <section className="mt-6 grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_430px]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b99aef]">{tool.eyebrow}</p>
          <h1 className="mt-4 font-display text-4xl font-700 tracking-tight md:text-6xl">{tool.h1}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-white/70">{tool.intro}</p>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/48">Built for {tool.audience}</p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold text-white/60">
            {['Free', 'No login', 'Copy anywhere', `Best with ${tool.recommendedModel}`].map((label) => <span key={label} className="rounded-full border border-white/15 px-3 py-1.5">{label}</span>)}
          </div>
        </div>
        <figure className="relative overflow-hidden rounded-3xl border border-white/12 bg-white/[0.03]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={tool.image} alt={tool.imageAlt} className="aspect-[4/3] h-full w-full object-cover" />
          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-5 pb-4 pt-14 text-xs text-white/55">Locally generated ManifoldGen prompt study</figcaption>
        </figure>
      </section>

      <div className="mt-10"><PromptBuilder tool={tool} /></div>

      <section className="mt-14 grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
        <div>
          <h2 className="font-display text-2xl font-700">Prompts you can steal</h2>
          <div className="mt-5 space-y-3">
            {tool.examples.map((example) => (
              <div key={example} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                <p className="font-mono text-xs leading-6 text-white/68">{example}</p>
                <Link href={`/studio?prompt=${encodeURIComponent(example)}`} className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[#cab3f3] hover:text-white">Render this prompt <ArrowRight size={13} /></Link>
              </div>
            ))}
          </div>
        </div>
        <aside className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40">What improves the result</p>
          <ul className="mt-5 space-y-4">
            {tool.tips.map((tip) => <li key={tip} className="flex gap-3 text-sm leading-6 text-white/68"><Check size={16} className="mt-1 shrink-0 text-[#7be7d9]" />{tip}</li>)}
          </ul>
          <Link href={tool.modelHref} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-black hover:bg-white/85">Try {tool.recommendedModel} <ArrowRight size={14} /></Link>
        </aside>
      </section>

      <FaqSection faqs={tool.faqs} title={`${tool.h1} FAQ`} />
      {useCases.length > 0 ? <CrossLinks title="Use-case playbooks" links={useCases.map((entry) => ({ label: entry.h1, href: `/ai-video-generator/${entry.slug}` }))} /> : null}
      <CrossLinks title="More free prompt tools" links={related.map((entry) => ({ label: entry.h1, href: `/prompts/${entry.slug}` }))} />
    </PageShell>
  );
}
