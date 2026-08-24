import type { Guide } from '../types';

const guide: Guide = {
  slug: 'soul-id-explained',
  section: 'continuity',
  category: 'Soul ID',
  title: `Soul ID Explained`,
  excerpt: `Soul ID is ManifoldGen's identity layer: one locked character spec — anchors, descriptor, derivation rules — reused everywhere so every output inherits the same face.`,
  readTime: '6 min read',
  updated: 'August 2026',
  blocks: [
    { t: 'p', text: `Soul ID is the name we give to the practice the consistency guides teach: identity lives in assets you own, not in prompts you retype. A character has a Soul ID when anyone on the team can produce a new image of them without guessing — because the face of record and the rules for deriving from it are written down.` },
    { t: 'h2', text: `The three parts` },
    { t: 'list', items: [
      `**Anchor set** — the canonical sheet: frontal, three-quarter, full-body portraits at high fidelity. The face of record.`,
      `**Descriptor block** — the frozen identity paragraph, pasted verbatim into every brief. Never paraphrased, versioned like code.`,
      `**Derivation rules** — how new images may legally be made: reference edit from anchors; masked inpaint for repairs; never a text-only regeneration of the face.`,
    ] },
    { t: 'h2', text: `How it flows through the tools` },
    { t: 'list', items: [
      `**Soul Moodboard** fuses anchor references with style references into one visual direction for the project.`,
      `**Nano Banana 2 / GPT Image 2 reference editing** moves the anchored face into new scenes — identity rides with the pixels.`,
      `**H3 Image Editor** (REF2VA) regenerates a scene while preserving identity and geometry, for heavier recontextualization.`,
      `**Inpaint** repairs drifted regions while the mask protects approved pixels.`,
      `**Relight** adapts anchors to scene lighting without touching facial structure.`,
      `**Character Animator** carries identity through motion driven by a performance clip.`,
      `**Image Upscale** finishes selects for delivery.`,
    ] },
    { t: 'h2', text: `What Soul ID is not` },
    { t: 'list', items: [
      `Not a magic one-click clone — the anchor set still needs to be built deliberately.`,
      `Not seed locking — seeds die at every route, model, and resolution change.`,
      `Not style transfer — style is how the world renders; identity is who is standing in it. They are separate layers.`,
    ] },
    { t: 'h2', text: `Setting one up takes ten minutes` },
    { t: 'steps', items: [
      `Pick or produce the anchor portraits (photo-to-persona flow works for real faces).`,
      `Write the descriptor block; save it next to the images.`,
      `Test derivation: three scenes via reference edit, audited against the anchors.`,
      `Freeze v1. Assets plus descriptor live in one folder; nothing generates outside the rules.`,
    ] },
    { t: 'callout', tone: 'teal', title: `The rule of thumb`, body: `If a new image cannot be traced back to an anchor, it is not your character. Traceability is the product — every output should be able to answer "which anchor did you come from?"` },
    { t: 'p', text: `The same pattern scales beyond people: give a location an anchor set and derivation rules and you have Soul ID for sets — which is exactly what sequence work demands (see Characters and Locations Across Shots).` },
  ],
};

export default guide;
