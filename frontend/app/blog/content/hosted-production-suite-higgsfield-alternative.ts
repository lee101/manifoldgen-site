import type { BlogArticle } from '../articles';

const D = 'https://manifoldgenstatic.manifoldgen.com/static/tools/production';

export const hostedProductionSuite: BlogArticle = {
  slug: 'hosted-production-suite-higgsfield-alternative',
  category: 'Production',
  title: 'The Hosted Production Suite: Blender, After Effects and Resolve Jobs Without the Desktop Apps',
  excerpt: 'Eleven production tools behind one API key: destruction sims, exploded views, toon shading, remote Blender, photo to 3D, layered SVG, video object removal, footage sorting, compositing, color grading and shader FX. Every job returns an editable file, and none of it needs a local install.',
  readTime: '6 min read',
  date: '2026-10-14',
  ogImage: '/blog/og/hosted-production-suite-higgsfield-alternative.webp',
  blocks: [
    { type: 'p', text: 'Agent skill bundles for creative work usually assume you already own and run Blender, Premiere, After Effects, Illustrator, Photoshop, TouchDesigner and Resolve on the machine the agent controls. That works on a fully licensed workstation, but not on a laptop, a CI runner or a phone. ManifoldGen runs the same jobs on its own servers instead. You call a tool over MCP, the CLI or REST, and you get back the finished media plus a file you can keep editing.' },
    { type: 'p', text: 'This post covers every tool in the suite, what each one costs, and how to connect Claude Code, Codex or Cursor in about a minute. Each tool also has its own deep-dive post, linked at the end.' },

    { type: 'h2', text: 'What the suite replaces' },
    { type: 'table', head: ['Desktop job', 'Hosted tool', 'Price', 'You get', 'Editable file'], rows: [
      ['Blender rigid-body destruction', 'Destruction Studio · blender_destruction', '$0.40 (+$0.06 photo to 3D, +$0.20 high)', 'MP4 + poster', 'Baked .blend'],
      ['Blender exploded view', 'Exploded View · blender_exploded_view', '$0.40 (+$0.06, +$0.20 high)', 'MP4 + poster', '.blend with keyed parts'],
      ['Blender NPR / toon look', 'Toon Shader · blender_toon_shader', '$0.30 (+$0.06, +$0.20 high)', 'Turntable MP4', '.blend with toon materials'],
      ['Scripted Blender scene', 'Remote Blender · blender_render_scene', '$0.30 (+$0.20 high)', 'MP4 + poster', '.blend + your JSON spec'],
      ['Photogrammetry / modeling', 'Image to 3D · image_to_3d', '$0.06 ($0.45 high)', 'Textured GLB', 'GLB'],
      ['Illustrator Image Trace', 'Vectorize · vectorize_image', '$0.02 ($0.03 AI tracer)', 'SVG', 'One layer per color'],
      ['After Effects content-aware fill', 'Shot Cleanup · remove_video_objects', '$0.24 per second, up to 30 s', 'Cleaned MP4 with audio', 'Original kept alongside'],
      ['Premiere project logging', 'Footage Sorter · organize_footage', '$0.05 + $0.02 per clip (up to 24)', 'Contact sheet + report', 'FCPXML 1.10, OTIO, Studio project'],
      ['After Effects keying + comp', 'Shot Composer · composite_shot', '$0.10 + per-second matte rate, max 30 s', 'Composite MP4', 'Alpha WebM, .cube, Studio project'],
      ['Resolve color page', 'Color Grade (browser)', 'Free', 'Graded MP4 / PNG', '33³ .cube LUT'],
      ['TouchDesigner effect chains', 'Shader FX (browser)', 'Free', 'MP4 / PNG', 'Studio project'],
    ] },
    { type: 'p', text: 'Shot Composer pricing depends on the matte. AI background removal costs $0.10 plus the video background removal rate for each second ($0.10 per second at the time of writing). A green or blue screen chroma key costs $0.10 plus $0.01 per second. A generated background adds $0.04. Every paid job is charged only when it completes, and failed jobs cost nothing.' },

    { type: 'h2', text: 'What comes back' },
    {
      type: 'example',
      example: {
        label: 'Four tools, four real outputs',
        promptLabel: 'MCP calls',
        prompt: `blender_destruction  {"subject":"tower","material":"brick","impact":"ball"}
blender_exploded_view {"model_url":"https://.../helmet.glb","mode":"explode_assemble","split":"loose"}
blender_toon_shader  {"model_url":"https://.../helmet.glb","style":"anime"}
remove_video_objects {"video_url":"https://.../beach.mp4","prompt":"woman"}`,
        media: [
          { kind: 'video', src: `${D}/destruction-studio/1-output.mp4`, poster: `${D}/destruction-studio/1-poster.jpg`, aspect: '16:9', seconds: 4, caption: 'Destruction Studio: brick tower, ball impact' },
          { kind: 'video', src: `${D}/exploded-view/2-output.mp4`, poster: `${D}/exploded-view/2-poster.jpg`, aspect: '16:9', seconds: 4, caption: 'Exploded View: sci-fi helmet, 48 parts' },
          { kind: 'video', src: `${D}/toon-shader/1-output.mp4`, poster: `${D}/toon-shader/1-poster.jpg`, aspect: '16:9', seconds: 4, caption: 'Toon Shader: anime style' },
          { kind: 'video', src: `${D}/shot-cleanup/1-output.mp4`, poster: `${D}/shot-cleanup/1-poster.jpg`, aspect: '16:9', seconds: 5.2, caption: 'Shot Cleanup: walker removed' },
        ],
        note: 'Each Blender job also returned a .blend file. The cleanup job took about 55 seconds for a 5.2 second clip and cost $1.44 (6 billed seconds at $0.24).',
      },
    },

    { type: 'h2', text: 'Connect an agent' },
    { type: 'p', text: 'Create an API key on your account page, then add the MCP server. The same key works for the CLI and REST.' },
    { type: 'code', text: `claude mcp add --transport http manifoldgen https://manifoldgen.com/api/mcp \\
  --header "Authorization: Bearer $MANIFOLDGEN_API_KEY"` },
    { type: 'p', text: 'The server exposes the production tools above plus list_services (live prices and parameters), create_upload (a presigned PUT URL for local files) and wait_for_job. Every production tool also accepts wait_seconds (0 to 600), so a single call can block until the render is done. Through prompts/list it serves guided workflows: production-bundle, destruction-studio, exploded-view, scene-builder, toon-shader, shot-cleanup, shot-composer, footage-sorter, vectorize, image-fixer, color-grade and shader-fx.' },

    { type: 'h3', text: 'CLI' },
    { type: 'code', text: `npm i -g manifoldgen-cli          # or: bunx manifoldgen-cli <command>
mg auth login                     # browser approval; --no-browser on SSH boxes
mg services                       # every service with its live price
mg generate destruction-studio --model vase.glb --param impact=ball --param quality=draft --dry-run
mg generate destruction-studio --model vase.glb --param impact=ball --param quality=draft --wait --out fx
mg mcp config                     # MCP snippets for Claude Code, Codex, Cursor` },
    { type: 'p', text: 'Local files passed to --image, --video or --model are uploaded for you. With --out, the CLI polls the job and downloads every output (MP4, PNG, SVG, .blend, .glb) into the folder.' },

    { type: 'h3', text: 'Skills' },
    { type: 'code', text: 'npx skills add manifoldgen/skills    # Claude Code, Codex, Cursor, ...' },
    { type: 'p', text: 'This installs one skill per workflow: manifoldgen (setup, spend rules, the canonical service table), destruction-studio, exploded-view, toon-shader, scene-builder, vectorize, shot-cleanup, shot-composer, footage-sorter, image-fixer, color-grade and shader-fx. Each skill tells the agent what to ask before it spends money, how to run a cheap draft first, and which files to hand back.' },

    { type: 'h2', text: 'Keep it editable' },
    { type: 'p', text: 'A rendered MP4 is a dead end if the client wants one more change. Every tool in the suite therefore returns a file you can open somewhere else:' },
    { type: 'list', items: [
      'Blender tools return a packed .blend with textures embedded, the rigid-body cache baked in, and materials, modifiers and keyframes left editable. Re-light, re-time or re-render it in desktop Blender.',
      'Vectorize groups paths into one layer per palette color, so they open as named layers in Illustrator, Inkscape or Figma.',
      'Footage Sorter writes FCPXML 1.10 (Premiere, Resolve, Final Cut) and OTIO timelines that point at your original clips.',
      'Shot Composer keeps the matted foreground as an alpha WebM, the background and the color-match .cube as separate files, and builds a Studio project with each one on its own layer.',
      'Color Grade exports a 33³ .cube that works in Resolve, Premiere, Final Cut, OBS or ffmpeg.',
    ] },
    { type: 'callout', title: 'Draft first, then render', text: 'All Blender tools take quality draft (about 540p), standard (720p) or high (1080p, +$0.20). Draft and standard cost the same, so check framing on a fast draft and save the high-quality pass for the take you approve. Keep the same seed while you iterate and the fracture or layout stays put.' },

    { type: 'h2', text: 'Deep dives' },
    { type: 'links', items: [
      { label: 'Destruction', href: '/blog/blender-destruction-simulation-online' },
      { label: 'Exploded view', href: '/blog/exploded-view-animation-generator' },
      { label: 'Toon shader', href: '/blog/toon-shader-3d-model-online' },
      { label: 'Remote Blender scene spec', href: '/blog/remote-blender-mcp-scene-spec' },
      { label: 'Photo to 3D', href: '/blog/photo-to-3d-model-glb' },
      { label: 'Vectorize', href: '/blog/vectorize-image-to-layered-svg' },
      { label: 'Video object removal', href: '/blog/remove-objects-from-video-ai' },
      { label: 'Color grade + .cube', href: '/blog/color-grade-video-online-cube-lut' },
      { label: 'Shader FX', href: '/blog/shader-effects-touchdesigner-alternative' },
      { label: 'Footage sorter', href: '/blog/footage-sorter-fcpxml-otio-audio-sync' },
      { label: 'Shot composer', href: '/blog/composite-vfx-shot-online' },
    ] },
    { type: 'links', items: [{ label: 'Open the production tools', href: '/tools/production' }, { label: 'API and MCP docs', href: '/api' }] },
  ],
};
