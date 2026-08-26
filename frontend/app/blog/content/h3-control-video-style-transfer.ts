import type { BlogArticle } from '../articles';

export const h3ControlVideoStyleTransfer: BlogArticle = {
  slug: 'h3-control-video-style-transfer',
  category: 'Product update',
  title: 'Pose to Witch: Six New Ways to Control AI Video',
  excerpt: 'Turn ordinary footage into a pose, depth, edge, line, or masked control signal, then regenerate it as a new character or world. We shipped six MiniMax H3 control-video tools and tested the full path with a real pose-to-witch render.',
  readTime: '6 min read',
  date: '2026-08-25',
  ogImage: '/blog/og/h3-control-video-style-transfer.webp',
  blocks: [
    { type: 'p', text: 'Video-to-video usually asks one model to preserve everything and change everything at once. That is why a strong style transfer can lose the walk, flatten the camera move, or slowly replace the performer with a different person. Our new H3 control tools split the problem in two: first extract the part of the source clip that matters, then use that signal to guide a new generation.' },
    { type: 'p', text: 'We have launched six focused workflows—Canny, Depth, HED, MLSD, Pose, and Video Inpainting—on the MiniMax-H3-Fun ControlNet Union model. Each tool accepts a normal source video. ManifoldGen prepares the correct control pass automatically, or you can turn preprocessing off and upload a control video you prepared elsewhere.' },

    { type: 'h2', text: 'The test: turn a performance into a forest witch' },
    { type: 'p', text: 'For the launch test, we used a short pose-driving clip and asked for a full-body forest witch in layered emerald robes, silver hair, and a moonlit ancient forest. The output keeps the source performance and hand timing while replacing the person, wardrobe, lighting, and location.' },
    {
      type: 'example',
      example: {
        label: 'Real launch render — Pose control',
        prompt: 'A powerful forest witch performing the movement, full body, layered emerald robes and leather corset, silver hair, magical particles around her hands, moonlit ancient forest, cinematic fantasy realism',
        input: {
          kind: 'video',
          src: 'https://huggingface.co/alibaba-pai/MiniMax-H3-Fun-Controlnet-Union/resolve/main/asset/pose_dance.mp4',
          aspect: '16:9',
          caption: 'Source performance / pose control',
        },
        media: [{
          kind: 'video',
          src: 'https://manifoldgenstatic.manifoldgen.com/gallery/control-video/pose-forest-witch-v12.mp4',
          aspect: '16:9',
          seconds: 2.3,
          caption: 'Forest witch output — generated on the production H3 control worker',
        }],
        note: 'This is the actual production output, not a concept mockup. Pose control carries the body performance; the prompt controls the new subject and world.',
      },
    },
    { type: 'links', items: [{ label: 'Try Pose Video', href: '/tools/pose-video' }] },

    { type: 'h2', text: 'Which control should you use?' },
    { type: 'table', head: ['Control', 'What it preserves', 'Best use'], rows: [
      ['Pose', 'Body joints, gesture, and performance timing', 'Replace a walker, dancer, or actor with a mage, creature, or new character'],
      ['Depth', 'Camera path, distance, spatial layers, and subject volume', 'Rebuild a location while retaining the original 3D movement'],
      ['Canny', 'Strong silhouettes and hard edges', 'Graphic transformations, products, vehicles, and clearly outlined subjects'],
      ['HED', 'Softer contours and internal organic detail', 'Faces, fabric, creatures, illustration, and expressive shapes'],
      ['MLSD', 'Dominant straight lines and perspective geometry', 'Architecture, rooms, streets, sets, and designed environments'],
      ['Inpainting', 'Everything outside a supplied mask', 'Replace wardrobe or props, remove objects, or add localized effects'],
    ] },
    { type: 'p', text: 'The useful distinction is what you cannot afford to lose. Choose Pose when the performance is sacred, Depth when the camera and volume matter, Canny for bold shape, HED for nuanced contour, and MLSD for constructed geometry. Use Inpainting when most of the frame is already right and only one region should change.' },
    { type: 'links', items: [
      { label: 'Canny', href: '/tools/canny-video' },
      { label: 'Depth', href: '/tools/depth-video' },
      { label: 'HED', href: '/tools/hed-video' },
      { label: 'MLSD', href: '/tools/mlsd-video' },
      { label: 'Pose', href: '/tools/pose-video' },
      { label: 'Video Inpainting', href: '/tools/video-inpainting' },
    ] },

    { type: 'h2', text: 'A normal video is enough' },
    { type: 'p', text: 'You do not need to run OpenPose, a depth estimator, or an edge detector before uploading. Keep “Extract control from my normal video” enabled and the worker derives a temporally aligned control video before generation. Advanced users can disable that switch to send an already prepared Canny, Depth, HED, MLSD, or Pose pass directly.' },
    { type: 'callout', title: 'Inpainting needs one extra file', text: 'Upload the source clip and a matching mask video. White areas are regenerated through time; black areas stay anchored to the original. A stable mask produces a more stable edit.' },

    { type: 'h2', text: 'Settings that matter' },
    { type: 'list', items: [
      'Control strength decides how strictly the new shot follows the guide. Start near the default; lower it for a larger creative change and raise it when motion or geometry begins to drift.',
      'Prompt the replacement, not the source. Describe the new subject, wardrobe, environment, light, materials, and desired finish.',
      'Use a seed when comparing prompts or strength values. Keeping it fixed makes the effect of one changed setting easier to judge.',
      'Start at 480p on a short excerpt. Once motion and framing work, move to 576p or 720p and render the longer clip.',
    ] },
    { type: 'p', text: 'The launch tools accept clips up to 15 seconds, with 3, 5, 8, 10, and 15-second output choices. Resolutions are 480p, 576p, and 720p. Generation runs as a durable asynchronous job, so a long render does not depend on keeping one browser request open.' },

    { type: 'h2', text: 'Launch pricing' },
    { type: 'p', text: 'Before you generate, the page shows an estimate based on duration and resolution. At launch, the approximate 480p prices are $1.16 for 3 seconds, $1.44 for 5 seconds, $1.88 for 8 seconds, and $2.88 for 15 seconds. A 576p render is about 1.35× the 480p estimate and 720p is about 2×. The final charge settles from actual GPU runtime, so you pay for the compute used rather than a padded fixed ceiling.' },
    { type: 'callout', title: 'Prototype short, finish high', text: 'Control-video generation is high-memory GPU work. Test the prompt and control strength on the shortest useful section at 480p, then spend on the final duration and resolution after the motion is right.' },

    { type: 'h2', text: 'Availability and model license' },
    { type: 'p', text: 'These six tools use the MiniMax H3 Community License. They are currently unavailable in the United States, European Union, United Kingdom, and South Korea. The tool checks territory before generation and requires license acceptance in the interface. If the tool is available where you are, review the linked model license for the restrictions that apply to your use.' },
    { type: 'links', items: [
      { label: 'Read the model license', href: 'https://huggingface.co/alibaba-pai/MiniMax-H3-Fun-Controlnet-Union/blob/main/LICENSE' },
      { label: 'Open Pose Video', href: '/tools/pose-video' },
    ] },

    { type: 'h2', text: 'What to make first' },
    { type: 'p', text: 'Start with a clean, readable performance: one person walking, dancing, casting, or turning in frame. Run it through Pose and describe a character whose silhouette can plausibly follow that motion—a witch, armored knight, forest spirit, or stylized creature. Then take the same source through Depth or HED. Seeing which information each control preserves is the fastest way to understand the six tools, and often reveals a stronger treatment than the one you planned.' },
  ],
};
