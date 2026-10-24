import { JsonLd, toolJsonLd } from '@/components/seo/kit';
import CrazyCaptionsTool from './CrazyCaptionsTool';

export const metadata = {
  title: 'Crazy Captions: Word-by-Word Glitch Video Captions - ManifoldGen',
  description: 'Transcribe a video word by word with Gemini, fix the transcript, then restyle it with loud, glitchy hi-fi captions that react to the voice. Add a translated second-language track, English above French or any pair, and render both in your browser to MP4.',
  alternates: { canonical: '/tools/crazy-captions' },
};

export default function Page() {
  return (
    <>
      <JsonLd data={toolJsonLd(metadata, '/tools/crazy-captions')} />
      <CrazyCaptionsTool />
    </>
  );
}
