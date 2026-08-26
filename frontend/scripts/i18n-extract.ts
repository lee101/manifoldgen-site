// Builds frontend/translations/en.json (and meta.json hashes) from the source
// data modules. Every SEO route gets a flat map of dotted keys -> English text.
// Re-running is idempotent; keys are structural (slug + index), never content,
// so existing translations survive re-extraction.
//
//   bun scripts/i18n-extract.ts
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { articles } from '../app/blog/articles';
import { guides } from '../app/blog/guides/registry';
import { CURATED_SEARCH_PAGES } from '../lib/search-pages';
import { CATEGORIES, MODELS as BENCH_MODELS, comparePairs } from '../lib/seo/benchmarks';
import { BEST_TOPICS } from '../lib/seo/best-topics';
import { COMPARISONS } from '../lib/seo/comparisons';
import { VIDEO_MODELS } from '../lib/seo/models';
import { USE_CASES } from '../lib/seo/usecases';
import { VIDEO_CONTROL_TOOLS } from '../lib/video-controls';
import type { BlogBlock } from '../app/blog/articles';
import type { GuideBlock } from '../app/blog/guides/types';
import { VIDEO_GENERATORS } from '../lib/video-generators';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'translations');

type RouteStrings = Record<string, string>;
const routes: Record<string, RouteStrings> = {};

const NON_PROSE = /^(\/|https?:\/\/)/;

function add(route: string, key: string, value: unknown): void {
  if (typeof value !== 'string') return;
  if (!value.trim()) return;
  // Paths, URLs, and similar identifiers are not translatable prose.
  if (NON_PROSE.test(value.trim())) return;
  (routes[route] ??= {})[key] = value;
}
const STATIC_METAS: [string, string, string][] = [
  ['/', 'ManifoldGen | AI Video Creator and Generator', 'Create AI video from text, images, and reference media with ManifoldGen, an AI video creator for cinematic generation, audio, and editing.'],
  ['/tools', 'AI Creative Tools — ManifoldGen', 'Purpose-built spaces for AI art, image editing, relighting, upscaling, character animation, and video finishing.'],
  ['/ai-video-generator', 'AI Video Generator for Every Job — Ads, TikTok, VFX, Anime', 'Programmatic playbooks for AI video: product ads, UGC, TikTok, YouTube Shorts, music videos, VFX, anime and more — with model picks, prices, and real examples.'],
  ['/compare', 'AI Model Comparisons — Seedance vs Wan, LTX vs Manifold & More', 'Head-to-head AI video and image model comparisons on real ManifoldGen output: prices per clip, resolution, audio, and which model wins for which job.'],
  ['/best', 'AI Video Generator Answers — Best, Cheapest, Fastest, Compared', 'Direct answers to the questions buyers actually ask: best AI video generator, cheapest clips, native audio, most models in one API — backed by published prices.'],
  ['/models', 'AI Video Models on ManifoldGen — Seedance, Wan, LTX & More', 'Every AI video and image model on ManifoldGen with prices, resolutions, audio support, and honest strengths. One API key, one credit balance, all models.'],
  ['/leaderboard', 'AI Video Model Leaderboard (2026) — Same Prompt, Every Model', 'We ran the exact same prompts through Manifold H3, Seedance 2, Seedance Fast, LTX 2 and Wan. Real generations, measured speed, per-category winners — watch every model fight on identical inputs.'],
  ['/blog', 'Blog — AI Video Guides and Prompt Craft', 'Practical guides for AI video: scripts to video, realism, TikTok content, documentaries, product shots, faceless channels, character consistency, and camera control — every example generated with ManifoldGen.'],
  ['/blog/guides', 'AI Creation Guides — ManifoldGen', 'Practical guides on making money with AI — faceless channels, ad pipelines, UGC, product photos — plus character consistency, AI personas, scene continuity, ComfyUI thinking, and directing agents.'],
  ['/blog/anime-styles', 'One Elf, 1000 Anime Styles — An Interactive Style Explorer', 'We took one prompt — aesthetic elf woman — and re-ran it 1000 times, changing only the style modifier: art movements, printmaking, retro games, subculture fashion, lighting grades. Browse every result with the exact prompt that made it.'],
  ['/api', 'API Documentation', 'Build image, native video, music, and AI voice generation into your product with the ManifoldGen API.'],
  ['/api/video-generators', 'Video Generator API Directory', 'Build with Manifold, Seedance, LTX, Wan, Happy Horse, and other video generators through one ManifoldGen API.'],
  ['/tool/animate-video', 'AI Character Animation Transfer', 'Use AI character animation to transfer body motion, facial expression, timing, and optional audio from a driving video onto a reference character with Wan Animate 2.'],
  ['/tool/image-editor', 'AI Image Editor | Object Selection and Inpainting', 'Upload or generate an image, split foreground and background into editable layers, select any object precisely, and regenerate only the selected area with AI.'],
];

for (const [route, title, description] of STATIC_METAS) {
  add(route, 'meta.title', title);
  add(route, 'meta.description', description);
}

// --- Use cases (/ai-video-generator/<slug>) — full editorial content.
for (const useCase of USE_CASES) {
  const route = `/ai-video-generator/${useCase.slug}`;
  add(route, 'h1', useCase.h1);
  add(route, 'title', useCase.title);
  add(route, 'metaDescription', useCase.metaDescription);
  add(route, 'intro', useCase.intro);
  add(route, 'audience', useCase.audience);
  useCase.workflow.forEach((step, i) => {
    add(route, `workflow.${i}.step`, step.step);
    add(route, `workflow.${i}.detail`, step.detail);
  });
  useCase.recommendedModels.forEach((rec, i) => add(route, `recommendedModels.${i}.why`, rec.why));
  useCase.faqs.forEach((faq, i) => {
    add(route, `faqs.${i}.q`, faq.q);
    add(route, `faqs.${i}.a`, faq.a);
  });
}

// --- Comparisons (/compare/<slug>) — editorial pages.
for (const comparison of COMPARISONS) {
  const route = `/compare/${comparison.slug}`;
  add(route, 'h1', comparison.h1);
  add(route, 'title', comparison.title);
  add(route, 'metaDescription', comparison.metaDescription);
  add(route, 'question', comparison.question);
  add(route, 'verdict', comparison.verdict);
  for (const side of ['a', 'b'] as const) {
    const data = comparison[side];
    add(route, `${side}.displayName`, data.displayName);
    data.bullets.forEach((bullet, i) => add(route, `${side}.bullets.${i}`, bullet));
  }
  comparison.specRows.forEach((row, i) => {
    add(route, `specRows.${i}.label`, row.label);
    add(route, `specRows.${i}.a`, row.a);
    add(route, `specRows.${i}.b`, row.b);
  });
  if (comparison.samePrompt) add(route, 'samePrompt.note', comparison.samePrompt.note);
  comparison.chooseA.forEach((line, i) => add(route, `chooseA.${i}`, line));
  comparison.chooseB.forEach((line, i) => add(route, `chooseB.${i}`, line));
  comparison.faqs.forEach((faq, i) => {
    add(route, `faqs.${i}.q`, faq.q);
    add(route, `faqs.${i}.a`, faq.a);
  });
}

// Benchmark pair pages build title/description from templates in the page file.
for (const pair of comparePairs()) {
  const route = `/compare/${pair.slug}`;
  add(route, 'meta.title', `${pair.a.name} vs ${pair.b.name}: Same Prompt, Real Generations`);
  add(route, 'meta.description', `We ran identical prompts through ${pair.a.name} and ${pair.b.name} on ManifoldGen and measured per-category winners. Watch every real generation and pick your model.`);
}

// --- Best topics + benchmark categories (/best/<slug>).
for (const topic of BEST_TOPICS) {
  const route = `/best/${topic.slug}`;
  add(route, 'question', topic.question);
  add(route, 'h1', topic.h1);
  add(route, 'title', topic.title);
  add(route, 'metaDescription', topic.metaDescription);
  add(route, 'directAnswer', topic.directAnswer);
  topic.evidence.forEach((item, i) => {
    add(route, `evidence.${i}.claim`, item.claim);
    add(route, `evidence.${i}.support`, item.support);
  });
  if (topic.table) {
    topic.table.columns.forEach((col, i) => add(route, `table.columns.${i}`, col));
    topic.table.rows.forEach((row, y) => row.forEach((cell, x) => add(route, `table.rows.${y}.${x}`, cell)));
  }
  topic.runnersUp?.forEach((line, i) => add(route, `runnersUp.${i}`, line));
  topic.faqs.forEach((faq, i) => {
    add(route, `faqs.${i}.q`, faq.q);
    add(route, `faqs.${i}.a`, faq.a);
  });
}

const CATEGORY_WINNER_NAMES: Record<string, string> = {
  manifold: 'Manifold H3', seedance: 'Seedance 2', 'seedance-fast': 'Seedance 2 Fast', 'ltx-2': 'LTX 2', wan: 'Wan',
};
for (const category of CATEGORIES) {
  const route = `/best/${category.key}`;
  add(route, 'label', category.label);
  add(route, 'tagline', category.tagline);
  Object.entries(category.why).forEach(([modelKey, why]) => add(route, `why.${modelKey}`, why));
  const winnerName = CATEGORY_WINNER_NAMES[category.ranking[0]] ?? category.ranking[0];
  add(route, 'meta.title', `Best AI Video Model for ${category.label} (2026) — Tested`);
  add(route, 'meta.description', `We ran the same ${category.label.toLowerCase()} prompt through Manifold H3, Seedance 2, LTX 2 and Wan. ${winnerName} wins — watch every generation and decide for yourself.`);
}

// --- Model directory pages (/models/<slug>).
for (const model of VIDEO_MODELS) {
  const route = `/models/${model.slug}`;
  add(route, 'tagline', model.tagline);
  add(route, 'description', model.description);
  add(route, 'priceFrom', model.priceFrom);
  add(route, 'verdictFor', model.verdictFor);
  model.bestFor.forEach((item, i) => add(route, `bestFor.${i}`, item));
  model.toolHrefs.forEach((href, i) => add(route, `toolHrefs.${i}.label`, href.label));
  add(route, 'meta.title', `${model.name} on ManifoldGen — ${model.tagline.split('.')[0]}`.slice(0, 65));
  add(route, 'meta.description', `${model.description.slice(0, 150)}…`);
}

// --- Tool workspaces (/tools/<slug>) + API directory entries.
for (const generator of VIDEO_GENERATORS) {
  const route = `/tools/${generator.slug}`;
  add(route, 'name', generator.name);
  add(route, 'description', generator.description);
  generator.strengths.forEach((strength, i) => add(route, `strengths.${i}`, strength));
  add(route, 'price', generator.price);
  add(route, 'meta.title', `${generator.name} AI Video Creator`);
  add(route, 'meta.description', `${generator.description} Create and edit AI video in ManifoldGen Studio.`);
  const apiRoute = `/api/video-generators/${generator.slug}`;
  add(apiRoute, 'meta.title', `${generator.name} API`);
  add(apiRoute, 'meta.description', `Generate ${generator.name} video through the ManifoldGen API. Includes request schema, tester, pricing, and editor handoff.`);
}
for (const control of VIDEO_CONTROL_TOOLS) {
  const route = `/tools/${control.slug}`;
  add(route, 'name', control.name);
  add(route, 'description', control.description);
  control.bestFor.forEach((item, i) => add(route, `bestFor.${i}`, item));
  add(route, 'meta.title', `${control.name} — AI Video Style Transfer`);
  add(route, 'meta.description', control.description);
}

// --- Curated search pages (/search/<slug>).
for (const page of CURATED_SEARCH_PAGES) {
  const route = `/search/${page.slug}`;
  add(route, 'title', page.title);
  add(route, 'blurb', page.blurb);
}

// --- Blog articles (/blog/<slug>).
function addArticleBlocks(route: string, blocks: readonly BlogBlock[] | undefined): void {
  blocks?.forEach((block, i) => {
    switch (block.type) {
      case 'p':
      case 'h2':
      case 'h3':
        add(route, `blocks.${i}.text`, block.text);
        break;
      case 'list':
        block.items.forEach((item: string, j: number) => add(route, `blocks.${i}.items.${j}`, item));
        break;
      case 'callout':
        add(route, `blocks.${i}.title`, block.title);
        add(route, `blocks.${i}.text`, block.text);
        break;
      case 'table':
        block.head.forEach((cell: string, j: number) => add(route, `blocks.${i}.head.${j}`, cell));
        block.rows.forEach((row: string[], y: number) => row.forEach((cell: string, x: number) => add(route, `blocks.${i}.rows.${y}.${x}`, cell)));
        break;
      case 'links':
        block.items.forEach((item: { label: string }, j: number) => add(route, `blocks.${i}.items.${j}.label`, item.label));
        break;
      case 'example':
        add(route, `blocks.${i}.example.label`, block.example.label);
        add(route, `blocks.${i}.example.note`, block.example.note);
        block.example.media.forEach((media: { caption?: string }, j: number) => {
          if (media.caption) add(route, `blocks.${i}.example.media.${j}.caption`, media.caption);
        });
        break;
    }
  });
}
for (const article of articles) {
  const route = `/blog/${article.slug}`;
  add(route, 'title', article.title);
  add(route, 'excerpt', article.excerpt);
  add(route, 'category', article.category);
  addArticleBlocks(route, article.blocks);
}

// --- Guides (/blog/guides/<slug>).
for (const guide of guides) {
  const route = `/blog/guides/${guide.slug}`;
  add(route, 'title', guide.title);
  add(route, 'excerpt', guide.excerpt);
  guide.blocks?.forEach((block: GuideBlock, i: number) => {
    switch (block.t) {
      case 'p':
      case 'h2':
      case 'h3':
        add(route, `blocks.${i}.text`, block.text);
        break;
      case 'list':
      case 'steps':
        block.items.forEach((item: string, j: number) => add(route, `blocks.${i}.items.${j}`, item));
        break;
      case 'prompt':
        add(route, `blocks.${i}.label`, block.label);
        break;
      case 'callout':
        add(route, `blocks.${i}.title`, block.title);
        add(route, `blocks.${i}.body`, block.body);
        break;
    }
  });
}

// --- Shared strings rendered across many routes (benchmark blurbs).
for (const model of BENCH_MODELS) {
  add('_shared', `benchModels.${model.key}.blurb`, model.blurb);
}

// --- Emit.
mkdirSync(OUT_DIR, { recursive: true });
const en = JSON.stringify(
  { _meta: { comment: 'Generated by scripts/i18n-extract.ts — do not hand-edit values; rerun the extractor.' }, routes },
  null,
  2,
) + '\n';
writeFileSync(join(OUT_DIR, 'en.json'), en);

const hashes: Record<string, string> = {};
for (const [route, strings] of Object.entries(routes)) {
  for (const [key, value] of Object.entries(strings)) {
    hashes[`${route}|${key}`] = createHash('sha1').update(value).digest('hex');
  }
}
writeFileSync(join(OUT_DIR, 'meta.json'), JSON.stringify(hashes, null, 2) + '\n');

const total = Object.values(routes).reduce((sum, strings) => sum + Object.keys(strings).length, 0);
console.log(`en.json: ${Object.keys(routes).length} routes, ${total} strings`);
