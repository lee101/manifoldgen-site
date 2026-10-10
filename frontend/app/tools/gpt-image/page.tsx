import { JsonLd, toolJsonLd } from '@/components/seo/kit';
import type { Metadata } from 'next';
import GptImageTool from './GptImageTool';

export const metadata: Metadata = {
  title: 'GPT Image 2 — Premium AI Image Generation — ManifoldGen',
  description: 'Premium OpenAI-image generation with precise prompts, up to 4 variants per run, aspect control, and optional seeds.',
  alternates: { canonical: '/tools/gpt-image' },
};

function GptImagePage() {
  return <GptImageTool />;
}

export default function Page() {
  return (
    <>
      <JsonLd data={toolJsonLd(metadata, '/tools/gpt-image')} />
      <GptImagePage />
    </>
  );
}
