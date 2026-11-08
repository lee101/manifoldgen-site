import { JsonLd, toolJsonLd } from '@/components/seo/kit';
import MusicRestyleTool from './MusicRestyleTool';

export const metadata = {
  title: 'AI Music Restyle — Turn Any Instrumental Into Lofi, R&B, Violin or Piano — ManifoldGen',
  description: 'Upload an instrumental and hear the same melody re-performed as lofi hip hop, an R&B slow jam, solo violin, peaceful piano and more. Then turn it into a looping lofi video or an AI music video.',
  alternates: { canonical: '/tools/music-restyle' },
};

export default function Page() {
  return (
    <>
      <JsonLd data={toolJsonLd(metadata, '/tools/music-restyle')} />
      <MusicRestyleTool />
    </>
  );
}
