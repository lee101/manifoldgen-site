import { JsonLd, toolJsonLd } from '@/components/seo/kit';
import type { Metadata } from 'next';
import MoodboardTool from './MoodboardTool';

export const metadata: Metadata = {
  title: 'Soul Moodboard — ManifoldGen',
  description: 'Fuse two to six reference images into one cohesive design with a prompt, routed through OpenPaths reference-aware image models.',
  alternates: { canonical: '/tools/moodboard' },
};

function MoodboardPage() {
  return <MoodboardTool />;
}

export default function Page() {
  return (
    <>
      <JsonLd data={toolJsonLd(metadata, '/tools/moodboard')} />
      <MoodboardPage />
    </>
  );
}
