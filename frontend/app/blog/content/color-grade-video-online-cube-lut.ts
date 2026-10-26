import type { BlogArticle } from '../articles';

const D = 'https://manifoldgenstatic.manifoldgen.com/static/tools/production/color-grade';
const SRC = 'https://manifoldgenstatic.manifoldgen.com/gallery/2176d271-9e3/videos/935072f9-bdc2-4191-a8c9-ceae98e682f4.mp4';

export const colorGradeVideoOnline: BlogArticle = {
  slug: 'color-grade-video-online-cube-lut',
  category: 'Production',
  title: 'Color Grade Video Online and Export a .cube LUT',
  excerpt: 'Lift/gamma/gain wheels, RGB curves, film looks, auto white balance and reference matching in a free browser grader. Export the grade as a 33³ .cube for Resolve, Premiere, Final Cut, OBS or ffmpeg. Your footage never leaves your device.',
  readTime: '5 min read',
  date: '2026-10-14',
  ogImage: '/blog/og/color-grade-video-online-cube-lut.webp',
  blocks: [
    { type: 'p', text: 'Most grading jobs don\'t need a full Resolve install. You need to balance a shot, push it toward a look, and take that look to every other shot and app in the project. Color Grade does this in the browser on your GPU. Nothing uploads, there is no per-job charge, and the result is a standard .cube LUT that any editor can read.' },

    { type: 'h2', text: 'One clip, three looks' },
    {
      type: 'example',
      example: {
        label: 'Teal & orange on a sunset walk',
        promptLabel: 'Steps',
        prompt: `Open /tools/color-grade?src=<video URL>
Seek to 2 s → FILM LOOKS → Teal & orange
Export: .cube (33³), PNG, MP4`,
        input: { kind: 'video', src: SRC, aspect: '16:9', seconds: 5.2, caption: 'Ungraded source' },
        media: [
          { kind: 'image', src: `${D}/1-before.jpg`, aspect: '16:9', caption: 'Before' },
          { kind: 'video', src: `${D}/1-teal-orange.mp4`, poster: `${D}/1-teal-orange.jpg`, aspect: '16:9', seconds: 5.2, caption: 'Teal & orange, MP4 encoded in the browser' },
        ],
        note: 'The look lowers the lift on red and raises it on blue, warms the gain and adds a gentle S-curve. Skin and sand pick up warmth and the shadows cool off.',
      },
    },
    {
      type: 'example',
      example: {
        label: 'Same frame, two more film looks',
        promptLabel: 'Steps',
        prompt: `FILM LOOKS → Day for night   → export .cube
FILM LOOKS → Bleach bypass → export .cube`,
        media: [
          { kind: 'image', src: `${D}/2-day-for-night.jpg`, aspect: '16:9', caption: 'Day for night' },
          { kind: 'image', src: `${D}/3-bleach-bypass.jpg`, aspect: '16:9', caption: 'Bleach bypass' },
        ],
        note: 'Day for night drops exposure by about a stop, desaturates and cools the image. Bleach bypass cuts saturation by more than half and adds hard contrast.',
      },
    },
    { type: 'links', items: [
      { label: 'Download teal-orange.cube', href: `${D}/1-teal-orange.cube` },
      { label: 'Download day-for-night.cube', href: `${D}/2-day-for-night.cube` },
      { label: 'Download bleach-bypass.cube', href: `${D}/3-bleach-bypass.cube` },
    ] },

    { type: 'h2', text: 'The controls' },
    { type: 'table', head: ['Panel', 'What it does'], rows: [
      ['Basics', 'Exposure, contrast, saturation, temperature, tint, highlights, shadows, vignette and grain. Double-click a slider to reset it.'],
      ['Color wheels', 'Lift, gamma and gain, each with a hue wheel and a master slider.'],
      ['Curves', 'Master, red, green and blue curves. Tap to add a point, drag to move it, double-tap to remove it.'],
      ['3D LUT', 'Import a .cube at 17³, 33³ or 65³ and grade on top of it.'],
      ['Match & auto', 'Auto white balance, auto exposure, or both. Match to a still from another shot or a reference image.'],
      ['Film looks', 'Teal & orange, Print film, Bleach bypass, Cross process, Faded film, Day for night, Matte noir, Golden hour.'],
    ] },
    { type: 'p', text: 'Matching works in Lab space. The tool measures the mean and spread of lightness and both color axes in your frame and in the reference, then builds a LUT that moves one distribution onto the other. Use it to bring a pickup shot in line with the hero shot before you add a creative look.' },
    { type: 'p', text: 'Hold the Original button to compare against the ungraded frame. Copy and Paste move a whole grade between clips, and Reset clears it.' },

    { type: 'h2', text: 'A fast workflow' },
    { type: 'list', ordered: true, items: [
      'Load a representative frame: drop a file or pass a public URL as ?src= on /tools/color-grade.',
      'Run Auto WB and Auto exposure to see how far the shot is from neutral.',
      'If the shot has to cut against another one, use Match to still with a frame from that shot. The match is stored as a LUT.',
      'Add a film look, then trim it with the wheels and curves. A look resets the grade controls but keeps any LUT, so choose the look first and fine-tune afterwards.',
      'Export the .cube, plus a PNG still for approval or an MP4 of the graded clip.',
    ] },

    { type: 'h2', text: 'Use the LUT anywhere' },
    { type: 'p', text: 'The export is a 33-point 3D LUT with a 0-1 domain. It loads in Resolve, Premiere (Lumetri), Final Cut, OBS and most cameras or monitors that accept .cube files. To apply it to a batch on the command line:' },
    { type: 'code', text: 'ffmpeg -i in.mp4 -vf lut3d=look.cube -c:a copy graded.mp4' },
    { type: 'p', text: 'Assume Rec.709 SDR footage unless you graded something else. A LUT made on log footage will look wrong on a clip that is already in display space.' },

    { type: 'h2', text: 'Keep it editable' },
    { type: 'list', items: [
      'The .cube is the non-destructive version of the grade. Keep the ungraded originals and apply the LUT in your editor, where you can still adjust it.',
      'Open in Studio carries the clip, the grade settings and any imported LUT into a Studio project, where the grade stays live on the timeline.',
      'Copy the grade before you leave the page and paste it onto the next clip. That keeps a scene consistent without baking anything in.',
      'Export a final MP4 only after the edit is locked. Everything before that should stay a LUT or a live grade.',
    ] },

    { type: 'h2', text: 'From an agent' },
    { type: 'p', text: 'Color Grade is a browser tool, so there is no API job and no credit charge. Agents use it through the color-grade MCP prompt or the color-grade skill (npx skills add manifoldgen/skills). Both send the user to the tool to export a .cube, then apply it with the ffmpeg command above. For glow, grain, halftone or glitch effects, use Shader FX instead.' },
    { type: 'callout', title: 'Grade before you stylize', text: 'Balance and match first, add the look second, and put effects last. If you pile a look on top of a shot that is out of balance, you just push its color cast further.' },

    { type: 'links', items: [
      { label: 'Open Color Grade', href: '/tools/color-grade' },
      { label: 'Shader FX', href: '/blog/shader-effects-touchdesigner-alternative' },
      { label: 'The production suite', href: '/blog/hosted-production-suite-higgsfield-alternative' },
    ] },
  ],
};
