import { JsonLd, toolJsonLd } from '@/components/seo/kit';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Code2 } from 'lucide-react';
import { GeneratorHeader } from '@/components/generator-directory';
import OrbitVideoTool from './OrbitVideoTool';

export const metadata: Metadata = {
  title: '360° Orbit Video Generator — ManifoldGen',
  description: 'Turn one photo into a frozen-time 360° camera orbit that lands back on its first frame: MiniMax H3 with the 360 Orbit LoRA, 3 seconds at 768 x 768.',
  alternates: { canonical: '/tools/orbit-video' },
};

function OrbitVideoPage() {
  return (
    <main className="min-h-screen bg-[var(--color-ink)] text-white">
      <GeneratorHeader section="Tools" />
      <div className="mx-auto max-w-7xl px-5 pt-4 pb-2 md:py-10">
        <Link href="/tools" className="inline-flex items-center gap-2 text-sm text-white/65 hover:text-white"><ArrowLeft size={15} /> All creative tools</Link>
        <OrbitVideoTool />
        <section className="mt-10 flex flex-col justify-between gap-5 rounded-3xl border border-white/15 bg-white/[0.05] p-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-xl font-700">Build this workflow into your product</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-white/60">One JSON request with an image URL returns an async job that renders the 360° orbit, at a fixed price set before it starts.</p>
          </div>
          <Link href="/api" className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-sm font-semibold hover:border-white/40"><Code2 size={16} /> API reference <ArrowRight size={15} /></Link>
        </section>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <>
      <JsonLd data={toolJsonLd(metadata, '/tools/orbit-video')} />
      <OrbitVideoPage />
    </>
  );
}
