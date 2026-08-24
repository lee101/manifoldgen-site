import type { Guide } from '../types';

const guide: Guide = {
  slug: 'filmmaking-principles-for-ai-shots',
  section: 'craft',
  category: 'Directing',
  title: `Filmmaking Principles That Make AI Shots Look Intentional`,
  excerpt: `Shot grammar, coverage, motivated light, and cutting rhythm — the film-school basics that separate generated clips from generated footage.`,
  readTime: '8 min read',
  updated: 'August 2026',
  blocks: [
    { t: 'p', text: `Image and video models learned from a century of cinematography. When your prompts speak that language, outputs snap into coherence; when they don't, you get technically impressive footage that somehow feels amateur. These are the principles that matter most.` },
    { t: 'h2', text: `Shot sizes carry meaning` },
    { t: 'list', items: [
      `Extreme close-up — detail and tension; one object fills the frame.`,
      `Close-up — emotion; the face is the story.`,
      `Medium close-up — chest up; dialogue's default.`,
      `Medium — waist up; hands enter, social distance.`,
      `Wide — full body plus context; body language reads.`,
      `Extreme wide — geography and scale; where are we.`,
    ] },
    { t: 'p', text: `Choose size per story beat first, then say it in the prompt. "Slow push-in to a close-up" means something; "cinematic" does not.` },
    { t: 'h2', text: `Coverage: scenes are families of shots` },
    { t: 'p', text: `A master establishes geography; mediums and close-ups carry emotion; inserts prove details. Keep eyelines matched across cuts, stay on one side of the action line between angles, and generate insert cutaways freely — if two shots refuse to match, an audience reads a cutaway as intent, not error.` },
    { t: 'h2', text: `Motivated lighting` },
    { t: 'p', text: `Every key light should have a visible or implied source — window, lamp, neon sign — named in the prompt. Keep direction constant across a scene's shots ("hard sun from screen left") and enforce it with Relight when outputs wander. Unmotivated light is the fastest way to make generated footage feel weightless.` },
    { t: 'h2', text: `Blocking and camera grammar` },
    { t: 'p', text: `Decide who moves where before touching the camera line. Camera height is power: low angle dominates the subject, high angle diminishes. Lens distance is intimacy. Camera moves need reasons — reveal, follow, energy — or they read as noise.` },
    { t: 'h2', text: `Cutting rhythm` },
    { t: 'list', items: [
      `Hold wides longer than feels necessary; audiences need geography time.`,
      `Cut on action to hide seams.`,
      `Two to four seconds per beat for social formats.`,
      `End shots on a settle, never mid-motion — this matches how good video prompts specify endings.`,
    ] },
    { t: 'h2', text: `Sound sells the image` },
    { t: 'p', text: `Room tone under every scene, foley on physical actions, music entering at a beat change rather than frame zero. The Song Generator covers score; silence right before a logo makes the logo land.` },
    { t: 'callout', tone: 'teal', title: `Steal this exercise`, body: `Storyboard one scene from a favorite film as six AI shots — shot sizes, lens feel, light sources written into each brief. Generate them, then compare against the original. One afternoon of this teaches more than fifty tutorials.` },
  ],
};

export default guide;
