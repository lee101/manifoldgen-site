import type { BlogArticle } from '../articles';

export const howToUseVeo31: BlogArticle = {
  slug: 'how-to-use-veo-3-1',
  category: 'Guides',
  title: 'How to Use Veo 3.1 for Photoreal Video With Sound',
  excerpt: 'Google\'s Veo 3.1 is the photorealism benchmark: physics that hold, native dialogue, and 4/6/8-second takes with synced audio. Fast covers drafts at 90 credits; Standard covers finals.',
  readTime: '6 min read',
  date: '2026-08-24',
  ogImage: '/blog/og/how-to-use-veo-3-1.jpg',
  blocks: [
    { type: 'p', text: 'Veo 3.1 is the model you reach for when the clip must look filmed rather than generated: real-world physics, believable skin and water, and the best native dialogue in the field. On ManifoldGen it runs as image-to-video in two tiers — Fast for iteration, Standard for finals — both with synchronized sound.' },
    { type: 'table', head: ['Route', 'Resolution', 'Durations', 'Price'], rows: [
      ['Veo 3.1 Fast (image)', '720p · 1080p', '4 · 6 · 8s', 'from 90 credits / 5s'],
      ['Veo 3.1 Standard (image)', '720p · 1080p', '4 · 6 · 8s', 'from 240 credits / 5s'],
    ] },

    { type: 'h2', text: 'Start from a still, always' },
    { type: 'p', text: 'Both ManifoldGen routes are image-to-video, and that is the correct workflow anyway. Veo follows composition religiously, so a still gives you casting, framing, and lighting direction for free — then the video prompt only has to describe motion and sound. Generate your frame with any image model, pick the take you would have shot, and animate it.' },

    { type: 'h2', text: 'Write motion like a director, not a caption' },
    { type: 'code', text: `The chef turns from the window, wipes her hands on her apron,
and looks back at the rain. Camera holds static; depth of field
stays on her hands. Rain streaks the glass; kitchen ambience,
distant radio, one low thunder roll.` },
    { type: 'list', items: [
      'One subject action per clause — "turns", "wipes", "looks" are three beats Veo will sequence faithfully.',
      'State the camera explicitly — "static", "slow push-in". Silence invites drift.',
      'Name what should not move — "depth of field stays on her hands" pins focus better than hoping.',
      'Score it — ambience, one music cue, or a weather layer. Unspecified audio defaults to room tone.',
    ] },

    { type: 'h2', text: 'Dialogue that passes' },
    { type: 'p', text: 'Veo renders speech with lip alignment and even accent control if you name it. Keep lines under twelve words, put them in quotes, and attribute them: He says, "Lock the door behind you." Faces read best at medium close-up or tighter; dialogue in a wide shot wastes the feature.' },
    { type: 'callout', title: 'Fast is the look-dev tier', text: 'Prompt structure transfers one-to-one between tiers. Lock motion and timing on Fast at 90 credits per pass, then re-run the identical request on Standard only for the shots that made the cut.' },

    { type: 'h2', text: 'Choosing durations' },
    { type: 'p', text: 'Four seconds suits inserts and social loops; six handles a full action beat; eight fits a line of dialogue plus a reaction. If a scene needs more, generate two eight-second takes with matched stills (same character frame, different camera) and cut — Veo keeps identity across cuts far better than across a single long generation.' },

    { type: 'h2', text: 'Troubleshooting' },
    { type: 'list', items: [
      'Physics show off — water, cloth, and fire are Veo strengths, but they need space. Tight frames force shortcuts; widen the shot instead of slowing the motion.',
      'Subject ignores the source image — your prompt re-describes appearance. Strip adjectives about the person; keep only motion and audio.',
      'Dialogue sounds dubbed — shorten the line and mark delivery ("quietly", "over the shoulder").',
      'Eight seconds sag in the middle — add one sustained ambient clause (rain continues, crowd murmur persists) to carry the middle beat.',
    ] },
    { type: 'p', text: 'Run it at /tools/veo-3-1-fast for drafts and /tools/veo-3-1 for finals; automation mirrors live at /api/video-generators/veo-3-1-fast and /api/video-generators/veo-3-1.' },
  ],
};
