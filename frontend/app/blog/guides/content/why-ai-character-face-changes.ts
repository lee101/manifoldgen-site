import type { Guide } from '../types';

const guide: Guide = {
  slug: 'why-ai-character-face-changes',
  section: 'foundations',
  category: 'Character identity',
  title: `Why Does Your AI Character's Face Keep Changing?`,
  excerpt: `Diffusion models have no memory of your character. Here is what actually moves a face between generations — and which levers pin it down.`,
  readTime: '7 min read',
  updated: 'August 2026',
  blocks: [
    { t: 'p', text: `You wrote the same prompt twice and got two different people. That is not the model being stubborn — it is the model doing exactly what it was built to do. Nothing in a text-to-image pipeline carries your character forward from one run to the next except the things you deliberately carry. Once you see which inputs move identity, the fixes become obvious.` },
    { t: 'h2', text: `A model does not know who your character is` },
    { t: 'p', text: `Generation is conditional sampling: prompt + seed + weights go in, one sample comes out of an enormous distribution of possible people. "Maya, 28, dark hair, green eyes" describes thousands of plausible faces. Every generation picks one point in that space. Change any input even slightly and you land on a different point — usually a different person.` },
    { t: 'h2', text: `What actually moves a face between runs` },
    { t: 'list', items: [
      `**Seed** — different initial noise produces a structurally different person before your prompt has any say.`,
      `**Prompt wording** — synonyms, adjective order, and added details all shift conditioning. "short bob" vs "bob haircut" is enough.`,
      `**Model or route** — different checkpoints and samplers carve the latent space differently; the same words describe different people on each.`,
      `**Resolution and aspect ratio** — coarse features like skull shape get re-decided when the canvas changes size.`,
      `**Refiner and upscale passes** — second-stage models happily redraw jawlines and eyes while "improving" detail.`,
      `**Batch mode** — generating many variants means many identities by design. A batch is an audition, not a library.`,
    ] },
    { t: 'h2', text: `Separate the three failure modes` },
    { t: 'list', items: [
      `**Identity drift** — a genuinely different person. Fix with references, not prompts.`,
      `**Render drift** — same person drawn differently: softer skin, wider spacing, changed age. Fix by editing the output (inpaint) instead of rerolling.`,
      `**Framing drift** — right face, wrong crop or lens feel. Fix with composition language and camera presets, leave identity alone.`,
    ] },
    { t: 'callout', tone: 'teal', title: `The 80/20`, body: `Most "inconsistent character" complaints trace to missing reference anchoring, not bad prompting. Prompts constrain; references specify. A prompt can say "freckles", but only a reference image says these freckles, this nose.` },
    { t: 'h2', text: `What actually pins a face down` },
    { t: 'steps', items: [
      `Produce **one canonical portrait** everyone copies from. Stop auditioning new versions of the face once you have it.`,
      `Freeze an **identity descriptor block** — a paragraph describing the face structurally — and paste it verbatim into every brief.`,
      `Create new scenes by **reference-based editing** from approved frames, so the pixels of the face travel with the request.`,
      `Repair drift with **masked inpainting**: only the broken region resamples, everything outside the mask stays pixel-identical.`,
    ] },
    { t: 'h2', text: `Know when drift is expected` },
    { t: 'p', text: `Extreme head angles, heavy motion blur, and deliberate style shifts will always approximate rather than clone. Set a tolerance per medium — film stills deserve tighter likeness than 200px thumbnails — and repair outliers with targeted edits. Chasing pixel-perfect identity across every frame burns credits faster than it builds believability.` },
    { t: 'p', text: `Next: the full four-layer workflow that keeps a character recognizable across dozens of images — see How to Keep Your AI Character Consistent in this section.` },
  ],
};

export default guide;
