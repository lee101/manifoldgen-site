import type { BlogArticle } from '../articles';

export const howToMakeAiVideoLookReal: BlogArticle = {
  slug: 'how-to-make-ai-video-look-real',
  category: 'Guides',
  title: 'How to Make AI Video Look Real in 2026',
  excerpt: 'Realism in AI video comes from imperfection and light physics: handheld shake, mixed color temps, natural exposure, mundane action. Exact prompt language inside.',
  readTime: '9 min read',
  date: '2026-08-18',
  ogImage: '/blog/og/how-to-make-ai-video-look-real.webp',
  blocks: [
    { type: 'p', text: 'AI video looks fake for one reason: it is too perfect. Frames are clean, motion is smooth, lighting is flattering, and every shot is composed like a poster. Real footage — the footage models were trained on — is handheld, slightly miss-framed, lit by whatever bulbs were in the room, and mostly shows people doing boring things.' },
    { type: 'p', text: 'So the technique is subtraction plus physics. Remove every "cinematic" word from your vocabulary, then describe how light actually behaves and how an actual camera actually fails. Two passes on real generations below show exactly what that looks like.' },

    { type: 'h2', text: 'The realism checklist' },
    { type: 'list', ordered: true, items: [
      'Camera: "handheld smartphone footage" or "static tripod shot" with "slight camera shake". Never "sweeping", "epic", or "dynamic".',
      'Framing: "imperfect framing", "off-center", "partially blocked by a passerby". Real cameras miss.',
      'Color: "mixed daylight and tungsten", "natural color", "unstylized". Mixed color temperature is the single strongest realism signal.',
      'Exposure: "natural exposure", "soft highlight rolloff", no HDR words. Blown window highlights are honest; perfect dynamic range is not.',
      'Texture: "subtle sensor noise" mimics the compression grain of training data. Clean pixels read as CGI.',
      'Action: mundane and single. Pouring, sorting, wiping, waiting. Nobody backflips through a fish market.',
      'Grade: never say cinematic, dramatic (unless documentary-dramatic), 8K, hyperrealistic, or masterpiece. Each one pushes the model toward its most saturated, overproduced output.',
    ] },

    { type: 'h2', text: 'Pass one: imperfection' },
    {
      type: 'example',
      example: {
        label: 'Imperfection pass',
        prompt: 'Handheld smartphone footage of a busy fish market at dawn. A vendor tosses ice over silver fish while steam rises from a noodle cart behind. Slight camera shake, imperfect framing, mixed daylight and tungsten bulbs, natural color, unstylized documentary realism.',
        media: [{ kind: 'video', src: '/blog/media/how-to-make-ai-video-look-real/fish-market.webm', poster: '/blog/media/how-to-make-ai-video-look-real/fish-market.jpg', aspect: '16:9', seconds: 4 }],
        note: 'Every clause attacks one tell of synthetic footage: shake kills glide, imperfect framing kills poster composition, mixed bulbs kill the graded look, "documentary realism" anchors the whole style. The subject is deliberately ordinary — ice, fish, steam.',
      },
    },

    { type: 'h2', text: 'Pass two: light physics' },
    {
      type: 'example',
      example: {
        label: 'Light-physics pass',
        prompt: 'Static tripod shot of a quiet kitchen at golden hour. Dust motes drift through a hard shaft of window light across a wooden table; steam curls from a ceramic mug. Natural exposure, soft highlight rolloff, subtle sensor noise, 35mm lens, nothing dramatic happens.',
        media: [{ kind: 'video', src: '/blog/media/how-to-make-ai-video-look-real/kitchen-golden-hour.webm', poster: '/blog/media/how-to-make-ai-video-look-real/kitchen-golden-hour.jpg', aspect: '16:9', seconds: 4 }],
        note: '"Nothing dramatic happens" is a deliberate constraint, not a joke. It forbids the model from inventing events, so the clip spends its entire budget on believable micro-motion: drifting dust, curling steam. Volumetric details like dust motes in a hard shaft also prove the light source has a direction.',
      },
    },
    { type: 'p', text: 'Light-physics phrases worth memorizing: "dust motes in window light", "soft highlight rolloff", "light falls off across the room", "practicals visible in frame" (lamps and ceiling fixtures that justify the illumination), "shadows fall left of frame". Any one of these does more for believability than ten style adjectives, because they force consistent geometry between light source, shadow, and surface.' },

    { type: 'h2', text: 'What to delete from your prompts' },
    { type: 'list', items: [
      '"Cinematic" — triggers teal-orange grading and shallow-everything focus.',
      '"Hyperrealistic / ultra detailed / 8K" — pushes toward rendered, plastic textures, the opposite of the goal.',
      '"Beautiful woman / handsome man" — faces drift toward airbrushed stock. Describe clothing, age, and activity instead.',
      '"Slow motion" everywhere — reserve it for genuine high-speed subjects; as a default it makes walking look underwater.',
      '"Perfect symmetry, centered composition" — real footage is off-balance. Ask for the opposite.',
    ] },

    { type: 'code', text: `[Handheld smartphone|static tripod] footage of [ordinary place], [time of day].
[One mundane action] while [secondary background detail].
Slight camera shake, imperfect framing,
mixed [warm] and [cool] light sources, natural exposure,
subtle sensor noise, unstylized documentary realism.` },

    { type: 'callout', title: 'Boring is believable', text: 'The fastest route to realistic AI video is a subject nobody would film beautifully. A vendor tossing ice beats a warrior drawing a sword every time, because the model has millions of shaky phone clips of markets and none of choreographed sword fights. Pick subjects from life, describe them plainly, and let imperfection do the styling.' },

    { type: 'h2', text: 'Troubleshooting' },
    { type: 'list', items: [
      'Still looks like CGI — remove all remaining style adjectives and add "shot on a phone" plus a mixed-lighting source.',
      'Motion is unnaturally smooth — the camera clause got buried. Put "handheld" first and delete competing movement words.',
      'Colors look graded despite "natural color" — another phrase is overriding it, usually "cinematic" or "golden" outside golden hour. Strip them.',
      'Faces uncanny — keep faces small in frame, backlit, or in profile; close front-lit faces expose skin rendering first.',
      'Too much happening — you listed three actions. One action, one background detail, nothing else.',
      'Noise looks like artifacting — reduce to "subtle sensor noise"; heavy grain words degrade fine detail instead of adding texture.',
    ] },

    { type: 'p', text: 'Take any prompt you already have, strip the style words, run it through the skeleton above, and compare both clips in /studio. For focal-length language that keeps perspective honest, pair this with /tools/cinematic-cameras.' },
  ],
};
