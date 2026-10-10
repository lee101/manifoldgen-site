import { JsonLd, toolJsonLd } from '@/components/seo/kit';
import type { Metadata } from 'next';
import RelightTool from './RelightTool';

export const metadata: Metadata = {
  title: 'AI Relight — ManifoldGen',
  description: 'Upload an image, pick a lighting direction or describe the mood, and IC-Light v2 rebuilds the illumination while keeping the subject intact.',
  alternates: { canonical: '/tools/relight' },
};

function RelightPage() {
  return <RelightTool />;
}

export default function Page() {
  return (
    <>
      <JsonLd data={toolJsonLd(metadata, '/tools/relight')} />
      <RelightPage />
    </>
  );
}
