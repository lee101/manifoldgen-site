import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, BookOpen } from 'lucide-react';
import { articles } from '../articles';

import type { BlogArticle, BlogBlock, BlogExample } from '../articles';


type ArticlePageProps = { params: Promise<{ slug: string }> };
export function generateStaticParams() {
  return articles.map(({ slug }) => ({ slug }));
}

const SITE_URL = 'https://manifoldgen.com';

function absolute(path: string) {
  return `${SITE_URL}${path}`;
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = articles.find((entry) => entry.slug === slug);
  if (!article) return { title: 'Blog' };
  const url = `${SITE_URL}/blog/${article.slug}`;
  return {
    title: article.title,
    description: article.excerpt,
    alternates: { canonical: `/blog/${article.slug}` },
    openGraph: {
      type: 'article',
      url,
      title: article.title,
      description: article.excerpt,
      publishedTime: article.date,
      images: [{ url: absolute(article.ogImage), width: 1200, height: 630, alt: article.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.excerpt,
      images: [absolute(article.ogImage)],
    },
  };
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function CodeBlock({ children }: { children: string }) {
  return <pre className="overflow-x-auto rounded-2xl border border-white/10 bg-black/40 p-4 text-[13px] leading-6 text-white/75"><code>{children}</code></pre>;
}

function ExampleMedia({ src, poster, aspect, caption, seconds }: { src: string; poster?: string; aspect?: string; caption?: string; seconds?: number }) {
  const vertical = aspect === '9:16';
  if (src.endsWith('.webm') || src.endsWith('.mp4')) {
    return (
      <div className={vertical ? 'mx-auto w-full max-w-[300px]' : 'w-full'}>
        <video className="aspect-video w-full rounded-2xl border border-white/10 bg-black object-cover" style={vertical ? { aspectRatio: '9 / 16' } : undefined} controls muted loop playsInline preload="metadata" poster={poster} src={src} />
        {(caption || seconds) && (
          <p className="mt-2 text-center text-xs text-white/35">{caption}{seconds ? ` · ${seconds}s` : ''}</p>
        )}
      </div>
    );
  }
  return (
    <figure className={vertical ? 'mx-auto w-full max-w-[300px]' : 'w-full'}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="aspect-video w-full rounded-2xl border border-white/10 object-cover" style={vertical ? { aspectRatio: '9 / 16' } : undefined} src={src} alt={caption || 'Generated output'} loading="lazy" />
      {caption && <figcaption className="mt-2 text-center text-xs text-white/35">{caption}</figcaption>}
    </figure>
  );
}

function ExampleBlock({ example }: { example: BlogExample }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[.03]">
      {example.label && <div className="border-b border-white/10 px-5 py-3 text-xs font-semibold tracking-[.14em] text-[#bcb2ff]">{example.label.toUpperCase()}</div>}
      <div className="space-y-4 p-5">
        {example.input && (
          <div>
            <p className="mb-2 text-xs font-semibold tracking-[.14em] text-white/40">INPUT</p>
            <ExampleMedia {...example.input} />
          </div>
        )}
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[.14em] text-[#7be7d9]">PROMPT</p>
          <CodeBlock>{example.prompt}</CodeBlock>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[.14em] text-white/40">OUTPUT — GENERATED WITH MANIFOLDGEN</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {example.media.map((item) => (
              <ExampleMedia key={item.src} {...item} />
            ))}
          </div>
        </div>
        {example.note && <p className="text-sm leading-6 text-white/50">{example.note}</p>}
      </div>
    </div>
  );
}

function BlockRenderer({ block }: { block: BlogBlock }) {
  switch (block.type) {
    case 'p':
      return <p>{block.text}</p>;
    case 'h2':
      return <h2 className="font-display text-3xl font-700 tracking-tight text-white">{block.text}</h2>;
    case 'h3':
      return <h3 className="font-display text-xl font-700 tracking-tight text-white">{block.text}</h3>;
    case 'list': {
      const items = block.items.map((item) => (
        <li key={item} className="leading-7">{item}</li>
      ));
      return block.ordered
        ? <ol className="list-decimal space-y-2 pl-5">{items}</ol>
        : <ul className="list-disc space-y-2 pl-5">{items}</ul>;
    }
    case 'code':
      return <CodeBlock>{block.text}</CodeBlock>;
    case 'callout':
      return (
        <div className="rounded-2xl border border-[#37d6c5]/20 bg-[#37d6c5]/[.06] p-5 text-[15px] leading-7 text-white/70">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#7be7d9]"><BookOpen size={15} /> {block.title}</div>
          <p className="mt-3">{block.text}</p>
        </div>
      );
    case 'table':
      return (
        <div className="w-full overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/[.05] font-semibold text-white">
                {block.head.map((cell) => (
                  <th key={cell} className="px-4 py-3 text-left">{cell}</th>
                ))}
              </tr>
            </thead>
            <tbody className="text-white/65">
              {block.rows.map((row) => (
                <tr key={row[0]} className="border-b border-white/5 last:border-b-0">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className={cellIndex === 0 ? 'px-4 py-3 text-white' : 'px-4 py-3'}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'example':
      return <ExampleBlock example={block.example} />;
  }
}

function ArticleJsonLd({ article }: { article: BlogArticle }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.title,
    description: article.excerpt,
    image: absolute(article.ogImage),
    datePublished: article.date,
    dateModified: article.date,
    author: { '@type': 'Organization', name: 'ManifoldGen', url: SITE_URL },
    publisher: { '@type': 'Organization', name: 'ManifoldGen', url: SITE_URL },
    mainEntityOfPage: `${SITE_URL}/blog/${article.slug}`,
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

export default async function BlogArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = articles.find((entry) => entry.slug === slug);
  if (!article) {
    return <main className="min-h-screen bg-[var(--color-ink)] p-10 text-white">Article not found.</main>;
  }

  return (
    <main className="min-h-screen bg-[var(--color-ink)] text-white">
      <ArticleJsonLd article={article} />
      <header className="border-b border-white/10 bg-[#07070a]/85">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/blog" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white"><ArrowLeft size={16} /> All notes</Link>
          <Link href="/studio" className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold">Open Studio <ArrowRight size={14} /></Link>
        </div>
      </header>

      <article className="mx-auto max-w-6xl px-5 pb-24 pt-14 sm:pt-20">
        <header className="border-b border-white/10 pb-10">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-[.14em] text-[#bcb2ff]"><BookOpen size={14} /> {article.category.toUpperCase()} · {formatDate(article.date)} · {article.readTime.toUpperCase()}</div>
          <h1 className="mt-5 max-w-4xl font-display text-4xl font-700 tracking-tight sm:text-6xl">{article.title}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-white/55">{article.excerpt}</p>
        </header>

        <div className="mt-12 max-w-3xl space-y-10 text-[16px] leading-8 text-white/65">
          {article.blocks.map((block, index) => (
            <BlockRenderer key={index} block={block} />
          ))}
        </div>

        <section className="mt-16 flex flex-col justify-between gap-5 rounded-3xl border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/[.08] p-7 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-2xl font-700">Try these prompts on your own shot.</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/50">Every example on this page was generated with ManifoldGen. Open the Studio and run the same structure on your idea.</p>
          </div>
          <Link href="/studio" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#14121f]">Open Studio <ArrowRight size={15} /></Link>
        </section>
      </article>
    </main>
  );
}
