import type { BlogArticle } from '../articles';

export const promptingVideoMotionCameraLanguage: BlogArticle = {
  slug: 'prompting-video-motion-camera-language',
  category: 'Prompt craft',
  title: 'Prompting video: describe the shot, not a pile of adjectives',
  excerpt: 'A repeatable structure for turning a visual idea into camera motion, subject action, lighting, and a clean ending.',
  readTime: '6 min read',
  date: '2026-07-09',
  ogImage: '/blog/og/prompting-video-motion-camera-language.webp',
  blocks: [
    { type: 'p', text: 'A strong video prompt gives the model a shot to perform. Start with what is in frame, then say what moves, how the camera moves, how the light behaves, and where the shot should settle. The model does not need a screenplay; it needs a coherent visual event.' },
    {
      type: 'example',
      example: {
        label: 'Studio example',
        prompt: 'A translucent glass torus suspended in a rain-soaked greenhouse at night.\nThe torus rotates slowly while tiny droplets slide across its surface.\nSlow cinematic dolly forward, eye-level macro perspective, shallow depth of field.\nCool moonlight through the glass roof, warm practical lights in the distance,\nwet reflections, restrained motion, seamless three-second ending.',
        media: [{ kind: 'video', src: '/showcase/h3-loop-glass-torus.webm', aspect: '16:9' }],
        note: 'A generated showcase clip is useful for evaluating whether a prompt holds composition and motion together over time.',
      },
    },
    { type: 'h2', text: 'The five-part shot prompt' },
    { type: 'list', items: [
      'Subject + setting — name the hero object and the world around it. “A glass torus in a dark greenhouse” is more actionable than “beautiful sci-fi.”',
      'Action — give the subject one primary verb: rotates, unfolds, drifts, approaches, or turns toward camera.',
      'Camera — one move, one angle, one speed: dolly, orbit, crane, handheld, static.',
      'Light and atmosphere — direction, color, and physics: moonlight through glass, steam in backlight, wet reflections.',
      'Ending — say where the shot settles or that motion should loop seamlessly.',
    ] },
    { type: 'h2', text: 'Copyable prompt' },
    { type: 'code', text: `A translucent glass torus suspended in a rain-soaked greenhouse at night.
The torus rotates slowly while tiny droplets slide across its surface.
Slow cinematic dolly forward, eye-level macro perspective, shallow depth of field.
Cool moonlight through the glass roof, warm practical lights in the distance,
wet reflections, restrained motion, seamless three-second ending.` },
    { type: 'p', text: 'Notice the pacing: one subject, one action, one camera move, then physical light and a clear ending. If the result is unstable, remove adjectives before adding more. If the composition is right but the movement is wrong, change the action or camera line, not the entire prompt.' },
    { type: 'callout', title: 'Iterate on one variable', text: 'Use the Studio timeline to compare variations side by side, then trim the strongest moment instead of asking one generation to do everything.' },
  ],
};
