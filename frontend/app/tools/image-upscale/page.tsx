import { JsonLd, toolJsonLd } from '@/components/seo/kit';
import type { Metadata } from 'next';
import ImageUpscaleTool from './ImageUpscaleTool';

export const metadata: Metadata = {
  title: 'AI Image Upscaler — ManifoldGen',
  description: 'Upscale any image 2x or 4x from $0.02 per run, or use Creative mode to redraw texture and edge detail.',
  alternates: { canonical: '/tools/image-upscale' },
};

function ImageUpscalePage() {
  return <ImageUpscaleTool />;
}

export default function Page() {
  return (
    <>
      <JsonLd data={toolJsonLd(metadata, '/tools/image-upscale')} />
      <ImageUpscalePage />
    </>
  );
}
