import { writeFileSync } from 'node:fs';
import { USE_CASES } from '../lib/seo/usecases';
import { COMPARISONS } from '../lib/seo/comparisons';
import { BEST_TOPICS } from '../lib/seo/best-topics';
import { VIDEO_MODELS } from '../lib/seo/models';
import { CATEGORIES, comparePairs } from '../lib/seo/benchmarks';
import { articles } from '../app/blog/articles';
import { guides } from '../app/blog/guides/registry';

const routes = [...new Set([
  '/ai-video-generator',
  ...USE_CASES.map((useCase) => `/ai-video-generator/${useCase.slug}`),
  '/compare',
  ...comparePairs().map((pair) => `/compare/${pair.slug}`),
  ...COMPARISONS.map((comparison) => `/compare/${comparison.slug}`),
  '/best',
  ...CATEGORIES.map((category) => `/best/${category.key}`),
  ...BEST_TOPICS.map((topic) => `/best/${topic.slug}`),
  '/models',
  ...VIDEO_MODELS.map((model) => `/models/${model.slug}`),
  '/leaderboard',
  ...articles.map((article) => `/blog/${article.slug}`),
  ...guides.map((guide) => `/blog/guides/${guide.slug}`),
])];

writeFileSync(
  new URL('../public/seo-routes.json', import.meta.url),
  JSON.stringify({ routes }, null, 2) + '\n',
);
console.log(`seo-routes.json: ${routes.length} routes`);
