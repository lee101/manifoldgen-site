import type { Guide } from '../types';

const guide: Guide = {
  slug: 'directing-ai-agents-well',
  section: 'craft',
  category: 'Agents',
  title: `Directing AI Agents: Briefs, Checkpoints, and Review Loops`,
  excerpt: `Agents multiply whatever you give them — clarity or fog. Structure work as a brief, a decomposition, staged checkpoints, and binary acceptance tests.`,
  readTime: '7 min read',
  updated: 'August 2026',
  blocks: [
    { t: 'p', text: `Our agent page produces a complete game trailer — eight shots, score, review pass — from a single brief. It works because the brief is unambiguous, not because the agent is smart. Agents multiply whatever you hand them: clarity or fog. This guide is the directing manual for handing them clarity.` },
    { t: 'h2', text: `Brief like a director, not a typist` },
    { t: 'list', items: [
      `**Goal** — what exists when the work is done ("a 40s trailer, 16:9, four factions").`,
      `**Constraints** — duration, ratios, tone, banned elements ("no narrator").`,
      `**Deliverable format** — clips at five seconds each, a music track, a final assembly.`,
      `**References attached** — character sheets, location plates, style boards.`,
      `**Definition of done** — how anyone can tell it succeeded without asking you.`,
    ] },
    { t: 'h2', text: `Decompose before delegating` },
    { t: 'steps', items: [
      `Outline the beats of the piece.`,
      `Assign each beat an artifact type — shot, song, still, edit.`,
      `Give each item acceptance criteria ("shot ends on settle", "faction colors readable").`,
      `Hand the agent the whole plan. Independent items run in parallel; dependent ones stay ordered.`,
    ] },
    { t: 'p', text: `The chess trailer brief works shot by shot: each SHOT line carries duration, subject, camera move, dialogue, and ratio. Nothing is left for the agent to negotiate mid-run.` },
    { t: 'h2', text: `Checkpoints beat hope` },
    { t: 'p', text: `Review after each stage — script, then boards, then shots, then edit. Fixing a wrong beat at script stage costs a sentence; after render it costs credits. Sample agent output against your anchors the same way you audit persona drift: does the character match the sheet? Does the scene match the plates?` },
    { t: 'h2', text: `Give agents memory` },
    { t: 'list', items: [
      `Shared asset paths — sheets, plates, bibles — quoted verbatim into briefs.`,
      `Naming conventions and version numbers on everything.`,
      `Forbid paraphrasing descriptor blocks; quote them like constants.`,
    ] },
    { t: 'h2', text: `Failure patterns to watch` },
    { t: 'list', items: [
      `Scope creep — unrequested polish added mid-run. Cap variants; demand selection against criteria.`,
      `Late-chain degradation — re-anchor long pipelines to sheets and plates periodically.`,
      `Conflicting instructions — resolve contradictions in the brief before launch, not during.`,
      `Over-generation — thirty variants is not exploration, it is avoidance of selection.`,
    ] },
    { t: 'callout', tone: 'violet', title: `Acceptance tests are binary`, body: `Per deliverable: Would I publish this? Does the character match the sheet? Does the shot end on a settle? Yes/no answers catch most failures; "looks fine" catches none.` },
  ],
};

export default guide;
