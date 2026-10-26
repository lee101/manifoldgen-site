import type { BlogArticle } from '../articles';

const D = 'https://manifoldgenstatic.manifoldgen.com/static/tools/production';

export const toonShader3dModel: BlogArticle = {
  slug: 'toon-shader-3d-model-online',
  category: 'Production',
  title: 'Toon Shader for 3D Models Online: Cel, Anime and Comic Turntables',
  excerpt: 'Turn any 3D model into a cel, anime, comic or flat-shaded turntable with outlines, rim light and your own palette. Renders take about 20 seconds in hosted Blender, and the .blend keeps every toon material editable. $0.30 per render.',
  readTime: '5 min read',
  date: '2026-10-14',
  ogImage: '/blog/og/toon-shader-3d-model-online.webp',
  blocks: [
    { type: 'p', text: 'Non-photorealistic rendering is a rabbit hole of shader nodes. Shader-to-RGB, color ramps with constant interpolation, shadow tint, toon specular, inverted-hull outlines, Freestyle settings. Toon Shader applies a tuned version of that stack to your model in hosted Blender and renders a turntable. You pick the style and get back an MP4, a poster and a .blend with the materials still live.' },

    { type: 'h2', text: 'Two real renders' },
    {
      type: 'example',
      example: {
        label: 'Sci-fi helmet, anime style',
        promptLabel: 'MCP call',
        prompt: 'blender_toon_shader {"model_url":"https://.../helmet.glb","style":"anime","background":"sky","wait_seconds":120}',
        media: [{ kind: 'video', src: `${D}/toon-shader/1-output.mp4`, poster: `${D}/toon-shader/1-poster.jpg`, aspect: '16:9', seconds: 4, caption: 'Anime bands, rim light, sky background' }],
        note: '720p, 4 seconds. About 20 seconds end to end on a GPU shared with other services, roughly three times faster than the Cycles-based Blender tools.',
      },
    },
    {
      type: 'example',
      example: {
        label: 'Demo character, comic style with halftone',
        promptLabel: 'MCP call',
        prompt: 'blender_toon_shader {"demo":"character","style":"comic","background":"white","wait_seconds":120}',
        media: [{ kind: 'video', src: `${D}/toon-shader/2-output.mp4`, poster: `${D}/toon-shader/2-poster.jpg`, aspect: '16:9', seconds: 4, caption: 'Comic adds a halftone pattern in the shadow bands' }],
        note: 'About 23 seconds end to end. The built-in character bounces by default, which is useful for checking how outlines hold up in motion.',
      },
    },

    { type: 'h2', text: 'Styles and controls' },
    { type: 'table', head: ['Param', 'Values', 'Notes'], rows: [
      ['style', 'cel, anime, comic, flat', 'Sets defaults for bands and outline. Comic adds halftone. Default cel.'],
      ['bands', '2-5', 'Number of hard shading steps.'],
      ['outline_width', 'Number, 0 turns it off', 'Inverted-hull outline thickness.'],
      ['outline_color', 'Hex', 'Default #030303. Try a dark tint of the main color for softer lines.'],
      ['rim', 'true / false', 'Rim light on silhouettes. On by default.'],
      ['palette', 'Up to 8 hex colors', 'Replaces per-material base colors.'],
      ['turntable', 'true / false', 'A 120 degree turn over the shot by default.'],
      ['demo', 'character', 'Preview without uploading a model.'],
    ] },
    { type: 'p', text: 'The common Blender params also apply: duration 2-8 s, aspect 16:9, 9:16 or 1:1, quality draft, standard or high (+$0.20), background studio, dark, sky or white, and seed.' },

    { type: 'h2', text: 'How it is built' },
    { type: 'p', text: 'Each material is rebuilt as Shader-to-RGB feeding a constant color ramp, which gives hard bands that respond to real lights and cast shadows. Shadow tint, toon specular and rim light are layered on top. Comic style adds a halftone pattern. Outlines use the inverted-hull method: a flipped Solidify modifier with backface culling. That keeps outlines in the geometry, so they render the same in every frame and you can adjust them in the modifier panel. If the fast engine cannot start, the job falls back to Cycles with light-direction bands, which lose cast shadows but keep the look.' },

    { type: 'h2', text: 'Run it' },
    { type: 'code', text: `mg generate toon-shader --model hero.glb --param style=anime --param bands=3 \\
  --param outline_width=3 --param outline_color="#111111" --param quality=draft --dry-run

mg generate toon-shader --model hero.glb --param style=anime --param bands=3 \\
  --param outline_width=3 --param quality=draft --wait --out out/toon

mg generate toon-shader --model hero.glb --params '{"style":"flat","palette":["#f4d35e","#ee964b","#0d3b66"]}' --wait --out out/flat` },
    { type: 'code', text: `curl -X POST https://manifoldgen.com/api/service \\
  -H "Authorization: Bearer $MANIFOLDGEN_API_KEY" -H 'Content-Type: application/json' \\
  -d '{"service":"toon-shader","model_url":"https://.../hero.glb","params":{"style":"comic","bands":3,"rim":true}}'` },
    { type: 'p', text: 'Models can be .glb, .obj, .fbx, .stl or .ply up to 200 MB. Pass image_url instead to build the model from a photo first (+$0.06).' },

    { type: 'h2', text: 'Pricing' },
    { type: 'p', text: 'A render costs $0.30, plus $0.06 when it starts from a photo and $0.20 at high quality. Because renders are fast, it is cheap to try all four styles on draft and pick one.' },

    { type: 'h2', text: 'Keep it editable' },
    { type: 'list', items: [
      'Every toon material in the .blend is a normal node tree. Move ramp stops to change band edges, or recolor bands directly.',
      'The outline is a Solidify modifier. Change its thickness per object, or disable it on parts that should stay lineless.',
      'Drop your own camera and animation into the file. The look follows because it is in the materials, not a post effect.',
      'The view transform is set to Standard so colors match your palette exactly. Keep it that way when re-rendering.',
    ] },
    { type: 'callout', title: 'Footage instead of a model?', text: 'Toon Shader works on 3D geometry. To get a toon or comic look on video, use Shader FX in the browser: posterize, edges/toon and halftone layers run on any clip, free.' },

    { type: 'h2', text: 'Tips' },
    { type: 'list', items: [
      'Outlines look too heavy at 9:16: lower outline_width, since vertical frames show the model smaller.',
      'Muddy colors on scanned models: pass a palette to replace noisy textures with flat brand colors.',
      'Anime faces: 2-3 bands and rim on usually read best.',
    ] },
    { type: 'links', items: [
      { label: 'Open Toon Shader', href: '/tools/toon-shader' },
      { label: 'Shader FX for footage', href: '/blog/shader-effects-touchdesigner-alternative' },
      { label: 'The full production suite', href: '/blog/hosted-production-suite-higgsfield-alternative' },
    ] },
  ],
};
