import type { Metadata } from 'next';
import { JsonLd, toolJsonLd } from '@/components/seo/kit';
import H3ImageTool from '../h3-image/H3ImageTool';

export const metadata: Metadata = {
  title: 'H3 Image Editor — Reference-Based AI Image Edit — ManifoldGen',
  description: 'Edit an image with MiniMax H3 reference generation: regenerate your source while preserving subject identity and scene geometry.',
  alternates: { canonical: '/tools/h3-image-editor' },
};

export default function H3ImageEditorPage() {
  return (
    <>
      <JsonLd data={toolJsonLd(metadata, '/tools/h3-image-editor')} />
      <H3ImageTool editing />
    </>
  );
}
