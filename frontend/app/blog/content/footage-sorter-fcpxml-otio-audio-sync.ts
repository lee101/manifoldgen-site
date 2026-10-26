import type { BlogArticle } from '../articles';

const D = 'https://manifoldgenstatic.manifoldgen.com/static/tools/production/footage-sorter';

export const footageSorterFcpxmlOtio: BlogArticle = {
  slug: 'footage-sorter-fcpxml-otio-audio-sync',
  category: 'Production',
  title: 'Footage Sorter: Auto-Bin, Caption and Audio-Sync Clips into FCPXML and OTIO',
  excerpt: 'Send up to 24 clips and get back captions, A-roll/B-roll and shot-size tags, bins by scene and camera, audio sync offsets with confidence scores, and timelines for Premiere, Resolve, Final Cut and ManifoldGen Studio. $0.05 plus $0.02 per clip.',
  readTime: '5 min read',
  date: '2026-10-14',
  ogImage: '/blog/og/footage-sorter-fcpxml-otio-audio-sync.webp',
  blocks: [
    { type: 'p', text: 'Before you can edit, someone has to log the footage: watch every clip, note what it shows, sort it into bins and line up second-camera angles against the main audio. Footage Sorter does that pass on ManifoldGen servers and hands back a timeline your editor can open directly. You don\'t need a Premiere plugin or a sync app, and your original files stay where they are.' },

    { type: 'h2', text: 'A real run' },
    {
      type: 'example',
      example: {
        label: 'Three unrelated clips, sorted in about 11 seconds',
        promptLabel: 'MCP call',
        prompt: `organize_footage {
  "clips": [
    "https://.../01-beach-walk.mp4",
    "https://.../02-man-on-beach.mp4",
    "https://.../03-neon-street.mp4"
  ],
  "wait_seconds": 300
}`,
        media: [
          { kind: 'image', src: `${D}/1-contact.jpg`, aspect: '16:9', caption: 'Contact sheet: three stills per clip' },
        ],
        note: 'Captions put the clips in three scene bins (Scene 1: Sunset beach walk, Scene 2: Beach at sunset, Scene 3: Neon city street) and tagged them wide, medium and close. With no one speaking to camera, all three went into B-roll. Each clip has a different resolution (896x512, a vertical 768x1344 and 1184x672), so each got its own camera bin. The third clip became the sync reference. The beach clip only reached 0.126 sync confidence, under the 0.15 threshold, so it stayed unsynced, which is correct for footage from unrelated shoots. The timeline runs at 24 fps. Cost: $0.05 + 3 × $0.02 = $0.11.',
      },
    },
    { type: 'links', items: [
      { label: 'Download timeline.fcpxml', href: `${D}/1-timeline.fcpxml` },
      { label: 'Download timeline.otio', href: `${D}/1-timeline.otio` },
      { label: 'Download report.json', href: `${D}/1-report.json` },
    ] },

    { type: 'h2', text: 'What it does to each clip' },
    { type: 'list', items: [
      'Probes duration, frame rate, resolution, audio channels, creation time and the camera tag when the file has one.',
      'Captions three stills from each clip in one sentence covering subject, action and framing, and adds a short scene label.',
      'Classifies shot size as wide, medium or close from the caption.',
      'Assigns a role. Clips with speech and evidence of someone talking to camera become A-roll, other video becomes B-roll, and audio-only files go to Audio.',
      'Builds bins by role, by camera (the camera tag, or resolution plus frame rate when the tag is missing) and by scene, clustering clips whose captions share words.',
      'Syncs audio. Each clip\'s audio is aligned to the reference clip within ±60 s. A clip counts as synced only when its confidence is at least 0.15.',
    ] },

    { type: 'h2', text: 'Parameters and outputs' },
    { type: 'table', head: ['Field', 'Values', 'Notes'], rows: [
      ['clips', '1-24 public video or audio URLs', '2 GB total; use create_upload for local files'],
      ['reference_audio', 'clip index 0-23', 'Defaults to the clip with the longest audio'],
      ['sync', 'true / false', 'Default true; turn off for B-roll-only piles'],
      ['fps', '1-120', 'Timeline rate; defaults to the most common clip rate'],
    ] },
    { type: 'p', text: 'The finished job returns fcpxml_url (FCPXML 1.10 for Premiere, Resolve and Final Cut), otio_url, studio_project_url, studio_url (opens the project in ManifoldGen Studio), contact_sheet_url and report_url. The report is JSON with every clip, its caption, shot type, role, bins, offset in seconds and sync confidence.' },

    { type: 'h3', text: 'CLI and REST' },
    { type: 'p', text: 'MCP takes clips as a flat field. In REST and the CLI, clips go inside params:' },
    { type: 'code', text: `mg generate footage-sorter --params '{"clips":["https://.../a.mp4","https://.../b.mp4"],"reference_audio":0}' --dry-run
mg generate footage-sorter --params '{"clips":["https://.../a.mp4","https://.../b.mp4"],"reference_audio":0}' --wait --out sorted

curl -X POST https://manifoldgen.com/api/service \\
  -H "Authorization: Bearer $MANIFOLDGEN_API_KEY" -H 'Content-Type: application/json' \\
  -d '{"service":"footage-sorter","params":{"clips":["https://.../a.mp4","https://.../b.mp4"],"fps":25}}'` },

    { type: 'h2', text: 'Keep it editable' },
    { type: 'list', items: [
      'The timelines point at your original clip URLs. Nothing is transcoded or renamed. If your editor cannot stream a URL, relink to your local copies and the cuts, bins and offsets stay intact.',
      'Bins, roles, shot types and sync confidence are also written into the OTIO metadata, so a script can rebuild selects or filter by scene later.',
      'Treat low-confidence sync as a flag, not a failure. The report lists every offset with its score. Check those clips by ear before you trust them.',
      'The Studio project is a starting point you can keep cutting in the browser. The FCPXML is the hand-off to a desktop finishing suite.',
    ] },
    { type: 'callout', title: 'Pick the reference yourself', text: 'Automatic reference selection takes the clip with the longest audio. On a multicam interview that is usually right. If a lavalier or field recorder track exists, pass its index as reference_audio so every camera syncs to the cleanest audio.' },
    { type: 'p', text: 'Agents can run the whole loop with the footage-sorter MCP prompt. It collects clip URLs, asks which clip has the best audio, confirms the $0.05 + $0.02 per clip cost, then summarizes bins and sync offsets and flags weak matches.' },

    { type: 'links', items: [
      { label: 'Production tools', href: '/tools/production' },
      { label: 'Composite a VFX shot', href: '/blog/composite-vfx-shot-online' },
      { label: 'The production suite', href: '/blog/hosted-production-suite-higgsfield-alternative' },
    ] },
  ],
};
