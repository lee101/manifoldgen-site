import type { BlogArticle } from '../articles';

export const howToUseKling4: BlogArticle = {
  slug: 'how-to-use-kling-4',
  category: 'Guides',
  title: 'How to Use Kling 4.0 for Long Cinematic AI Video',
  excerpt: 'Kling 4.0 generates and edits 3 to 30 second clips at 720p or 1080p from text, images, references, or an existing video. Here is how to prompt each route and what it costs.',
  readTime: '6 min read',
  date: '2026-10-24',
  ogImage: '/blog/og/how-to-use-kling-3.webp',
  blocks: [
    { type: 'p', text: 'Kling 4.0 stretches the Kling line to 30-second clips and adds a proper editing route. On ManifoldGen it runs as four routes behind one API key: text-to-video, image-to-video, reference-to-video, and video edit. All four render at 720p or 1080p, accept 3 to 30 seconds, and support per-shot prompting. This guide covers which route to pick, how to write shot-by-shot prompts, and how pricing works.' },
    { type: 'table', head: ['Route', 'Resolution', 'Durations', 'Price'], rows: [
      ['Kling 4.0 (text)', '720p · 1080p', '3–30s', 'from 87 credits / 5s'],
      ['Kling 4.0 Image to Video', '720p · 1080p', '3–30s', 'from 87 credits / 5s'],
      ['Kling 4.0 Reference to Video', '720p · 1080p', '3–30s', 'from 87 credits / 5s'],
      ['Kling 4.0 Video Edit', '720p · 1080p', '3–30s', 'from 104 credits / 5s'],
    ] },

    { type: 'h2', text: 'Pick the route by input' },
    { type: 'list', items: [
      'Text is the fastest way to explore. Describe subject, action, camera, and light, then iterate on the winner.',
      'Image to Video locks the first frame. Generate the still with any image model, then animate it when a character or product must look exactly right. An optional end image pins the last frame.',
      'Reference to Video takes reference images and videos so characters, objects, and motion carry into a new shot. Call them @Image1, @Video1 and so on in the prompt.',
      'Video Edit rewrites an existing 3 to 30 second clip from a text instruction: change the background, swap wardrobe, shift the weather. Refer to the source as @Video1.',
    ] },

    { type: 'h2', text: 'Prompt shot by shot' },
    { type: 'p', text: 'Longer clips need structure. Write one line per shot with its own camera distance and action, and keep the total within the clip length:' },
    { type: 'code', text: `Shot 1 (0-5s): Wide - a detective in a black trench coat crosses a rain-soaked rooftop toward a telescope.
Shot 2 (5-10s): Close-up - her eye at the eyepiece, neon reflecting in the lens.
Shot 3 (10-15s): Medium - she lowers the telescope and turns toward the stairwell door.` },
    { type: 'p', text: 'One subject, one action, and one camera per shot keeps boundaries clean. For clips past 15 seconds, give each beat a distinct visual change so the model has something to move toward instead of repeating itself.' },

    { type: 'h2', text: 'Resolution, aspect ratio, and cost' },
    { type: 'list', items: [
      '720p is the drafting resolution. 1080p costs about 50% more per second; spend it on the shots that survive the edit.',
      'Aspect ratios are 16:9, 9:16, 1:1, and 21:9. Reference to Video also accepts auto, which follows the references. Image to Video and Video Edit follow their source.',
      'Pricing is per second of output. Reference runs that include a reference video, and every Video Edit run, bill on input plus output length, so they cost about twice the plain per-second rate.',
      'Kling 4.0 does not generate a separate audio track. Add sound in the Studio timeline.',
    ] },

    { type: 'h2', text: 'Troubleshooting' },
    { type: 'list', items: [
      'Shots melt together - shorten each shot description to one action.',
      'Character drifts - move to Image to Video or Reference to Video with a clean reference image.',
      'Edit changes too much - name what must stay: "keep the subject and camera move, only change the background".',
      'Long clip feels slow - split into two 10 to 15 second generations and cut them together.',
    ] },
    { type: 'p', text: 'Open the workflow at /tools/kling-4, /tools/kling-4-image, /tools/kling-4-reference, or /tools/kling-4-edit. The API mirror of each lives at /api/video-generators/kling-4 and friends.' },
  ],
};
