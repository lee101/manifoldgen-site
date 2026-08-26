import type { BlogArticle } from '../articles';

export const aiProductVideosWithoutAStudio: BlogArticle = {
  slug: 'ai-product-videos-without-a-studio',
  category: 'Guides',
  title: 'How to Make AI Product Videos Without a Studio',
  excerpt: 'Skip the light table and crew: prompt AI product videos with precise material language, one hero move, controlled reflections, and seamless loops built for ads.',
  readTime: '7 min read',
  date: '2026-08-03',
  ogImage: '/blog/og/ai-product-videos-without-a-studio.webp',
  blocks: [
    { type: 'p', text: 'A product video used to mean a light table, a macro rig, and a day of crew time. AI video replaces most of that — but only if you prompt like a cinematographer instead of a marketer. Commercial product footage has a grammar: the product described precisely enough to render its actual material, one hero move, reflections that look placed rather than accidental, and a loop clean enough to run as an ad. This guide gives you that grammar with a real generation.' },
    { type: 'p', text: 'The example below is a four-second luxury loop of a perfume bottle — no camera, no studio, generated in ManifoldGen. The prompts are copyable.' },

    { type: 'h2', text: 'The workflow' },
    { type: 'list', ordered: true, items: [
      'Write the product spec like a materials list. Material, finish, shape, color, surface state. "Black bottle" is nothing; "matte-black ceramic bottle" renders.',
      'Design the set. Pedestal or surface, backdrop, atmosphere. One surface, one backdrop gradient, at most one atmospheric element (mist, dust).',
      'Choose one hero move. A slow rotate for bottles, a push-in for texture detail, a rise-and-reveal for packaging. One per clip.',
      'Direct the lighting explicitly. Name the source ("one large softbox") and its behavior ("sliding across the curved surface"). Reflections are your production value.',
      'Decide the destination before generating. Social placement wants 9:16; web hero loops want 16:9 or 1:1. Generate per placement rather than cropping.',
      'Generate short, judge the loop point, iterate on lighting words only once geometry is right.',
    ] },

    { type: 'h2', text: 'One hero move, fully specified' },
    {
      type: 'example',
      example: {
        label: 'Hero loop',
        prompt: 'A matte-black ceramic perfume bottle standing on a wet slate pedestal, rotating slowly. Soft deep-charcoal gradient backdrop, one large softbox reflection sliding across the curved surface, thin mist drifting at the base, macro lens, luxury commercial lighting, seamless loop.',
        media: [{ kind: 'video', src: '/blog/media/ai-product-videos-without-a-studio/perfume-loop.webm', poster: '/blog/media/ai-product-videos-without-a-studio/perfume-loop.jpg', aspect: '16:9', seconds: 4 }],
        note: 'Every commercial decision is in one sentence: material (matte-black ceramic), stage (wet slate pedestal), backdrop (deep-charcoal gradient), lighting event (softbox reflection sliding), scale (macro lens), grade (luxury commercial), and edit intent (seamless loop). Nothing decorative competes with the rotate.',
      },
    },
    { type: 'p', text: '"One large softbox reflection sliding across the curved surface" is what a gaffer produces with a real softbox on a move — a single elongated highlight traveling over the product as it turns. One named source with named behavior yields a coherent highlight instead of scattered specular noise.' },

    { type: 'h2', text: 'Describe the product like a materials list' },
    { type: 'p', text: 'Models know how finishes behave under light, but only if you name them:' },
    { type: 'list', items: [
      'Finish pairs with highlight behavior — matte absorbs (say "matte", "soft sheen"), gloss mirrors ("glossy", "mirror polish"), metal conducts ("brushed aluminum anisotropic streaks", "chrome with sharp reflections"), glass refracts ("thick glass, visible refraction through the liquid").',
      'Shape needs geometry words — "cylindrical flacon", "faceted edges", "curved shoulder". Silhouettes drift without them.',
      'Surface state sells realism — "faint fingerprint-free surface", "condensation droplets" for cold drinks, "dust-free". Pick the state a stylist would create.',
      'Color gets a value — "deep-charcoal", "bone white". Bare color names render brighter than the physical object.',
    ] },

    { type: 'h2', text: 'Lighting language that reads expensive' },
    { type: 'p', text: 'Commercial lighting is few sources, precisely described. The vocabulary that works:' },
    { type: 'list', items: [
      '"One large softbox reflection" — the signature single-highlight look of premium tabletop work.',
      '"Soft deep-charcoal gradient backdrop" — separation plus depth with zero set dressing.',
      '"Rim light tracing the silhouette" — defines dark products against dark sets.',
      '"Luxury commercial lighting" / "high-end product photography lighting" — global grade terms worth one slot at the end.',
      'Atmosphere, singular — "thin mist drifting at the base" or "fine dust in the light beam". Two atmospherics fight each other.',
    ] },

    { type: 'h2', text: 'Seamless loops for paid placements' },
    { type: 'p', text: 'Ads live or die on the loop seam. Ask for it directly ("seamless loop"), keep the motion constant-speed, and end where you started: a full rotation back to the opening angle, or a push-in that settles on the exact first frame. Avoid one-directional moves — dolly-ins cannot loop; rotations can. Keep clips to 3–5 seconds so the seam arrives early.' },

    { type: 'h2', text: 'A reusable hero-loop skeleton' },
    { type: 'code', text: `A [material + finish + shape] [product] standing on [pedestal/surface],
[one hero move]. [Backdrop gradient], one large softbox reflection
[behavior across the surface], [single atmospheric element],
macro lens, luxury commercial lighting, seamless loop.` },
    { type: 'callout', title: 'One move, one light story', text: 'A product clip fails when two things happen at once. If the bottle rotates, nothing else moves but mist and highlight. A push-in is a second clip for the same product; cutting two clips still beats one studio afternoon.' },

    { type: 'h2', text: 'Troubleshooting' },
    { type: 'list', items: [
      'Product shape mutates mid-rotate — the shape lacks geometry words. Add "cylindrical", "faceted", or "symmetrical" and slow the rotation.',
      'Label text warps — AI redraws typography every frame. Regenerate the product blank and overlay real label art in editing.',
      'Reflections flicker or scatter — more than one unnamed light. Cut back to "one large softbox" and delete competing light adjectives.',
      'Loop seam jumps — motion is not periodic. Switch to full rotation, or request "settles back on the opening frame".',
      'Material looks plastic — finish is underspecified. Name the real material plus its highlight behavior ("brushed steel, anisotropic streaks").',
      'Clip feels cheap despite good product — missing scale cue. Add "macro lens" and let shallow focus do the rest.',
    ] },
    { type: 'p', text: 'Spec your product in one materials sentence, run the skeleton above at 4 seconds in Studio, then compare placements side by side using the the Studio presets before rendering final lengths.' },
  ],
};
