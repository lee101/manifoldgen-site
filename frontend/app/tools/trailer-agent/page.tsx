import type { Metadata } from 'next';
import TrailerAgentTool from './TrailerAgentTool';

export const metadata: Metadata = {
  title: 'Cinematic Trailer Agent — ManifoldGen',
  description: 'Grok 4.6 writes the cut. Sketch characters on RA2, lock identity sheets with GPT Image 2, review stills at 800px, then animate accepted start frames with Gemini speech, a score, and H3.',
  alternates: { canonical: '/tools/trailer-agent' },
};

export default function TrailerAgentPage() {
  return <TrailerAgentTool />;
}
