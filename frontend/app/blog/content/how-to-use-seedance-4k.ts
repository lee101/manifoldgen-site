import type { BlogArticle } from '../articles';

export const howToUseSeedance4k: BlogArticle = {
  slug: 'how-to-use-seedance-4k',
  category: 'Guides',
  title: 'How to Use Seedance 4K for Native Ultra-HD Shots',
  excerpt: 'Seedance 4K runs Seedance 2.0 pinned to native ultra-HD output — one generation, no upscale pass. Here is when native pixels beat upscaling and how to art-direct for them.',
  readTime: '5 min read',
  date: '2026-08-24',
  ogImage: '/blog/og/how-to-use-seedance-4k.jpg',
  blocks: [
    { type: 'p', text: 'Most "4K AI video" is a 720p render stretched after the fact. Seedance 4K is different: it drives Seedance 2.0 straight into its native ultra-HD tier, so texture, edge detail, and on-screen text exist in the original pixels instead of being invented by a scaler. That costs more per second (from 747 credits for a 4-second clip) and buys the one thing upscalers cannot fake — real resolution where the camera looks.' },
    { type: 'table', head: ['Route', 'Resolution', 'Durations', 'Price'], rows: [
      ['Seedance 4K (text)', 'native 4K', '4 · 5s', 'from 747 credits / 4s'],
    ] },

    { type: 'h2', text: 'When native 4K is worth it' },
    { type: 'list', items: [
      'Hero shots that get cropped — 4K frames survive punch-ins and vertical reframes at full sharpness.',
      'Fine texture as subject — fabric weave, foliage, skin, water droplets. Upscalers average these; native rendering keeps them distinct.',
      'Ledger and signage — readable text in frame survives because the glyphs are rendered, not hallucinated by an upscale pass.',
      'Client delivery floors — broadcast and OOT specs that reject upscaled pipelines.',
    ] },
    { type: 'p', text: 'And when it is not: anything destined for social feeds at 1080p or below. Draft those on Seedance 2 at one-fifth the rate and spend the difference on takes.' },

    { type: 'h2', text: 'Art-direct for the resolution' },
    { type: 'p', text: 'Ultra-HD rewards prompts that name materials and optics. The model can only render detail you ask for:' },
    { type: 'code', text: `Macro shot of a mechanical watch being assembled, tweezers place
the balance wheel into a brushed titanium movement; every screw
slot and brush stroke resolves sharply; shallow depth of field
with crisp micro-detail at the focal plane; quiet workshop room tone.` },
    { type: 'p', text: 'Note the pattern: one precise action, then clauses about surface quality ("brushed", "screw slots", "micro-detail at the focal plane"), then restrained camera. In 4K every adjective renders — including ones you did not mean, like extra reflections from vague glass language.' },

    { type: 'h2', text: 'Keep durations short and shots tight' },
    { type: 'p', text: 'Native 4K generations are priced per second with no fast lane, so the economics favor short, dense shots: four seconds of hero material cut into a longer edit, not ten seconds of coverage. Storyboard first on cheaper tiers to lock timing, then re-run only the winning composition here.' },
    { type: 'callout', title: 'One hero per generation', text: 'Treat each 4K pass like film stock. Compose a single deliberate shot — macro insert, establishing aerial, product beauty — and let cheaper tiers handle connective tissue.' },

    { type: 'h2', text: 'Troubleshooting' },
    { type: 'list', items: [
      'Detail feels soft despite 4K — the prompt never named fine textures. Add material and optics language; resolution cannot invent unrequested detail.',
      'Costs ran away — you iterated composition at native rate. Lock framing on Seedance 2 first, then re-render the keeper.',
      'Shallow-focus backgrounds too busy — state the aperture intent ("f/1.8 look, background melts to bokeh").',
      'Motion reads sluggish at macro distances — scale motion to lens length; macros need small real-world movement, not sweeps.',
    ] },
    { type: 'p', text: 'Run it at /tools/seedance-4k, or automate through /api/video-generators/seedance-4k; draft the same prompts cheaply at /tools/seedance-2.' },
  ],
};
