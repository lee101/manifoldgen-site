import type { Guide } from '../types';

const guide: Guide = {
  slug: 'ai-ugc-ads-that-convert',
  section: 'money',
  category: 'Money',
  title: `AI UGC Ads: Persona-Led Creative That Converts`,
  excerpt: `Testimonial-style ads outperform studio polish in direct response. How to cast an AI persona, write the four-beat script, produce it believably, and test it properly.`,
  readTime: '8 min read',
  updated: 'August 2026',
  blocks: [
    { t: 'p', text: `UGC-style ads — a person talking to camera like a friend making a recommendation — consistently beat polished studio creative in direct response, because testimony reads as evidence and production value reads as advertising. AI personas let you cast that testimony, script it, and produce it at pipeline speed. The craft is keeping it believable.` },
    { t: 'h2', text: `Cast the persona, do not pick a face` },
    { t: 'p', text: `The persona must match the product's actual buyer: age range, energy, speech pattern, setting. A 22-year-old gym-bro persona selling bookkeeping software reads as spam. Build the persona with the photo-to-persona flow or a generated sheet, then freeze it with Soul ID anchors — the same creator must appear across every ad in the campaign and every follow-up, or the "person" stops existing.` },
    { t: 'h2', text: `The four-beat script` },
    { t: 'list', items: [
      `**Hook** (0–2s) — pattern interrupt in the buyer's language. Five variants per product; the body never changes.`,
      `**Problem** (2–10s) — name the pain specifically. "Back pain after desk days" beats "discomfort".`,
      `**Demo** (10–22s) — hands in frame, product in use, one concrete result.`,
      `**CTA** (22–30s) — exactly one action. "Link in bio, code SAVE20."`,
    ] },
    { t: 'prompt', label: 'Four-beat UGC script skeleton', body: `PERSONA: <paste persona descriptor block verbatim>
SETTING: <persona's canonical room, window light, phone at arm's length>
HOOK: <pattern interrupt, spoken like a text to a friend>
PROBLEM: <the specific pain, in the buyer's words>
DEMO: <product in hands, one measurable result>
CTA: <one action, one code>
Delivery: casual pace, natural pauses, slight imperfection, no ad-voice.` },
    { t: 'h2', text: `Production that stays believable` },
    { t: 'steps', items: [
      `Drive the persona with Character Animator or a talking-video generator, using your own performance as the driving clip — your gestures are the naturalness.`,
      `Relight toward phone-camera realism: slightly flat window light beats glossy key lights.`,
      `Keep the persona's canonical room from her Soul ID sheet as the set — recurring space reads as a real person's life.`,
      `Ambient audio pass: room tone under dialogue, no music until the CTA card.`,
    ] },
    { t: 'h2', text: `The believability checklist` },
    { t: 'list', items: [
      `Imperfect framing — arm's-length camera, not tripod-slick.`,
      `Natural pauses and one breath before the demo.`,
      `No corporate adjectives in dialogue — nobody says "innovative" to a friend.`,
      `Hands in frame during the demo.`,
      `Platform-native captions, sound-off legible.`,
      `One-take energy: two takes max, keep the human one.`,
    ] },
    { t: 'h2', text: `The testing loop` },
    { t: 'p', text: `Five hooks × one body = five ads per concept. Kill at your spend threshold, mutate hooks, and — critically — keep the persona constant across tests, so performance deltas attribute to the hook instead of the face. When a hook wins, it graduates to the full 100-ad matrix from the ads pipeline guide.` },
    { t: 'callout', tone: 'teal', title: `Disclose synthetic creators`, body: `Label AI personas where platform rules require it. A banned ad account costs more than any label ever will, and disclosure has not shown to hurt direct-response performance when the product claim is true.` },
  ],
};

export default guide;
