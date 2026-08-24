import type { Metadata } from 'next';
import OutpaintTool from './OutpaintTool';

export const metadata: Metadata = {
  title: 'AI Outpainting — Extend Image — ManifoldGen',
  description: 'Upload an image, expand any edge or zoom the scene out, and outpainting fills the new canvas in continuity with the original.',
  alternates: { canonical: '/tools/outpaint' },
};

export default function OutpaintPage() {
  return <OutpaintTool />;
}
