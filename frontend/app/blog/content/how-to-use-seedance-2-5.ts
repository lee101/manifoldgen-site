import type { BlogArticle } from '../articles';

export const howToUseSeedance25: BlogArticle = {
  slug: 'how-to-use-seedance-2-5',
  category: 'Guides',
  title: 'How to Use Seedance 2.5 for Long Single-Take Video',
  excerpt: 'Seedance 2.5 plans a whole shot at once: coherent single takes up to 30 seconds, synced speech and music, and up to 50 multimodal references. Here is how to drive it.',
  readTime: '6 min read',
  date: '2026-08-24',
  ogImage: '/blog/og/how-to-use-seedance-2-5.webp',
  blocks: [
    { type: 'p', text: 'Most video models think in five-second fragments; Seedance 2.5 thinks in scenes. It reasons about the entire take before rendering — so motion, lighting, and identity hold from first frame to last — and it generates synchronized speech, music, and effects natively. On ManifoldGen it runs as text-to-video, image-to-video, and a reference route that locks characters and sets across the whole clip.' },
    { type: 'table', head: ['Route', 'Resolution', 'Durations', 'Price'], rows: [
      ['Seedance 2.5 (text)', '480p · 720p', '4 · 5 · 8 · 10s', 'from 106 credits / 4s'],
      ['Seedance 2.5 Image to Video', '480p · 720p', '4 · 5 · 8 · 10s', 'from 106 credits / 4s'],
      ['Seedance 2.5 Reference', '480p · 720p', '4 · 5 · 8 · 10s', 'from 106 credits / 4s'],
    ] },

    { type: 'h2', text: 'Prompt the arc, not the frame' },
    { type: 'p', text: 'Because the model plans whole-shot, describe what happens over time rather than composing one frozen moment:' },
    { type: 'code', text: `A courier sprints across a rain-slick rooftop at dusk, vaults a gap
between buildings, lands hard on the far ledge, and looks back as
the searchlight sweeps past. Handheld energy settles after the landing.
Audio: driving rain, wind gusts, distant sirens, heartbeat after she stops.` },
    { type: 'p', text: 'Verbs carry sequence (sprints, vaults, lands, looks back), and the audio line gets its own beat ("heartbeat after she stops") that the model places correctly in time. That temporal awareness is the reason to pick 2.5 over fragment-based models for any shot with a beginning, middle, and end.' },

    { type: 'h2', text: 'Use references for anything recurring' },
    { type: 'p', text: 'The reference route accepts multiple images, videos, and audio clips as input. Feed it a character sheet, a set photo, or a brand product shot plus a prompt like "@Image1 is the barista, @Image2 is the café interior" and 2.5 holds both consistent across the take. This is the cheapest character-consistency workflow in the catalog — no training, no LoRA, just attachments.' },
    { type: 'list', items: [
      'One reference per concept — a face sheet, a location plate, an object turntable.',
      'Say which is which in the prompt; do not make the model guess roles.',
      'Product shots: front-on hero image plus "rotate slowly around @Image1" beats re-prompting appearance every time.',
    ] },

    { type: 'h2', text: 'Pick resolution by destination' },
    { type: 'p', text: 'Native output is 480p and 720p. Draft at 480p where iteration cost is roughly half; finish at 720p for delivery or hand the chosen take to an upscaler. Audio quality is identical across tiers, so dialogue tests can always run cheap.' },
    { type: 'callout', title: 'Longer is not looser', text: 'Coherence comes from the whole-shot plan, but your prompt still needs one continuous idea per generation. A chase is a scene; a chase, then lunch, then a boardroom is three generations stitched.' },

    { type: 'h2', text: 'Troubleshooting' },
    { type: 'list', items: [
      'Middle of the clip drifts — your action list exceeds the duration budget. Cut actions or add seconds.',
      'Speech sounds rushed — allocate roughly two seconds per spoken clause and mark pauses with "then".',
      'References bleed into each other — the model merged two faces. Use one clean frontal image per person and name them separately.',
      'Camera moves fight the choreography — give the camera its own sentence and keep it simple (one push-in, one follow).',
    ] },
    { type: 'p', text: 'Generate at /tools/seedance-2-5, animate a still at /tools/seedance-2-5-image, lock characters at /tools/seedance-2-5-reference — API mirrors under /api/video-generators/seedance-2-5.' },
  ],
};
