import { JsonLd, toolJsonLd } from '@/components/seo/kit';
import AnimaTool from './AnimaTool';

export const metadata = {
  title: 'Anima Anime Art Generator — ManifoldGen',
  description: 'Create anime characters, key art, and polished illustration with the Anima art studio.',
  alternates: { canonical: '/tool/anima' },
};

function AnimaPage() {
  return <AnimaTool />;
}

export default function Page() {
  return (
    <>
      <JsonLd data={toolJsonLd(metadata, '/tool/anima')} />
      <AnimaPage />
    </>
  );
}
