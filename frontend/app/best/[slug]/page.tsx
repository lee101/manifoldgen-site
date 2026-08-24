import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import BenchBest from '@/components/seo/bench-best';
import EditorialBest from '@/components/seo/editorial-best';
import { CATEGORIES } from '@/lib/seo/benchmarks';
import { BEST_TOPICS } from '@/lib/seo/best-topics';

export const dynamicParams = false;

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return [...CATEGORIES.map(({ key }) => ({ slug: key })), ...BEST_TOPICS.map(({ slug }) => ({ slug }))];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const topic = BEST_TOPICS.find((entry) => entry.slug === slug);
  if (topic) {
    return { title: topic.title, description: topic.metaDescription, alternates: { canonical: `/best/${slug}` } };
  }
  const category = CATEGORIES.find((entry) => entry.key === slug);
  if (!category) return {};
  const winner = category.ranking[0];
  const winnerName = { manifold: 'Manifold H3', seedance: 'Seedance 2', 'seedance-fast': 'Seedance 2 Fast', 'ltx-2': 'LTX 2', wan: 'Wan' }[winner] ?? winner;
  return {
    title: `Best AI Video Model for ${category.label} (2026) — Tested`,
    description: `We ran the same ${category.label.toLowerCase()} prompt through Manifold H3, Seedance 2, LTX 2 and Wan. ${winnerName} wins — watch every generation and decide for yourself.`,
    alternates: { canonical: `/best/${slug}` },
  };
}

export default async function BestPage({ params }: PageProps) {
  const { slug } = await params;
  const topic = BEST_TOPICS.find((entry) => entry.slug === slug);
  if (topic) {
    return <EditorialBest topic={topic} others={BEST_TOPICS.filter((entry) => entry.slug !== slug)} />;
  }
  const category = CATEGORIES.find((entry) => entry.key === slug);
  if (!category) notFound();
  return <BenchBest category={category} />;
}
