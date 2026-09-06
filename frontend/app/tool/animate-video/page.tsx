import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Check } from 'lucide-react';
import { GeneratorHeader } from '@/components/generator-directory';
import { AnimationTransferWorkspace } from '@/components/animation-transfer-workspace';

export const metadata: Metadata = {
  title: 'Wan Animate Move & Replace',
  description: 'Move a complete reference image or replace a source-video performer while transferring motion with Wan 2.2 Animate.',
  alternates: { canonical: '/tool/animate-video' },
};

export default function AnimateVideoToolPage() {
  return <main className="min-h-screen bg-[var(--color-ink)] text-white">
    <GeneratorHeader section="Tools" />
    <div className="mx-auto max-w-7xl px-5 py-10 md:py-14">
      <Link href="/tools" className="inline-flex items-center gap-2 text-sm text-white/45 hover:text-white"><ArrowLeft size={15} /> All video tools</Link>
      <section className="grid gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
        <div><div className="text-xs font-semibold uppercase tracking-[.2em] text-[#9c8cff]">WAN 2.2 ANIMATE · MOVE + REPLACE</div><h1 className="mt-4 max-w-4xl font-display text-4xl font-700 tracking-tight md:text-6xl">Move the image. Or replace the performer.</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-white/55">Move keeps the reference image’s world. Replace keeps the source video’s world. Both transfer the driving performance onto your character.</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[.025] p-5"><div className="text-xs uppercase tracking-[.16em] text-white/35">Best source material</div><div className="mt-3 space-y-2">{['Visible full body and face', 'One main performer', 'Short, uncut motion'].map((item) => <div key={item} className="flex items-center gap-2 text-sm text-white/65"><Check size={14} className="text-[#9c8cff]" />{item}</div>)}</div><div className="mt-4 border-t border-white/10 pt-4 text-sm text-white/45">480p–720p · final billing follows source frames</div></div>
      </section>
      <AnimationTransferWorkspace />
      <section className="mt-10 rounded-3xl border border-white/10 bg-white/[.025] p-6"><h2 className="font-display text-xl font-700">Built for the Studio workflow</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-white/45">Start here and open the result directly in a new Studio project, or right-click a video already on the Studio timeline and choose Animation Transfer. The same durable job, credit settlement, and result library power both paths.</p></section>
    </div>
  </main>;
}
