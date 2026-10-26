import type { Metadata } from 'next';
import { JsonLd, toolJsonLd } from '@/components/seo/kit';
import { ProductionToolWorkspace } from '@/components/production/ProductionToolWorkspace';
import { productionTool } from '@/lib/production-tools';

const tool = productionTool('motion-fx')!;

export const metadata: Metadata = {
  title: tool.metaTitle,
  description: tool.metaDescription,
  alternates: { canonical: '/tools/motion-fx' },
};

export default function Page() {
  return (
    <>
      <JsonLd data={toolJsonLd(metadata, '/tools/motion-fx')} />
      <ProductionToolWorkspace slug="motion-fx" />
    </>
  );
}
