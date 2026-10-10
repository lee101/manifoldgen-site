import { JsonLd, toolJsonLd } from '@/components/seo/kit';
import type { Metadata } from 'next';
import GrokImagineTool from './GrokImagineTool';

export const metadata: Metadata = {
  title: 'AI Image Generation with Grok Imagine — ManifoldGen',
  description: 'Generate images with xAI Grok Imagine. Pick an aspect ratio, choose standard or high-res output, and create up to four variants per prompt.',
  alternates: { canonical: '/tools/grok-imagine' },
};

function GrokImaginePage() {
  return <GrokImagineTool />;
}

export default function Page() {
  return (
    <>
      <JsonLd data={toolJsonLd(metadata, '/tools/grok-imagine')} />
      <GrokImaginePage />
    </>
  );
}
