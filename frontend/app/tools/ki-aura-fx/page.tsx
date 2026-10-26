import type { Metadata } from 'next';
import { JsonLd, toolJsonLd } from '@/components/seo/kit';
import { ProductionToolWorkspace } from '@/components/production/ProductionToolWorkspace';
import { productionTool } from '@/lib/production-tools';

const tool = productionTool('ki-aura-fx')!;

export const metadata: Metadata = {
  title: tool.metaTitle,
  description: tool.metaDescription,
  alternates: { canonical: '/tools/ki-aura-fx' },
};

export default function Page() {
  return (
    <>
      <JsonLd data={toolJsonLd(metadata, '/tools/ki-aura-fx')} />
      <ProductionToolWorkspace slug="ki-aura-fx" />
    </>
  );
}
