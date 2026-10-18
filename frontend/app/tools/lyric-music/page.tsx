import { JsonLd, toolJsonLd } from '@/components/seo/kit';
import LyricMusicTool from './LyricMusicTool';

export const metadata = {
  title: 'Lyrics to Song — AI Rap and Song Generator From Your Lyrics — ManifoldGen',
  description: 'Paste your lyrics, choose a style and a voice, and get a finished song that performs every line, ready to turn into a lyric music video.',
  alternates: { canonical: '/tools/lyric-music' },
};

export default function Page() {
  return (
    <>
      <JsonLd data={toolJsonLd(metadata, '/tools/lyric-music')} />
      <LyricMusicTool />
    </>
  );
}
