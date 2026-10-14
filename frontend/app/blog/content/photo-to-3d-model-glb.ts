import type { BlogArticle } from '../articles';

const D = 'https://manifoldgenstatic.manifoldgen.com/static/tools/production';

export const photoTo3dModelGlb: BlogArticle = {
  slug: 'photo-to-3d-model-glb',
  category: 'Production',
  title: 'Photo to 3D Model: A Textured GLB From One Image for $0.06',
  excerpt: 'Turn a single product or prop photo into a textured GLB in about 20 seconds, then drop it straight into hosted Blender for destruction, toon shading or a full scene. Includes MCP, CLI and REST calls and the photo habits that give clean meshes.',
  readTime: '4 min read',
  date: '2026-10-14',
  ogImage: '/blog/og/photo-to-3d-model-glb.webp',
  blocks: [
    { type: 'p', text: 'Most 3D jobs stall before they start because nobody has a model. Photogrammetry needs dozens of photos and a cleanup pass. Modeling by hand takes hours. Image to 3D skips both: one photo goes in, and a textured GLB comes out that you can render, fracture, toon-shade or place in a scene. The standard tier costs $0.06 per model. The high tier costs $0.45 and returns a denser, higher-resolution mesh.' },

    { type: 'h2', text: 'One sneaker photo, one GLB' },
    {
      type: 'example',
      example: {
        label: 'Sneaker product shot to textured GLB',
        promptLabel: 'MCP call',
        prompt: 'image_to_3d {"image_url":"https://.../sneaker.jpg","quality":"standard","wait_seconds":120}',
        input: { kind: 'image', src: `${D}/image-to-3d/1-input.jpg`, aspect: '1:1', caption: 'Source photo' },
        media: [{ kind: 'model', src: `${D}/image-to-3d/1-output.glb`, caption: 'Textured GLB' }],
        note: 'This took about 20 seconds and cost $0.06. The finished job returns glb_url. Open the file in Blender, a three.js viewer, or any glTF-aware tool.',
      },
    },
    { type: 'links', items: [{ label: 'Try Image to 3D', href: '/tools/image-to-3d' }] },

    { type: 'h2', text: 'Run it from anywhere' },
    { type: 'h3', text: 'CLI' },
    { type: 'code', text: `mg pricing image-to-3d
mg generate image-to-3d --image sneaker.jpg --wait --out out/models --json
mg generate image-to-3d --image sneaker.jpg --param quality=high --wait --out out/models` },
    { type: 'h3', text: 'REST' },
    { type: 'code', text: `curl -X POST https://manifoldgen.com/api/service \\
  -H "Authorization: Bearer $MANIFOLDGEN_API_KEY" -H 'Content-Type: application/json' \\
  -d '{"service":"image-to-3d","image_url":"https://.../sneaker.jpg","params":{"quality":"standard"}}'
curl https://manifoldgen.com/api/video-jobs/<job_id> -H "Authorization: Bearer $MANIFOLDGEN_API_KEY"` },
    { type: 'p', text: 'Local files go through create_upload over MCP, or are uploaded automatically by the CLI.' },

    { type: 'h2', text: 'Photos that reconstruct well' },
    { type: 'list', items: [
      'One object, fully in frame. Cropped edges become missing geometry.',
      'Plain, contrasting background. The 3D reconstruction has to separate the subject first, so clutter costs you shape.',
      'Three-quarter view. A slightly elevated angle that shows the top and one side gives the model more surface to infer from than a flat front view.',
      'Soft, even light. Hard shadows and blown highlights get baked into the texture.',
      'Sharp and well lit. Upscale small images first; detail that is not in the photo will not appear in the mesh.',
    ] },
    { type: 'callout', title: 'Standard or high?', text: 'Use standard ($0.06) for props, previs, destruction debris and anything seen at a distance. Pay for high ($0.45) when the model is the hero of a close product shot and texture detail will be visible on screen.' },

    { type: 'h2', text: 'Feed it into hosted Blender' },
    { type: 'p', text: 'A GLB is most useful as an input. Pass glb_url as model_url to the Blender tools, or list several in model_urls for a scene:' },
    { type: 'code', text: `blender_toon_shader  {"model_url":"https://.../sneaker.glb","style":"anime","quality":"draft","wait_seconds":300}
blender_destruction  {"model_url":"https://.../sneaker.glb","material":"glass","impact":"ball","quality":"draft"}
blender_render_scene {"model_urls":["https://.../sneaker.glb"],"spec":{"objects":[{"type":"model","model_index":0}]},"quality":"draft"}` },
    { type: 'p', text: 'Shortcut: Destruction Studio, Exploded View and Toon Shader also accept image_url directly. When you pass a photo instead of a model, the reconstruction step runs first and adds $0.06 to the job. Run image_to_3d separately when you want to reuse the same GLB across several renders, so you pay for reconstruction once.' },

    { type: 'h2', text: 'Keep it editable' },
    { type: 'list', items: [
      'The GLB is a standard binary glTF file with mesh and texture in one file. Import it into Blender, Unity, Unreal, three.js or a web viewer without conversion.',
      'Keep the source photo with the GLB. If the shape needs work, a re-run from the same image at high quality is cheaper than hand modeling.',
      'When a GLB goes through a Blender tool, the returned .blend contains it with materials editable, so retexturing or remodeling happens in one file.',
    ] },

    { type: 'h2', text: 'Troubleshooting' },
    { type: 'list', items: [
      'Background shapes fused to the model: reshoot or cut out the subject first (remove-background), then run again.',
      'Back side looks invented: it is. One photo cannot see the far side, so pick the angle that matters for your shot.',
      'Thin parts such as laces, straps or antennae are missing: try quality high, or accept them as texture detail.',
      'Job failed: failed jobs are not charged. Check that the image URL is public and points straight at a JPG, PNG or WebP.',
    ] },
    { type: 'links', items: [
      { label: 'Open Image to 3D', href: '/tools/image-to-3d' },
      { label: 'Remote Blender scene spec', href: '/blog/remote-blender-mcp-scene-spec' },
      { label: 'The full production suite', href: '/blog/hosted-production-suite-higgsfield-alternative' },
    ] },
  ],
};
