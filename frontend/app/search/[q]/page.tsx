import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import SearchGallery, { type SearchImage } from '@/components/search/search-gallery';
import { CURATED_SEARCH_PAGES, relatedSearchPages } from '@/lib/search-pages';

export const dynamic = 'force-static';
export const dynamicParams = false;

const API_ORIGIN = process.env.MANIFOLDGEN_API_ORIGIN || 'http://localhost:8116';

interface PageParams {
  params: Promise<{ q: string }>;
}

async function fetchInitialResults(query: string): Promise<SearchImage[] | undefined> {
  try {
    const res = await fetch(
      `${API_ORIGIN}/api/images/semantic?q=${encodeURIComponent(query)}&top_k=24`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return undefined;
    const data: unknown = await res.json();
    const rows = (data as { results?: unknown }).results;
    return Array.isArray(rows) ? (rows as SearchImage[]) : undefined;
  } catch {
    return undefined;
  }
}

export function generateStaticParams() {
  return CURATED_SEARCH_PAGES.map(({ slug }) => ({ q: slug }));
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { q } = await params;
  const entry = CURATED_SEARCH_PAGES.find((page) => page.slug === q);
  if (!entry) return {};
  return {
    title: entry.title,
    description: entry.blurb,
    alternates: { canonical: `/search/${entry.slug}` },
  };
}

export default async function CuratedSearchPage({ params }: PageParams) {
  const { q } = await params;
  const entry = CURATED_SEARCH_PAGES.find((page) => page.slug === q);
  if (!entry) notFound();
  const initial = await fetchInitialResults(entry.query);
  const related = relatedSearchPages(entry);

  return (
    <main className="min-h-screen bg-[var(--color-ink)] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link href="/" className="font-display text-lg font-700 tracking-tight">ManifoldGen</Link>
          <nav className="flex items-center gap-1 text-sm text-white/70">
            <Link href="/" className="rounded-full px-3 py-2 hover:text-white">Explore</Link>
            <Link href="/tools" className="rounded-full px-3 py-2 hover:text-white">Tools</Link>
            <Link href="/studio" className="rounded-full bg-white px-4 py-2 font-semibold text-black">Studio</Link>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-10 md:py-14">
        <section className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-2)]">AI image gallery</p>
          <h1 className="mt-4 font-display text-4xl font-700 tracking-tight md:text-6xl">{entry.title}</h1>
          <p className="mt-5 text-lg leading-8 text-white/70">{entry.blurb}</p>
        </section>
      </div>
      <section className="mt-2 w-full">
        <SearchGallery query={entry.query} initial={initial} />
      </section>
      <div className="mx-auto max-w-7xl px-5 pb-16">
        <section className="mt-12">
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Related searches</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {related.map((page) => (
              <Link
                key={page.slug}
                href={`/search/${page.slug}`}
                className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/75 transition hover:border-white/40 hover:text-white"
              >
                {page.title}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
