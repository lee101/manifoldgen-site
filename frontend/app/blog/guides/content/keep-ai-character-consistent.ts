import type { Guide } from '../types';

const guide: Guide = {
  slug: 'keep-ai-character-consistent',
  section: 'foundations',
  category: 'Character identity',
  title: `How to Keep Your AI Character Consistent`,
  excerpt: `A four-layer workflow — canonical sheet, frozen descriptor, reference edits, masked repairs — that keeps one character recognizable across dozens of images.`,
  readTime: '8 min read',
  updated: 'August 2026',
  blocks: [
    { t: 'p', text: `Consistency is a workflow property, not a prompt property. Any single generation can nail a face; keeping it nailed across thirty images needs structure. The structure has four layers, and they stack: each one removes a way for identity to leak.` },
    { t: 'h2', text: `Layer 1 — Canonical character sheet` },
    { t: 'p', text: `Audition candidates once, then stop. Use bulk variants (Make Image runs several models on your description per line) to find a face worth committing to. From the winner, produce a small set of plate portraits at high quality:` },
    { t: 'list', items: [
      `Frontal, neutral expression, even light — the anchor every comparison starts from.`,
      `Three-quarter view — how the face reads in most scenes.`,
      `Full body — proportions, posture, wardrobe baseline.`,
      `One expression range shot — smile and neutral, so mood changes do not read as identity changes.`,
    ] },
    { t: 'p', text: `These plates are the only source of truth. Everything else is derived from them or rejected.` },
    { t: 'h2', text: `Layer 2 — Frozen descriptor block` },
    { t: 'p', text: `Write the face as structure, not adjectives about beauty: age range, face length and width, eye shape and spacing, brow thickness, nose bridge and tip, mouth and lip fullness, chin and jawline, skin tone and texture, hairline and hair behavior, plus permanent anchors (wardrobe signature, marks). Then paste this paragraph verbatim into every brief for the project. Paraphrasing mid-project quietly re-rolls the conditioning — treat the block like a constant in code.` },
    { t: 'prompt', label: 'Canonical descriptor block', body: `MAYA — identity block (paste verbatim):
Woman, late 20s, narrow oval face, high cheekbones,
almond eyes set slightly wide, straight dark-brown brows,
straight nose bridge with rounded tip, full lower lip,
defined jawline ending in a soft chin, warm olive skin
with visible pores, collarbone-length black hair with a
center part tucked behind the left ear, small silver hoop
nose stud on the right nostril.` },
    { t: 'h2', text: `Layer 3 — Edit, do not regenerate` },
    { t: 'p', text: `For every new scene, start from an approved frame and use reference-based editing — Nano Banana 2 or GPT Image 2 reference edit, or the H3 Image Editor when geometry must hold — to place the character into the new context. Identity rides along with the pixels. A fresh text-only generation of "the same character" is a lottery ticket with worse odds every time you buy one.` },
    { t: 'h2', text: `Layer 4 — Masked repairs` },
    { t: 'p', text: `When an output is 90% right, inpaint only the drifted region — a hairline, hands, a logo — and let the mask protect everything else pixel-for-pixel. This is cheaper than a reroll and never disturbs the parts you already approved.` },
    { t: 'h2', text: `Change one variable at a time` },
    { t: 'p', text: `Move light with Relight, camera language with Cinematic Cameras presets, backgrounds with outpainting or style transfer — separately. If an iteration changes five things at once, you cannot tell which one broke the face.` },
    { t: 'h2', text: `Pre-publish audit` },
    { t: 'list', items: [
      `Eye spacing and size against the frontal plate.`,
      `Jawline width and chin shape in three-quarter views.`,
      `Hairline position and part direction.`,
      `Nose bridge profile in profile shots.`,
      `Permanent anchors present: studs, moles, scars, signature jewelry.`,
    ] },
    { t: 'callout', tone: 'violet', title: `Seed discipline`, body: `Locking a seed helps within one model and configuration only — it does not survive route changes, resolution changes, or refiners. References survive everything. Spend your discipline on the sheet, not the seed.` },
  ],
};

export default guide;
