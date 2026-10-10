import { JsonLd, toolJsonLd } from '@/components/seo/kit';
import MusicTool from './MusicTool';

export const metadata = {
  title: 'AI Music Generator — Songs and Instrumentals — ManifoldGen',
  description: 'Describe a song in plain English, create an arrangement and lyrics, then generate the full track with AI Music Generator.',
  alternates: { canonical: '/tools/music-generator' },
};

function MusicGeneratorPage() {
  return <MusicTool />;
}

export default function Page() {
  return (
    <>
      <JsonLd data={toolJsonLd(metadata, '/tools/music-generator')} />
      <MusicGeneratorPage />
    </>
  );
}
