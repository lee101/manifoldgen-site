import type { BlogArticle } from '../articles';

const D = 'https://manifoldgenstatic.manifoldgen.com/static/tools/production/shader-fx';
const SRC = 'https://manifoldgenstatic.manifoldgen.com/gallery/2176d271-9e3/videos/935072f9-bdc2-4191-a8c9-ceae98e682f4.mp4';

export const shaderEffectsTouchdesignerAlternative: BlogArticle = {
  slug: 'shader-effects-touchdesigner-alternative',
  category: 'Production',
  title: 'Shader Effects in the Browser: A Lightweight TouchDesigner Alternative',
  excerpt: 'Stack up to 12 GPU effects, including feedback trails, datamosh, kaleidoscope, halftone, bloom, CRT, VHS and luma or chroma keys, on any image or video. It runs locally for free, exports MP4 or PNG, and opens in Studio with the stack still editable.',
  readTime: '5 min read',
  date: '2026-10-14',
  ogImage: '/blog/og/shader-effects-touchdesigner-alternative.webp',
  blocks: [
    { type: 'p', text: 'TouchDesigner is great for live installations, but it\'s overkill when all you need is a VHS pass for a music video, a kaleidoscope loop for a visualizer, or a quick key on a social edit. Shader FX gives you the chain-of-operators part of that workflow in a browser tab. You stack effects, tune each layer and export. Everything renders on your GPU, so nothing uploads and nothing is billed.' },

    { type: 'h2', text: 'Three stacks on one clip' },
    {
      type: 'example',
      example: {
        label: 'Retro broadcast',
        promptLabel: 'Stack (top to bottom)',
        prompt: `VHS
Chromatic aberration
CRT scanlines`,
        input: { kind: 'video', src: SRC, aspect: '16:9', seconds: 5.2, caption: 'Source clip' },
        media: [
          { kind: 'video', src: `${D}/1-vhs-crt.mp4`, poster: `${D}/1-vhs-crt.jpg`, aspect: '16:9', seconds: 5.2, caption: 'VHS + chromatic aberration + CRT' },
        ],
        note: 'All three layers use their default values. VHS animates tracking and color bleed, and CRT adds scanlines, curvature and an RGB mask.',
      },
    },
    {
      type: 'example',
      example: {
        label: 'Visualizer and comic looks',
        promptLabel: 'Stacks',
        prompt: `A: Kaleidoscope → Feedback trails
B: Posterize → Edges / toon → Bloom / glow`,
        media: [
          { kind: 'video', src: `${D}/2-kaleidoscope-feedback.mp4`, poster: `${D}/2-kaleidoscope-feedback.jpg`, aspect: '16:9', seconds: 5.2, caption: 'Kaleidoscope + feedback' },
          { kind: 'video', src: `${D}/3-toon.mp4`, poster: `${D}/3-toon.jpg`, aspect: '16:9', seconds: 5.2, caption: 'Posterize + toon edges + bloom' },
        ],
        note: 'Feedback blends each frame with the previous output, so the kaleidoscope smears into trails. Layer order matters: posterizing before edge detection gives cleaner ink lines.',
      },
    },

    { type: 'h2', text: 'The effect library' },
    { type: 'table', head: ['Group', 'Effects'], rows: [
      ['Motion', 'Feedback trails, Datamosh smear'],
      ['Distort', 'Kaleidoscope, Mirror, Wave warp, Noise displace'],
      ['Stylize', 'Pixelate, Posterize, Halftone, Edges / toon'],
      ['Light', 'Chromatic aberration, RGB shift, Bloom / glow, Film burn / leak'],
      ['Retro', 'CRT scanlines, VHS'],
      ['Key', 'Luma key, Chroma key'],
    ] },
    { type: 'p', text: 'Each layer has its own controls (decay, zoom and hue drift for feedback, segments and rotation for kaleidoscope, dot size, angle and mono or color ink for halftone) plus a Mix slider that blends it with the layer below. You can stack up to 12 layers, move them up or down, or remove them. Animated effects such as VHS, wave warp and film burn keep moving even on a still image, so a single PNG can become a looping clip.' },
    { type: 'p', text: 'The two keyers let you cut out a subject. Luma key removes darks or lights by threshold and softness. Chroma key takes a key color (you can pick it from the stage), similarity, smoothness and spill suppression.' },

    { type: 'h2', text: 'Workflow' },
    { type: 'list', ordered: true, items: [
      'Open /tools/shader-fx and drop in an image or video up to 1 GB, or pass a public URL as ?src=.',
      'Add effects from the + Add effect menu. Start with the effect that defines the look and add finishing layers such as bloom or chromatic aberration after it.',
      'Open a layer to tune it. Lower Mix before you push a parameter to an extreme.',
      'Export a PNG for a still, or an MP4. Video exports re-encode every frame through the stack in your browser. A still exports as a 5-second, 30 fps clip.',
    ] },

    { type: 'h2', text: 'Keep it editable' },
    { type: 'list', items: [
      'Open in Studio hands the source file and the whole effect stack to a Studio project. Layers, order and Mix values stay adjustable on the timeline, so you can re-time or retune the effects after the cut.',
      'Write the stack down (effect order and key values) next to the export. Effects are parameter-only, so anyone can rebuild the look from that list.',
      'Keep the original clip. Effects are applied at export and never change the source.',
      'Shader FX does not export a LUT. Grade color in Color Grade, export the .cube there, and use Shader FX for the stylized pass on top.',
    ] },

    { type: 'h2', text: 'From an agent' },
    { type: 'p', text: 'Like Color Grade, Shader FX runs in the browser, so there is no API job or charge. The shader-fx MCP prompt and the shader-fx skill send the user to the tool with a suggested stack and ask them to export MP4 or PNG or open the result in Studio. If you want the toon look on a 3D model instead of footage, use the hosted Toon Shader. It returns a .blend with real outline and band materials.' },
    { type: 'callout', title: 'Less is more', text: 'Two or three layers at partial Mix read as a deliberate style. Eight layers at 100% read as a preset. Build the look from one hero effect and add support layers only where they help.' },

    { type: 'links', items: [
      { label: 'Open Shader FX', href: '/tools/shader-fx' },
      { label: 'Color grade + .cube', href: '/blog/color-grade-video-online-cube-lut' },
      { label: 'The production suite', href: '/blog/hosted-production-suite-higgsfield-alternative' },
    ] },
  ],
};
