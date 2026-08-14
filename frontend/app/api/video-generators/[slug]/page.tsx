import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, Clock3, KeyRound } from 'lucide-react';
import { GeneratorHeader } from '@/components/generator-directory';
import { VideoGeneratorWorkspace } from '@/components/video-generator-workspace';
import { VIDEO_GENERATORS, videoGenerator } from '@/lib/video-generators';

export const dynamicParams = false;
export function generateStaticParams() { return VIDEO_GENERATORS.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const generator = videoGenerator((await params).slug);
  if (!generator) return {};
  return { title: `${generator.name} API`, description: `Generate ${generator.name} video through the ManifoldGen API. Includes request schema, tester, pricing, and editor handoff.`, alternates: { canonical: `/api/video-generators/${generator.slug}` } };
}

export default async function GeneratorAPIPage({ params }: { params: Promise<{ slug: string }> }) {
  const generator = videoGenerator((await params).slug);
  if (!generator) notFound();
  const fields = generator.manifold
    ? [['service', 'h3_video', 'Required'], ['prompt', 'string', 'Required'], ['first_frame', 'HTTPS URL', 'Optional'], ['keyframes', 'HTTPS URL[]', 'Optional, up to 8'], ['duration', generator.durations.join(' | '), `${generator.durations[0]}`], ['size', 'preview | balanced | native', 'balanced'], ['aspect_ratio', generator.aspectRatios.join(' | '), generator.aspectRatios[0]]]
    : [['service', 'video_generate', 'Required'], ['model', generator.model, 'Required'], ['prompt', 'string', 'Required'], [generator.mode === 'reference' ? 'reference_image_urls' : 'image_url', generator.mode === 'reference' ? 'HTTPS URL[]' : 'HTTPS URL', generator.mode === 'text' ? 'Optional' : 'Required'], ['duration', generator.durations.join(' | '), `${generator.durations[0]}`], ['resolution', generator.resolutions.join(' | '), generator.resolutions[0]], ['aspect_ratio', generator.aspectRatios.join(' | '), generator.aspectRatios[0]]];
  return (
    <main className="min-h-screen bg-[var(--color-ink)] text-white">
      <GeneratorHeader section="API" />
      <div className="mx-auto max-w-7xl px-5 py-10 md:py-14">
        <Link href="/api/video-generators" className="inline-flex items-center gap-2 text-sm text-white/65 hover:text-white"><ArrowLeft size={15} /> Video API directory</Link>
        <div className="grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div><div className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: generator.accent }}>VIDEO GENERATION API</div><h1 className="mt-4 font-display text-4xl font-700 tracking-tight md:text-6xl">{generator.name} API</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-white/70">{generator.description} Route it through one ManifoldGen key and receive a recoverable asynchronous job.</p></div>
          <div className="space-y-3"><Fact icon={<KeyRound size={16} />} label="Authentication" value="Bearer API key" /><Fact icon={<Clock3 size={16} />} label="Response" value="Async job + status URL" /></div>
        </div>
        <section className="max-w-4xl"><h2 className="font-display text-2xl font-700">Request schema</h2><div className="mt-5 overflow-hidden rounded-2xl border border-white/15">{fields.map(([name, type, fallback]) => <div key={name} className="grid gap-1 border-b border-white/15 bg-white/[0.04] px-4 py-3 text-sm last:border-0 sm:grid-cols-[150px_1fr_120px]"><code className="text-[var(--color-accent-2)]">{name}</code><span className="break-words text-white/65">{type}</span><span className="text-white/50">{fallback}</span></div>)}</div><div className="mt-6 rounded-2xl border border-white/15 bg-white/[0.05] p-5 text-sm leading-6 text-white/65"><b className="text-white/90">Job lifecycle:</b> POST to <code>/api/service</code>, read <code>result.job_id</code>, then poll <code>/api/video-jobs/&#123;job_id&#125;</code> every 2–5 seconds. Completed jobs contain a durable <code>video_url</code>.</div><Link href={`/tools/${generator.slug}`} className="mt-5 inline-flex items-center gap-2 text-sm text-white/70 hover:text-white">Open the visual generator <ArrowRight size={15} /></Link></section>
        <section className="mt-12"><h2 className="mb-5 font-display text-2xl font-700">Live API tester</h2><VideoGeneratorWorkspace generator={generator} /></section>
      </div>
    </main>
  );
}

function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <div className="rounded-2xl border border-white/15 bg-white/[0.05] p-4"><div className="flex items-center gap-2 text-xs text-white/55">{icon} {label}</div><div className="mt-2 text-sm font-semibold text-white/85">{value}</div></div>; }
