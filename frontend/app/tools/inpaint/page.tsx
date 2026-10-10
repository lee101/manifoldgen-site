import { JsonLd, toolJsonLd } from '@/components/seo/kit';
import type { Metadata } from 'next';
import InpaintTool from './InpaintTool';

export const metadata: Metadata = {
  title: 'AI Inpaint — ManifoldGen',
  description: 'Brush a region, describe the change, and the edit composites back only inside your mask while the rest of the image stays untouched.',
  alternates: { canonical: '/tools/inpaint' },
};

function InpaintPage() {
  return <InpaintTool />;
}

export default function Page() {
  return (
    <>
      <JsonLd data={toolJsonLd(metadata, '/tools/inpaint')} />
      <InpaintPage />
    </>
  );
}
