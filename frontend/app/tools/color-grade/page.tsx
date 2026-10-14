import { JsonLd, toolJsonLd } from '@/components/seo/kit';
import type { Metadata } from 'next';
import { ProductionTool } from '@/components/production-tool';

export const metadata: Metadata = {
  title: 'Color Grade - Free Online Video Color Grading & LUTs - ManifoldGen',
  description: 'Grade images and videos in your browser with lift/gamma/gain wheels, RGB curves, .cube LUT import and export, reference matching and film looks. Free, GPU-accelerated, nothing uploads.',
  alternates: { canonical: '/tools/color-grade' },
};

export default function Page() {
  return (
    <>
      <JsonLd data={toolJsonLd(metadata, '/tools/color-grade')} />
      <ProductionTool mode="grade" />
    </>
  );
}
