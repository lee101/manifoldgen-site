import type { BlogArticle } from '../articles';

export const howToMakeAiVideoFromScript: BlogArticle = {
  slug: 'how-to-make-ai-video-from-script',
  category: 'Guides',
  title: 'How to Make an AI Video From a Script in 2026',
  excerpt: 'Turn a written script into shot-by-shot AI video prompts: extract subject, action, camera, light, and ending per scene line and keep continuity across cuts.',
  readTime: '8 min read',
  date: '2026-08-20',
  ogImage: '/blog/og/how-to-make-ai-video-from-script.webp',
  blocks: [
    { type: 'p', text: 'A script is already a prompt list — most people just hand it over whole. Video models generate one shot at a time, four or five seconds each. Feed them three pages of scene description and you get mush. Feed them one formatted line per shot and the edit assembles itself.' },
    { type: 'p', text: 'This guide walks through converting a two-scene script into two prompts, generating both clips with ManifoldGen, and cutting them together into a coherent sequence. The workflow scales to any length: every scene heading becomes one or more shot prompts, never more than one shot per prompt.' },

    { type: 'h2', text: 'The workflow: script line to shot prompt' },
    { type: 'list', ordered: true, items: [
      'Break the script into shots. Each EXT./INT. scene line is at least one shot; action lines with their own camera logic become additional shots. A 60-second piece is typically 12–16 four-second clips.',
      'Extract five fields from each scene line: subject, action, camera move, lighting, ending state. If a field is missing from the script, invent it once and lock it — that decision now belongs to the world.',
      'Write one prompt per shot using the skeleton below. Camera clause directly after the subject, exactly as you would for any directed shot.',
      'Repeat world details across prompts verbatim. Same palette words ("cold blue-grey"), same weather ("sheets of rain"), same time of day in every shot of the sequence. Continuity lives in repeated adjectives.',
      'Generate at low duration first, review all shots together on a timeline, regenerate only the weak ones.',
      'Cut in an editor: trim each clip to its strongest 2.5–3.5 seconds, order follows the script, no transitions. Hard cuts are the grammar.',
    ] },

    { type: 'h2', text: 'A two-scene script' },
    { type: 'p', text: 'Here is the entire source material — a standard scene breakdown:' },
    { type: 'code', text: `EXT. STORM CLIFF - NIGHT

Rain hammers a stone lighthouse on a cliff.
Huge waves explode against the rocks below.
The beam sweeps through the storm.

INT. LAMP ROOM - NIGHT

Weathered hands grip a brass wheel.
The giant Fresnel lens rotates, blades of
light sweeping across rain-streaked glass.` },
    { type: 'p', text: 'Two scene headings, two establishing details, two actions. That maps cleanly to two prompts.' },

    { type: 'h2', text: 'Shot prompts, generated' },
    {
      type: 'example',
      example: {
        label: 'Scene 1 — EXT. STORM CLIFF – NIGHT',
        prompt: 'A stone lighthouse on a storm-battered cliff at night. Huge waves explode against the rocks while the beam sweeps through sheets of rain. Slow aerial push toward the lantern room, wide establishing shot, cold blue-grey palette, dramatic documentary energy.',
        media: [{ kind: 'video', src: '/blog/media/how-to-make-ai-video-from-script/storm-cliff.webm', poster: '/blog/media/how-to-make-ai-video-from-script/storm-cliff.jpg', aspect: '16:9', seconds: 4 }],
        note: 'This shot carries the scene heading itself: exterior, night, weather, scale. The wide aerial push establishes geography before any close-up exists, which is what an establishing shot is for — and "toward the lantern room" aims the move at where Scene 2 will take us.',
      },
    },
    {
      type: 'example',
      example: {
        label: 'Scene 2 — INT. LAMP ROOM – NIGHT',
        prompt: 'Close-up inside a lighthouse lantern room at night. Weathered hands grip a brass wheel as the giant Fresnel lens rotates, throwing moving blades of light across rain-streaked glass. Slow dolly-in, shallow depth of field, warm amber light against cold blue night.',
        media: [{ kind: 'video', src: '/blog/media/how-to-make-ai-video-from-script/lamp-room.webm', poster: '/blog/media/how-to-make-ai-video-from-script/lamp-room.jpg', aspect: '16:9', seconds: 4 }],
        note: 'The INT. heading becomes a close-up interior with shallow depth of field — the contrast with Shot 1 does the storytelling. Rain-streaked glass and cold blue night repeat Scene 1\'s weather and palette verbatim, so the cut reads as the same world minutes apart.',
      },
    },

    { type: 'h2', text: 'Continuity is repetition' },
    { type: 'p', text: 'Models have no memory between generations. The only continuity mechanism you control is word-for-word repetition across prompts. Pick a small vocabulary per project and reuse it mechanically:' },
    { type: 'list', items: [
      'Palette: name two or three colors once ("cold blue-grey", "warm amber") and use them in every shot.',
      'Weather and time: "night", "sheets of rain" appear in both prompts above. Drop them and the second clip silently becomes a different evening.',
      'Recurring objects: if the lighthouse beam matters, it appears in the exterior and as moving light inside the interior. Same object, different angle.',
      'Style anchor: one phrase like "dramatic documentary energy" in every prompt keeps grade and texture consistent even when subjects change.',
    ] },

    { type: 'h2', text: 'Cutting four-second clips' },
    { type: 'p', text: 'Plan on 4-second renders even when your edit needs longer takes. Short clips generate faster, fail cheaper, and force the discipline of one idea per shot. In the timeline, trim each clip to its best 2.5–3.5 seconds so motion never visibly loops or stalls at the edges. Cut on action — hands turning a wheel, waves mid-explosion — and the seams disappear. For pacing reference, dialogue-free sequences like this one sit comfortably at one cut every 2–4 seconds.' },

    { type: 'code', text: `[Subject and setting], matching the scene's INT/EXT and time of day.
[One action from the script].
[Camera move] toward [target], [shot size], [palette words],
[style anchor phrase repeated from previous shots].` },

    { type: 'callout', title: 'One shot per prompt', text: 'Never ask a single generation to cover a whole scene. A prompt describing the lighthouse, then the interior, then the keeper walking upstairs produces a morphing compromise. Each scene heading yields its own prompt; each prompt yields one composition, one move, one action.' },

    { type: 'h2', text: 'Troubleshooting' },
    { type: 'list', items: [
      'Shots look like different worlds — a detail changed between prompts. Audit palette, weather, and time-of-day words; they must match character-for-character.',
      'Clip contains two locations — the prompt covered more than one shot. Split it at the scene heading and generate again.',
      'Interior feels disconnected from exterior — the establishing shot named no destination. End exteriors with a move toward whatever the next interior shows.',
      'Sequence feels flat — every shot uses the same size. Alternate wide establishing shots with close-ups the way the script alternates EXT/INT.',
      'Motion stalls before the cut ends — no ending state defined. Add a settle clause ("settles on the rotating lens") so the last frames hold a stable frame.',
    ] },

    { type: 'p', text: 'Draft your scene breakdown, convert each heading with the skeleton, and run the shots side by side in /studio before committing to final renders. For camera-move vocabulary to fill the skeleton with, see /tools/cinematic-cameras.' },
  ],
};
