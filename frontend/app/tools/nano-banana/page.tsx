import { JsonLd, toolJsonLd } from '@/components/seo/kit';
import type { Metadata } from 'next';
import NanoBananaTool from './NanoBananaTool';

export const metadata: Metadata = {
  title: 'Nano Banana 2 — AI Image Generation — ManifoldGen',
  description: 'Generate images with Google Gemini-flash, or upload a reference and edit it. Square, portrait, or landscape at 1K or 2K.',
  alternates: { canonical: '/tools/nano-banana' },
};

function NanoBananaPage() {
  return <NanoBananaTool />;
}

export default function Page() {
  return (
    <>
      <JsonLd data={toolJsonLd(metadata, '/tools/nano-banana')} />
      <NanoBananaPage />
    </>
  );
}
