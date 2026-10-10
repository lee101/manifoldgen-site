import type { Metadata } from 'next';
import { JsonLd, toolJsonLd } from '@/components/seo/kit';
import H3ImageTool from './H3ImageTool';

export const metadata: Metadata = {
  title: 'H3 Image Generator — MiniMax H3 Text to Image — ManifoldGen',
  description: 'Generate high-detail finished frames from text with the MiniMax H3 visual world model, in aspect ratios from square to widescreen.',
  alternates: { canonical: '/tools/h3-image' },
};

export default function H3ImagePage() {
  return (
    <>
      <JsonLd data={toolJsonLd(metadata, '/tools/h3-image')} />
      <H3ImageTool />
    </>
  );
}
