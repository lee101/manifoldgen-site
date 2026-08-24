import type { Guide } from '../types';

const guide: Guide = {
  slug: 'ecommerce-product-photos-without-a-studio',
  section: 'money',
  category: 'Money',
  title: `E-commerce Product Photos Without a Studio`,
  excerpt: `Catalogs need constant imagery; studios charge $30–100 a shot and book out weeks. The AI pipeline: capture the source right, build scene plates once, batch by collection, sell per-SKU packages.`,
  readTime: '8 min read',
  updated: 'August 2026',
  blocks: [
    { t: 'p', text: `Every e-commerce brand has the same recurring bill: product photography. New SKUs, seasonal refreshes, marketplace requirements — at $30–100+ per shot and multi-week lead times, a 100-SKU catalog spends five figures a year staying current. The AI pipeline produces scene-consistent product sets in hours. The product pixels stay real; only the world around them is generated.` },
    { t: 'h2', text: `Capture the source right` },
    { t: 'steps', items: [
      `Phone on a white foam-board sweep, window light, no flash.`,
      `Three angles per SKU: hero front, 45-degree, one macro detail of texture or mechanism.`,
      `Wipe fingerprints and dust first — generation faithfully reproduces smudges too.`,
      `Same distance and height per SKU so the batch composites consistently.`,
    ] },
    { t: 'p', text: `Ten minutes per product, once. This is the entire studio cost of the pipeline.` },
    { t: 'h2', text: `Build the scene system once` },
    { t: 'p', text: `Generate a library of scene plates for the brand's world: marble kitchen counter, spa bathroom, wooden desk flat-lay, gym bench, outdoor patio at golden hour. Each plate gets a light signature — direction, quality, color — exactly like location plates in the continuity guide. New product shots are reference edits compositing the source photo into a plate, then relit to match the plate's light. The scene library is the asset that compounds; every new SKU gets cheaper.` },
    { t: 'h2', text: `Batch by collection, not by SKU` },
    { t: 'p', text: `Run the whole spring line in one session: same scene, same light, same grade. Catalog pages where every product sits in the same world read as a professional brand; a mix of lighting per SKU reads as a garage sale no matter how good each image is. Consistency across the grid sells harder than fidelity in any single frame.` },
    { t: 'h2', text: `Marketplace rules that decide deliverables` },
    { t: 'list', items: [
      `Amazon main image — pure white background, product fills 85% of frame, no props, no text, no logos other than the product's.`,
      `Lifestyle variants — the scene-plate composites, for A+ content and social.`,
      `Shopify grids — 1:1 crops, consistent padding per collection.`,
      `Zoom-ready — upscale final selects to 2000px+ so fabric texture survives inspection.`,
      `File naming — SKU, angle, scene. Catalog managers will love you and rehire you.`,
    ] },
    { t: 'h2', text: `Pricing the service` },
    { t: 'p', text: `Sell per-SKU packages: five to eight images (white-background set plus three to five scene composites) at $15–40 per SKU, against the studio's $150+ equivalent. Target brands with 50+ SKUs where studio cost is an annual argument. Position it as catalog refresh and conversion work, never as "AI images" — the buyer is buying a current catalog, not a technology.` },
    { t: 'callout', tone: 'teal', title: `Product truth is non-negotiable`, body: `Never let generation invent features, change proportions, or restyle the product itself. The source photo defines the product; generation builds only the world around it. Customers return products that do not match their photos — and brands fire vendors whose photos cause returns.` },
    { t: 'h2', text: `The video upsell` },
    { t: 'p', text: `The same plates and sources produce five to ten second product motion loops for product pages and social — slow orbit, pour, steam, texture rack focus — via the video generators. Price the video set at two to three times the photo package; it is the same session's assets doing double duty.` },
  ],
};

export default guide;
