import type { Metadata } from 'next';
import { DirectoryIntro, GeneratorCards, GeneratorHeader } from '@/components/generator-directory';

export const metadata: Metadata = {
  title: 'AI Video Creator Tools',
  description: 'Compare AI video creator tools for text-to-video, image-to-video, reference video, animation transfer, and editing in ManifoldGen Studio.',
  alternates: { canonical: '/tools' },
};

export default function ToolsPage() {
  return <main className="min-h-screen bg-[var(--color-ink)] text-white"><GeneratorHeader section="Tools" /><div className="mx-auto max-w-7xl px-5 py-14 md:py-20"><DirectoryIntro /><GeneratorCards /></div></main>;
}
