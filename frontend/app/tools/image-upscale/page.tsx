import { JsonLd, toolJsonLd } from '@/components/seo/kit';
import type { Metadata } from 'next';
import ImageUpscaleTool from './ImageUpscaleTool';

export const metadata: Metadata = {
  title: 'AI Image Upscaler — ManifoldGen',
  description: 'Upload an image and get a 2x creative upscale that recovers texture and edge detail for a flat $0.15 per run.',
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
