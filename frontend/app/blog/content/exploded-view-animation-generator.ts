import type { BlogArticle } from '../articles';

const D = 'https://manifoldgenstatic.manifoldgen.com/static/tools/production';

export const explodedViewAnimationGenerator: BlogArticle = {
  slug: 'exploded-view-animation-generator',
  category: 'Production',
  title: 'Exploded View Animation Generator: Product Teardowns From a 3D Model',
  excerpt: 'Upload a product model and get an exploded or assembling animation with studio staging, guide lines and a turntable, rendered in hosted Blender. Includes an editable .blend with keyed parts. $0.40 per animation.',
  readTime: '5 min read',
  date: '2026-10-14',
  ogImage: '/blog/og/exploded-view-animation-generator.webp',
  blocks: [
    { type: 'p', text: 'Exploded views sell hardware. They show what is inside, how it fits together and how much engineering went into it. Keyframing one by hand means separating parts, choosing a direction for each, staggering the timing and pulling the camera back as everything spreads. Exploded View does that in hosted Blender. Give it a model and it splits the parts, animates them out, back in, or both, and stages the shot with clean studio light.' },

    { type: 'h2', text: 'Two real renders' },
    {
      type: 'example',
      example: {
        label: 'Built-in camera demo, explode then assemble',
        promptLabel: 'MCP call',
        prompt: 'blender_exploded_view {"demo":"camera","mode":"explode_assemble","quality":"standard","wait_seconds":300}',
        media: [{ kind: 'video', src: `${D}/exploded-view/1-output.mp4`, poster: `${D}/exploded-view/1-poster.jpg`, aspect: '16:9', seconds: 4, caption: 'Demo camera with designed part directions' }],
        note: '720p, 4 seconds. About 48 seconds end to end on a GPU shared with other services. The built-in demos (camera, watch, headphones) let you preview staging before you have a model.',
      },
    },
    {
      type: 'example',
      example: {
        label: 'Uploaded sci-fi helmet, 48 loose parts',
        promptLabel: 'MCP call',
        prompt: 'blender_exploded_view {"model_url":"https://.../helmet.glb","mode":"explode_assemble","split":"loose","wait_seconds":300}',
        media: [{ kind: 'video', src: `${D}/exploded-view/2-output.mp4`, poster: `${D}/exploded-view/2-poster.jpg`, aspect: '16:9', seconds: 4, caption: 'Mesh islands split into 48 parts, radial explode' }],
        note: 'About 61 seconds end to end. The packed .blend with the original textures came to 3.6 MB.',
      },
    },

    { type: 'h2', text: 'How parts are found' },
    { type: 'p', text: 'With split set to auto, the recipe tries each strategy in turn: separate objects in the file, then loose mesh islands, then material slots, then planar slices as a fallback. Tiny parts are merged into their neighbors and the result is capped at 48 parts so the motion stays readable. You can force a strategy:' },
    { type: 'table', head: ['split', 'Use when'], rows: [
      ['auto', 'Default. Picks the first strategy that yields usable parts.'],
      ['loose', 'Parts are disconnected islands inside one mesh, as with many game assets and scans.'],
      ['material', 'Parts are welded together but use different materials (glass, rubber, metal).'],
      ['slices', 'A single solid shape. Cuts it into planar layers like a cutaway.'],
    ] },

    { type: 'h2', text: 'Motion and staging' },
    { type: 'table', head: ['Param', 'Values', 'Notes'], rows: [
      ['mode', 'explode, assemble, explode_assemble', 'Default explode_assemble: out, hold, back in.'],
      ['axis', 'radial, vertical, forward', 'Demos use designed directions; models default to radial.'],
      ['spread', '0.2-3', 'Distance multiplier. Default 1.'],
      ['stagger', '0-1', 'Per-part delay. 0 moves everything at once. Default 0.5.'],
      ['turntable', 'true / false', 'Slow rotation during the shot. On by default.'],
      ['guides', 'true / false', 'Thin guide lines from each part to its home. On automatically at 20 parts or fewer.'],
      ['demo', 'camera, watch, headphones', 'Preview without a model.'],
      ['quality', 'draft, standard, high', 'About 540p, 720p, 1080p. High adds $0.20.'],
    ] },
    { type: 'p', text: 'The camera distance animates with the explode, so parts never leave the frame. Duration (2-8 s), aspect (16:9, 9:16, 1:1), background (studio, dark, sky, white) and seed work as in the other Blender tools.' },

    { type: 'h2', text: 'Run it' },
    { type: 'code', text: `mg generate exploded-view --model headphones.glb --param mode=explode_assemble \\
  --param split=loose --param axis=radial --param guides=true --param quality=draft --dry-run

mg generate exploded-view --model headphones.glb --param mode=explode_assemble \\
  --param split=loose --param axis=radial --param guides=true --param quality=draft --wait --out out/exploded

mg generate exploded-view --param demo=watch --param axis=vertical --wait --out out/demo` },
    { type: 'code', text: `curl -X POST https://manifoldgen.com/api/service \\
  -H "Authorization: Bearer $MANIFOLDGEN_API_KEY" -H 'Content-Type: application/json' \\
  -d '{"service":"exploded-view","model_url":"https://.../headphones.glb",
       "params":{"mode":"explode_assemble","split":"loose","spread":1.4,"stagger":0.6}}'` },
    { type: 'p', text: 'Models can be .glb, .obj, .fbx, .stl or .ply, up to 200 MB. A product photo works too: pass image_url and it is turned into 3D first for $0.06. A photo-built model is a single shell, so expect slices rather than real components.' },

    { type: 'h2', text: 'Pricing' },
    { type: 'p', text: 'Each animation costs $0.40, plus $0.06 when it starts from a photo and $0.20 at high quality. Draft costs the same as standard, so use draft to check part separation, then render the final once.' },

    { type: 'h2', text: 'Keep it editable' },
    { type: 'p', text: 'The .blend that comes back has every part as its own object with its own location keys. In desktop Blender you can:' },
    { type: 'list', items: [
      'Retime individual parts on the timeline, for example to hold the hero component for a beat.',
      'Add text callouts or annotations parented to parts.',
      'Swap materials for a clay or x-ray look and re-render.',
      'Change the turntable or camera move without touching part motion.',
    ] },

    { type: 'h2', text: 'Tips' },
    { type: 'list', items: [
      'CAD exports with separate meshes give the cleanest result. Keep parts as separate objects when exporting.',
      'Parts did not separate well: try split=material, or slices for a solid object.',
      'Too busy: lower spread, raise stagger, or turn guides off.',
      'Vertical stacks (keyboards, stacked PCBs) read best with axis=vertical.',
    ] },
    { type: 'links', items: [
      { label: 'Open Exploded View', href: '/tools/exploded-view' },
      { label: 'The full production suite', href: '/blog/hosted-production-suite-higgsfield-alternative' },
    ] },
  ],
};
