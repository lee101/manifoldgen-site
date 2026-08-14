import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Check } from 'lucide-react';
import { GeneratorHeader } from '@/components/generator-directory';
import { ImageEditorWorkspace } from '@/components/image-editor-workspace';

export const metadata: Metadata = {
  title: 'AI Image Editor | Object Selection and Inpainting',
  description: 'Upload or generate an image, split foreground and background into editable layers, select any object precisely, and regenerate only the selected area with AI.',
  alternates: { canonical: '/tool/image-editor' },
};

export default function ImageEditorToolPage() {
  return <main className="min-h-screen bg-[var(--color-ink)] text-white"><GeneratorHeader section="Tools" /><div className="mx-auto max-w-7xl px-5 py-10 md:py-14"><Link href="/tools" className="inline-flex items-center gap-2 text-sm text-white/45 hover:text-white"><ArrowLeft size={15} /> All tools</Link><section className="grid gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end"><div><div className="text-xs font-semibold uppercase tracking-[.2em] text-[#8c7cff]">SAM2 SELECTION · BIREFNET LAYERS · TARGETED INPAINTING</div><h1 className="mt-4 max-w-4xl font-display text-4xl font-700 tracking-tight md:text-6xl">Edit one object without remaking the whole image.</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-white/55">Start with an upload or a new AI image. Split the foreground from its background, click exactly what you want to change, then describe the replacement. Everything outside the mask stays intact.</p></div><div className="rounded-2xl border border-white/10 bg-white/[.025] p-5"><div className="text-xs uppercase tracking-[.16em] text-white/35">Simple pricing</div><div className="mt-3 space-y-2">{['Background separation: 1 credit', 'Precise object selection: 1 credit', 'Targeted regeneration: 8 credits'].map((item) => <div key={item} className="flex items-center gap-2 text-sm text-white/65"><Check size={14} className="text-[#8c7cff]" />{item}</div>)}</div><p className="mt-4 border-t border-white/10 pt-4 text-sm text-white/45">If a worker cannot complete the operation, credits return automatically.</p></div></section><ImageEditorWorkspace /></div></main>;
}
