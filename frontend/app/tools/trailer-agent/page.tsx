import { JsonLd, toolJsonLd } from '@/components/seo/kit';
import type { Metadata } from 'next';
import TrailerAgentTool from './TrailerAgentTool';

export const metadata: Metadata = {
  title: 'Cinematic Trailer Agent — ManifoldGen',
  description: 'Grok 4.6 writes the cut. Sketch characters, lock identity sheets with GPT Image 2, then animate accepted start frames with speech, a score and H3.',
  alternates: { canonical: '/tools/trailer-agent' },
};

function TrailerAgentPage() {
  return <TrailerAgentTool />;
}

export default function Page() {
  return (
    <>
      <JsonLd data={toolJsonLd(metadata, '/tools/trailer-agent')} />
      <TrailerAgentPage />
    </>
  );
}
