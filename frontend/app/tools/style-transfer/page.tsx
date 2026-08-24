import type { Metadata } from 'next';
import StyleTransferTool from './StyleTransferTool';

export const metadata: Metadata = {
  title: 'AI Style Transfer — ManifoldGen',
  description: 'Upload an image, describe a new visual direction, and keep the subject while OpenPaths edits the source image.',
  alternates: { canonical: '/tools/style-transfer' },
};

export default function StyleTransferPage() {
  return <StyleTransferTool />;
}
