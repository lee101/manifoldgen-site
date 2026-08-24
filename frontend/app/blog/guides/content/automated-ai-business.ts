import type { Guide } from '../types';

const guide: Guide = {
  slug: 'automated-ai-business',
  section: 'money',
  category: 'Money',
  title: `How to Build an Automated AI Business`,
  excerpt: `The real automation opportunity: productized offers where agents run production and humans run sales and QA. The pipeline pattern, the math, and the build order that avoids the classic corpse.`,
  readTime: '9 min read',
  updated: 'August 2026',
  blocks: [
    { t: 'p', text: `"Automated AI business" usually means a dashboard selling a course about a dashboard. The real version is unglamorous and profitable: a productized offer — fixed scope, fixed price — where agents handle production and humans handle judgment. Six clients at $2K a month is a real business with 70–85% margins. Here is the operating manual.` },
    { t: 'h2', text: `Productize before you automate` },
    { t: 'p', text: `One offer: "30 ad creatives a month, $2K", "one faceless video channel run for you, $3K", "50 product photos per season, $1.5K". Fixed scope forces you to learn what the work actually is. Agents multiply clarity and fog equally — handing an agent a vague offer gives you vague output at machine speed.` },
    { t: 'h2', text: `The pipeline pattern` },
    { t: 'steps', items: [
      `Intake form — the client answers twenty questions once. This is your brief generator's input.`,
      `Brief generator — converts intake into the production brief: deliverable list, acceptance criteria, references attached.`,
      `Agent production line — parallel where items are independent, ordered where dependent. The directing-agents guide is the manual.`,
      `Human QA gates — judgment points where a person approves against the sheet: script pass, brand pass, final pass.`,
      `Delivery plus report — what shipped, what won, what mutates next cycle. The report is the retention engine.`,
    ] },
    { t: 'h2', text: `What agents run well vs badly` },
    { t: 'list', items: [
      `Good: variant generation, first-pass scripts, asset organization, format conversion, reporting, the boring 80%.`,
      `Bad: taste calls, brand judgment, client politics, final approval, pricing conversations.`,
      `Design consequence: every pipeline terminates at a human gate. Agents hand to people at judgment points, never past them.`,
    ] },
    { t: 'h2', text: `The math, honestly` },
    { t: 'p', text: `Six clients at $2K = $12K monthly. Production compute runs $100–300 across the book of business. Your time: sales plus one to two QA hours per client per week. That is the whole model — the margin is real because generation collapsed production cost, and the risk is real because churn eats everything. Weekly reports with winner analysis are what keep clients into month four, where the business actually lives.` },
    { t: 'h2', text: `The build order` },
    { t: 'steps', items: [
      `Deliver the offer manually to two or three clients. Feel where the hours go.`,
      `Write the brief template from what you repeated three times.`,
      `Automate one node at a time — the one-variable discipline from the ComfyUI guide applies to business systems too.`,
      `Only automate what you have done manually ten times. Everything else stays human until it is boring.`,
    ] },
    { t: 'callout', tone: 'violet', title: `Automate version two, not version one`, body: `Premature automation of an unvalidated offer is the number-one killer in this category. Validation is manual; automation is what you earn by validating.` },
    { t: 'h2', text: `Where the moat actually forms` },
    { t: 'list', items: [
      `Proprietary asset libraries — Soul ID sheets, style bibles, scene plates tuned per client.`,
      `Winner data loops — you know which of the client's creatives converted; the next agency starts blind.`,
      `Iteration speed — your kill-and-mutate cycle runs in days, theirs runs in weeks.`,
      `Never the model. Everyone has the model.`,
    ] },
  ],
};

export default guide;
