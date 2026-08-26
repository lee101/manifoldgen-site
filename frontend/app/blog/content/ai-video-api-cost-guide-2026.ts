import type { BlogArticle } from '../articles';

export const aiVideoApiCostGuide: BlogArticle = {
  slug: 'ai-video-api-cost-guide-2026',
  category: 'API & pricing',
  title: 'The real cost of an AI video API in 2026: $/s across eight model families',
  excerpt: 'Every model on ManifoldGen, measured in credits and dollars per second: LTX 2 at $0.09 per clip through Veo 3.1 at $0.40/s. With per-second math and the workflow that keeps spend sane.',
  readTime: '7 min read',
  date: '2026-08-24',
  ogImage: '/blog/og/ai-video-api-cost-guide-2026.webp',
  blocks: [
    { type: 'p', text: 'AI video APIs stopped being priced per clip — they are priced per second, and the spread is enormous. On ManifoldGen the cheapest real generator (LTX 2) runs about $0.02 per second while the photoreal flagship (Veo 3.1) runs $0.40 per second, a 20x spread across one API key and one credit balance. This is the pricing picture as it stands on the platform, with the math you need to estimate a project before you start.' },
    { type: 'h2', text: 'The per-second table' },
    { type: 'table', head: ['Model', 'Price per 5s clip', '$/second (approx)', 'Audio', 'Max res'], rows: [
      ['LTX 2 (text)', '9 credits (~$0.09)', '$0.02', 'No', '720p'],
      ['Wan', '90 credits (~$0.90)', '$0.18', 'No', '720p'],
      ['Kling 3.0 Standard', '76 credits (~$0.76)', '$0.15', 'Yes', '720p'],
      ['Kling 3.0 Pro', '101 credits (~$1.01)', '$0.20', 'Yes', '1080p'],
      ['Seedance 2 Fast', '128 credits (~$1.28)', '$0.27', 'Yes', '1080p'],
      ['Seedance 2', '128 credits (~$1.28); 161 full', '$0.33', 'Yes', '1080p'],
      ['Seedance 2.5', '106 credits', '$0.21', 'Yes', '720p'],
      ['Veo 3.1 Fast', '90 credits', '$0.18', 'Yes', '1080p'],
      ['Veo 3.1', '240 credits (~$2.40)', '$0.48', 'Yes', '1080p'],
    ] },
    { type: 'callout', title: 'Credits math', text: '1 credit = $0.01. A 60-second cut at Seedance full quality is roughly 60 × $0.33 = $20; the same cut drafted in LTX 2 costs about $1.20. The gap is why the cheap lane exists — it is for iteration, not delivery.' },
    { type: 'h2', text: 'How per-second pricing changes pipeline design' },
    { type: 'list', items: [
      'Draft in the cheap lane: LTX 2 at ~$0.09 a clip means a 20-shot animatic costs under $2 before any quality spend.',
      'Move to the audio lane for story beats: Kling 3.0 and Seedance give synced audio without a separate sound pass, so one render is the whole cut.',
      'Reserve the flagship for hero frames: Veo 3.1 at $0.40/s only where the shot must look physical.',
      'Use one key: every lane above bills from the same prepaid balance, so switching models mid-project is a parameter change, not an integration change.',
    ] },
    { type: 'h2', text: 'Estimating a real project' },
    { type: 'p', text: 'A 30-second product ad, 12 shots: draft all 12 in LTX 2 (~$1.10), move the 4 hero shots to Seedance 2 full quality (~$2.70), keep one Veo 3.1 photoreal insert (~$1.20). Total under $6 before music — and the music track itself is $0.35 flat on the same balance. The API surface for this is one POST per shot; the per-model tool pages carry the exact request shapes.' },
    { type: 'h2', text: 'Full pricing and tooling' },
    { type: 'list', items: [
      'Live price list: /api/pricing and the /api page',
      'Per-model pages with specs: /models/seedance, /models/wan, /models/ltx, /models/kling, /models/veo',
      'Hands-on tools: /tools/ltx-2, /tools/wan, /tools/seedance-2, /tools/kling-3, /tools/veo-3-1',
      'API directory per generator: /api/video-generators',
      'Head-to-head verdicts: /compare/seedance-vs-kling and /compare/kling-vs-veo',
    ] },
  ],
};