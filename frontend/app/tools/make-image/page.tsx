import type { Metadata } from 'next';
import BulkImageTool from './BulkImageTool';

export const metadata: Metadata = {
  title: 'Bulk Image Generator — RA2 · RA1 · R1 — ManifoldGen',
  description: 'Generate many image variants at once across the RA2, RA1, and R1 image lanes, one prompt per line.',
  alternates: { canonical: '/tools/make-image' },
};

export default function MakeImagePage() {
  return <BulkImageTool />;
}