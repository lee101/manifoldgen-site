import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { JsonLd, toolJsonLd } from '@/components/seo/kit';

export const metadata: Metadata = {
  title: 'AI Video Background Remover — Transparent Video — ManifoldGen',
  description: 'Remove the background from a video and keep the original foreground pixels for a transparent WebM, with audio preserved.',
  alternates: { canonical: '/tools/video-background-remover' },
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <JsonLd data={toolJsonLd(metadata, '/tools/video-background-remover')} />
      {children}
    </>
  );
}
