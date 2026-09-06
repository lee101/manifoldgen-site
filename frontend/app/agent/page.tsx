import type { Metadata } from 'next';
import TrailerAgentTool from '../tools/trailer-agent/TrailerAgentTool';

export const metadata: Metadata = {
  title: 'Cinematic Trailer Agent — ManifoldGen',
  description: 'One brief becomes locked character sheets, consistent start frames, H3 clips, and a score.',
  alternates: { canonical: '/agent' },
};

export default function AgentPage() {
  return <TrailerAgentTool example="conjurers-soul" />;
}
