import { JsonLd, toolJsonLd } from '@/components/seo/kit';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { GeneratorHeader } from '@/components/generator-directory';
import PosePuppet from '@/components/pose-library/PosePuppet';

export const metadata: Metadata = {
  title: 'Pose Puppet — Pose 1 to 3 Characters in 3D — ManifoldGen',
  description: 'Pose up to three man and woman puppets in 3D with IK, move, turn and resize them, take a screenshot or a depth map, then draw the scene in any style.',
  alternates: { canonical: '/tools/pose-puppet' },
};

export default function Page() {
  return (
    <>
      <JsonLd data={toolJsonLd(metadata, '/tools/pose-puppet')} />
      <main className="min-h-screen bg-[var(--color-ink)] text-white">
        <GeneratorHeader section="Tools" />
        <div className="mx-auto max-w-7xl px-5 pt-4 pb-2 md:py-10">
          <div className="flex gap-5 text-sm text-white/65">
            <Link href="/tools" className="inline-flex items-center gap-2 hover:text-white"><ArrowLeft size={15} /> All creative tools</Link>
            <Link href="/tools/pose-library" className="hover:text-white">Browse the pose library</Link>
          </div>
          <PosePuppet />
        </div>
      </main>
    </>
  );
}
