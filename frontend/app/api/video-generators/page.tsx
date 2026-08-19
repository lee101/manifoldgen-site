import type { Metadata } from 'next';
import { DirectoryIntro, GeneratorCards, GeneratorHeader } from '@/components/generator-directory';

export const metadata: Metadata = { title: 'Video Generator API Directory', description: 'Build with Manifold, Seedance, LTX, Wan, Happy Horse, and other video generators through one ManifoldGen API.', alternates: { canonical: '/api/video-generators' } };

export default function VideoAPIPage() {
  return <main className="min-h-screen bg-[var(--color-ink)] text-white"><GeneratorHeader section="API" /><div className="mx-auto max-w-7xl px-5 py-14 md:py-20"><DirectoryIntro api /><GeneratorCards destination="api" /></div></main>;
}
