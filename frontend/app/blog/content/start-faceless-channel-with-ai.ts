import type { BlogArticle } from '../articles';

export const startFacelessChannelWithAi: BlogArticle = {
  slug: 'start-faceless-channel-with-ai',
  category: 'Guides',
  title: 'How to Start a Faceless Channel With AI',
  excerpt: 'A faceless channel is an asset pipeline: pick a repeatable niche, generate voiceover and b-roll in batches, build loops that monetize, ship on a calendar.',
  readTime: '8 min read',
  date: '2026-07-30',
  ogImage: '/blog/og/start-faceless-channel-with-ai.jpg',
  blocks: [
    { type: 'p', text: 'A faceless channel is not a channel without you on camera; it is a channel where every asset is replaceable. Voiceover, b-roll, music, thumbnail — none of it depends on your presence, which means all of it can be generated, batched, and scheduled. That is the entire advantage: you compete on consistency of output, not charisma.' },
    { type: 'p', text: 'This guide walks through niche selection, a three-asset pipeline (voiceover plus generated visuals plus music), a batching workflow for a weekly calendar, and the format decisions per platform — vertical for Shorts and TikTok, 16:9 for YouTube long-form. You need a video generation tool such as /studio, a voiceover tool, and two to three hours per week.' },

    { type: 'h2', text: 'Pick a niche you can template' },
    { type: 'p', text: 'Faceless channels die from variety, not competition. Every format change forces new prompts, new pacing, new research. Choose a niche where one visual recipe repeats forever:' },
    { type: 'list', items: [
      'Ambience — rain rooms, fireplaces, study scenes. The visual is a single slow loop; monetization comes from watch time on multi-hour uploads built from repeated loops.',
      'History — narrated events over period-style b-roll. One documentary structure, endless subjects.',
      'Finance explainers — charts, city footage, abstract motion under tight scripts. High CPM, low visual risk.',
      'Sci-fi stories — original micro-fiction over generated alien landscapes and characters. Highest ceiling, hardest consistency problem.',
    ] },
    { type: 'p', text: 'Test a niche by writing ten titles first. If ten strong titles do not come easily in twenty minutes, the niche will starve. If they come easily, write the recurring shot list next — most niches settle into five to eight reusable scene types that cover ninety percent of episodes.' },

    { type: 'h2', text: 'The three-asset pipeline' },
    { type: 'list', ordered: true, items: [
      'Script first, always. 150 spoken words per minute of runtime. Write the full script before generating anything so visuals serve narration instead of replacing it.',
      'Voiceover. Generate the complete narration track, then cut it into segments at natural pauses. Segment timestamps become your edit skeleton.',
      'B-roll per segment. For each script beat, write one image or video prompt describing the scene the sentence paints. Generate at the aspect ratio the platform needs before editing.',
      'Music bed. Pick one or two tracks per series and reuse them. A recognizable sound bed builds brand faster than any individual video.',
      'Assemble in the editor: voiceover spine, b-roll cuts on sentence boundaries, music ducked under speech. No transition effects between cuts — hard cuts read as professional, dissolves read as a slideshow.',
    ] },

    { type: 'h2', text: 'Batch a month in one sitting' },
    { type: 'p', text: 'Generation is cheap when batched and expensive when interrupted. Run production in passes across all four episodes of the month, not episode by episode:' },
    { type: 'list', ordered: true, items: [
      'Day 1: write four scripts and their shot lists.',
      'Day 1: generate all voiceovers back to back — same voice settings, same energy.',
      'Day 2: queue every b-roll prompt in one session. Reuse prompt skeletons and change only subject lines so the series keeps a consistent look.',
      'Day 3: edit all four videos using the same project template, then schedule them across the calendar.',
    ] },
    { type: 'p', text: 'One session per pass beats four sessions per episode because every repeated decision — voice, color, music, pacing — stays identical across the batch. Consistency across uploads is what turns casual viewers into subscribers.' },

    { type: 'h2', text: 'Ambience channels live on loops' },
    {
      type: 'example',
      example: {
        label: 'Ambience loop',
        prompt: 'Cozy window nook during heavy rain at dusk: warm lamp glow, steam rising from a mug on the sill, raindrops racing down the glass, fairy lights softly out of focus, slow almost-imperceptible push-in, calm looping ambience for a faceless channel.',
        media: [{ kind: 'video', src: '/blog/media/start-faceless-channel-with-ai/cozy-rain-nook.webm', poster: '/blog/media/start-faceless-channel-with-ai/cozy-rain-nook.jpg', aspect: '9:16', seconds: 5 }],
        note: 'Motion is subtle enough that the last frame nearly matches the first, which lets editors tile the clip into hour-long uploads without a visible seam. The push-in must stay almost imperceptible; any obvious camera travel breaks the loop.',
      },
    },
    { type: 'p', text: 'Ambience is the purest faceless business model: viewers press play for hours, ads run against watch time, and one well-built loop library becomes a permanent catalog. Design every ambience clip for looping — constant gentle motion (rain, steam, flicker), no people, no events, no camera move larger than a slow drift. Generate six to ten distinct scenes per theme and rotate them; a viewer should never notice the rotation.' },

    { type: 'h2', text: 'Vertical versus widescreen' },
    { type: 'list', items: [
      '9:16 — Shorts, TikTok, Reels. Compose vertically: subject center-frame, key detail in the middle third, nothing important near the top edge where UI overlays sit.',
      '16:9 — YouTube long-form. Widescreen rewards layered compositions: foreground, midground, background parallax.',
      'Do not crop 16:9 down to vertical as an afterthought — reframing loses composition. Prompt the aspect ratio you need and generate separately when publishing to both formats.',
      'Vertical clips reward tighter framing and faster cuts (one to two seconds); long-form tolerates four to eight second holds.',
    ] },
    { type: 'code', text: `[Scene], [two to three concrete sensory details],
[lighting], [slow constant motion element],
[almost-imperceptible camera drift], seamless loop,
calm ambient atmosphere.` },
    { type: 'callout', title: 'Design for the loop', text: 'Every ambience clip must survive being played on repeat for an hour. Constant motion, no events, minimal camera travel. If a viewer can spot the seam, the loop fails — regenerate rather than patching it in the editor.' },

    { type: 'h2', text: 'When output looks off' },
    { type: 'list', items: [
      'Clips vary wildly in style across a series — your prompts drift. Lock a shared skeleton and change only the subject line between generations.',
      'Loop seams are visible — motion was too strong. Cut the camera move entirely or halve the motion words ("gentle" to "slight").',
      'Voiceover and visuals feel disconnected — you generated b-roll before scripting. Regenerate visuals from the final narration, not the outline.',
      'Watch time collapses after thirty seconds — front-load the strongest scene. Put your best generated shot in the first five seconds of every upload.',
      'Uploads stall after week three — you are producing episodically. Switch to monthly batches; the calendar only works if generation happens in bulk.',
    ] },
    { type: 'p', text: 'Draft your first batch in Studio: write ten titles, pick the best four, and generate every shot for episode one in a single session. The tools page for cinematic cameras covers the motion language that keeps ambient loops subtle.' },
  ],
};
