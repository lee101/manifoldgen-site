import type { BlogArticle } from '../articles';

const D = 'https://manifoldgenstatic.manifoldgen.com/static/tools/production/shot-composer';

export const compositeVfxShotOnline: BlogArticle = {
  slug: 'composite-vfx-shot-online',
  category: 'Production',
  title: 'Composite a VFX Shot Online: Matte, Color Match, Light Wrap and Grain',
  excerpt: 'Shot Composer mattes a subject with AI background removal or a chroma key, places it on a new image, video or generated plate, and color matches it with a Lab .cube LUT. It adds light wrap, shadow and grain, and returns the composite plus every layer as a Studio project.',
  readTime: '5 min read',
  date: '2026-10-14',
  ogImage: '/blog/og/composite-vfx-shot-online.webp',
  blocks: [
    { type: 'p', text: 'A basic After Effects composite is the same five steps every time: pull a matte, drop the plate behind it, match the color, wrap a little background light around the edges and add grain so both layers look like one camera. Shot Composer runs those steps as one hosted job. You can call it over MCP, the CLI or REST without keying plugins or a render queue, and you still get every layer back separately.' },

    { type: 'h2', text: 'Beach to glacier' },
    {
      type: 'example',
      example: {
        label: 'AI matte, color matched, light wrap 0.4, grain 0.25',
        promptLabel: 'MCP call',
        prompt: `composite_shot {
  "video_url": "https://.../man-on-beach.mp4",
  "image_url": "https://.../glacial-valley.webp",
  "key": "ai",
  "match_color": true,
  "light_wrap": 0.4,
  "grain": 0.25,
  "wait_seconds": 300
}`,
        input: { kind: 'video', src: `${D}/1-input.mp4`, aspect: '9:16', seconds: 5.2, caption: 'Foreground: vertical beach clip' },
        media: [
          { kind: 'video', src: `${D}/1-output.mp4`, poster: `${D}/1-poster.jpg`, aspect: '16:9', seconds: 5.2, caption: 'Composite' },
          { kind: 'image', src: `${D}/1-background.webp`, aspect: '16:9', caption: 'Background plate: glacial valley at sunrise' },
        ],
        note: 'This 5.2 s clip took about 57 seconds. It billed as 6 seconds: $0.10 + 6 × $0.10 per second for the AI matte = $0.70. The match LUT moved the warm beach skin tones toward the cool dawn light of the valley.',
      },
    },

    { type: 'h2', text: 'How the job runs' },
    { type: 'list', ordered: true, items: [
      'Foreground. The clip is trimmed to the requested duration (up to 30 s) and scaled to at most 1920 px wide.',
      'Matte. With key ai, background removal produces an alpha WebM. With key chroma, a green or blue (or any hex) key with spill suppression produces it locally.',
      'Background. This is your image_url, a background_video_url looped to the clip length, or a plate generated from prompt. A generated plate is 1344x768, 768x1344 or 1024x1024 to match the subject\'s orientation.',
      'Color match. Foreground and background are sampled and compared in Lab space, and a 17³ .cube LUT moves the subject toward the plate.',
      'Composite. Position and scale place the subject. Light wrap spills background light over the edges, and an optional drop shadow and film grain finish the frame.',
    ] },

    { type: 'h2', text: 'Parameters' },
    { type: 'table', head: ['Field', 'Values', 'Default'], rows: [
      ['video_url', 'Foreground subject video', 'Required'],
      ['image_url / background_video_url / prompt', 'One background source, checked in that order', 'One is required'],
      ['key', 'ai, chroma', 'ai'],
      ['key_color', 'green, blue or hex (chroma only)', 'green'],
      ['position', 'center, left, right, bottom', 'center'],
      ['scale', '0.3-1.5, relative to fitting the frame', '1'],
      ['match_color', 'true / false', 'true'],
      ['light_wrap', '0-1', '0'],
      ['grain', '0-1', '0'],
      ['shadow', 'true / false', 'false'],
      ['keep_audio', 'true / false', 'true'],
      ['duration', '1-30 s from the start', 'Whole clip up to 30 s'],
    ] },

    { type: 'h2', text: 'Pricing' },
    { type: 'p', text: 'Billed seconds are rounded up, up to 30. The AI matte costs $0.10 plus the video background removal rate for each second ($0.10 per second at the time of writing, so 10 s = $1.10). A chroma key costs $0.10 plus $0.01 per second (10 s = $0.20). Generating the background from a prompt adds $0.04. If you shot on green or blue screen, use key chroma: it is cheaper and keeps hair detail as well as your screen allows.' },

    { type: 'h3', text: 'CLI and REST' },
    { type: 'code', text: `mg generate shot-composer --video take.mp4 --prompt "neon alley at night, wet asphalt" \\
  --param key=chroma --param key_color=green --param light_wrap=0.3 --param shadow=true --dry-run

curl -X POST https://manifoldgen.com/api/service \\
  -H "Authorization: Bearer $MANIFOLDGEN_API_KEY" -H 'Content-Type: application/json' \\
  -d '{"service":"shot-composer","video_url":"https://.../take.mp4","image_url":"https://.../plate.jpg","duration":8,
       "params":{"position":"left","scale":0.8,"grain":0.2}}'` },
    { type: 'p', text: 'In REST, video_url, image_url, prompt and duration stay at the top level. background_video_url and the look settings go in params. MCP takes every field flat.' },

    { type: 'h2', text: 'Keep it editable' },
    { type: 'p', text: 'The composite MP4 is only one of the outputs. The job also returns:' },
    { type: 'list', items: [
      'fg_alpha_url: the matted foreground as an alpha WebM (color graded when matching is on). Drop it into any editor that reads alpha.',
      'background_url: the plate, including a generated one or the looped background video.',
      'lut_url: the color-match .cube. Reuse it on other shots of the same subject, or load it into Color Grade and refine it.',
      'audio_url: the foreground audio track when keep_audio is on.',
      'studio_project_url and studio_url: a Studio project with the background, foreground and audio on separate layers, with the foreground already placed and scaled. Move, re-time or regrade it without re-running the job.',
    ] },
    { type: 'callout', title: 'Light it like the plate', text: 'Matching and light wrap fix color and edges, but they can\'t change the direction of the light. Choose a plate whose key light comes from the same side as your subject\'s, or generate one with that direction in the prompt.' },

    { type: 'links', items: [
      { label: 'Production tools', href: '/tools/production' },
      { label: 'Remove objects from video', href: '/blog/remove-objects-from-video-ai' },
      { label: 'The production suite', href: '/blog/hosted-production-suite-higgsfield-alternative' },
    ] },
  ],
};
