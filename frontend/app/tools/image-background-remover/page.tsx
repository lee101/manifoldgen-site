import { JsonLd, toolJsonLd } from '@/components/seo/kit';
import type { Metadata } from 'next';
import { ImageUtilityWorkspace } from '@/components/image-utility-workspace';

export const metadata: Metadata = {
  title: 'AI Image Background Remover - ManifoldGen',
  description: 'Remove backgrounds from photos, products and characters with BiRefNet. Download a transparent PNG without redrawing your subject.',
  alternates: { canonical: '/tools/image-background-remover' },
};

function BackgroundRemoverPage() { return <ImageUtilityWorkspace resize={false} />; }

export default function Page() {
  return (
    <>
      <JsonLd data={toolJsonLd(metadata, '/tools/image-background-remover')} />
      <BackgroundRemoverPage />
    </>
  );
}
