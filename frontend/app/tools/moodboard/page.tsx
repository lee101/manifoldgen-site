import type { Metadata } from 'next';
import MoodboardTool from './MoodboardTool';

export const metadata: Metadata = {
  title: 'Soul Moodboard — ManifoldGen',
  description: 'Fuse two to six reference images into one cohesive design with a prompt, routed through OpenPaths reference-aware image models.',
  alternates: { canonical: '/tools/moodboard' },
};

export default function MoodboardPage() {
  return <MoodboardTool />;
}
