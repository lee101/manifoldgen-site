import type { BlogArticle } from '../articles';

const D = 'https://manifoldgenstatic.manifoldgen.com/static/tools/production';

export const vectorizeImageToLayeredSvg: BlogArticle = {
  slug: 'vectorize-image-to-layered-svg',
  category: 'Production',
  title: 'Vectorize an Image to a Layered SVG (One Layer per Color)',
  excerpt: 'Turn logos, illustrations and product shots into SVGs grouped into one named layer per color, ready for Illustrator, Inkscape or Figma. About a second per image, $0.02, or $0.03 with the AI tracer.',
  readTime: '4 min read',
  date: '2026-10-14',
  ogImage: '/blog/og/vectorize-image-to-layered-svg.webp',
  blocks: [
    { type: 'p', text: 'Most auto-tracers give you thousands of loose paths in one group. Before you can recolor anything, you spend twenty minutes selecting by fill. Vectorize groups the output for you. The image is reduced to a palette, traced, and every path is placed in a layer named after its hex color. Recoloring the sky means selecting one layer.' },

    { type: 'h2', text: 'Two real traces' },
    {
      type: 'example',
      example: {
        label: 'Illustration, 10 color layers',
        promptLabel: 'MCP call',
        prompt: 'vectorize_image {"image_url":"https://.../illustration.jpg","mode":"color","colors":10,"wait_seconds":60}',
        input: { kind: 'image', src: `${D}/vectorize/1-input.jpg`, aspect: '1:1', caption: 'Raster input' },
        media: [{ kind: 'image', src: `${D}/vectorize/1-output.svg`, aspect: '1:1', caption: 'Layered SVG, 10 colors' }],
        note: 'Traced in about a second for $0.02. Each <g> is a layer: id="layer-01", data-color and inkscape:label set to the hex color.',
      },
    },
    {
      type: 'example',
      example: {
        label: 'Product photo, 14 colors',
        promptLabel: 'MCP call',
        prompt: 'vectorize_image {"image_url":"https://.../sneaker.jpg","mode":"color","colors":14,"smooth":"spline"}',
        input: { kind: 'image', src: `${D}/vectorize/2-input.jpg`, aspect: '1:1', caption: 'Raster input' },
        media: [{ kind: 'image', src: `${D}/vectorize/2-output.svg`, aspect: '1:1', caption: 'Layered SVG, 14 colors' }],
        note: 'Photos need more colors to hold their shading. 14 layers keep the sneaker readable while staying light enough to edit.',
      },
    },
    { type: 'links', items: [{ label: 'Try Vectorize', href: '/tools/vectorize' }] },

    { type: 'h2', text: 'Parameters' },
    { type: 'table', head: ['Param', 'Values', 'What it does'], rows: [
      ['mode', 'color, poster, bw, lineart', 'color and poster quantize to a palette; bw and lineart trace in black and white'],
      ['colors', '2-32 (default 12)', 'Palette size, which is also the number of layers'],
      ['detail', '0-1', 'Higher keeps smaller shapes; lower drops speckles'],
      ['corners', '0-180 degrees', 'Corner threshold: lower keeps sharper corners'],
      ['smooth', 'spline, polygon, pixel', 'Curve fitting: smooth curves, straight segments, or pixel-exact'],
      ['engine', 'trace ($0.02), ai ($0.03)', 'trace is exact; the AI tracer gives cleaner shapes on noisy or low-res input'],
    ] },

    { type: 'h2', text: 'CLI and REST' },
    { type: 'code', text: `mg pricing vectorize
mg generate vectorize --image logo.png --param mode=poster --param colors=4 --param smooth=spline --wait --out out/vector
mg generate vectorize --image scan.jpg --param mode=lineart --wait --out out/vector
mg generate vectorize --image blurry-logo.jpg --param engine=ai --wait --out out/vector` },
    { type: 'code', text: `curl -X POST https://manifoldgen.com/api/service \\
  -H "Authorization: Bearer $MANIFOLDGEN_API_KEY" -H 'Content-Type: application/json' \\
  -d '{"service":"vectorize","image_url":"https://.../logo.png","params":{"mode":"poster","colors":4}}'` },
    { type: 'p', text: 'The finished job returns svg_url along with palette (hex colors, most used first), layers and paths counts, so an agent can report what it made without opening the file.' },

    { type: 'h2', text: 'Picking settings' },
    { type: 'list', items: [
      'Logo or flat brand art: mode poster with colors set to the real ink count (often 2-6). Fewer colors give cleaner, smaller files.',
      'Illustration: mode color with 8-16 colors. Start at the default 12 and adjust by eye.',
      'Scanned sketch or ink: mode lineart, then recolor in your editor.',
      'Cutting or plotter files: mode bw with smooth polygon gives predictable, closed paths.',
      'Low-res or JPEG-noisy logo: upscale first (upscale-image), or use engine ai.',
    ] },

    { type: 'h2', text: 'Keep it editable' },
    { type: 'p', text: 'Layers are real groups with inkscape:groupmode="layer" and a label set to the color, so they open as named layers in Inkscape. Illustrator and Figma import them as groups you can lock, hide or recolor one at a time. To change a color everywhere, select its layer and change one fill. The SVG is plain paths with no embedded raster and no scripts, so it scales to any size and is safe to ship.' },

    { type: 'h2', text: 'Troubleshooting' },
    { type: 'list', items: [
      'Too many tiny specks: lower detail, or reduce colors.',
      'Rounded corners on a geometric logo: lower corners, or switch smooth to polygon.',
      'Gradients turned into bands: expected with a fixed palette. Raise colors, or rebuild the gradient on one layer in your editor.',
      '"Tracing failed": try fewer colors or less detail. Failed jobs are not charged.',
    ] },
    { type: 'links', items: [
      { label: 'Open Vectorize', href: '/tools/vectorize' },
      { label: 'The full production suite', href: '/blog/hosted-production-suite-higgsfield-alternative' },
    ] },
  ],
};
