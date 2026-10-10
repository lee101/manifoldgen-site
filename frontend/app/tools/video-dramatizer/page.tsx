import { JsonLd, toolJsonLd } from '@/components/seo/kit';
import type { Metadata } from 'next';
import VideoDramatizerTool from './VideoDramatizerTool';

export const metadata: Metadata = {
  title: 'AI Video Dramatizer — ManifoldGen',
  description: 'Give an agent a clip and a brief: it plans a shot list, generates cut-ins and cuts them on the beat into a finished vertical edit with an editable timeline.',
  alternates: { canonical: '/tools/video-dramatizer' },
};

function VideoDramatizerPage() {
  return <VideoDramatizerTool />;
}

export default function Page() {
  return (
    <>
      <JsonLd data={toolJsonLd(metadata, '/tools/video-dramatizer')} />
      <VideoDramatizerPage />
    </>
  );
}
