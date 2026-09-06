import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { PageShell } from '@/components/seo/kit';
import { PROMPT_TOOLS } from '@/lib/prompt-tools';

export const metadata: Metadata = {
  title: 'Free AI Video Prompt Generators — Seedance, Kling, Veo & More',
  description: 'Free no-login prompt builders for cinematic AI video, product ads, anime, image-to-video, Seedance, Kling, Veo, TikTok, storyboards, and camera moves.',
  alternates: { canonical: '/prompts' },
};

export default function PromptToolsIndex() {
  return (
    <PageShell>
      <section className="max-w-4xl">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-2)]"><Sparkles size={14} /> Free prompt tools</p>
        <h1 className="mt-4 font-display text-4xl font-700 tracking-tight md:text-6xl">From rough idea to a shot you can render</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-white/70">
          Build model-ready prompts with real camera, lighting, motion, continuity, and format controls. No login to write or copy. When the prompt feels right, send it straight into ManifoldGen.
        </p>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {PROMPT_TOOLS.map((tool, index) => (
          <Link key={tool.slug} href={`/prompts/${tool.slug}`} className={`group overflow-hidden rounded-3xl border border-white/12 bg-white/[0.035] transition hover:-translate-y-1 hover:border-[#b99aef]/35 ${index === 0 ? 'md:col-span-2' : ''}`}>
            <div className={`relative overflow-hidden bg-[#111018] ${index === 0 ? 'aspect-[2/1]' : 'aspect-[16/9]'}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={tool.image} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
              <span className="absolute left-4 top-4 rounded-full border border-white/20 bg-black/45 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/75 backdrop-blur-md">Free · no login</span>
            </div>
            <div className="p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b99aef]">{tool.eyebrow}</p>
              <h2 className="mt-2 font-display text-xl font-700">{tool.h1}</h2>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-white/58">{tool.intro}</p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white/75 group-hover:text-white">Build a prompt <ArrowRight size={14} /></span>
            </div>
          </Link>
        ))}
      </section>

      <section className="mt-14 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">The useful version of prompt SEO</p>
        <h2 className="mt-3 font-display text-2xl font-700">Every page ends in a working generator</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/60">Learn the model’s vocabulary, build the exact prompt, copy it anywhere, or render it immediately. There is no article-to-dashboard scavenger hunt.</p>
      </section>
    </PageShell>
  );
}
