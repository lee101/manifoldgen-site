import { JsonLd, toolJsonLd } from '@/components/seo/kit';
import GeminiTTSSpace from './GeminiTTSSpace';

export const metadata = {
  title: 'Gemini Flash TTS — Multi-Speaker Voice Studio — ManifoldGen',
  description: 'Direct expressive single- and multi-speaker voice performances with Gemini 3.1 Flash TTS, 30 voices, accents, pace, scene, and emotion control.',
  alternates: { canonical: '/tools/gemini-tts' },
};

function GeminiTTSPage() { return <GeminiTTSSpace />; }

export default function Page() {
  return (
    <>
      <JsonLd data={toolJsonLd(metadata, '/tools/gemini-tts')} />
      <GeminiTTSPage />
    </>
  );
}
