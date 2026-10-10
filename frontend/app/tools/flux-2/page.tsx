import { JsonLd, toolJsonLd } from '@/components/seo/kit';
import type { Metadata } from 'next';
import Flux2Tool from './Flux2Tool';

export const metadata: Metadata = {
  title: 'AI FLUX.2 Image Generation — ManifoldGen',
  description: 'Generate images with the FLUX family: Klein for speed, Dev for balance, Pro for maximum fidelity.',
  alternates: { canonical: '/tools/flux-2' },
};

function Flux2Page() {
  return <Flux2Tool />;
}

export default function Page() {
  return (
    <>
      <JsonLd data={toolJsonLd(metadata, '/tools/flux-2')} />
      <Flux2Page />
    </>
  );
}
