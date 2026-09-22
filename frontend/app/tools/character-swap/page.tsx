import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Code2 } from 'lucide-react';
import { GeneratorHeader } from '@/components/generator-directory';
import CharacterSwapTool from './CharacterSwapTool';

export const metadata: Metadata = {
  title: 'Character Swap Music Video — ManifoldGen',
  description: 'Swap the performers in any music video: GPT Image 2 redraws the first frame with your new characters, MiniMax H3 re-performs every shot with the same moves, and the original soundtrack is kept.',
  alternates: { canonical: '/tools/character-swap' },
};

export default function CharacterSwapPage() {
  return (
    <main className="min-h-screen bg-[var(--color-ink)] text-white">
      <GeneratorHeader section="Tools" />
      <div className="mx-auto max-w-7xl px-5 pt-4 pb-2 md:py-10">
        <Link href="/tools" className="inline-flex items-center gap-2 text-sm text-white/65 hover:text-white"><ArrowLeft size={15} /> All creative tools</Link>
        <CharacterSwapTool />
        <section className="mt-10 flex flex-col justify-between gap-5 rounded-3xl border border-white/15 bg-white/[0.05] p-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-xl font-700">Build this workflow into your product</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-white/60">One JSON request returns an async job that ends in a re-performed music video with swapped characters on the untouched original soundtrack.</p>
          </div>
          <Link href="/api" className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-sm font-semibold hover:border-white/40"><Code2 size={16} /> API reference <ArrowRight size={15} /></Link>
        </section>
      </div>
    </main>
  );
}
