import type { Guide } from '../types';

const guide: Guide = {
  slug: 'keep-ai-persona-consistent',
  section: 'personas',
  category: 'AI personas',
  title: `How to Keep AI Persona Consistent`,
  excerpt: `Long projects outlive vibes. A one-page persona bible plus a weekly drift audit keeps voice, look, and behavior stable across weeks of generation.`,
  readTime: '6 min read',
  updated: 'August 2026',
  blocks: [
    { t: 'p', text: `A persona is more than a face. Faces drift visually; personas also drift editorially — outfits mutate, age slides, tone wanders, backstory contradicts itself. Visual fixes are covered elsewhere; this guide is about keeping the whole persona coherent over time.` },
    { t: 'h2', text: `Write the persona bible — one page, no more` },
    { t: 'list', items: [
      `The frozen **identity descriptor block** (face only).`,
      `**Wardrobe capsules** with exact named items per capsule.`,
      `A **palette** — three colors the persona gravitates toward.`,
      `**Prohibited traits** — never glasses unless story-required, no visible tattoos if canon says none.`,
      `**Voice sample** — three lines showing how they caption and speak.`,
      `**Canon facts** — age range, city, job, relationship status.`,
      `**Asset paths** — where the character sheet and location plates live.`,
    ] },
    { t: 'prompt', label: 'Persona bible skeleton', body: `# PERSONA BIBLE v1 — "MAYA"
Face: <paste canonical descriptor verbatim>
Capsule A (studio): black turtleneck, silver hoops, dark denim.
Capsule B (field): olive chore jacket, canvas tote, boots.
Palette: ink black / warm olive / paper white.
Never: glasses, visible tattoos, red lipstick.
Voice: dry, specific, one emoji maximum.
Canon: 28, Lisbon, ceramicist.
Assets: /personas/maya/{sheet, plates}` },
    { t: 'h2', text: `Version it like code` },
    { t: 'p', text: `Bump the version for every intentional change and log one line: "v2 — shorter bob, new field capsule." If someone regenerates from old briefs they resurrect dead versions. The current version number appears in every request, so stale outputs are traceable to their source.` },
    { t: 'h2', text: `Run a drift audit` },
    { t: 'steps', items: [
      `Weekly, pull the last batch of outputs into one grid next to the sheet.`,
      `Flag deltas: eyes, jawline, hairline, wardrobe, age cues.`,
      `Classify each flag — identity drift vs styling drift vs acceptable variation.`,
      `Repair identity flags with inpaint or reference edit from the sheet; note styling flags for the next bible revision.`,
    ] },
    { t: 'h2', text: `Multi-operator consistency` },
    { t: 'p', text: `Teams break personas faster than models do. Share the bible and the sheet; forbid paraphrased descriptor blocks in briefs — quote them verbatim; require the reference image attached to every generation request. Reviewers check against the sheet, not memory.` },
    { t: 'callout', tone: 'violet', title: `Scripted change beats accidental change`, body: `Personas age, get haircuts, change style. Fine — script it. A deliberate version bump with a new capsule and updated descriptor reads as story; silent drift reads as broken.` },
  ],
};

export default guide;
