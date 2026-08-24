import type { Guide } from '../types';

const guide: Guide = {
  slug: 'create-consistent-ai-influencer',
  section: 'personas',
  category: 'AI personas',
  title: `How to Create a Consistent AI Influencer`,
  excerpt: `From blank page to feed: design a reproducible persona, build a scene library, and run a weekly reference-locked production pipeline.`,
  readTime: '8 min read',
  updated: 'August 2026',
  blocks: [
    { t: 'p', text: `An AI influencer is a content system wearing a character. The face matters less than the repeatable machinery around it: recognizable look, recurring places, stable voice, steady cadence. Build the machinery first and the feed follows.` },
    { t: 'h2', text: `Decide the job before the face` },
    { t: 'list', items: [
      `Niche and audience — fashion, travel, fitness, food. Everything downstream inherits this.`,
      `Platform ratios — 4:5 for feed posts, 9:16 for stories and reels. Pick per-shot at brief time, not after generation.`,
      `Tone — aspirational, cozy, chaotic, minimal. Three words maximum, written down.`,
    ] },
    { t: 'h2', text: `Design the persona` },
    { t: 'steps', items: [
      `Build the base with the photo-to-persona flow (real-face anchor) or a generated character sheet (fully synthetic).`,
      `Choose distinctive but reproducible features — avoid hyper-complex tattoos or elaborate hairstyles as daily anchors; they are the first thing models get wrong.`,
      `Define two wardrobe capsules plus one signature accessory that appears constantly.`,
      `Lock a palette; feeds read as coherent largely through repeated color.`,
    ] },
    { t: 'h2', text: `Build a scene library` },
    { t: 'p', text: `Recurring locations sell realism harder than face tweaks do. Generate each core location once as a high-fidelity master plate — the café corner, the gym mirror, the rooftop at dusk — then reuse it via reference edit and outpainting. Vary time of day and mood with Relight instead of generating new places. Five great locations beaten to death beat fifty forgettable ones.` },
    { t: 'h2', text: `The weekly production pipeline` },
    { t: 'steps', items: [
      `Brief the week: twelve to twenty shots mapped to captions and ratios before generating anything.`,
      `Batch-generate variants from approved frames (Make Image across models), one variable per variant.`,
      `Select ruthlessly; repair drift with masked inpaint; never reroll whole frames late in the week.`,
      `Upscale selects, export per platform ratio, schedule.`,
      `Log which scene types performed; next week's brief leans into winners.`,
    ] },
    { t: 'h2', text: `Voice is part of consistency` },
    { t: 'p', text: `Write a caption style guide into the persona bible: sentence length, emoji policy, recurring phrases, how she signs off. Readers detect voice drift faster than face drift — and unfollow for it.` },
    { t: 'callout', tone: 'teal', title: `Disclose`, body: `Label synthetic origin where platform rules and audience expectation require it. The persona's trust is the actual product; borrowing human trust for a synthetic face is the fastest way to lose both.` },
    { t: 'p', text: `Refresh wardrobe capsules quarterly as scripted bible versions — change on purpose, never by accident.` },
  ],
};

export default guide;
