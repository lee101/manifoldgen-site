import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Banknote, Check, Clapperboard, Compass, Cpu, Image as ImageIcon } from 'lucide-react';
import { guideSections, guides, relatedGuides } from '../registry';
import type { GuideBlock } from '../types';

type GuidePageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return guides.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = guides.find((g) => g.slug === slug);
  return guide ? { title: guide.title, description: guide.excerpt } : { title: 'Guides — ManifoldGen' };
}

/** Renders **bold** spans; used by paragraphs, list items, and callouts so emphasis behaves identically everywhere. */
function rich(text: string): ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((part, index) =>
    index % 2 ? <strong key={index} className="font-semibold text-white">{part}</strong> : part,
  );
}

function PromptBlock({ label, body }: { label?: string; body: string }) {
  return (
    <div>
      {label ? <div className="mb-2 text-xs font-semibold tracking-[.14em] text-[#7be7d9]">{label.toUpperCase()}</div> : null}
      <pre className="overflow-x-auto rounded-2xl border border-white/10 bg-black/40 p-4 text-[13px] leading-6 text-white/75"><code>{body}</code></pre>
    </div>
  );
}

function Blocks({ blocks }: { blocks: GuideBlock[] }) {
  return (
    <div className="space-y-8">
      {blocks.map((block, index) => {
        switch (block.t) {
          case 'h2':
            return <h2 key={index} className="!mt-14 font-display text-3xl font-700 tracking-tight text-white">{block.text}</h2>;
          case 'h3':
            return <h3 key={index} className="!mt-10 text-lg font-semibold text-white">{block.text}</h3>;
          case 'p':
            return <p key={index} className="leading-8">{rich(block.text)}</p>;
          case 'list':
            return (
              <ul key={index} className="space-y-3">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="flex items-start gap-3 leading-7">
                    <Check size={15} className="mt-[7px] shrink-0 text-[#7be7d9]" />
                    <span>{rich(item)}</span>
                  </li>
                ))}
              </ul>
            );
          case 'steps':
            return (
              <ol key={index} className="grid gap-3">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="flex items-start gap-4 leading-7">
                    <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-md border border-white/15 bg-white/5 text-xs font-semibold text-[#bcb2ff]">{String(itemIndex + 1).padStart(2, '0')}</span>
                    <span>{rich(item)}</span>
                  </li>
                ))}
              </ol>
            );
          case 'prompt':
            return <PromptBlock key={index} label={block.label} body={block.body} />;
          case 'callout': {
            const tone = block.tone === 'teal'
              ? 'border-[#37d6c5]/20 bg-[#37d6c5]/[.06]'
              : 'border-[var(--color-accent)]/25 bg-[var(--color-accent)]/[.07]';
            const icon = block.tone === 'teal' ? <Cpu size={16} className="text-[#7be7d9]" /> : <Clapperboard size={16} className="text-[#bcb2ff]" />;
            const titleColor = block.tone === 'teal' ? 'text-[#7be7d9]' : 'text-[#bcb2ff]';
            return (
              <div key={index} className={`rounded-2xl border p-5 text-[15px] leading-7 text-white/70 ${tone}`}>
                <div className={`flex items-center gap-2 text-sm font-semibold ${titleColor}`}>{icon} {block.title}</div>
                <p className="mt-3">{rich(block.body)}</p>
              </div>
            );
          }
        }
      })}
    </div>
  );
}

const SECTION_ICONS = { foundations: Compass, personas: ImageIcon, continuity: Clapperboard, craft: Cpu, money: Banknote } as const;

export default async function GuidePage({ params }: GuidePageProps) {
  const { slug } = await params;
  const guide = guides.find((g) => g.slug === slug);
  if (!guide) notFound();

  const related = relatedGuides(guide);
  const section = guideSections.find((entry) => entry.id === guide.section);
  const SectionIcon = SECTION_ICONS[guide.section];

  return (
    <main className="min-h-screen bg-[var(--color-ink)] text-white">
      <header className="border-b border-white/10 bg-[#07070a]/85">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/blog/guides" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white"><ArrowLeft size={16} /> All guides</Link>
          <Link href="/studio" className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold">Open Studio <ArrowRight size={14} /></Link>
        </div>
      </header>

      <article className="mx-auto max-w-6xl px-5 pb-24 pt-14 sm:pt-20">
        <header className="border-b border-white/10 pb-10">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-[.14em] text-[#bcb2ff]">
            <SectionIcon size={14} /> {section?.title.toUpperCase()} · {guide.category.toUpperCase()} · {guide.readTime.toUpperCase()} · UPDATED {guide.updated.toUpperCase()}
          </div>
          <h1 className="mt-5 max-w-4xl font-display text-4xl font-700 tracking-tight sm:text-6xl">{guide.title}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-white/55">{guide.excerpt}</p>
        </header>

        <div className="mt-12 max-w-3xl space-y-8 text-[16px] text-white/65">
          <Blocks blocks={guide.blocks} />
        </div>

        <div className="mt-16 flex flex-col justify-between gap-6 rounded-3xl border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/[.08] p-7 sm:flex-row sm:items-center sm:p-9">
          <div>
            <h2 className="font-display text-2xl font-700">Put the workflow to work.</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/50">The Studio has the reference editing, relighting, and batch tools these guides assume.</p>
          </div>
          <Link href="/studio" className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#14121f]">Open Studio <ArrowRight size={15} /></Link>
        </div>

        <section className="mt-16" aria-labelledby="related-heading">
          <h2 id="related-heading" className="text-xs font-semibold tracking-[.15em] text-white/40">KEEP READING</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {related.map((entry) => (
              <Link key={entry.slug} href={`/blog/guides/${entry.slug}`} className="group rounded-2xl border border-white/10 bg-white/[.025] p-5 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[.05]">
                <div className="text-xs text-white/40">{entry.category} · {entry.readTime}</div>
                <h3 className="mt-3 font-display text-lg font-700 leading-snug text-white/90 group-hover:text-white">{entry.title}</h3>
              </Link>
            ))}
          </div>
        </section>
      </article>
    </main>
  );
}
