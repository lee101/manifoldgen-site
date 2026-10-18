import { JsonLd, toolJsonLd } from '@/components/seo/kit';
import VoiceEnhancerTool from './VoiceEnhancerTool';

export const metadata = {
  title: 'AI Voice Enhancer — Turn a Rough Vocal Into a Produced Song — ManifoldGen',
  description: 'Upload a sung or rapped take, pick a style like a hard hip-hop diss track, and get a finished song in your own voice, a studio vocalist version, and your take beat-locked and mixed.',
  alternates: { canonical: '/tools/voice-enhancer' },
};

export default function Page() {
  return (
    <>
      <JsonLd data={toolJsonLd(metadata, '/tools/voice-enhancer')} />
      <VoiceEnhancerTool />
    </>
  );
}
