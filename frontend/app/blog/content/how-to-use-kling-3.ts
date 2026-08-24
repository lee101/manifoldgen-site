import type { BlogArticle } from '../articles';

export const howToUseKling3: BlogArticle = {
  slug: 'how-to-use-kling-3',
  category: 'Guides',
  title: 'How to Use Kling 3.0 for Cinematic AI Video',
  excerpt: 'Kling 3.0 turns prompts and stills into multi-shot cinematic clips with native synced audio. Here is how to prompt it, which tier to pick, and what each setting costs.',
  readTime: '6 min read',
  date: '2026-08-24',
  ogImage: '/blog/og/how-to-use-kling-3.jpg',
  blocks: [
    { type: 'p', text: 'Kling 3.0 is the strongest Kling release for narrative work: it plans multiple shots inside one generation, keeps characters consistent across them, and ships native synced audio — dialogue, ambience, and effects — without a post pass. On ManifoldGen it runs in two tiers (Standard and Pro) with text-to-video and image-to-video routes for each. This guide covers when each tier earns its price, how to prompt for multi-shot scenes, and the settings that actually change the output.' },
    { type: 'table', head: ['Route', 'Resolution', 'Durations', 'Price'], rows: [
      ['Kling 3.0 (Standard, text)', '720p', '5 or 10s', 'from 76 credits / 5s'],
      ['Kling 3.0 Pro (text)', '720p · 1080p', '5 or 10s', 'from 101 credits / 5s'],
      ['Kling 3.0 Image to Video', '720p', '5 or 10s', 'from 76 credits / 5s'],
    ] },

    { type: 'h2', text: 'Pick the tier by job, not by pride' },
    { type: 'list', items: [
      'Standard is the drafting tier. Same motion engine at 720p; use it for story beats, shot lists, and anything you will recut anyway.',
      'Pro buys 1080p output and noticeably better lipsync and face fidelity under speech. Use it for the shots that survive the edit.',
      'Image to Video is the identity lock. When a character must look exactly right, generate the still first (any image model), then animate it instead of rolling dice on text-to-video.',
    ] },

    { type: 'h2', text: 'Prompt multi-shot scenes explicitly' },
    { type: 'p', text: 'Kling 3.0\'s signature trick is generating several coherent shots in one clip. It follows numbered shot structure far better than prose:' },
    { type: 'code', text: `Shot 1: Wide — a lighthouse keeper climbs the iron stairs during a storm,
rain lashing the glass, lamp beam sweeping.
Shot 2: Close-up — her hands grip the railing; breath fogs in cold air.
Shot 3: Medium — she throws the switch; the lamp ignites and holds.
Audio: howling wind, creaking metal, thunder rolls, distant foghorn.` },
    { type: 'p', text: 'Three rules make this reliable. Number the shots so the model cannot blur their boundaries. Give each shot its own camera distance (wide / close-up / medium) rather than one global camera move. And specify audio as its own line — Kling generates the soundtrack, so tell it what world should sound like.' },

    { type: 'h2', text: 'Dialogue and lipsync' },
    { type: 'p', text: 'For spoken lines, put the words in quotes inside the shot they belong to and keep sentences short: "We hold until dawn," she says into the wind. Lipsync quality scales with face size in frame — dialogue belongs in close-ups, not wides. If a line fights the clip length, cut the words before you cut the seconds; rushed speech reads as artifact.' },
    { type: 'callout', title: 'Audio is generated, not added', text: 'Kling 3.0 always renders its own soundtrack. Describe the sound scene (wind, room tone, music style) the same way you describe the visual one, or you will get generic ambience over a specific picture.' },

    { type: 'h2', text: 'Troubleshooting' },
    { type: 'list', items: [
      'Shots melt into each other — your shot descriptions share actions. One subject, one action, one camera per shot.',
      'Faces drift across shots — switch that character to Image to Video from a locked still.',
      'Lipsync misses — bring the speaker closer to camera and shorten the line to under eight words.',
      'Ten seconds feel cramped — split into two five-second generations at different camera distances and cut them together; it reads as intentional coverage.',
      '1080p requested but soft — source prompt detail, not upscale, drives perceived sharpness. Add lens and lighting specifics.',
    ] },
    { type: 'p', text: 'Open the workflow at /tools/kling-3 for Standard drafts, /tools/kling-3-pro for finals, and /tools/kling-3-image for stills you need to keep — the API mirror of each lives at /api/video-generators/kling-3 and friends.' },
  ],
};
