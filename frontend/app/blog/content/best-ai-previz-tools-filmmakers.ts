import type { BlogArticle } from '../articles';

export const bestAiPrevizToolsForFilmmakers: BlogArticle = {
  slug: 'best-ai-previz-tools-filmmakers',
  category: 'Use cases',
  title: 'Best AI previz tools in 2026: shot-blocking without a crew',
  excerpt: 'Previz is the cheapest place on the cost curve to make a mistake. Which ManifoldGen tools actually block shots and look like a film — and which are just prompt toys.',
  readTime: '5 min read',
  date: '2026-08-24',
  ogImage: '/blog/og/best-ai-previz-tools-filmmakers.jpg',
  blocks: [
    { type: 'p', text: 'Previz does not need to sell the final pixels — it needs to sell the shot: subject, camera move, lens, timing. The good ManifoldGen previz tools separate prompts from storyboards and give you blocking in seconds, so the job is deciding which tool reads your intent best and keeps a clean pipeline.' },
    { type: 'h2', text: 'The shortlist' },
    { type: 'list', items: [
      'Manifold Motion — ordered keyframes and an exact stop frame, from ~101 credits per blocked shot.',
      'H3 Image / Animate — wipe, rig, and relight in one place; pairs with H3 Image Editor.',
      'Camera-move presets — dolly, crane, orbit, handheld; the closest thing to lenses outside the studio.',
      'Seedance 2 — steady character and camera behavior for a finished frame at 1080p.',
      'LTX 2.3 — cheapest real output, from ~$1.10 per 6s clip; read prompts well, weird motion physics acceptable for a draft.',
    ] },
    { type: 'h2', text: 'What to check before you pay' },
    { type: 'list', items: [
      'No fake previews — a real output is rendered by the platform at request time, not a vendor demo.',
      'Camera prompt columns actually do something — a few still pretend "camera" does not exist.',
      'The /api endpoint accepts one POST with the exact same shape for every tool page.',
      'Billing is per second of served output, not per "attempt".',
    ] },
    { type: 'callout', title: 'The two-lane rule', text: 'Block everything in the cheap lane, keep the keyframe lane for hero frames, and never let a tool page claim motion the vendor demo videos ship.' },
    { type: 'h2', text: 'Tool pages and pricing' },
    { type: 'list', items: [
      '/tools/manifold → hold the exact request shape',
      '/tools/h3-image-editor, /tools/style-transfer',
      '/api/pricing and the /tools/* pages carry live numbers',
      '/models pages: /models/ltx, /models/wan and /models/h3 with verdicts',
    ] },
  ],
};