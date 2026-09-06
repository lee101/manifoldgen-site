import type { Metadata } from 'next';
import VideoRemakeTool from './VideoRemakeTool';

export const metadata: Metadata = {
  title: 'AI Video Remake Agent — ManifoldGen',
  description: 'Split a video into shots, guide an AI restyle for every cut, preserve the original timing and soundtrack, and download a full-length remake.',
  alternates: { canonical: '/tools/video-remake' },
};

export default function VideoRemakePage() {
  return <VideoRemakeTool />;
}
