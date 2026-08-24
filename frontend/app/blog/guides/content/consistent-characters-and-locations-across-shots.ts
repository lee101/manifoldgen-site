import type { Guide } from '../types';

const guide: Guide = {
  slug: 'consistent-characters-and-locations-across-shots',
  section: 'continuity',
  category: 'Scene continuity',
  title: `How to Keep Characters and Locations Consistent Across AI Shots`,
  excerpt: `Shoot AI like film: master plates, motivated light, match-on-action, and repairs in post instead of continuity-killing rerolls.`,
  readTime: '9 min read',
  updated: 'August 2026',
  blocks: [
    { t: 'p', text: `Single-image consistency is solved with references. Sequences add a time axis: wardrobe state, lighting, and geography have to persist shot to shot. The fix is to stop treating generations as independent images and start treating the project like a shoot — plates, coverage, continuity notes.` },
    { t: 'h2', text: `Master plates before shots` },
    { t: 'steps', items: [
      `Lock the character sheet (Soul ID anchors).`,
      `Generate each location as plates too: wide establishing, reverse angle, two or three key detail inserts.`,
      `Approve plates once; every scene shot derives from them via reference edit. No shot invents its own version of the kitchen.`,
    ] },
    { t: 'h2', text: `Lock the light before the shot` },
    { t: 'p', text: `Write down each location's light signature — key direction, quality, color — and reuse the same terms in every shot prompt. "Hard afternoon sun from screen left" must mean the same thing in shot 4 as in shot 11. Normalize stray outputs with Relight rather than accepting a different sun per frame. Lighting mismatch reads as "different universe" faster than face drift does.` },
    { t: 'h2', text: `Shoot coverage, not singles` },
    { t: 'list', items: [
      `Establish wide → mediums → inserts. Give the editor something to cut to.`,
      `Keep eyelines consistent across cuts — if A looks right, B looks left in the reverse.`,
      `Stay on one side of the action (the 180° line) between angles of the same subject.`,
      `Match action across cuts: hand position, door state, cup level must agree.`,
    ] },
    { t: 'h2', text: `Camera language stays in-family` },
    { t: 'p', text: `Pick a lens family and camera height vocabulary per scene and keep it. Cinematic Cameras presets give repeatable dolly, crane, and macro moves — use the same preset names across a scene instead of improvising new gear language per shot.` },
    { t: 'h2', text: `Repair in post, not by reroll` },
    { t: 'p', text: `Regenerating a whole shot resets continuity — wardrobe, light, geography all re-roll. Repair the broken element instead: inpaint the wrong prop, outpaint to extend the set, style-transfer the grade. For motion, video generators take the strongest stills forward; Character Animator re-performs a locked design.` },
    { t: 'prompt', label: 'Sequence shot brief template', body: `SHOT 7 — kitchen argument, medium close-up.
CHARACTER: <paste canonical descriptor verbatim>
LOCATION: <location plate id + light signature>
CAMERA: 50mm feel, eye level, static with slight push-in.
CONTINUITY FROM SHOT 6: same tea towel over shoulder,
window light unchanged, cup on counter to frame left.
ACTION: she sets the cup down, turns toward the door.` },
    { t: 'callout', tone: 'teal', title: `Continuity board`, body: `Before approving any shot, paste the final frames of the previous shot beside the draft and compare: wardrobe state, light direction, props, geography. Ten seconds of comparison saves a regeneration cycle.` },
  ],
};

export default guide;
