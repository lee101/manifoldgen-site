import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, BookOpen, Check, Code2 } from 'lucide-react';
import { GeneratorHeader } from '@/components/generator-directory';
import { VideoGeneratorWorkspace } from '@/components/video-generator-workspace';
import { VideoControlWorkspace } from '@/components/video-control-workspace';
import { VIDEO_GENERATORS, videoGenerator } from '@/lib/video-generators';
import { VIDEO_CONTROL_TOOLS, videoControlTool } from '@/lib/video-controls';

export const dynamicParams = false;
export function generateStaticParams() { return [...VIDEO_GENERATORS, ...VIDEO_CONTROL_TOOLS].map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const slug = (await params).slug;
  const control = videoControlTool(slug);
  if (control) return { title: `${control.name} — AI Video Style Transfer`, description: control.description, alternates: { canonical: `/tools/${control.slug}` } };
  const generator = videoGenerator(slug);
  if (!generator) return {};
  return { title: `${generator.name} AI Video Creator`, description: `${generator.description} Create and edit AI video in ManifoldGen Studio.`, alternates: { canonical: `/tools/${generator.slug}` } };
}

export default async function GeneratorToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const control = videoControlTool(slug);
  if (control) return (
    <main className="min-h-screen bg-[var(--color-ink)] text-white">
      <GeneratorHeader section="Tools" />
      <div className="mx-auto max-w-7xl px-5 pt-4 pb-2 md:py-10">
        <Link href="/tools" className="inline-flex items-center gap-2 text-sm text-white/65 hover:text-white"><ArrowLeft size={15} /> All creative tools</Link>
        <section className="grid gap-5 pt-5 pb-2 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div><div className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: control.accent }}>MINIMAX H3 CONTROLNET UNION · {control.eyebrow}</div><h1 className="mt-2 max-w-4xl font-display text-2xl font-700 tracking-tight md:text-5xl">{control.name}</h1><p className="mt-3 max-w-3xl text-sm leading-6 md:text-lg md:leading-8 text-white/70 line-clamp-2 md:line-clamp-none">{control.description}</p></div>
          <div className="hidden rounded-2xl border border-white/15 bg-white/[0.05] p-4 lg:block"><div className="text-xs uppercase tracking-[0.16em] text-white/50">Control behavior</div><div className="mt-2 space-y-1.5">{control.bestFor.map((strength) => <div key={strength} className="flex items-center gap-2 text-sm text-white/75"><Check size={14} style={{ color: control.accent }} /> {strength}</div>)}</div><div className="mt-3 border-t border-white/15 pt-3 text-sm text-white/60">1–15s · fixed 24 fps · final price follows measured GPU compute</div></div>
        </section>
        <VideoControlWorkspace tool={control} />
        <section className="mt-10 flex flex-col justify-between gap-5 rounded-3xl border border-white/15 bg-white/[0.05] p-6 sm:flex-row sm:items-center"><div><h2 className="font-display text-xl font-700">One union model, six control workflows</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-white/60">Switch between Canny, Depth, HED, MLSD, Pose, and masked video inpainting without changing checkpoints. Upload ordinary footage and ManifoldGen prepares the matching control pass.</p></div><Link href="/tools/pose-video" className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-sm font-semibold hover:border-white/40">Try Pose <ArrowRight size={15} /></Link></section>
      </div>
    </main>
  );
  const generator = videoGenerator(slug);
  if (!generator) notFound();
  return (
    <main className="min-h-screen bg-[var(--color-ink)] text-white">
      <GeneratorHeader section="Tools" />
      <div className="mx-auto max-w-7xl px-5 pt-4 pb-2 md:py-10">
        <Link href="/tools" className="inline-flex items-center gap-2 text-sm text-white/65 hover:text-white"><ArrowLeft size={15} /> All video tools</Link>
        <section className="grid gap-5 pt-5 pb-2 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div><div className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: generator.accent }}>{generator.family} · {generator.mode === 'text' ? 'Text to video' : generator.mode === 'image' ? 'Image to video' : 'Reference to video'}</div><h1 className="mt-2 max-w-4xl font-display text-2xl font-700 tracking-tight md:text-5xl">{generator.name}</h1><p className="mt-3 max-w-3xl text-sm leading-6 md:text-lg md:leading-8 text-white/70 line-clamp-2 md:line-clamp-none">{generator.description}</p></div>
          <div className="hidden rounded-2xl border border-white/15 bg-white/[0.05] p-4 lg:block"><div className="text-xs uppercase tracking-[0.16em] text-white/50">Best for</div><div className="mt-2 space-y-1.5">{generator.strengths.map((strength) => <div key={strength} className="flex items-center gap-2 text-sm text-white/75"><Check size={14} className="text-[var(--color-accent-2)]" /> {strength}</div>)}</div><div className="mt-3 border-t border-white/15 pt-3 text-sm text-white/60">{generator.price}</div></div>
        </section>
        <VideoGeneratorWorkspace generator={generator} />
        {generator.guide && (
          <section className="mt-10 flex flex-col justify-between gap-5 rounded-3xl border border-white/15 bg-white/[0.05] p-6 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-display text-xl font-700">How to use {generator.name}</h2>
              <p className="mt-1 text-sm text-white/60">{generator.guide.title} — prompting patterns, tier choice, and troubleshooting.</p>
            </div>
            <Link href={`/blog/${generator.guide.slug}`} className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-sm font-semibold hover:border-white/40"><BookOpen size={16} /> Read the guide <ArrowRight size={15} /></Link>
          </section>
        )}
        <section className="mt-10 flex flex-col justify-between gap-5 rounded-3xl border border-white/15 bg-white/[0.05] p-6 sm:flex-row sm:items-center"><div><h2 className="font-display text-xl font-700">Build this workflow into your product</h2><p className="mt-1 text-sm text-white/60">Stable JSON API, async jobs, durable outputs, and the same ManifoldGen billing.</p></div><Link href={`/api/video-generators/${generator.slug}`} className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-sm font-semibold hover:border-white/40"><Code2 size={16} /> API reference <ArrowRight size={15} /></Link></section>
      </div>
    </main>
  );
}
