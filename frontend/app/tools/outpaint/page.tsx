import { JsonLd, toolJsonLd } from '@/components/seo/kit';
import type { Metadata } from 'next';
import OutpaintTool from './OutpaintTool';

export const metadata: Metadata = {
  title: 'AI Outpainting — Extend Image — ManifoldGen',
  description: 'Upload an image, expand any edge or zoom the scene out, and outpainting fills the new canvas in continuity with the original.',
  alternates: { canonical: '/tools/outpaint' },
};

function OutpaintPage() {
  return <OutpaintTool />;
}

export default function Page() {
  return (
    <>
      <JsonLd data={toolJsonLd(metadata, '/tools/outpaint')} />
      <OutpaintPage />
    </>
  );
}
