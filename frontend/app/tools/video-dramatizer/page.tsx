import type { Metadata } from 'next';
import VideoDramatizerTool from './VideoDramatizerTool';

export const metadata: Metadata = {
  title: 'AI Video Dramatizer — ManifoldGen',
  description:
    'Give an agent a clip and a brief. It plans a shot list, generates and restyles cut-ins, cuts them against your original footage on the beat, and hands back a finished vertical edit plus an editable Studio project.',
  alternates: { canonical: '/tools/video-dramatizer' },
};

export default function VideoDramatizerPage() {
  return <VideoDramatizerTool />;
}
