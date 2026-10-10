import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { JsonLd, toolJsonLd } from '@/components/seo/kit';

export const metadata: Metadata = {
  title: 'Character Animator — AI Motion Transfer Video — ManifoldGen',
  description: 'Animate a character image by transferring body movement, expression and timing from a driving video with Wan Animate 2.',
  alternates: { canonical: '/tools/character-animator' },
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <JsonLd data={toolJsonLd(metadata, '/tools/character-animator')} />
      {children}
    </>
  );
}
