import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import BenchCompare from '@/components/seo/bench-compare';
import EditorialCompare from '@/components/seo/editorial-compare';
import { comparePairs } from '@/lib/seo/benchmarks';
import { COMPARISONS } from '@/lib/seo/comparisons';

export const dynamicParams = false;

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return [...comparePairs().map((pair) => ({ slug: pair.slug })), ...COMPARISONS.map(({ slug }) => ({ slug }))];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const comparison = COMPARISONS.find((entry) => entry.slug === slug);
  if (comparison) {
    return { title: comparison.title, description: comparison.metaDescription, alternates: { canonical: `/compare/${slug}` } };
  }
  const pair = comparePairs().find((entry) => entry.slug === slug);
  if (!pair) return {};
  return {
    title: `${pair.a.name} vs ${pair.b.name}: Same Prompt, Real Generations`,
    description: `We ran identical prompts through ${pair.a.name} and ${pair.b.name} on ManifoldGen and measured per-category winners. Watch every real generation and pick your model.`,
    alternates: { canonical: `/compare/${slug}` },
  };
}

export default async function ComparePage({ params }: PageProps) {
  const { slug } = await params;
  const comparison = COMPARISONS.find((entry) => entry.slug === slug);
  if (comparison) {
    return <EditorialCompare comparison={comparison} others={COMPARISONS.filter((entry) => entry.slug !== slug)} />;
  }
  const pair = comparePairs().find((entry) => entry.slug === slug);
  if (!pair) notFound();
  return <BenchCompare slug={pair.slug} a={pair.a} b={pair.b} />;
}