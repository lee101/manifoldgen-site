import type { Metadata } from 'next';
import Flux2Tool from './Flux2Tool';

export const metadata: Metadata = {
  title: 'AI FLUX.2 Image Generation — ManifoldGen',
  description: 'Generate images with the FLUX family: Klein for speed, Dev for balance, Pro for maximum fidelity.',
  alternates: { canonical: '/tools/flux-2' },
};

export default function Flux2Page() {
  return <Flux2Tool />;
}
