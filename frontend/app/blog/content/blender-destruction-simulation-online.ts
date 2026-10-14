import type { BlogArticle } from '../articles';

const D = 'https://manifoldgenstatic.manifoldgen.com/static/tools/production';

export const blenderDestructionSimulation: BlogArticle = {
  slug: 'blender-destruction-simulation-online',
  category: 'Production',
  title: 'Blender Destruction Simulation Online: Fracture, Debris and Dust From One API Call',
  excerpt: 'Shatter a tower, a statue, 3D text, your own model or a photo with a real rigid-body simulation in hosted Blender. You get an MP4, a poster and a baked .blend you can keep editing. $0.40 per shot.',
  readTime: '5 min read',
  date: '2026-10-14',
  ogImage: '/blog/og/blender-destruction-simulation-online.webp',
  blocks: [
    { type: 'p', text: 'A good destruction shot in Blender takes an afternoon: fracture the mesh, set up rigid bodies and breakable constraints, bake, add debris and dust, frame the camera around a sim you cannot predict, then render. Destruction Studio runs that whole pipeline on ManifoldGen servers. You describe what breaks and how, and you get back a finished clip plus the baked .blend file.' },
    { type: 'p', text: 'Under the hood it uses a Voronoi fracture with breakable bonds between neighboring pieces, Bullet rigid bodies, secondary debris, procedural dust that also spawns where chunks hit the ground, auto-framing from the baked simulation, and a small camera shake on impact.' },

    { type: 'h2', text: 'Two real renders' },
    {
      type: 'example',
      example: {
        label: 'Brick tower, ball impact',
        promptLabel: 'MCP call',
        prompt: 'blender_destruction {"subject":"tower","material":"brick","impact":"ball","quality":"standard","wait_seconds":300}',
        media: [{ kind: 'video', src: `${D}/destruction-studio/1-output.mp4`, poster: `${D}/destruction-studio/1-poster.jpg`, aspect: '16:9', seconds: 4, caption: '70 pieces, 327 bonds, studio background' }],
        note: '720p, 4 seconds, 96 frames. The full job took about 72 seconds on a GPU shared with other services, and the render was most of that. The packed .blend was about 0.5 MB.',
      },
    },
    {
      type: 'example',
      example: {
        label: 'Marble statue, explosion, slow motion',
        promptLabel: 'MCP call',
        prompt: 'blender_destruction {"subject":"statue","material":"marble","impact":"explosion","slowmo":true,"background":"dark","wait_seconds":300}',
        media: [{ kind: 'video', src: `${D}/destruction-studio/2-output.mp4`, poster: `${D}/destruction-studio/2-poster.jpg`, aspect: '16:9', seconds: 4, caption: 'slowmo ramps the rigid-body time scale around the impact' }],
        note: 'Same resolution and length, about 70 seconds end to end. With slowmo on, the simulation speed is animated, so the blast reads in real time and then stretches out while the pieces fly.',
      },
    },

    { type: 'h2', text: 'Parameters' },
    { type: 'table', head: ['Param', 'Values', 'Notes'], rows: [
      ['subject', 'tower, wall, pillar, statue, house, text', 'Preset to break when you pass no model or photo. Default tower.'],
      ['text', 'Up to 12 characters', 'Extruded 3D text when subject is text.'],
      ['material', 'concrete, brick, glass, wood, marble, ice', 'Each subject has a sensible default.'],
      ['impact', 'ball, explosion, quake, slice', 'Default ball.'],
      ['pieces', '12-160', 'Fracture cells. Default 70.'],
      ['slowmo', 'true / false', 'Slow motion around the impact.'],
      ['dust', 'true / false', 'Procedural dust clouds.'],
      ['duration', '2-8 s', 'Default 4 s at 24 fps.'],
      ['aspect', '16:9, 9:16, 1:1', 'Vertical works for shorts and reels.'],
      ['quality', 'draft, standard, high', 'About 540p, 720p, 1080p. High adds $0.20.'],
      ['background', 'studio, dark, sky, white', 'Lighting and backdrop preset.'],
      ['seed', 'Integer', 'Keep it fixed to keep the same fracture.'],
    ] },

    { type: 'h2', text: 'Break your own model, a photo or a word' },
    { type: 'p', text: 'Pass model_url with a .glb, .obj, .fbx, .stl or .ply file up to 200 MB. Uploaded models are scaled to 3.6 m, vertices are welded and the mesh is decimated to 30k faces. If it is not watertight, a voxel proxy is used for the inside tests. Your original materials and UVs stay on the outer faces, and the cut faces get an interior material.' },
    { type: 'p', text: 'No model? Pass image_url instead. The photo is turned into a textured 3D model first, which adds $0.06. For titles, use the text subject:' },
    { type: 'code', text: `mg generate destruction-studio --param subject=text --param text="LAUNCH" \\
  --param material=concrete --param impact=explosion --param quality=draft --wait --out out/title

mg generate destruction-studio --model vase.glb --param material=glass --param impact=ball \\
  --param pieces=80 --param quality=draft --dry-run

mg generate destruction-studio --image statue.png --param impact=quake --wait --out out/photo` },
    { type: 'p', text: 'The REST body uses the same names. Model and image URLs go at the top level and tool options go in params:' },
    { type: 'code', text: `curl -X POST https://manifoldgen.com/api/service \\
  -H "Authorization: Bearer $MANIFOLDGEN_API_KEY" -H 'Content-Type: application/json' \\
  -d '{"service":"destruction-studio","model_url":"https://.../vase.glb",
       "params":{"material":"glass","impact":"ball","pieces":80,"quality":"draft"}}'

curl https://manifoldgen.com/api/video-jobs/<job_id> -H "Authorization: Bearer $MANIFOLDGEN_API_KEY"` },

    { type: 'h2', text: 'Pricing' },
    { type: 'p', text: 'A shot costs $0.40. Turning a photo into 3D first adds $0.06, and high quality (1080p) adds $0.20, so the most you can pay is $0.66. Draft and standard cost the same. You are charged only when the job completes.' },
    { type: 'callout', title: 'Iterate on draft', text: 'Physics, fracture and baking take under 5 seconds. Almost all the time goes into rendering, which is why a 2 second draft comes back in seconds. Lock in the framing, piece count and impact on draft with a fixed seed, then render standard or high once.' },

    { type: 'h2', text: 'Keep it editable' },
    { type: 'p', text: 'The blend_url output is a packed .blend with textures embedded and the rigid-body cache already baked. Open it in desktop Blender and you can:' },
    { type: 'list', items: [
      'Swap the material on the chunks or the interior faces and re-render without re-simulating.',
      'Re-time the shot by moving keys or changing the frame range, since the cache is already in the file.',
      'Re-light, change the camera or add your own environment around the baked debris.',
      'Re-bake with different constraint strengths if you want a looser or tighter collapse.',
    ] },
    { type: 'p', text: 'The MP4 and poster are ready to drop into an edit. Studio, Premiere or Resolve all take them as is.' },

    { type: 'h2', text: 'Troubleshooting' },
    { type: 'list', items: [
      'Too few, chunky pieces: raise pieces toward 120-160. Very thin meshes still break along their few faces.',
      'Collapse looks different on every run: set seed and keep it.',
      'Uploaded model rejected: files over 200 MB or meshes over 1.6M faces are refused. Decimate or export a lighter LOD.',
      'Subject text missing: subject text requires params.text.',
    ] },
    { type: 'links', items: [
      { label: 'Open Destruction Studio', href: '/tools/destruction-studio' },
      { label: 'The full production suite', href: '/blog/hosted-production-suite-higgsfield-alternative' },
    ] },
  ],
};
