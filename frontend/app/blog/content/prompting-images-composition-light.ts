import type { BlogArticle } from '../articles';

export const promptingImagesCompositionLight: BlogArticle = {
  slug: 'prompting-images-composition-light',
  category: 'Prompt craft',
  title: 'Prompting images: composition first, detail second',
  excerpt: 'Use subject, framing, lens, light, and material cues in the order an image model can actually use them.',
  readTime: '5 min read',
  date: '2026-07-02',
  ogImage: '/blog/og/prompting-images-composition-light.webp',
  blocks: [
    { type: 'p', text: 'Image prompts work best when they establish the frame before decorating it. A model can use “three-quarter portrait, subject on the right third, hard side light” as a set of visual constraints. It has less to do with whether the prompt sounds poetic.' },
    {
      type: 'example',
      example: {
        label: 'Copyable prompt, generated output',
        prompt: `Editorial portrait of a ceramicist in a cobalt-blue studio,
three-quarter profile positioned on the right third of a vertical frame,
negative space to the left, 85mm portrait lens, eyes in sharp focus,
hard window light from camera left, deep but readable shadows,
subtle clay dust in the air, tactile matte surfaces, restrained film color.`,
        media: [{ kind: 'image', src: '/blog/media/prompting-images-composition-light/ceramicist.webp', aspect: '16:9', caption: 'Generated with ManifoldGen from the prompt above' }],
      },
    },
    { type: 'h2', text: 'Build from large to small' },
    { type: 'list', ordered: true, items: [
      'Subject and action: what is the viewer looking at?',
      'Composition: portrait, wide, centered, negative space, foreground/background.',
      'Optics: lens feel, depth of field, focus plane, camera height.',
      'Light and material: direction, softness, reflections, surface qualities.',
      'Finish: color grade or medium, used as a final nudge.',
    ] },
    { type: 'h2', text: 'Copyable prompt' },
    { type: 'code', text: `Editorial portrait of a ceramicist in a cobalt-blue studio,
three-quarter profile positioned on the right third of a vertical frame,
negative space to the left, 85mm portrait lens, eyes in sharp focus,
hard window light from camera left, deep but readable shadows,
subtle clay dust in the air, tactile matte surfaces, restrained film color.` },
    { type: 'p', text: 'For a batch, change one variable at a time: framing, light direction, or material. That makes the outputs teach you something. If every variation changes the subject, lens, mood, and color at once, you cannot tell which instruction helped.' },
    { type: 'callout', title: 'References are constraints', text: 'Call out what a reference contributes: palette, silhouette, material, or composition. Do not make the model guess what the reference is for.' },
    { type: 'callout', title: 'Negatives are a scalpel', text: 'Use a short negative list for known failure modes such as text, watermarks, or extra fingers — not a second essay that competes with the prompt.' },
  ],
};
