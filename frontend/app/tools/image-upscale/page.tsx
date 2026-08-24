import type { Metadata } from 'next';
import ImageUpscaleTool from './ImageUpscaleTool';

export const metadata: Metadata = {
  title: 'AI Image Upscaler — ManifoldGen',
  description: 'Upload an image and get a 2x creative upscale that recovers texture and edge detail for a flat $0.15 per run.',
  alternates: { canonical: '/tools/image-upscale' },
};

export default function ImageUpscalePage() {
  return <ImageUpscaleTool />;
}
