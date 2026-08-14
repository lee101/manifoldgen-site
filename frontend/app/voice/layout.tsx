import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Voice Studio',
  description: 'Generate expressive speech, narration, and cinematic audio scenes with leading AI voice models.',
  alternates: { canonical: '/voice' },
};

export default function VoiceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
