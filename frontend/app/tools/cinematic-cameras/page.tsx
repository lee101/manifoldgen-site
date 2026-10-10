import { JsonLd, toolJsonLd } from '@/components/seo/kit';
import type { Metadata } from 'next';
import CinematicCamerasTool from './CinematicCamerasTool';

export const metadata: Metadata = {
  title: 'AI Cinematic Cameras — ManifoldGen',
  description: 'Direct AI images like a cinematographer: stack camera-move presets and render through RA2 or GPT Image 2.',
  alternates: { canonical: '/tools/cinematic-cameras' },
};

function CinematicCamerasPage() {
  return <CinematicCamerasTool />;
}

export default function Page() {
  return (
    <>
      <JsonLd data={toolJsonLd(metadata, '/tools/cinematic-cameras')} />
      <CinematicCamerasPage />
    </>
  );
}
