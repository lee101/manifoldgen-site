import type { BlogArticle } from '../articles';

const D = 'https://manifoldgenstatic.manifoldgen.com/static/tools/production';

export const removeObjectsFromVideoAi: BlogArticle = {
  slug: 'remove-objects-from-video-ai',
  category: 'Production',
  title: 'Remove Objects From Video With AI: Name It, Erase It',
  excerpt: 'Erase a person, logo, car or boom mic from a clip by naming it in one word. The AI eraser keeps motion and texture, keeps your audio, and costs $0.24 per second for clips up to 30 seconds, charged only on success.',
  readTime: '5 min read',
  date: '2026-10-14',
  ogImage: '/blog/og/remove-objects-from-video-ai.webp',
  blocks: [
    { type: 'p', text: 'Paint-out is the least glamorous job in post. In After Effects it means masks, tracking and content-aware fill, frame by frame when the fill drifts. Shot Cleanup turns that into a single call. Pass the clip and a short noun such as "person", "logo" or "car", and the AI eraser removes it across the shot while rebuilding the background behind it.' },

    { type: 'h2', text: 'A walker removed from a beach shot' },
    {
      type: 'example',
      example: {
        label: 'Prompt "woman", 5.2 second clip',
        promptLabel: 'MCP call',
        prompt: 'remove_video_objects {"video_url":"https://.../beach.mp4","prompt":"woman","keep_audio":true,"wait_seconds":600}',
        input: { kind: 'video', src: `${D}/shot-cleanup/1-input.mp4`, aspect: '16:9', seconds: 5.2, caption: 'Original' },
        media: [{ kind: 'video', src: `${D}/shot-cleanup/1-output.mp4`, poster: `${D}/shot-cleanup/1-poster.jpg`, aspect: '16:9', seconds: 5.2, caption: 'Cleaned' }],
        note: 'Processing took about 55 seconds. Billing rounds up to whole seconds: 6 x $0.24 = $1.44. Waves, sand and the sunset reflection are rebuilt where she walked.',
      },
    },
    { type: 'links', items: [{ label: 'Try Shot Cleanup', href: '/tools/shot-cleanup' }] },

    { type: 'h2', text: 'Two ways to pick the target' },
    { type: 'table', head: ['Targeting', 'Clip length', 'Use when'], rows: [
      ['prompt (short noun)', 'Up to 30 s', 'The object has a clear name: person, car, logo, boom microphone'],
      ['points on the first frame', 'Up to 4.8 s', 'Several similar objects and you need exactly one, or the object has no simple name'],
    ] },
    { type: 'p', text: 'Points are pixel coordinates on the first frame, up to 12 of them, each marked positive (remove this) or negative (keep this). The prompt must stay short, at most 120 characters, and a single noun works best.' },

    { type: 'h2', text: 'CLI and REST' },
    { type: 'code', text: `mg generate shot-cleanup --video take3.mp4 --prompt "boom microphone" --duration 12 --param keep_audio=true --dry-run
mg generate shot-cleanup --video take3.mp4 --prompt "boom microphone" --duration 12 --param keep_audio=true --wait --out out/cleanup
mg generate shot-cleanup --video short.mp4 --params '{"points":[{"x":812,"y":140,"type":"positive"}]}' --duration 4 --wait --out out/cleanup` },
    { type: 'code', text: `curl -X POST https://manifoldgen.com/api/service \\
  -H "Authorization: Bearer $MANIFOLDGEN_API_KEY" -H 'Content-Type: application/json' \\
  -d '{"service":"shot-cleanup","video_url":"https://.../take3.mp4","prompt":"boom microphone","duration":12,"params":{"keep_audio":true}}'` },
    { type: 'p', text: 'duration is the number of seconds to process from the start, and it sits at the top level of the request, not inside params. Leave it out to process the whole clip up to 30 seconds. Over MCP, all fields are passed flat.' },

    { type: 'h2', text: 'How longer clips are handled' },
    { type: 'p', text: 'The eraser works on parts of at most 4.8 seconds. Longer clips are split into equal parts, up to three are processed in parallel, and each joint gets a 0.3 second crossfade so there is no visible seam. This is why points only work on clips up to 4.8 seconds: a point on frame one only describes the first part. Video wider than 1920 px is scaled down to 1920 for processing.' },

    { type: 'h2', text: 'Cost' },
    { type: 'p', text: 'Price is $0.24 per second, rounded up to whole seconds, with a 30 second maximum per job: 5 s costs $1.20, 12 s costs $2.88, 30 s costs $7.20. You are charged only when the job succeeds. For longer shots, split them into 30 second jobs, or trim to the part where the object actually appears.' },
    { type: 'callout', title: 'Need a matte instead?', text: 'If you want to keep the subject and drop the background, use video_background_removal. It returns an alpha video you can composite yourself, or use composite_shot to key and place the subject on a new plate in one job.' },

    { type: 'h2', text: 'Keep it editable' },
    { type: 'list', items: [
      'The cleaned MP4 has the same framing and length as the processed range, so it drops onto the original in any NLE as a replacement.',
      'Audio is kept by default (keep_audio true). Set it to false only if you plan to lay the sound back in from the original.',
      'Keep the original clip next to the result. If the fill is wrong in a few frames, cut back to the original there, or run a tighter range with duration.',
    ] },

    { type: 'h2', text: 'Troubleshooting' },
    { type: 'list', items: [
      'The wrong object vanished: use a more specific noun ("red car" rather than "car"), or switch to points on a clip of 4.8 s or less.',
      'Smearing where the object was: large objects that cover most of the frame leave little background to rebuild from. Trim to the frames where it is smaller.',
      '"Point selection works on clips up to 4.8 s": either set duration to 4 or use a prompt.',
      'Job failed: no charge. Check the URL is public and the file is a readable video.',
    ] },
    { type: 'links', items: [
      { label: 'Open Shot Cleanup', href: '/tools/shot-cleanup' },
      { label: 'Composite a VFX shot', href: '/blog/composite-vfx-shot-online' },
      { label: 'The full production suite', href: '/blog/hosted-production-suite-higgsfield-alternative' },
    ] },
  ],
};
