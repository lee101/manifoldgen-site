import type { Guide } from '../types';

const guide: Guide = {
  slug: 'turn-photo-into-consistent-ai-persona',
  section: 'personas',
  category: 'AI personas',
  title: `How to Turn Your Photo Into a Consistent AI Persona`,
  excerpt: `Choose the right source photo, extract a reusable identity spec, and rebuild yourself — or anyone with consent — as a repeatable character for scenes, avatars, and animation.`,
  readTime: '7 min read',
  updated: 'August 2026',
  blocks: [
    { t: 'p', text: `A photo is the strongest identity anchor that exists — stronger than any prompt. Turned into a persona properly, one picture becomes avatars, storyboard stand-ins, brand characters, or a virtual presenter. One rule first: only transform photos you have the rights to, and disclose synthetic personas where audiences expect humans.` },
    { t: 'h2', text: `Pick a strong source photo` },
    { t: 'list', items: [
      `Frontal or near-frontal; both eyes clearly visible.`,
      `Even soft light — no hard side shadows carving the face.`,
      `Neutral to mild expression; a big smile distorts eye shape and jaw.`,
      `Sharp focus on the eyes; no sunglasses, hats, or heavy filters.`,
      `Highest resolution available, single subject, uncluttered background.`,
    ] },
    { t: 'p', text: `If your best photo fails two or more of these, shoot a new one against a window. Thirty seconds of photography beats an hour of repair generation.` },
    { t: 'h2', text: `Extract the identity spec` },
    { t: 'steps', items: [
      `Describe the face structurally — not "pretty", but measurable: face length and width, eye shape and spacing, brow thickness and arch, nose bridge and tip, lip fullness, chin and jawline, skin tone and undertone, hair texture and hairline, permanent marks.`,
      `Write it in present tense as a descriptor block (see the character consistency guide for format).`,
      `Generate a three-angle verification set — frontal, three-quarter, profile — using reference edit **from the original photo**, then compare each against the source before trusting it.`,
    ] },
    { t: 'prompt', label: 'Persona descriptor extracted from a photo', body: `DANIEL — derived from ref_01.jpg:
Man, mid-30s, rectangular face with broad forehead,
deep-set brown eyes set close, thick straight brows,
slightly convex nose bridge, thin upper lip,
square jaw with a cleft chin, light olive skin,
short wavy dark hair receding at the temples,
faint scar through the left eyebrow.` },
    { t: 'h2', text: `Build the persona around the face` },
    { t: 'p', text: `The spec carries identity; the persona adds everything scenes need: a wardrobe capsule of two or three named outfits, a short vibe vocabulary kept deliberately small, occupation, age range, and one signature prop. Store photos, descriptor, and capsules in one place — a Soul Moodboard fuses them into a single visual direction you can hand to any brief.` },
    { t: 'h2', text: `Deploy into scenes` },
    { t: 'steps', items: [
      `Reference-edit the anchor into environments rather than regenerating the person.`,
      `Relight outputs to match scene lighting when the mood must shift.`,
      `Upscale final selects for delivery.`,
      `For motion, Character Animator drives movement while identity holds through the clip.`,
    ] },
    { t: 'callout', tone: 'violet', title: `Do not chain derivatives`, body: `If an early stylized output loses likeness, go back to the original photo — never re-derive from a derivative. Every hop away from the source compounds drift.` },
  ],
};

export default guide;
