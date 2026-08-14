import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Check } from 'lucide-react';
import { GeneratorHeader } from '@/components/generator-directory';
import { AnimationTransferWorkspace } from '@/components/animation-transfer-workspace';

export const metadata: Metadata = {
  title: 'AI Character Animation Transfer',
  description: 'Use AI character animation to transfer body motion, facial expression, timing, and optional audio from a driving video onto a reference character with Wan Animate 2.',
  alternates: { canonical: '/tool/animate-video' },
};

export default function AnimateVideoToolPage() {
  return <main className="min-h-screen bg-[var(--color-ink)] text-white">
    <GeneratorHeader section="Tools" />
    <div className="mx-auto max-w-7xl px-5 py-10 md:py-14">
      <Link href="/tools" className="inline-flex items-center gap-2 text-sm text-white/45 hover:text-white"><ArrowLeft size={15} /> All video tools</Link>
      <section className="grid gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
        <div><div className="text-xs font-semibold uppercase tracking-[.2em] text-[#9c8cff]">WAN ANIMATE 2 · BODY ANIMATION TRANSFER</div><h1 className="mt-4 max-w-4xl font-display text-4xl font-700 tracking-tight md:text-6xl">Make any character perform your video.</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-white/55">Pair one character image with a driving clip. Animation Transfer carries over body motion, facial expression, timing, and optional sound while redrawing every frame around your subject.</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[.025] p-5"><div className="text-xs uppercase tracking-[.16em] text-white/35">Best source material</div><div className="mt-3 space-y-2">{['Visible full body and face', 'One main performer', 'Uncut 3–15 second motion'].map((item) => <div key={item} className="flex items-center gap-2 text-sm text-white/65"><Check size={14} className="text-[#9c8cff]" />{item}</div>)}</div><div className="mt-4 border-t border-white/10 pt-4 text-sm text-white/45">From 60 credits for 3s Preview · final billing follows measured compute</div></div>
      </section>
      <AnimationTransferWorkspace />
      <section className="mt-10 rounded-3xl border border-white/10 bg-white/[.025] p-6"><h2 className="font-display text-xl font-700">Built for the Studio workflow</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-white/45">Start here and open the result directly in a new Studio project, or right-click a video already on the Studio timeline and choose Animation Transfer. The same durable job, credit settlement, and result library power both paths.</p></section>
    </div>
  </main>;
}
