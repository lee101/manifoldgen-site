import type { Metadata } from 'next';
import { JsonLd, toolJsonLd } from '@/components/seo/kit';
import { ProductionToolWorkspace } from '@/components/production/ProductionToolWorkspace';
import { productionTool } from '@/lib/production-tools';

const tool = productionTool('motion-exaggerate-fx')!;

export const metadata: Metadata = {
  title: tool.metaTitle,
  description: tool.metaDescription,
  alternates: { canonical: '/tools/motion-exaggerate-fx' },
};

export default function Page() {
  return (
    <>
      <JsonLd data={toolJsonLd(metadata, '/tools/motion-exaggerate-fx')} />
      <ProductionToolWorkspace slug="motion-exaggerate-fx" />
    </>
  );
}
