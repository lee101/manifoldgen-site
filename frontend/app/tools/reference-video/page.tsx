import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Code2 } from 'lucide-react';
import { GeneratorHeader } from '@/components/generator-directory';
import ReferenceVideoTool from './ReferenceVideoTool';

export const metadata: Metadata = {
  title: 'Reference Video Studio — ManifoldGen',
  description: 'Direct a video from reference images, a motion reference video and a soundtrack: Seedance 2.0 follows the choreography, cuts and camera of your video, up to 60 seconds.',
  alternates: { canonical: '/tools/reference-video' },
};

export default function ReferenceVideoPage() {
  return (
    <main className="min-h-screen bg-[var(--color-ink)] text-white">
      <GeneratorHeader section="Tools" />
      <div className="mx-auto max-w-7xl px-5 pt-4 pb-2 md:py-10">
        <Link href="/tools" className="inline-flex items-center gap-2 text-sm text-white/65 hover:text-white"><ArrowLeft size={15} /> All creative tools</Link>
        <ReferenceVideoTool />
        <section className="mt-10 flex flex-col justify-between gap-5 rounded-3xl border border-white/15 bg-white/[0.05] p-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-xl font-700">Build this workflow into your product</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-white/60">One JSON request returns an async job that directs a video from reference images, a motion reference video and a soundtrack, with long references split at cuts.</p>
          </div>
          <Link href="/api" className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-sm font-semibold hover:border-white/40"><Code2 size={16} /> API reference <ArrowRight size={15} /></Link>
        </section>
      </div>
    </main>
  );
}
