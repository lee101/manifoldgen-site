import { JsonLd, toolJsonLd } from '@/components/seo/kit';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { GeneratorHeader } from '@/components/generator-directory';
import PoseLibrary from '@/components/pose-library/PoseLibrary';

export const metadata: Metadata = {
  title: 'Pose Library — Searchable Pose References With Depth Maps — ManifoldGen',
  description: 'Search 2,000+ mannequin pose references from five camera angles with depth and skeleton maps. Open a pose in the 3D puppet, then draw it in any style.',
  alternates: { canonical: '/tools/pose-library' },
};

export default function Page() {
  return (
    <>
      <JsonLd data={toolJsonLd(metadata, '/tools/pose-library')} />
      <main className="min-h-screen bg-[var(--color-ink)] text-white">
        <GeneratorHeader section="Tools" />
        <div className="mx-auto max-w-7xl px-5 pt-4 pb-16 md:py-10">
          <Link href="/tools" className="inline-flex items-center gap-2 text-sm text-white/65 hover:text-white"><ArrowLeft size={15} /> All creative tools</Link>
          <PoseLibrary />
        </div>
      </main>
    </>
  );
}
