import type { Metadata } from 'next';
import GptImageTool from './GptImageTool';

export const metadata: Metadata = {
  title: 'GPT Image 2 — Premium AI Image Generation — ManifoldGen',
  description: 'Premium OpenAI-image generation with precise prompts, up to 4 variants per run, aspect control, and optional seeds.',
  alternates: { canonical: '/tools/gpt-image' },
};

export default function GptImagePage() {
  return <GptImageTool />;
}
