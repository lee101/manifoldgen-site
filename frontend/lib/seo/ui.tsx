import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { BenchCategory, BenchModel } from './benchmarks';
import { completedClip } from './benchmarks';

export const SITE_URL = 'https://manifoldgen.com';

export function BenchHeader({ backHref = '/', backLabel = 'Home' }: { backHref?: string; backLabel?: string }) {
  return (
    <header className="border-b border-white/10 bg-[#07070a]/85">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link href={backHref} className="text-sm text-white/60 hover:text-white">{backLabel}</Link>
        <Link href="/studio" className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold">
          Open Studio <ArrowRight size={14} />
        </Link>
      </div>
    </header>
  );
}

export function ClipCard({ categoryKey, modelKey, model, rank }: { categoryKey: string; modelKey: string; model: BenchModel; rank?: number }) {
  const clip = completedClip(categoryKey, modelKey);
  return (
    <figure className="overflow-hidden rounded-2xl border border-white/10 bg-white/[.03]">
      {clip ? (
        <video
          className="aspect-video w-full bg-black object-cover"
          controls
          muted
          loop
          playsInline
          preload="metadata"
          src={clip.video_url}
        />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center bg-black/60 text-xs text-white/30">generation pending</div>
      )}
      <figcaption className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
        <span className="font-semibold" style={{ color: model.accent }}>{model.name}</span>
        {rank === 1 ? (
          <span className="rounded-full bg-[#37d6c5]/15 px-2 py-0.5 text-xs font-semibold text-[#7be7d9]">Winner</span>
        ) : rank ? (
          <span className="text-xs text-white/35">#{rank}</span>
        ) : null}
      </figcaption>
    </figure>
  );
}

export function PromptBlock({ prompt }: { prompt: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
      <p className="text-xs font-semibold tracking-[.14em] text-white/40">THE EXACT PROMPT EVERY MODEL RAN</p>
      <p className="mt-2 font-mono text-[13px] leading-6 text-white/70">{prompt}</p>
    </div>
  );
}

export function CtaBanner({ title, body }: { title: string; body: string }) {
  return (
    <section className="mt-16 flex flex-col justify-between gap-5 rounded-3xl border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/[.08] p-7 sm:flex-row sm:items-center">
      <div>
        <h2 className="font-display text-2xl font-700">{title}</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-white/50">{body}</p>
      </div>
      <Link href="/studio" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#14121f]">
        Generate yours <ArrowRight size={15} />
      </Link>
    </section>
  );
}

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

export function CategoryHeading({ category }: { category: BenchCategory }) {
  return (
    <div className="border-b border-white/10 pb-6">
      <h2 className="font-display text-2xl font-700 tracking-tight sm:text-3xl">{category.label}</h2>
      <p className="mt-2 text-sm leading-6 text-white/45">{category.tagline}</p>
    </div>
  );
}
