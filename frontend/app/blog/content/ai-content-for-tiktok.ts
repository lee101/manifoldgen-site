import type { BlogArticle } from '../articles';

export const aiContentForTiktok: BlogArticle = {
  slug: 'ai-content-for-tiktok',
  category: 'Guides',
  title: 'How to Create AI Content for TikTok in 2026',
  excerpt: 'Generate AI video that performs on TikTok: vertical-native 9:16 prompts, a hook in the first second, seamless loops, and batch variation workflows.',
  readTime: '7 min read',
  date: '2026-08-14',
  ogImage: '/blog/og/ai-content-for-tiktok.jpg',
  blocks: [
    { type: 'p', text: 'TikTok punishes landscape video twice: once when the letterboxed frame shrinks on the For You page, and again when the viewer has to rotate or squint. Generate vertical from the start — aspect 9:16 in every prompt — and compose for a phone held in one hand.' },
    { type: 'p', text: 'This guide covers the four things that separate AI clips that travel from AI clips that die at 200 views: native vertical composition, a hook inside the first second, loop-ability, and batching enough variations to let the algorithm choose.' },

    { type: 'h2', text: 'The workflow' },
    { type: 'list', ordered: true, items: [
      'Pick a satisfying subject. Macro food, textures, fluids, tools, cleaning, crafts. Subjects with continuous physical motion outperform narrative on a feed scrolled at one second per clip.',
      'Prompt natively vertical: state "9:16" intent through subject placement — tall glasses, standing figures, top-to-bottom pours. Center-weighted composition survives UI overlays.',
      'Front-load motion into the first second. The model spends early frames on your first clause, so open the prompt with the pour, the crack, the splash — not the setting.',
      'Design the loop: end state near start state. Ice settles back onto the glass rim; steam returns to stillness. A seamless loop multiplies watch time, and watch time is the metric.',
      'Batch 4–6 variations of the same prompt changing one variable each (backdrop color, camera distance, pour speed). Post the best performer; hold the rest as follow-ups.',
      'Post native resolution: 1080x1920, no watermark, caption and sound added in the app.',
    ] },

    { type: 'h2', text: 'A vertical hook, generated' },
    {
      type: 'example',
      example: {
        label: 'Vertical macro hook',
        prompt: 'Extreme macro slow motion of iced coffee pouring into a tall glass: milk swirling through dark espresso, ice cubes cracking and shifting, condensation droplets on the glass. Bold terracotta studio backdrop, crisp product lighting, satisfying ASMR energy, seamless loop.',
        media: [{ kind: 'video', src: '/blog/media/ai-content-for-tiktok/iced-coffee-macro.webm', poster: '/blog/media/ai-content-for-tiktok/iced-coffee-macro.jpg', aspect: '9:16', seconds: 5 }],
        note: 'The action clause leads ("pouring into a tall glass") so frame one is already mid-motion — no establishing dead time. The tall glass fills the 9:16 frame naturally, and the swirl-to-settle arc reads as endless when looped.',
      },
    },

    { type: 'h2', text: 'Hook engineering' },
    { type: 'p', text: 'You have roughly one second before the swipe. That means the first frame must contain motion and the first half-second must escalate. Prompt structure controls this directly:' },
    { type: 'list', items: [
      'Open with the verb in motion: "pouring", "slicing", "spinning". Never "A quiet kitchen in the morning..." — that is a dead first frame.',
      'Name the payoff in the middle of the prompt where mid-clip frames land it: the crack, the reveal, the perfect swirl.',
      '"Slow motion" earns its place here: macro fluid dynamics are the rare subject where slowmo adds feed-stopping detail instead of dulling pace.',
      'Contrast carries thumbnails: bold flat backdrop colors (terracotta, cobalt, cream) make the moving subject pop even at stamp size.',
    ] },

    { type: 'h2', text: 'Safe-zone composition' },
    { type: 'p', text: 'TikTok covers the right edge with engagement rail and the bottom third with caption and audio UI. Compose center-weighted: subject in the middle 60 percent of frame, critical detail slightly above center, nothing important hugging edges. In prompts this translates to simple geometry — "centered in frame", "tall glass filling the vertical frame", "shot straight on". Avoid prompts asking for wide environmental context; vertical plus busy edges guarantees your subject ends up behind a button.' },

    { type: 'h2', text: 'Loop mechanics' },
    { type: 'p', text: 'A seamless loop needs matching endpoints. Two reliable patterns:' },
    { type: 'list', items: [
      'Return to rest: the pour finishes, ice settles, surface stills. The last frame resembles the first. Say "seamless loop" explicitly; models trained on looping stock respond to it.',
      'Continuous cycle: stirring never stops, gears keep turning. Periodic motion hides the seam by construction. Add "constant speed" so the cycle does not decelerate at the clip boundary.',
    ] },
    { type: 'code', text: `Extreme macro [slow motion] of [satisfying process] into/onto [tall vertical subject]:
[primary motion], [secondary texture detail], [tertiary micro detail].
Bold [flat color] studio backdrop, crisp product lighting,
satisfying ASMR energy, seamless loop.` },

    { type: 'callout', title: 'Batch, do not perfect', text: 'TikTok rewards volume and lets the algorithm pick winners. Generate five variations of one concept in /studio, post the strongest, and repost variations days apart rather than polishing a single clip for hours. The winning variable is rarely the one you would have guessed.' },

    { type: 'h2', text: 'Troubleshooting' },
    { type: 'list', items: [
      'Clip feels dead in the feed — first frame is static. Reorder the prompt so the action clause comes first.',
      'Subject hidden behind UI — composition too wide or low. Recompose center-weighted, detail above center.',
      'Loop visibly jumps — end state differs from start. Switch to return-to-rest phrasing or constant-speed cyclic motion.',
      'Macro detail melts mid-clip — too many simultaneous motions. Cut to one primary motion plus one texture detail.',
      'Looks like an ad, gets skipped — drop "product lighting" for lifestyle subjects and re-add mixed ambient light per the realism pass.',
      'Vertical render crops oddly — the prompt described a horizontal scene. Rewrite around tall subjects: glasses, bottles, standing people, falling pours.',
    ] },

    { type: 'p', text: 'Draft three concepts tonight, run each as a 9:16 batch in /studio, and post the winner within 48 hours while you still care about the result. For lens and framing vocabulary to fill the skeleton with, see /tools/cinematic-cameras.' },
  ],
};
