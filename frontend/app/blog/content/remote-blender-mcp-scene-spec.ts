import type { BlogArticle } from '../articles';

const D = 'https://manifoldgenstatic.manifoldgen.com/static/tools/production';

export const remoteBlenderSceneSpec: BlogArticle = {
  slug: 'remote-blender-mcp-scene-spec',
  category: 'Production',
  title: 'Remote Blender Over MCP: Render a Scene From a JSON Spec',
  excerpt: 'Let an agent build a Blender scene without installing Blender or running Python. Describe objects, materials, lights, camera moves and keyframes as JSON, then get an MP4, a poster and an editable .blend. $0.30 per render.',
  readTime: '5 min read',
  date: '2026-10-14',
  ogImage: '/blog/og/remote-blender-mcp-scene-spec.webp',
  blocks: [
    { type: 'p', text: 'Most "Blender MCP" setups give an agent a Python console inside a Blender you run locally. That is powerful but fragile: it needs a desktop session, and arbitrary code is a security problem on a shared box. Remote Blender takes the other route. The agent sends a declarative scene spec, which is data and not code. ManifoldGen validates it, builds the scene in headless Blender, renders it and returns the .blend.' },
    { type: 'p', text: 'Numbers are clamped, enums are whitelisted and text is sanitized, so an agent can iterate on a spec freely without breaking anything.' },

    { type: 'h2', text: 'Two real renders' },
    {
      type: 'example',
      example: {
        label: 'Helmet product shot on a glowing pedestal',
        promptLabel: 'MCP call',
        prompt: 'blender_render_scene {"model_urls":["https://.../helmet.glb"],"spec":{...},"quality":"standard","wait_seconds":300}',
        media: [{ kind: 'video', src: `${D}/blender-scene/1-output.mp4`, poster: `${D}/blender-scene/1-poster.jpg`, aspect: '16:9', seconds: 4, caption: 'Uploaded model on an emissive podium, dolly camera' }],
        note: '720p, 4 seconds. About 54 seconds end to end on a GPU shared with other services.',
      },
    },
    {
      type: 'example',
      example: {
        label: 'MANIFOLD in 3D text with a torus and a moving camera',
        promptLabel: 'MCP call',
        prompt: 'blender_render_scene {"spec":{"objects":[{"type":"text","text":"MANIFOLD",...},{"type":"torus",...}],"camera":{"keyframes":[...]}},"wait_seconds":300}',
        media: [{ kind: 'video', src: `${D}/blender-scene/2-output.mp4`, poster: `${D}/blender-scene/2-poster.jpg`, aspect: '16:9', seconds: 4, caption: 'Primitives and text only, three camera keys' }],
        note: 'About 41 seconds end to end. The .blend was 0.19 MB because nothing was uploaded.',
      },
    },

    { type: 'h2', text: 'The spec, field by field' },
    { type: 'p', text: 'Here is a complete spec for a product shot like the first example: one uploaded model on a glowing podium, a key light, a rim light and a slow dolly-in.' },
    { type: 'code', text: `{
  "objects": [
    { "type": "cylinder", "name": "podium", "location": [0, 0, 0.25], "scale": [1.2, 1.2, 0.25],
      "material": { "color": "#15151c", "roughness": 0.35, "metallic": 0.6,
                    "emission": "#7c5cff", "emission_strength": 2 } },
    { "type": "model", "model_index": 0, "name": "hero", "location": [0, 0, 1.1], "scale": 1.4,
      "rotation": [0, 0, -20],
      "keyframes": [ { "frame": 1, "rotation": [0, 0, -20] }, { "frame": 96, "rotation": [0, 0, 25] } ] },
    { "type": "torus", "location": [0, 0, 0.52], "scale": 1.3,
      "material": { "color": "#ffffff", "emission": "#37d6c5", "emission_strength": 4 } }
  ],
  "lights": [
    { "type": "area", "location": [3, -3, 4], "look_at": [0, 0, 1], "energy": 600, "size": 2 },
    { "type": "spot", "location": [-3, 2, 3], "look_at": [0, 0, 1.2], "color": "#9db8ff", "energy": 800, "spot_size": 45 }
  ],
  "camera": {
    "location": [0, -6, 1.8], "look_at": [0, 0, 1.1], "lens": 50, "fstop": 4,
    "keyframes": [ { "frame": 1, "location": [0, -6, 1.8] }, { "frame": 96, "location": [0, -4.2, 1.5], "lens": 65 } ]
  },
  "world": { "preset": "dark", "strength": 1 },
  "frames": 96,
  "floor": true,
  "motion_blur": true
}` },
    { type: 'table', head: ['Block', 'What it holds'], rows: [
      ['objects', 'type: cube, sphere, cylinder, cone, torus, plane, text or model. Plus name, location, rotation in degrees, scale as a number or [x,y,z], material, interpolation (bezier, linear, constant) and keyframes. Text takes text, size, extrude and bevel.'],
      ['model', 'model_index points into the model_urls array (up to 16). Each model is normalized to a 1-unit box first, so scale means the same thing for any file.'],
      ['material', 'color, roughness, metallic, transmission, emission, emission_strength and toon (true switches the object to a toon material).'],
      ['keyframes', '{frame, location, rotation, scale} per key, up to 64 per object.'],
      ['lights', 'sun, area, point or spot, with location, look_at or rotation, color, energy, size and spot_size. Up to 16.'],
      ['camera', 'location, look_at, lens, fstop and keyframes of {frame, location, look_at, lens}.'],
      ['world', 'preset (studio, sky, night, sunset, dark, white), or color and strength.'],
      ['frames', 'Up to 240. Set frames and fps, or use the duration param (2-8 s).'],
    ] },
    { type: 'p', text: 'You can leave things out. With no camera you get an auto-fit orbit, and with no lights you get preset lighting for the world. The engine is chosen automatically: if any material sets toon, the scene renders on the fast toon engine, otherwise it uses path tracing. The hard limits are 64 objects, 64 keyframes per object, 16 lights and 240 frames.' },

    { type: 'h2', text: 'From photos to a scene' },
    { type: 'p', text: 'An agent can build a set from reference photos. Run image_to_3d on each photo ($0.06 per GLB), collect the glb_url values into model_urls, and reference them by index:' },
    { type: 'code', text: `mg generate image-to-3d --image chair.jpg --wait --out out/models --json
mg generate blender-scene --model https://.../chair.glb --model table.glb \\
  --params "{\\"spec\\":$(cat spec.json),\\"quality\\":\\"draft\\"}" --wait --out out/scene` },
    { type: 'code', text: `curl -X POST https://manifoldgen.com/api/service \\
  -H "Authorization: Bearer $MANIFOLDGEN_API_KEY" -H 'Content-Type: application/json' \\
  -d '{"service":"blender-scene","model_urls":["https://.../chair.glb"],"params":{"spec":{...},"quality":"draft"}}'` },
    { type: 'p', text: 'Over MCP, the scene-builder prompt walks the agent through the whole loop: ask for the subject, props, mood and camera move, convert references, write the spec, render a draft, adjust positions and render the final.' },

    { type: 'h2', text: 'Pricing' },
    { type: 'p', text: 'A render costs $0.30, or $0.50 at high quality (1080p). Draft and standard cost the same. Models built with image_to_3d are billed separately at $0.06 each ($0.45 at high quality).' },

    { type: 'h2', text: 'Keep it editable' },
    { type: 'list', items: [
      'The returned .blend contains the full scene with named objects, real materials, lights and keyframes. Open it in desktop Blender and keep working.',
      'Keep spec.json next to the deliverables. It is a complete, re-renderable description of the shot, so changing one value and re-sending it is a cheap revision.',
      'Use object names in the spec, since they carry through to the outliner.',
    ] },

    { type: 'h2', text: 'Tips' },
    { type: 'list', items: [
      'Blender is Z-up: location [x, y, z] with z as height. A camera at negative y looks toward positive y.',
      'Use look_at instead of rotation for cameras and lights. It survives layout changes.',
      'Error "params.spec.objects must hold 1-64 objects": the spec needs at least one object.',
      'Draft at 2 seconds to block the shot, then set the final duration.',
    ] },
    { type: 'links', items: [
      { label: 'Open Remote Blender', href: '/tools/blender-scene' },
      { label: 'Photo to 3D', href: '/blog/photo-to-3d-model-glb' },
      { label: 'The full production suite', href: '/blog/hosted-production-suite-higgsfield-alternative' },
    ] },
  ],
};
