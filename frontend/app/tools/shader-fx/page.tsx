import { JsonLd, toolJsonLd } from '@/components/seo/kit';
import type { Metadata } from 'next';
import { ProductionTool } from '@/components/production-tool';

export const metadata: Metadata = {
  title: 'Shader FX - Free Online Video Effects & Chroma Key - ManifoldGen',
  description: 'Stack GPU shader effects on images and videos: feedback trails, kaleidoscope, glitch, datamosh, CRT, VHS, bloom, halftone, luma and chroma key. Runs locally in your browser, export MP4 or PNG.',
  alternates: { canonical: '/tools/shader-fx' },
};

export default function Page() {
  return (
    <>
      <JsonLd data={toolJsonLd(metadata, '/tools/shader-fx')} />
      <ProductionTool mode="fx" />
    </>
  );
}
