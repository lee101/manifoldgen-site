import { JsonLd, toolJsonLd } from '@/components/seo/kit';
import LyriaSpace from './LyriaSpace';

export const metadata = {
  title: 'Lyria 3 Music Studio — AI Song Generator — ManifoldGen',
  description: 'Generate complete songs, instrumentals, loops, and custom-lyric tracks with Google Lyria 3 Pro and Clip, exported as compact Opus audio.',
  alternates: { canonical: '/tools/lyria' },
};

function LyriaPage() { return <LyriaSpace />; }

export default function Page() {
  return (
    <>
      <JsonLd data={toolJsonLd(metadata, '/tools/lyria')} />
      <LyriaPage />
    </>
  );
}
