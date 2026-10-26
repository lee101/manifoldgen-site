import type { Metadata } from 'next';
import { JsonLd, toolJsonLd } from '@/components/seo/kit';
import { ProductionToolWorkspace } from '@/components/production/ProductionToolWorkspace';
import { productionTool } from '@/lib/production-tools';

const tool = productionTool('anime-fight-fx')!;

export const metadata: Metadata = {
  title: tool.metaTitle,
  description: tool.metaDescription,
  alternates: { canonical: '/tools/anime-fight-fx' },
};

export default function Page() {
  return (
    <>
      <JsonLd data={toolJsonLd(metadata, '/tools/anime-fight-fx')} />
      <ProductionToolWorkspace slug="anime-fight-fx" />
    </>
  );
}
