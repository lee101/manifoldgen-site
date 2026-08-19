import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, Code2 } from 'lucide-react';
import { GeneratorHeader } from '@/components/generator-directory';
import { VideoGeneratorWorkspace } from '@/components/video-generator-workspace';
import { VIDEO_GENERATORS, videoGenerator } from '@/lib/video-generators';

export const dynamicParams = false;
export function generateStaticParams() { return VIDEO_GENERATORS.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const generator = videoGenerator((await params).slug);
  if (!generator) return {};
  return { title: `${generator.name} AI Video Creator`, description: `${generator.description} Create and edit AI video in ManifoldGen Studio.`, alternates: { canonical: `/tools/${generator.slug}` } };
}

export default async function GeneratorToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const generator = videoGenerator((await params).slug);
  if (!generator) notFound();
  return (
    <main className="min-h-screen bg-[var(--color-ink)] text-white">
      <GeneratorHeader section="Tools" />
      <div className="mx-auto max-w-7xl px-5 py-10 md:py-14">
        <Link href="/tools" className="inline-flex items-center gap-2 text-sm text-white/65 hover:text-white"><ArrowLeft size={15} /> All video tools</Link>
        <section className="grid gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div><div className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: generator.accent }}>{generator.family} · {generator.mode === 'text' ? 'Text to video' : generator.mode === 'image' ? 'Image to video' : 'Reference to video'}</div><h1 className="mt-4 max-w-4xl font-display text-4xl font-700 tracking-tight md:text-6xl">{generator.name}</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-white/70">{generator.description}</p></div>
          <div className="rounded-2xl border border-white/15 bg-white/[0.05] p-5"><div className="text-xs uppercase tracking-[0.16em] text-white/50">Best for</div><div className="mt-3 space-y-2">{generator.strengths.map((strength) => <div key={strength} className="flex items-center gap-2 text-sm text-white/75"><Check size={14} className="text-[var(--color-accent-2)]" /> {strength}</div>)}</div><div className="mt-4 border-t border-white/15 pt-4 text-sm text-white/60">{generator.price}</div></div>
        </section>
        <VideoGeneratorWorkspace generator={generator} />
        <section className="mt-10 flex flex-col justify-between gap-5 rounded-3xl border border-white/15 bg-white/[0.05] p-6 sm:flex-row sm:items-center"><div><h2 className="font-display text-xl font-700">Build this workflow into your product</h2><p className="mt-1 text-sm text-white/60">Stable JSON API, async jobs, durable outputs, and the same ManifoldGen billing.</p></div><Link href={`/api/video-generators/${generator.slug}`} className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-sm font-semibold hover:border-white/40"><Code2 size={16} /> API reference <ArrowRight size={15} /></Link></section>
      </div>
    </main>
  );
}
