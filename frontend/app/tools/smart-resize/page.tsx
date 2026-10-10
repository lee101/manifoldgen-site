import { JsonLd, toolJsonLd } from '@/components/seo/kit';
import type { Metadata } from 'next';
import { ImageUtilityWorkspace } from '@/components/image-utility-workspace';

export const metadata: Metadata = {
  title: 'Smart Resize - AI Image Resizer - ManifoldGen',
  description: 'Recompose images for stories, posts and banners with exact target dimensions. AI Smart Resize adapts the composition instead of stretching your photo.',
  alternates: { canonical: '/tools/smart-resize' },
};

function SmartResizePage() { return <ImageUtilityWorkspace resize />; }

export default function Page() {
  return (
    <>
      <JsonLd data={toolJsonLd(metadata, '/tools/smart-resize')} />
      <SmartResizePage />
    </>
  );
}
