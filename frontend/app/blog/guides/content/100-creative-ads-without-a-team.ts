import type { Guide } from '../types';

const guide: Guide = {
  slug: '100-creative-ads-without-a-team',
  section: 'money',
  category: 'Money',
  title: `How to Produce 100+ Creative Ads Without a Team`,
  excerpt: `Performance advertising eats creative. Here is the solo pipeline — hook matrix, asset library, batch production, kill thresholds — that out-produces a four-person team.`,
  readTime: '10 min read',
  updated: 'August 2026',
  blocks: [
    { t: 'p', text: `Every direct-response brand has the same problem: their best ad is dying. Winners fatigue in two to four weeks, testing never stops, and agencies deliver ten creatives a month at agency speed. A solo operator with a real pipeline delivers a hundred. This is that pipeline.` },
    { t: 'h2', text: `Start with the matrix, not the ideas` },
    { t: 'p', text: `100 ads = 10 angles × 5 opening frames × 2 formats. An angle is the promise ("save 3 hours a week", "stop paying for gyms you don't use"). An opening frame is what the first two seconds look like. A format is 9:16 UGC-style, 16:9 demo, or 1:1 static. The matrix kills blank-page paralysis: you never "think of 100 ads", you fill in cells.` },
    { t: 'h2', text: `Build the asset library once` },
    { t: 'list', items: [
      `**Product plates** — hero shot, three-quarter, detail, in-hand. Shot once on foam board, reused forever.`,
      `**Persona cast** — two or three UGC personas with Soul ID anchors, so the same "creators" appear across the whole campaign.`,
      `**Scene plates** — kitchen counter, gym mirror, car interior, desk. The worlds your ads live in.`,
      `**Overlay templates** — caption styles, logo stings, end-card layouts per platform.`,
    ] },
    { t: 'h2', text: `The production line` },
    { t: 'steps', items: [
      `Write the 10 angle scripts — one line each: hook, demo, CTA. An angle that needs a paragraph is two angles.`,
      `Batch-generate opening frames with Make Image: five variants per angle, one variable changed per variant.`,
      `Send winning frames to video: video generators for product motion, Character Animator for persona delivery.`,
      `Assemble with overlay templates; captions on everything, sound-off legible.`,
      `QA against the brand sheet: persona consistent, product truthful, logo placement per spec.`,
      `Export the platform matrix: 9:16 + 1:1 per concept, named by angle-frame-format.`,
    ] },
    { t: 'prompt', label: 'UGC ad script template', body: `PERSONA: <paste persona descriptor block verbatim>
HOOK (0-2s): "I stopped buying protein powder at the store."
DEMO (2-15s): shows the product in use, hands in frame,
one concrete result ("mixed with water, no clumps").
OBJECTION (15-22s): "I thought it'd taste like chalk — it doesn't."
CTA (22-30s): "Link's in the bio — first tub's 20% off."
Delivery notes: casual, handheld, window light, one-take energy.` },
    { t: 'h2', text: `Persona-led UGC beats studio polish` },
    { t: 'p', text: `For direct response, testimonial-style ads from a consistent persona outperform glossy studio cuts, because testimony reads as evidence and polish reads as advertising. Keep the persona identical across the campaign — same face, wardrobe, room — so viewers and pixels both treat her as one real creator. Disclose synthetic creators where platform rules require it.` },
    { t: 'h2', text: `Kill and mutate` },
    { t: 'p', text: `Set kill thresholds before launch: typically 3 days or a fixed spend per cell. Expect the 80/20 — two angles carry the batch. When a winner emerges, mutate it: same body, new hook; same hook, new opening frame. That is where the next ten ads come from, and they arrive pre-validated.` },
    { t: 'h2', text: `Pricing and delivery` },
    { t: 'p', text: `Sell a monthly creative subscription, not per-asset: $1,500–4,000/month for a committed testing velocity. Report variants-per-week and cost-per-winning-angle, not asset counts. A warm solo pipeline sustains 100–200 ads a month; the constraint is QA discipline, not generation.` },
    { t: 'callout', tone: 'violet', title: `The moat is the system`, body: `Anyone can generate an ad. Almost nobody delivers 100 on-brand, on-time, platform-correct variants weekly with a kill-and-mutate loop attached. The system is the service.` },
  ],
};

export default guide;
