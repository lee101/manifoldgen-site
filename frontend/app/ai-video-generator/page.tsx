import type { Metadata } from 'next';
import Link from 'next/link';
import { USE_CASES } from '@/lib/seo/usecases';
import { CtaStrip, PageShell } from '@/components/seo/kit';

export const metadata: Metadata = {
  title: 'AI Video Generator for Every Job — Ads, TikTok, VFX, Anime',
  description:
    'Programmatic playbooks for AI video: product ads, UGC, TikTok, YouTube Shorts, music videos, VFX, anime and more — with model picks, prices, and real examples.',
  alternates: { canonical: '/ai-video-generator' },
};

export default function UseCaseIndex() {
  return (
    <PageShell>
      <section className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-2)]">Use cases</p>
        <h1 className="mt-4 font-display text-4xl font-700 tracking-tight md:text-6xl">The right model for every video job</h1>
        <p className="mt-5 text-lg leading-8 text-white/70">
          Each playbook names the models that actually fit the job, what a clip costs, prompt starters, and real generations
          produced on ManifoldGen. Pick a job:
        </p>
      </section>
      <section className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {USE_CASES.map((useCase) => (
          <Link
            key={useCase.slug}
            href={`/ai-video-generator/${useCase.slug}`}
            className="group rounded-2xl border border-white/12 bg-white/[0.04] p-5 transition hover:border-white/35"
          >
            <h2 className="font-display text-lg font-700 leading-snug">{useCase.h1}</h2>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/60">{useCase.intro}</p>
          </Link>
        ))}
      </section>
      <CtaStrip heading="One studio, every use case" sub="Generate, edit, score, and export without leaving ManifoldGen." />
    </PageShell>
  );
}
